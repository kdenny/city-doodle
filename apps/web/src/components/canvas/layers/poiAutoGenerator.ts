/**
 * Auto-generate POIs matching district type on district placement (CITY-345).
 *
 * When a district is placed, generates 2-5 appropriate POIs inside the polygon
 * at plausible, spread-out locations. The user can delete or move them afterward.
 */

import type { Point, POI, POIType, DistrictType, Road } from "./types";
import { pointInPolygon, getPolygonBounds } from "./polygonUtils";
import { generateId } from "../../../utils/idGenerator";

// ============================================================================
// District type -> POI type mapping
// ============================================================================

/**
 * POI template: a POI type paired with a display-name pattern.
 * The `namePool` provides a set of plausible names to pick from.
 */
interface POITemplate {
  type: POIType;
  namePool: string[];
}

/**
 * Mapping from district type to the set of POI templates that should be
 * auto-generated when that district type is placed.
 *
 * District types that should NOT generate POIs (e.g., park, airport) are
 * omitted and will return an empty array.
 */
const DISTRICT_POI_TEMPLATES: Partial<Record<DistrictType, POITemplate[]>> = {
  hospital: [
    { type: "hospital", namePool: ["General Hospital", "Memorial Hospital", "City Medical Center", "Regional Hospital", "Community Hospital"] },
    { type: "hospital", namePool: ["Urgent Care Clinic", "Family Health Clinic", "Specialty Clinic", "Outpatient Clinic", "Walk-In Clinic"] },
    { type: "civic", namePool: ["Medical Office Building", "Health Sciences Library", "Research Pavilion"] },
  ],
  downtown: [
    { type: "civic", namePool: ["City Hall", "Municipal Building", "Civic Center", "Government Center", "County Courthouse"] },
    { type: "shopping", namePool: ["Main Street Shops", "Downtown Market", "Central Plaza", "Market Square", "The Galleria"] },
    { type: "shopping", namePool: ["Downtown Restaurant Row", "Bistro District", "Dining Quarter", "Food Hall", "Culinary Corner"] },
    { type: "civic", namePool: ["Public Library", "Community Center", "Arts Center", "Cultural Center"] },
    { type: "transit", namePool: ["Central Station", "Downtown Transit Hub", "Bus Terminal", "Metro Station"] },
  ],
  university: [
    { type: "university", namePool: ["Main Campus Hall", "University Hall", "Administration Building", "Academic Center", "Founders Hall"] },
    { type: "university", namePool: ["Science Building", "Engineering Hall", "Arts & Humanities Building", "Business School", "Law School"] },
    { type: "civic", namePool: ["University Library", "Campus Library", "Research Library", "Academic Library"] },
    { type: "civic", namePool: ["Student Union", "Student Center", "Campus Commons", "Recreation Center"] },
  ],
  industrial: [
    { type: "industrial", namePool: ["Manufacturing Plant", "Assembly Factory", "Production Facility", "Processing Plant", "Industrial Works"] },
    { type: "industrial", namePool: ["Distribution Warehouse", "Logistics Center", "Storage Facility", "Freight Terminal", "Shipping Depot"] },
    { type: "industrial", namePool: ["Industrial Park Office", "Tech Workshop", "Research Lab", "Fabrication Shop"] },
  ],
  k12: [
    { type: "school", namePool: ["Elementary School", "Primary School", "Grade School", "Academy", "Preparatory School"] },
    { type: "school", namePool: ["Middle School", "Junior High", "Intermediate School"] },
    { type: "civic", namePool: ["School Library", "Gymnasium", "Athletic Complex", "Performing Arts Center"] },
  ],
  residential: [
    { type: "shopping", namePool: ["Corner Store", "Neighborhood Market", "Mini Mart", "Convenience Store", "Local Grocery"] },
    { type: "shopping", namePool: ["Coffee Shop", "Neighborhood Cafe", "Bakery", "Deli & Cafe", "Tea House"] },
    { type: "civic", namePool: ["Community Park", "Pocket Park", "Playground", "Dog Park"] },
  ],
  commercial: [
    { type: "shopping", namePool: ["Shopping Center", "Retail Plaza", "Commercial Center", "Strip Mall", "Town Center"] },
    { type: "shopping", namePool: ["Grocery Store", "Department Store", "Outlet Mall", "Marketplace"] },
    { type: "civic", namePool: ["Office Park", "Business Center", "Professional Building", "Corporate Campus"] },
    { type: "shopping", namePool: ["Food Court", "Restaurant Row", "Dining District", "Eatery Plaza"] },
  ],
};

