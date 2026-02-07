/**
 * Inter-district road generation (CITY-144, CITY-340)
 *
 * When a district is placed, automatically generates roads
 * connecting it to nearby districts to form a connected road network.
 * Short connections (<5mi) become arterials; longer ones become highways.
 *
 * Algorithm:
 * 1. Find nearest existing district - always connect
 * 2. Find all districts within 10 miles - connect if not already reachable
 * 3. Prefer downtown districts for connections
 * 4. Route around water features when possible
 * 5. Auto-upgrade to highway for connections >= highwayThreshold
 */

import type { District, Road, Point, RoadClass, WaterFeature } from "./types";
import { generateId } from "../../../utils/idGenerator";

/**
 * Configuration for inter-district road generation.
 */
export interface InterDistrictConfig {
  /** Maximum distance in world units to connect districts (default: ~10 miles) */
  maxConnectionDistance?: number;
  /** Road class for inter-district connections */
  roadClass?: RoadClass;
  /** Whether to avoid water features */
  avoidWater?: boolean;
  /** Distance threshold above which connections become highways (default: ~5 miles) */
  highwayThreshold?: number;
}

const DEFAULT_CONFIG: Required<InterDistrictConfig> = {
  maxConnectionDistance: 150, // ~10 miles in world units (768 units = 50 miles)
  roadClass: "arterial",
  avoidWater: true,
  highwayThreshold: 75, // ~5 miles in world units - longer connections become highways
};

/**
 * Result of generating inter-district roads.
 */
export interface InterDistrictRoadsResult {
  /** Generated roads connecting districts */
  roads: Road[];
  /** IDs of districts that were connected */
  connectedDistrictIds: string[];
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
 * Calculate Euclidean distance between two points.
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}


/**
 * Find the nearest point on a polygon boundary to a given point.
 */
