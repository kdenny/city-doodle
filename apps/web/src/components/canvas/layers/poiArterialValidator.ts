/**
 * POI arterial adjacency validation and auto-generation (CITY-149)
 *
 * Enforces that certain POIs (hospitals, universities, airports, train stations,
 * large shopping centers) must be placed adjacent to arterial roads.
 * If not adjacent, auto-generates arterial roads to connect them.
 *
 * Adjacency definition:
 * - POI is "adjacent to arterial" if within 50m (about 0.5 world units) of an arterial road
 */

import type { Point, Road, District, POIType, WaterFeature } from "./types";

/**
 * Maximum distance in world units for a POI to be considered "adjacent" to an arterial.
 * 50 meters ≈ 0.48 world units (768 units = 50 miles = 80,467 meters)
 */
const ARTERIAL_ADJACENCY_DISTANCE = 0.5;

/**
 * Maximum number of arterial roads that can be auto-generated per POI placement.
 */
const MAX_ARTERIALS_PER_POI = 3;

/**
 * Maximum distance to search for districts to connect (about 10 miles).
 */
const MAX_CONNECTION_DISTANCE = 150;

/**
 * POI types that require adjacency to an arterial road.
 */
const POI_TYPES_REQUIRING_ARTERIAL: POIType[] = [
  "hospital",
  "university",
  "shopping", // Large shopping centers
];

/**
 * District types that should be treated as POIs requiring arterial adjacency.
 * These are placed as districts but have the same arterial requirements.
 */
export const DISTRICT_TYPES_REQUIRING_ARTERIAL = [
  "hospital",
  "university",
  "airport",
] as const;

/**
 * Check if a POI type requires adjacency to an arterial road.
 */
export function requiresArterialAdjacency(poiType: POIType): boolean {
  return POI_TYPES_REQUIRING_ARTERIAL.includes(poiType);
}

/**
 * Check if a district type requires adjacency to an arterial road.
 */
export function districtRequiresArterialAdjacency(districtType: string): boolean {
  return DISTRICT_TYPES_REQUIRING_ARTERIAL.includes(
    districtType as (typeof DISTRICT_TYPES_REQUIRING_ARTERIAL)[number]
  );
}

/**
 * Calculate Euclidean distance between two points.
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the nearest point on a line segment to a given point.
 */
function nearestPointOnSegment(point: Point, p1: Point, p2: Point): Point {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return p1;

  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: p1.x + t * dx,
    y: p1.y + t * dy,
  };
}

/**
 * Calculate the minimum distance from a point to a road (line segments).
 */
function distanceToRoad(point: Point, road: Road): number {
  const linePoints = road.line.points;
  if (linePoints.length < 2) return Infinity;

  let minDist = Infinity;

  for (let i = 0; i < linePoints.length - 1; i++) {
    const nearest = nearestPointOnSegment(point, linePoints[i], linePoints[i + 1]);
    const dist = distance(point, nearest);
    minDist = Math.min(minDist, dist);
  }

  return minDist;
}

/**
 * Get all arterial roads from a list of roads.
 */
export function getArterialRoads(roads: Road[]): Road[] {
  return roads.filter((road) => road.roadClass === "arterial");
}

/**
 * Check if a position is adjacent to any arterial road.
 * Adjacent means within ARTERIAL_ADJACENCY_DISTANCE world units.
 */