/**
 * How many POIs to generate per district type.
 * Range [min, max] -- actual count is randomly selected within this range.
 */
const POI_COUNT_RANGE: Partial<Record<DistrictType, [number, number]>> = {
  hospital: [2, 3],
  downtown: [3, 5],
  university: [3, 4],
  industrial: [2, 3],
  k12: [2, 3],
  residential: [2, 3],
  commercial: [3, 4],
};

// ============================================================================
// Simple seeded random (matches codebase pattern)
// ============================================================================

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  intRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  pick<T>(arr: T[]): T {
    return arr[this.intRange(0, arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.intRange(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// ============================================================================
// Position generation
// ============================================================================

/**
 * Minimum distance between generated POIs (in world units) to ensure spread.
 */
const MIN_POI_SPACING = 1.5;

/**
 * Inset margin from polygon edges (fraction of bounding-box dimension).
 * Keeps POIs from sitting right on the boundary.
 */
const EDGE_INSET_FRACTION = 0.15;

/**
 * Distance from a point to the nearest point on a line segment.
 */
function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = point.x - a.x;
    const ey = point.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Minimum distance from a point to any road segment.
 */
function distanceToNearestRoad(point: Point, roads: Road[]): number {
  let minDist = Infinity;
  for (const road of roads) {
    const pts = road.line.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const dist = pointToSegmentDistance(point, pts[i], pts[i + 1]);
      if (dist < minDist) minDist = dist;
    }
  }
  return minDist;
}

/**
 * Generate candidate positions inside a polygon that are well-spread-out.
 *
 * Uses rejection sampling: pick random points inside the bounding box,
 * keep those that pass point-in-polygon and minimum-spacing checks.
 * When roads are provided, prefers road-adjacent positions (CITY-406).
 *
 * @param polygon - Polygon vertices
 * @param count - Number of positions to generate
 * @param rng - Seeded random instance
 * @param roads - Optional roads to bias placement toward
 * @param existingPositions - Positions of existing POIs to avoid overlapping (CITY-409)
 * @returns Array of points inside the polygon
 */
function generateSpreadPositions(
  polygon: Point[],
  count: number,
  rng: SeededRandom,
  roads?: Road[],
  existingPositions?: Point[]
): Point[] {
  const bounds = getPolygonBounds(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  // Inset the sampling area slightly from the edges
  const insetX = width * EDGE_INSET_FRACTION;
  const insetY = height * EDGE_INSET_FRACTION;
  const sampleMinX = bounds.minX + insetX;
  const sampleMaxX = bounds.maxX - insetX;
  const sampleMinY = bounds.minY + insetY;
  const sampleMaxY = bounds.maxY - insetY;

  // Filter to non-trail roads with at least 2 points for proximity checks
  const validRoads = roads?.filter((r) => r.roadClass !== "trail" && r.line.points.length >= 2) ?? [];

  const positions: Point[] = [];
  const maxAttempts = count * 50; // Generous limit to avoid infinite loops
  let attempts = 0;

  // When roads are available, generate extra candidates and pick the best
  // (closest to a road) from each batch. This biases POIs toward streets
  // without requiring them to be exactly on a road.
  const batchSize = validRoads.length > 0 ? 5 : 1;

  while (positions.length < count && attempts < maxAttempts) {
    const batch: Point[] = [];

    for (let b = 0; b < batchSize && attempts < maxAttempts; b++) {
      attempts++;

      const candidate: Point = {
        x: sampleMinX + rng.next() * (sampleMaxX - sampleMinX),
        y: sampleMinY + rng.next() * (sampleMaxY - sampleMinY),
      };

      // Must be inside the polygon
      if (!pointInPolygon(candidate, polygon)) continue;

      // Must be far enough from all new positions and existing POIs (CITY-409)
      const allPositions = existingPositions ? [...positions, ...existingPositions] : positions;
      const tooClose = allPositions.some((existing) => {
        const dx = candidate.x - existing.x;
        const dy = candidate.y - existing.y;
        return Math.sqrt(dx * dx + dy * dy) < MIN_POI_SPACING;
      });
      if (tooClose) continue;

      batch.push(candidate);
    }

    if (batch.length === 0) continue;

    if (validRoads.length > 0 && batch.length > 1) {
      // Pick the candidate closest to a road
      let bestCandidate = batch[0];
      let bestDist = distanceToNearestRoad(batch[0], validRoads);
      for (let i = 1; i < batch.length; i++) {
        const dist = distanceToNearestRoad(batch[i], validRoads);
        if (dist < bestDist) {
          bestDist = dist;
          bestCandidate = batch[i];
        }
      }
      positions.push(bestCandidate);
    } else {
      positions.push(batch[0]);
    }
  }

  return positions;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Auto-generate POIs for a newly placed district.
 *
 * @param districtType - The type of district being placed
 * @param polygon - The district polygon vertices
 * @param districtName - Name of the district (used as prefix context for POI naming)
 * @param roads - Optional roads within/near the district; POIs prefer road-adjacent locations (CITY-406)
 * @param existingPOIs - Existing POIs to avoid overlapping with (CITY-409)
 * @returns Array of POI objects ready to be added via addPOI / bulk create
 */
export function generatePOIsForDistrict(
  districtType: DistrictType,
  polygon: Point[],
  _districtName: string,
  roads?: Road[],
  existingPOIs?: POI[]
): POI[] {
  const templates = DISTRICT_POI_TEMPLATES[districtType];
  if (!templates || templates.length === 0) return [];

  const countRange = POI_COUNT_RANGE[districtType] ?? [2, 3];

  // Derive a seed from the district polygon centroid for determinism when
  // the same position is used. Uses the same pattern as districtGenerator.
  const centroid = polygon.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  centroid.x /= polygon.length;
  centroid.y /= polygon.length;
  const seed = Math.floor(centroid.x * 1000 + centroid.y * 7919);
  const rng = new SeededRandom(seed);

  // Determine how many POIs to generate
  const count = rng.intRange(countRange[0], countRange[1] + 1);

  // Shuffle templates and take `count` of them
  const shuffled = rng.shuffle(templates);
  const selected = shuffled.slice(0, count);

  // Generate spread-out positions, preferring road-adjacent spots and avoiding existing POIs
  const existingPositions = existingPOIs?.map((p) => p.position);
  const positions = generateSpreadPositions(polygon, count, rng, roads, existingPositions);

  // Build POI objects, tracking used names to avoid duplicates (CITY-414)
  const usedNames = new Set<string>();
  const pois: POI[] = [];
  for (let i = 0; i < Math.min(selected.length, positions.length); i++) {
    const template = selected[i];

    // Pick an unused name from the pool; fall back to first unused or skip
    const available = template.namePool.filter((n) => !usedNames.has(n));
    if (available.length === 0) continue;
    const name = rng.pick(available);
    usedNames.add(name);

    pois.push({
      id: generateId("poi"),
      name,
      type: template.type,
      position: positions[i],
    });
  }

  return pois;
}