function findNearestPointOnPolygon(point: Point, polygon: Point[]): Point {
  let nearestPoint = polygon[0];
  let minDist = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    // Find nearest point on this edge
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
 * Check if a line segment intersects any water features.
 */
function intersectsWater(
  start: Point,
  end: Point,
  waterFeatures: WaterFeature[]
): boolean {
  for (const water of waterFeatures) {
    if (lineIntersectsPolygon(start, end, water.polygon.points)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a line segment intersects a polygon.
 */
function lineIntersectsPolygon(
  lineStart: Point,
  lineEnd: Point,
  polygon: Point[]
): boolean {
  // Check if either endpoint is inside the polygon
  if (pointInPolygon(lineStart, polygon) || pointInPolygon(lineEnd, polygon)) {
    return true;
  }

  // Check if line crosses any polygon edge
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    if (segmentsIntersect(lineStart, lineEnd, p1, p2)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a point is inside a polygon using ray casting.
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

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
 * Check if two line segments intersect.
 */
function segmentsIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point
): boolean {
  const d1 = direction(b1, b2, a1);
  const d2 = direction(b1, b2, a2);
  const d3 = direction(a1, a2, b1);
  const d4 = direction(a1, a2, b2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return false;
}

/**
 * Cross product direction helper.
 */
function direction(p1: Point, p2: Point, p3: Point): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

/**
 * Find a path around water features using simple waypoints.
 * This is a simplified approach - a full A* implementation would be more robust.
 */
function findPathAroundWater(
  start: Point,
  end: Point,
  waterFeatures: WaterFeature[]
): Point[] {
  // If no water intersection, direct path is fine
  if (!intersectsWater(start, end, waterFeatures)) {
    return [start, end];
  }

  // Find which water feature we're crossing
  for (const water of waterFeatures) {
    if (!lineIntersectsPolygon(start, end, water.polygon.points)) {
      continue;
    }

    // Try to go around the water feature
    const waterCentroid = getPolygonCentroid(water.polygon.points);
    const waterBounds = getPolygonBounds(water.polygon.points);

    // Calculate perpendicular direction to avoid water
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len;
    const perpY = dx / len;

    // Try going around one side
    const offset = Math.max(
      waterBounds.maxX - waterBounds.minX,
      waterBounds.maxY - waterBounds.minY
    ) * 0.6;

    // Determine which side to go around based on start position
    const startToWater = {
      x: waterCentroid.x - start.x,
      y: waterCentroid.y - start.y,
    };
    const crossProduct = perpX * startToWater.y - perpY * startToWater.x;
    const sign = crossProduct > 0 ? 1 : -1;

    // Create waypoint to go around water
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const waypoint: Point = {
      x: midX + perpX * offset * sign,
      y: midY + perpY * offset * sign,
    };

    // Check if this path avoids water
    if (
      !intersectsWater(start, waypoint, waterFeatures) &&
      !intersectsWater(waypoint, end, waterFeatures)
    ) {
      return [start, waypoint, end];
    }

    // Try the other side
    const waypoint2: Point = {
      x: midX - perpX * offset * sign,
      y: midY - perpY * offset * sign,
    };

    if (
      !intersectsWater(start, waypoint2, waterFeatures) &&
      !intersectsWater(waypoint2, end, waterFeatures)
    ) {
      return [start, waypoint2, end];
    }
  }

  // If we can't find a path around, just use direct path
  // (will cross water - bridges can be added later)
  return [start, end];
}

/**
 * Get bounding box of polygon.
 */
function getPolygonBounds(points: Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Calculate priority score for connecting to a district.
 * Higher score = higher priority.
 */
function getConnectionPriority(district: District): number {
  let priority = 0;

  // Downtown districts get highest priority
  if (district.type === "downtown") {
    priority += 100;
  }

  // Commercial districts get medium priority
  if (district.type === "commercial") {
    priority += 50;
  }

  // High-density residential gets some priority
  if (district.type === "residential" && district.personality?.sprawl_compact) {
    priority += district.personality.sprawl_compact * 30;
  }

  return priority;
}

/**
 * Generate inter-district roads connecting a new district to existing ones.
 *
 * @param newDistrict - The newly placed district
 * @param existingDistricts - All existing districts
 * @param waterFeatures - Water features to route around
 * @param config - Configuration options
 * @returns Generated roads and connected district IDs
 */
export function generateInterDistrictRoads(
  newDistrict: District,
  existingDistricts: District[],
  waterFeatures: WaterFeature[] = [],
  config: InterDistrictConfig = {}
): InterDistrictRoadsResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const roads: Road[] = [];
  const connectedDistrictIds: string[] = [];

  if (existingDistricts.length === 0) {
    return { roads, connectedDistrictIds };
  }

  // Get centroid of new district
  const newCentroid = getPolygonCentroid(newDistrict.polygon.points);

  // Calculate distance and priority for each existing district
  const districtInfo = existingDistricts.map((district) => {
    const centroid = getPolygonCentroid(district.polygon.points);
    const dist = distance(newCentroid, centroid);
    const priority = getConnectionPriority(district);
    return { district, centroid, distance: dist, priority };
  });

  // Sort by distance first
  districtInfo.sort((a, b) => a.distance - b.distance);

  // Always connect to the nearest district
  const nearest = districtInfo[0];
  if (nearest) {
    const road = createConnectionRoad(
      newDistrict,
      nearest.district,
      newCentroid,
      nearest.centroid,
      waterFeatures,
      cfg,
      nearest.distance
    );
    roads.push(road);
    connectedDistrictIds.push(nearest.district.id);
  }

  // Connect to other districts within range, prioritizing downtown
  const withinRange = districtInfo
    .slice(1) // Skip nearest (already connected)
    .filter((d) => d.distance <= cfg.maxConnectionDistance)
    .sort((a, b) => b.priority - a.priority); // Sort by priority descending

  for (const info of withinRange) {
    // Limit connections to avoid overcrowding (max 3 additional connections)
    if (connectedDistrictIds.length >= 4) break;

    // Skip if already connected through other roads
    // (Simple heuristic: don't connect if very close to an already-connected district)
    const alreadyConnectedNearby = connectedDistrictIds.some((id) => {
      const connected = districtInfo.find((d) => d.district.id === id);
      if (!connected) return false;
      return distance(info.centroid, connected.centroid) < info.distance * 0.5;
    });

    if (alreadyConnectedNearby) continue;

    const road = createConnectionRoad(
      newDistrict,
      info.district,
      newCentroid,
      info.centroid,
      waterFeatures,
      cfg,
      info.distance
    );
    roads.push(road);
    connectedDistrictIds.push(info.district.id);
  }

  return { roads, connectedDistrictIds };
}

/** Running counter for highway numbering within a session */
let highwayCounter = 1;

/**
 * Highway naming convention inspired by US road classification.
 *
 * - Long-distance highways get Interstate-style names (I-5, I-90)
 * - Medium-distance highways get US Route-style names (US-1, US-30)
 * - Short highways get State Route-style names (SR 7, SR 12)
 *
 * Following real-world convention:
 *   - Odd numbers for predominantly N/S routes
 *   - Even numbers for predominantly E/W routes
 */

/** Distance thresholds for highway naming tiers (world units) */
const INTERSTATE_THRESHOLD = 120; // ~8 miles — long cross-city routes
const US_ROUTE_THRESHOLD = 75;    // ~5 miles — medium inter-district routes

/**
 * Pick a route number that is odd for N/S roads and even for E/W roads.
 */
function pickRouteNumber(counter: number, isNorthSouth: boolean): number {
  // Map counter to the appropriate odd/even number
  // counter 1 → odd=1, even=2; counter 2 → odd=3, even=4; etc.
  const base = counter * 2;
  return isNorthSouth ? base - 1 : base;
}

/**
 * Determine whether a road runs predominantly North/South based on its endpoints.
 */
function isNorthSouthRoute(from: Point, to: Point): boolean {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return dy >= dx; // More vertical than horizontal → N/S
}

/**
 * Generate a name for an inter-district road based on its class and geometry.
 */
function generateRoadName(
  roadClass: RoadClass,
  fromDistrict: District,
  toDistrict: District,
  fromCentroid: Point,
  toCentroid: Point,
  connectionDistance: number
): string {
  if (roadClass === "highway") {
    const ns = isNorthSouthRoute(fromCentroid, toCentroid);
    const num = pickRouteNumber(highwayCounter++, ns);

    if (connectionDistance >= INTERSTATE_THRESHOLD) {
      return `I-${num}`;
    }
    if (connectionDistance >= US_ROUTE_THRESHOLD) {
      return `US-${num}`;
    }
    return `SR ${num}`;
  }

  // Arterials: named boulevards connecting the two districts
  return `${fromDistrict.name} - ${toDistrict.name} Blvd`;
}

/**
 * Create a road connecting two districts.
 * Connections longer than the highway threshold are auto-upgraded to highways.
 */
function createConnectionRoad(
  fromDistrict: District,
  toDistrict: District,
  fromCentroid: Point,
  toCentroid: Point,
  waterFeatures: WaterFeature[],
  config: Required<InterDistrictConfig>,
  connectionDistance: number
): Road {
  // Find connection points on district perimeters
  const fromPerimeter = findNearestPointOnPolygon(
    toCentroid,
    fromDistrict.polygon.points
  );
  const toPerimeter = findNearestPointOnPolygon(
    fromCentroid,
    toDistrict.polygon.points
  );

  // Find path (may include waypoints to avoid water)
  let pathPoints: Point[];
  if (config.avoidWater && waterFeatures.length > 0) {
    pathPoints = findPathAroundWater(fromPerimeter, toPerimeter, waterFeatures);
  } else {
    pathPoints = [fromPerimeter, toPerimeter];
  }

  // Auto-upgrade to highway for long-distance connections (only from default arterial)
  const roadClass =
    config.roadClass === "arterial" && connectionDistance >= config.highwayThreshold
      ? "highway"
      : config.roadClass;

  return {
    id: generateId(`inter-district-${fromDistrict.id}-${toDistrict.id}`),
    name: generateRoadName(roadClass, fromDistrict, toDistrict, fromCentroid, toCentroid, connectionDistance),
    roadClass,
    line: { points: pathPoints },
  };
}

/**
 * Check if two districts are already connected by an existing road.
 */
export function areDistrictsConnected(
  district1: District,
  district2: District,
  existingRoads: Road[]
): boolean {
  const centroid1 = getPolygonCentroid(district1.polygon.points);
  const centroid2 = getPolygonCentroid(district2.polygon.points);

  // Check if any existing road connects the two district areas
  for (const road of existingRoads) {
    if (road.line.points.length < 2) continue;

    const start = road.line.points[0];
    const end = road.line.points[road.line.points.length - 1];

    // Check if road endpoints are near both districts
    const nearDistrict1 =
      distance(start, centroid1) < 50 || distance(end, centroid1) < 50;
    const nearDistrict2 =
      distance(start, centroid2) < 50 || distance(end, centroid2) < 50;

    if (nearDistrict1 && nearDistrict2) {
      return true;
    }
  }

  return false;
}