export function isAdjacentToArterial(position: Point, roads: Road[]): boolean {
  const arterials = getArterialRoads(roads);

  for (const arterial of arterials) {
    if (distanceToRoad(position, arterial) <= ARTERIAL_ADJACENCY_DISTANCE) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a district polygon touches or is adjacent to any arterial road.
 * A district is adjacent if any point on its boundary is within the adjacency distance.
 */
export function isDistrictAdjacentToArterial(
  districtPolygon: Point[],
  roads: Road[]
): boolean {
  const arterials = getArterialRoads(roads);

  // Check each vertex of the district polygon
  for (const vertex of districtPolygon) {
    for (const arterial of arterials) {
      if (distanceToRoad(vertex, arterial) <= ARTERIAL_ADJACENCY_DISTANCE) {
        return true;
      }
    }
  }

  // Also check edge midpoints for better coverage
  for (let i = 0; i < districtPolygon.length; i++) {
    const p1 = districtPolygon[i];
    const p2 = districtPolygon[(i + 1) % districtPolygon.length];
    const midpoint: Point = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };

    for (const arterial of arterials) {
      if (distanceToRoad(midpoint, arterial) <= ARTERIAL_ADJACENCY_DISTANCE) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find the nearest arterial road to a position.
 * Returns null if no arterials exist.
 */
export function findNearestArterial(
  position: Point,
  roads: Road[]
): { road: Road; distance: number; nearestPoint: Point } | null {
  const arterials = getArterialRoads(roads);

  if (arterials.length === 0) return null;

  let nearestRoad = arterials[0];
  let minDist = Infinity;
  let nearestPoint: Point = position;

  for (const arterial of arterials) {
    const linePoints = arterial.line.points;

    for (let i = 0; i < linePoints.length - 1; i++) {
      const nearest = nearestPointOnSegment(position, linePoints[i], linePoints[i + 1]);
      const dist = distance(position, nearest);

      if (dist < minDist) {
        minDist = dist;
        nearestRoad = arterial;
        nearestPoint = nearest;
      }
    }
  }

  return { road: nearestRoad, distance: minDist, nearestPoint };
}

/**
 * Calculate the centroid of a polygon.
 */
function getPolygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  return {
    x: sumX / points.length,
    y: sumY / points.length,
  };
}

/**
 * District candidate for arterial connection.
 */
export interface ConnectionCandidate {
  district: District;
  distance: number;
  priority: number; // Higher = more preferred
}

/**
 * Find districts that should be connected to via arterials.
 *
 * Algorithm:
 * 1. Get all districts within MAX_CONNECTION_DISTANCE
 * 2. Sort by distance (ascending), then priority (descending)
 * 3. Downtown districts get highest priority
 * 4. Return up to MAX_ARTERIALS_PER_POI candidates
 */
export function findConnectionCandidates(
  position: Point,
  existingDistricts: District[]
): ConnectionCandidate[] {
  const candidates: ConnectionCandidate[] = [];

  for (const district of existingDistricts) {
    const centroid = getPolygonCentroid(district.polygon.points);
    const dist = distance(position, centroid);

    if (dist <= MAX_CONNECTION_DISTANCE) {
      // Calculate priority based on district type
      let priority = 1;
      if (district.type === "downtown") {
        priority = 10; // Highest priority
      } else if (district.type === "commercial") {
        priority = 5;
      } else if (district.type === "residential") {
        priority = 2;
      }

      candidates.push({
        district,
        distance: dist,
        priority,
      });
    }
  }

  // Sort by distance (ascending), then by priority (descending)
  candidates.sort((a, b) => {
    // First, sort by distance
    const distDiff = a.distance - b.distance;
    if (Math.abs(distDiff) > 10) {
      // If distance difference is significant
      return distDiff;
    }
    // If distances are similar, prefer higher priority
    return b.priority - a.priority;
  });

  // Filter candidates based on the algorithm:
  // - Always include nearest (required)
  // - Include additional if distance < 2x nearest distance
  const filtered: ConnectionCandidate[] = [];

  if (candidates.length > 0) {
    const nearestDistance = candidates[0].distance;
    filtered.push(candidates[0]);

    for (let i = 1; i < candidates.length && filtered.length < MAX_ARTERIALS_PER_POI; i++) {
      // Include if distance is less than 2x the nearest distance
      if (candidates[i].distance < nearestDistance * 2) {
        filtered.push(candidates[i]);
      }
    }
  }

  return filtered;
}

/**
 * Find the nearest point on a polygon boundary to a given point.
 */
export function findNearestPointOnPolygon(point: Point, polygon: Point[]): Point {
  let nearestPoint = polygon[0];
  let minDist = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const nearest = nearestPointOnSegment(point, p1, p2);
    const dist = distance(point, nearest);

    if (dist < minDist) {
      minDist = dist;
      nearestPoint = nearest;
    }
  }

  return nearestPoint;
}

/**
 * Generate a unique ID for a road.
 */
function generateRoadId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Result of arterial generation for a POI/district.
 */
export interface ArterialGenerationResult {
  /** Whether the position was already adjacent to an arterial */
  wasAlreadyAdjacent: boolean;
  /** Generated arterial roads (empty if already adjacent) */
  roads: Road[];
  /** IDs of districts that were connected */
  connectedDistrictIds: string[];
}

/**
 * Generate arterial roads to connect a district to the road network.
 *
 * If the district is already adjacent to an arterial, no roads are generated.
 * Otherwise, generates arterials connecting to nearby districts.
 *
 * @param district - The district that needs arterial access
 * @param existingDistricts - All existing districts to potentially connect to
 * @param existingRoads - All existing roads (to check for existing arterials)
 * @param waterFeatures - Water features to avoid (optional)
 */
export function generateArterialConnections(
  district: District,
  existingDistricts: District[],
  existingRoads: Road[],
  _waterFeatures: WaterFeature[] = []
): ArterialGenerationResult {
  // Check if already adjacent to an arterial
  if (isDistrictAdjacentToArterial(district.polygon.points, existingRoads)) {
    return {
      wasAlreadyAdjacent: true,
      roads: [],
      connectedDistrictIds: [],
    };
  }

  const centroid = getPolygonCentroid(district.polygon.points);
  const candidates = findConnectionCandidates(centroid, existingDistricts);

  if (candidates.length === 0) {
    // No districts to connect to
    return {
      wasAlreadyAdjacent: false,
      roads: [],
      connectedDistrictIds: [],
    };
  }

  const roads: Road[] = [];
  const connectedDistrictIds: string[] = [];

  for (const candidate of candidates) {
    // Find connection points on each district's boundary
    const fromPoint = findNearestPointOnPolygon(
      getPolygonCentroid(candidate.district.polygon.points),
      district.polygon.points
    );
    const toPoint = findNearestPointOnPolygon(
      centroid,
      candidate.district.polygon.points
    );

    // Create the arterial road
    const road: Road = {
      id: generateRoadId(`arterial-${district.id}-${candidate.district.id}`),
      roadClass: "arterial",
      line: {
        points: [fromPoint, toPoint],
      },
    };

    roads.push(road);
    connectedDistrictIds.push(candidate.district.id);
  }

  return {
    wasAlreadyAdjacent: false,
    roads,
    connectedDistrictIds,
  };
}
