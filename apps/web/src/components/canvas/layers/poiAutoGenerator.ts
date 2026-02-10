/**
 * Auto-generate POIs matching district type on district placement (CITY-345).
 *
 * When a district is placed, generates 1-3 appropriate POIs inside the polygon
 * at plausible, spread-out locations. The user can delete or move them afterward.
 */

import type { Point, POI, POIType, DistrictType, Road } from "./types";
import { pointInPolygon, getPolygonBounds } from "./polygonUtils";
import { generateId } from "../../../utils/idGenerator";

// ============================================================================
// Contextual name generation (CITY-416)
// ============================================================================

/**
 * Context prefixes drawn from nature, geography, and neighborhood vocabulary.
 * Combined with type-specific suffixes to produce place-appropriate names
 * like "Maple Cafe", "Harbor Market", "Ridgeview Library".
 */
const CONTEXT_PREFIXES = [
  // Nature / trees
  "Oak", "Maple", "Cedar", "Pine", "Elm", "Birch", "Willow", "Aspen",
  "Laurel", "Magnolia", "Hazel", "Alder", "Spruce", "Cypress", "Ivy",
  // Geographic features
  "Harbor", "Riverside", "Hilltop", "Valley", "Lakeside", "Ridge",
  "Brookside", "Meadow", "Bayview", "Clearwater", "Summit", "Crestview",
  // Neighborhood feel
  "Eastside", "Northgate", "Westfield", "Southport", "Parkside",
  "Greenfield", "Fairview", "Highland", "Stonegate", "Rosewood",
  // Atmospheric / misc
  "Sunset", "Beacon", "Golden", "Silver", "Ironside", "Cornerstone",
];

/**
 * Suffixes for each POI type. The generator picks a prefix + suffix
 * to form names like "Cedar Hospital" or "Bayview Market".
 */
const TYPE_SUFFIXES: Partial<Record<POIType, string[]>> = {
  hospital: ["Hospital", "Medical Center", "Health Center", "Clinic", "Care Center"],
  shopping: ["Market", "Cafe", "Bakery", "Deli", "Grocery", "Bistro", "Shop", "Eatery"],
  civic: ["Community Center", "Library", "Center", "Plaza", "Hall"],
  university: ["Hall", "Building", "Center", "Institute", "Pavilion"],
  school: ["School", "Academy", "Preparatory", "Learning Center"],
  industrial: ["Works", "Facility", "Plant", "Warehouse", "Depot"],
  transit: ["Station", "Terminal", "Hub", "Stop"],
  park: ["Park", "Gardens", "Green", "Commons"],
};

/**
 * Generate a contextual name for a POI by combining a context prefix with
 * a type-appropriate suffix.  Avoids names already in `usedNames`.
 */
