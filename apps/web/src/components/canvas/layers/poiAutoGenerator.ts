/**
 * Auto-generate POIs matching district type on district placement (CITY-345).
 *
 * When a district is placed, generates 1-3 appropriate POIs inside the polygon
 * at plausible, spread-out locations. The user can delete or move them afterward.
 */

import type { Point, POI, POIType, DistrictType } from "./types";
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
    { type: "civic", namePool: ["Medical Office Building", "Health Sciences Library", "Research Pavilion", "Urgent Care Clinic"] },
  ],
  downtown: [
    { type: "civic", namePool: ["City Hall", "Municipal Building", "Civic Center", "County Courthouse"] },
    { type: "shopping", namePool: ["Main Street Shops", "Downtown Market", "Central Plaza", "The Galleria"] },
    { type: "transit", namePool: ["Central Station", "Downtown Transit Hub", "Bus Terminal", "Metro Station"] },
  ],
  university: [
    { type: "university", namePool: ["Main Campus Hall", "University Hall", "Administration Building", "Founders Hall"] },
    { type: "civic", namePool: ["University Library", "Student Union", "Campus Commons", "Recreation Center"] },
  ],
  industrial: [
    { type: "industrial", namePool: ["Manufacturing Plant", "Assembly Factory", "Production Facility", "Processing Plant"] },
    { type: "industrial", namePool: ["Distribution Warehouse", "Logistics Center", "Freight Terminal", "Shipping Depot"] },
  ],
  k12: [
    { type: "school", namePool: ["Elementary School", "Primary School", "Middle School", "Academy", "Preparatory School"] },
    { type: "park", namePool: ["School Playground", "Athletic Field", "Sports Complex"] },
  ],
  residential: [
    { type: "park", namePool: ["Community Park", "Pocket Park", "Playground", "Dog Park", "Neighborhood Green"] },
    { type: "shopping", namePool: ["Corner Store", "Neighborhood Cafe", "Bakery", "Mini Mart"] },
  ],
  commercial: [
    { type: "shopping", namePool: ["Shopping Center", "Retail Plaza", "Town Center", "Marketplace"] },
    { type: "civic", namePool: ["Office Park", "Business Center", "Professional Building", "Corporate Campus"] },
  ],
};

/**
 * How many POIs to generate per district type.
 * Range [min, max] -- actual count is randomly selected within this range.
 */
const POI_COUNT_RANGE: Partial<Record<DistrictType, [number, number]>> = {
  hospital: [1, 2],
  downtown: [2, 3],
  university: [1, 2],
  industrial: [1, 2],
  k12: [1, 2],
  residential: [1, 2],
  commercial: [2, 3],
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
 * Generate candidate positions inside a polygon that are well-spread-out.
 *
 * Uses rejection sampling: pick random points inside the bounding box,
 * keep those that pass point-in-polygon and minimum-spacing checks.
 *
 * @param polygon - Polygon vertices
 * @param count - Number of positions to generate
 * @param rng - Seeded random instance
 * @returns Array of points inside the polygon
 */
function generateSpreadPositions(
  polygon: Point[],
  count: number,
  rng: SeededRandom
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

  const positions: Point[] = [];
  const maxAttempts = count * 50; // Generous limit to avoid infinite loops
  let attempts = 0;

  while (positions.length < count && attempts < maxAttempts) {
    attempts++;

    const candidate: Point = {
      x: sampleMinX + rng.next() * (sampleMaxX - sampleMinX),
      y: sampleMinY + rng.next() * (sampleMaxY - sampleMinY),
    };

    // Must be inside the polygon
    if (!pointInPolygon(candidate, polygon)) continue;

    // Must be far enough from all existing positions
    const tooClose = positions.some((existing) => {
      const dx = candidate.x - existing.x;
      const dy = candidate.y - existing.y;
      return Math.sqrt(dx * dx + dy * dy) < MIN_POI_SPACING;
    });
    if (tooClose) continue;

    positions.push(candidate);
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
 * @returns Array of POI objects ready to be added via addPOI / bulk create
 */
export function generatePOIsForDistrict(
  districtType: DistrictType,
  polygon: Point[],
  _districtName: string
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

  // Generate spread-out positions inside the polygon
  const positions = generateSpreadPositions(polygon, count, rng);

  // Build POI objects
  const pois: POI[] = [];
  for (let i = 0; i < Math.min(selected.length, positions.length); i++) {
    const template = selected[i];
    const name = rng.pick(template.namePool);

    pois.push({
      id: generateId("poi"),
      name,
      type: template.type,
      position: positions[i],
    });
  }

  return pois;
}