function generateContextualName(
  poiType: POIType,
  rng: SeededRandom,
  usedNames: Set<string>,
  roadNames?: string[],
): string {
  const suffixes = TYPE_SUFFIXES[poiType] ?? ["Place"];
  const suffix = rng.pick(suffixes);

  // If nearby road names are available, try to use one as the prefix
  const prefixPool = roadNames && roadNames.length > 0
    ? [...roadNames, ...CONTEXT_PREFIXES]
    : CONTEXT_PREFIXES;

  // Try up to 10 combinations to find an unused name
  for (let attempt = 0; attempt < 10; attempt++) {
    const prefix = rng.pick(prefixPool);
    const name = `${prefix} ${suffix}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  // Fallback: just pick and accept potential duplicate (extremely unlikely
  // given pool sizes)
  const name = `${rng.pick(prefixPool)} ${rng.pick(suffixes)}`;
  usedNames.add(name);
  return name;
}

// ============================================================================
// Transit-oriented POI names (CITY-428)
// ============================================================================

/**
 * Names for transit-type POIs generated near placed transit stations.
 * Combined with a context prefix to form names like "Maple Transit Plaza".
 */
const TRANSIT_POI_NAMES = [
  "Transit Plaza",
  "Bus Terminal",
  "Park & Ride",
  "Metro Entrance",
  "Commuter Lot",
];

// ============================================================================
// District type -> POI type mapping
// ============================================================================

/**
 * Mapping from district type to the set of POI types that should be
 * auto-generated when that district type is placed.
 *
 * District types not listed here will not generate POIs.
 */
const DISTRICT_POI_TYPES: Partial<Record<DistrictType, POIType[]>> = {
  hospital: ["hospital", "civic"],
  downtown: ["civic", "shopping", "civic"],
  university: ["university", "university", "civic"],
  industrial: ["industrial", "industrial"],
  k12: ["school", "civic"],
  residential: ["shopping", "civic"],
  commercial: ["shopping", "civic", "shopping"],
  airport: ["transit", "shopping"],
  park: ["park", "civic"],
};

/**
 * How many POIs to generate per district type.
 * Range [min, max] -- actual count is randomly selected within this range.
 */
const POI_COUNT_RANGE: Partial<Record<DistrictType, [number, number]>> = {
  hospital: [1, 2],
  downtown: [2, 3],
  university: [2, 3],
  industrial: [1, 2],
  k12: [1, 2],
  residential: [1, 2],
  commercial: [2, 3],
  airport: [1, 2],
  park: [1, 2],
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
// Footprint generation (CITY-440, CITY-441, CITY-442)
// ============================================================================

/**
 * Campus/compound footprint configs by POI type.
 *
 * - baseRadius: average radius of the organic polygon in world units
 * - numPoints: number of vertices for the polygon boundary
 * - organicFactor: 0-1 controlling how much radial/angular variation (higher = more organic)
 * - elongation: >1 stretches horizontally, <1 stretches vertically (1 = circular)
 */
interface FootprintConfig {
  baseRadius: number;
  numPoints: number;
  organicFactor: number;
  elongation: number;
}

const FOOTPRINT_CONFIGS: Partial<Record<POIType, FootprintConfig>> = {
  university: { baseRadius: 5.0, numPoints: 14, organicFactor: 0.35, elongation: 1.2 },
  hospital:   { baseRadius: 3.5, numPoints: 10, organicFactor: 0.25, elongation: 1.1 },
  shopping:   { baseRadius: 2.5, numPoints: 8,  organicFactor: 0.2,  elongation: 1.3 },
};

/**
 * Generate an organic polygon footprint for campus/compound POI types.
 *
 * Returns `undefined` for POI types that don't get footprints (civic, transit,
 * park, school, industrial). For university/hospital/shopping, generates an
 * organic polygon with radial variation — modeled on park polygon generation.
 *
 * @param type - POI type
 * @param position - Center position of the POI
 * @returns Array of polygon points, or undefined if type has no footprint
 */
export function generatePOIFootprint(
  type: POIType,
  position: Point,
): Point[] | undefined {
  const config = FOOTPRINT_CONFIGS[type];
  if (!config) return undefined;

  // Seed from position for determinism
  const seed = Math.floor(position.x * 1000 + position.y * 7919 + type.charCodeAt(0) * 31);
  const rng = new SeededRandom(seed);

  const { baseRadius, numPoints, organicFactor, elongation } = config;

  // Random rotation so campuses aren't all axis-aligned
  const rotationAngle = rng.next() * Math.PI * 2;

  // Slight size variation per instance
  const radiusScale = 0.85 + rng.next() * 0.3; // 0.85 to 1.15

  const points: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;

    // Radial variation for organic boundary
    const radiusVariation = 1 - organicFactor / 2 + rng.next() * organicFactor;
    const radius = baseRadius * radiusScale * radiusVariation;

    // Angular offset for organic feel
    const angleOffset = (rng.next() - 0.5) * organicFactor * (Math.PI / numPoints) * 1.5;
    const finalAngle = angle + angleOffset;

    // Apply elongation (stretch along one axis) then rotate
    const rawX = Math.cos(finalAngle) * radius * elongation;
    const rawY = Math.sin(finalAngle) * radius;

    // Rotate by the random angle
    const rotatedX = rawX * Math.cos(rotationAngle) - rawY * Math.sin(rotationAngle);
    const rotatedY = rawX * Math.sin(rotationAngle) + rawY * Math.cos(rotationAngle);

    points.push({
      x: position.x + rotatedX,
      y: position.y + rotatedY,
    });
  }

  return points;
}

// ============================================================================
// Campus internal path generation (CITY-441, CITY-442)
// ============================================================================

/**
 * Path density configs by POI type.
 * numPaths: base number of internal paths to generate.
 * Campus POIs (university, hospital) get internal trail-class paths;
 * shopping compounds don't get paths.
 */
const CAMPUS_PATH_CONFIGS: Partial<Record<POIType, { numPaths: number }>> = {
  university: { numPaths: 4 },
  hospital:   { numPaths: 2 },
};

/**
 * Check if a point is inside a convex-ish polygon using ray casting.
 * (Local copy to avoid circular dependency on polygonUtils.)
 */
function pointInsidePolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Generate internal campus paths (walkways) within a POI footprint polygon.
 *
 * Creates trail-class roads that run through the campus, from near the edge
 * toward the center. Path shape uses curved waypoints for a natural look,
 * following the same pattern as park internal path generation.
 *
 * @param footprint - The campus footprint polygon
 * @param position - Center position of the POI
 * @param poiType - Type of POI (determines path count)
 * @param poiId - POI ID used for generating path IDs
 * @returns Array of trail-class Road objects
 */
export function generateCampusPaths(
  footprint: Point[],
  position: Point,
  poiType: POIType,
  poiId: string,
): Road[] {
  const config = CAMPUS_PATH_CONFIGS[poiType];
  if (!config || footprint.length < 3) return [];

  // Seed from position for determinism
  const seed = Math.floor(position.x * 1000 + position.y * 7919 + poiType.charCodeAt(0) * 31 + 17);
  const rng = new SeededRandom(seed);

  // Estimate radius from footprint for path generation
  const maxDist = Math.max(...footprint.map(
    p => Math.sqrt((p.x - position.x) ** 2 + (p.y - position.y) ** 2)
  ));
  const avgRadius = maxDist * 0.8;

  const paths: Road[] = [];

  for (let i = 0; i < config.numPaths; i++) {
    // Generate path from near edge to near center (or across)
    const startAngle = rng.next() * Math.PI * 2;
    const endAngle = startAngle + (0.5 + rng.next()) * Math.PI; // 90-270 degrees apart

    const startRadius = avgRadius * (0.6 + rng.next() * 0.3);
    const endRadius = avgRadius * (0.2 + rng.next() * 0.4);

    const start: Point = {
      x: position.x + Math.cos(startAngle) * startRadius,
      y: position.y + Math.sin(startAngle) * startRadius,
    };

    const end: Point = {
      x: position.x + Math.cos(endAngle) * endRadius,
      y: position.y + Math.sin(endAngle) * endRadius,
    };

    // Skip if start or end falls outside the footprint
    if (!pointInsidePolygon(start, footprint) || !pointInsidePolygon(end, footprint)) {
      continue;
    }

    // Build curved path with 1-2 intermediate waypoints
    const pathPoints: Point[] = [start];

    const numWaypoints = 1 + Math.floor(rng.next() * 2); // 1 or 2
    for (let j = 0; j < numWaypoints; j++) {
      const t = (j + 1) / (numWaypoints + 1);
      const midX = start.x + (end.x - start.x) * t;
      const midY = start.y + (end.y - start.y) * t;

      // Perpendicular offset for curve
      const perpX = -(end.y - start.y);
      const perpY = end.x - start.x;
      const perpLen = Math.sqrt(perpX * perpX + perpY * perpY);
      if (perpLen === 0) continue;

      const offset = (rng.next() - 0.5) * avgRadius * 0.3;

      const waypoint: Point = {
        x: midX + (perpX / perpLen) * offset,
        y: midY + (perpY / perpLen) * offset,
      };

      if (pointInsidePolygon(waypoint, footprint)) {
        pathPoints.push(waypoint);
      }
    }

    pathPoints.push(end);

    if (pathPoints.length >= 2) {
      paths.push({
        id: generateId(`${poiId}-path-${i}`),
        roadClass: "trail",
        line: { points: pathPoints },
        name: i === 0 ? "Main Walk" : "Campus Walk",
      });
    }
  }

  return paths;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Result of generating POIs for a district.
 * Includes both the POI objects and any campus paths (trail roads)
 * generated inside campus-type POI footprints.
 */
export interface GeneratedDistrictPOIs {
  pois: POI[];
  campusPaths: Road[];
}

/**
 * Auto-generate POIs for a newly placed district.
 *
 * For campus-type POIs (university, hospital), also generates internal
 * trail-class paths within the footprint polygon (CITY-441, CITY-442).
 *
 * @param districtType - The type of district being placed
 * @param polygon - The district polygon vertices
 * @param _districtName - District name (reserved, not used in naming)
 * @param roads - Optional roads within/near the district; POIs prefer road-adjacent locations (CITY-406)
 * @param existingPOIs - Existing POIs to avoid overlapping with (CITY-409)
 * @returns Object with POI array and campus path roads
 */
export function generatePOIsForDistrict(
  districtType: DistrictType,
  polygon: Point[],
  _districtName: string,
  roads?: Road[],
  existingPOIs?: POI[]
): GeneratedDistrictPOIs {
  const poiTypes = DISTRICT_POI_TYPES[districtType];
  if (!poiTypes || poiTypes.length === 0) return { pois: [], campusPaths: [] };

  const countRange = POI_COUNT_RANGE[districtType] ?? [1, 2];

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

  // Shuffle the available types and take `count` of them
  const shuffled = rng.shuffle(poiTypes);
  const selected = shuffled.slice(0, count);

  // Generate spread-out positions, preferring road-adjacent spots and avoiding existing POIs
  const existingPositions = existingPOIs?.map((p) => p.position);
  const positions = generateSpreadPositions(polygon, count, rng, roads, existingPositions);

  // Extract road names for contextual naming
  const roadNames = roads
    ?.map((r) => r.name)
    .filter((n): n is string => !!n)
    ?? [];

  // Build POI objects with contextual names, plus campus paths
  const usedNames = new Set<string>();
  const pois: POI[] = [];
  const campusPaths: Road[] = [];

  for (let i = 0; i < Math.min(selected.length, positions.length); i++) {
    const poiType = selected[i];
    const name = generateContextualName(poiType, rng, usedNames, roadNames);
    const poiId = generateId("poi");
    const footprint = generatePOIFootprint(poiType, positions[i]);

    pois.push({
      id: poiId,
      name,
      type: poiType,
      position: positions[i],
      footprint,
    });

    // Generate campus paths inside the footprint (CITY-441, CITY-442)
    if (footprint && footprint.length >= 3) {
      const paths = generateCampusPaths(footprint, positions[i], poiType, poiId);
      campusPaths.push(...paths);
    }
  }

  return { pois, campusPaths };
}

// ============================================================================
// Transit station POI generation (CITY-428)
// ============================================================================

/**
 * Minimum distance between transit POIs and existing POIs (in world units).
 * Matches the overlap prevention threshold used elsewhere.
 */
const TRANSIT_POI_MIN_SPACING = 80;

/**
 * Range for how far a transit POI is offset from the station (in world units).
 */
const TRANSIT_POI_OFFSET_MIN = 50;
const TRANSIT_POI_OFFSET_MAX = 100;

/**
 * Generate 1-2 transit-oriented POIs near a placed transit station.
 *
 * @param stationPosition - Position of the placed station
 * @param stationName - Name of the station (used for seed derivation)
 * @param districtPolygon - Polygon points of the containing district
 * @param existingPOIs - Existing POIs to avoid overlapping with
 * @returns Array of POI objects ready to be added
 */
export function generateTransitPOIs(
  stationPosition: Point,
  stationName: string,
  districtPolygon: Point[],
  existingPOIs: POI[]
): POI[] {
  // Derive a seed from the station position and name for determinism
  const nameSeed = stationName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = Math.floor(stationPosition.x * 1000 + stationPosition.y * 7919 + nameSeed);
  const rng = new SeededRandom(seed);

  // Generate 1-2 POIs
  const count = rng.intRange(1, 3); // 1 or 2

  const usedNames = new Set<string>(existingPOIs.map((p) => p.name));
  const existingPositions = existingPOIs.map((p) => p.position);
  const pois: POI[] = [];

  for (let i = 0; i < count; i++) {
    // Pick a transit POI name, combined with a context prefix
    let name: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const transitName = rng.pick(TRANSIT_POI_NAMES);
      const prefix = rng.pick(CONTEXT_PREFIXES);
      const candidate = `${prefix} ${transitName}`;
      if (!usedNames.has(candidate)) {
        usedNames.add(candidate);
        name = candidate;
        break;
      }
    }
    if (!name) {
      // Fallback: accept potential duplicate (extremely unlikely)
      name = `${rng.pick(CONTEXT_PREFIXES)} ${rng.pick(TRANSIT_POI_NAMES)}`;
      usedNames.add(name);
    }

    // Generate a position offset from the station, within the district polygon
    let position: Point | null = null;
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Random angle and distance
      const angle = rng.next() * Math.PI * 2;
      const dist = TRANSIT_POI_OFFSET_MIN + rng.next() * (TRANSIT_POI_OFFSET_MAX - TRANSIT_POI_OFFSET_MIN);
      const candidate: Point = {
        x: stationPosition.x + Math.cos(angle) * dist,
        y: stationPosition.y + Math.sin(angle) * dist,
      };

      // Must be inside the district polygon
      if (!pointInPolygon(candidate, districtPolygon)) continue;

      // Must be far enough from all existing POIs and previously generated ones
      const allPositions = [...existingPositions, ...pois.map((p) => p.position)];
      const tooClose = allPositions.some((existing) => {
        const dx = candidate.x - existing.x;
        const dy = candidate.y - existing.y;
        return Math.sqrt(dx * dx + dy * dy) < TRANSIT_POI_MIN_SPACING;
      });
      if (tooClose) continue;

      position = candidate;
      break;
    }

    // If no valid position found, skip this POI
    if (!position) continue;

    pois.push({
      id: generateId("poi"),
      name,
      type: "transit" as POIType,
      position,
    });
  }

  return pois;
}
