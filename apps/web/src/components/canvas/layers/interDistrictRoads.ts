/**
 * Inter-district road generation (CITY-144, CITY-340, CITY-382)
 *
 * Handles two levels of inter-district road connectivity:
 *
 * ## 1. Arterial/Collector connections (`generateInterDistrictRoads`)
 * When a district is placed, automatically generates roads connecting it to
 * nearby districts to form a connected road network.
 * - Arterials connect major districts (downtown, commercial, industrial, etc.)
 * - Collectors connect minor districts (residential-to-residential)
 * - Highways are never auto-generated; they must be explicitly placed by the user
 * - Algorithm: find nearest district (always connect), then connect to districts
 *   within 10mi prioritizing downtown, route around water when possible
 *
 * ## 2. Cross-boundary collector connections (`generateCrossBoundaryConnections`)
 * CITY-382: Each district generates its own independent street grid with its own
 * rotation angle and spacing. This means local/collector streets dead-end at
 * polygon boundaries. This function bridges that gap by finding collector-class
 * road endpoints that terminate near a shared boundary between adjacent districts
 * and creating short connector segments.
 *
 * ### Known limitations
 * - LOCAL streets are NOT connected across boundaries (only collectors). Connecting
 *   locals would create too many connections and the misaligned grids would look
 *   messy. Collectors provide enough connectivity for the road network.
 * - Adjacency detection uses vertex-to-vertex distance (approximation). Very thin
 *   or oddly-shaped district gaps may not be detected.
 * - Cross-boundary connections are generated at district placement time only — they
 *   are NOT regenerated when districts are moved or reshaped.
 */

import type { District, DistrictType, Road, Point, RoadClass, WaterFeature } from "./types";
import { generateId } from "../../../utils/idGenerator";

/**
 * Configuration for inter-district road generation.
 */
export interface InterDistrictConfig {
  /** Maximum distance in world units to connect districts (default: ~10 miles) */
  maxConnectionDistance?: number;
  /** Road class for inter-district connections (ignored — CITY-501 uses context-dependent class) */
  roadClass?: RoadClass;
  /** Whether to avoid water features */
  avoidWater?: boolean;
}

const DEFAULT_CONFIG: Required<InterDistrictConfig> = {
  maxConnectionDistance: 150, // ~10 miles in world units (768 units = 50 miles)
  roadClass: "arterial", // Ignored — CITY-501 determines class from district types
  avoidWater: true,
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
 * CITY-384: Find the shared boundary points between two adjacent districts.
 *
 * Walks the new district's polygon and collects consecutive runs of points
 * that lie on or very near the adjacent district's boundary. Returns the
 * longest run as the shared edge polyline.
 */
function findSharedBoundary(
  newPolygon: Point[],
  adjacentPolygon: Point[]
): Point[] {
  const TOLERANCE = 3; // world units — tight tolerance for boundary proximity

  // For each point in the new polygon, check if it's on the adjacent boundary
  const onBoundary: boolean[] = newPolygon.map((p) => {
    for (let j = 0; j < adjacentPolygon.length; j++) {
      const a = adjacentPolygon[j];
      const b = adjacentPolygon[(j + 1) % adjacentPolygon.length];
      if (pointToSegmentDist(p, a, b) < TOLERANCE) {
        return true;
      }
    }
    return false;
  });

  // Find the longest consecutive run of boundary points
  let bestRun: Point[] = [];
  let currentRun: Point[] = [];

  // Handle wrap-around by iterating twice
  const n = newPolygon.length;
  for (let i = 0; i < n * 2; i++) {
    const idx = i % n;
    if (onBoundary[idx]) {
      currentRun.push(newPolygon[idx]);
    } else {
      if (currentRun.length > bestRun.length) {
        bestRun = currentRun;
      }
      currentRun = [];
    }
  }
  if (currentRun.length > bestRun.length) {
    bestRun = currentRun;
  }

  // Deduplicate if we wrapped around (runs longer than n mean full boundary)
  if (bestRun.length > n) {
    bestRun = bestRun.slice(0, n);
  }

  return bestRun;
}

/**
 * Distance from point p to line segment ab.
 */
function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * CITY-384: Generate an arterial road along the shared boundary of adjacent districts.
 */
function createSharedBoundaryRoad(
  newDistrict: District,
  adjacentDistrict: District,
): Road | null {
  const sharedPoints = findSharedBoundary(
    newDistrict.polygon.points,
    adjacentDistrict.polygon.points
  );

  if (sharedPoints.length < 2) return null;

  return {
    id: generateId(`shared-arterial-${newDistrict.id}-${adjacentDistrict.id}`),
    name: `${newDistrict.name} - ${adjacentDistrict.name} Blvd`,
    roadClass: "arterial",
    line: { points: sharedPoints },
  };
}

/**
 * Generate inter-district roads connecting a new district to existing ones.
 *
 * @param newDistrict - The newly placed district
 * @param existingDistricts - All existing districts
 * @param waterFeatures - Water features to route around
 * @param config - Configuration options
 * @param adjacentDistrictIds - CITY-384: IDs of districts sharing a boundary
 * @returns Generated roads and connected district IDs
 */
export function generateInterDistrictRoads(
  newDistrict: District,
  existingDistricts: District[],
  waterFeatures: WaterFeature[] = [],
  config: InterDistrictConfig = {},
  adjacentDistrictIds: string[] = []
): InterDistrictRoadsResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const roads: Road[] = [];
  const connectedDistrictIds: string[] = [];

  // CITY-422: Reset highway counter per call so numbering is deterministic
  // and doesn't leak across place/delete cycles.
  highwayCounter = 1;

  if (existingDistricts.length === 0) {
    return { roads, connectedDistrictIds };
  }

  // CITY-384: Generate shared-boundary arterials for adjacent districts first.
  // These replace the standard centroid-to-centroid connections.
  for (const adjId of adjacentDistrictIds) {
    const adjDistrict = existingDistricts.find((d) => d.id === adjId);
    if (!adjDistrict) continue;

    const road = createSharedBoundaryRoad(newDistrict, adjDistrict);
    if (road) {
      roads.push(road);
      connectedDistrictIds.push(adjId);
    }
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

  // Always connect to the nearest non-adjacent district
  const nearest = districtInfo.find((d) => !connectedDistrictIds.includes(d.district.id));
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
    .filter((d) => !connectedDistrictIds.includes(d.district.id))
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
  if (roadClass === "arterial") {
    return `${fromDistrict.name} - ${toDistrict.name} Blvd`;
  }

  // Collectors: named streets
  return `${fromDistrict.name} - ${toDistrict.name} St`;
}

/** District types that warrant arterial-class inter-district connections */
const MAJOR_DISTRICT_TYPES: Set<DistrictType> = new Set([
  "downtown",
  "commercial",
  "industrial",
  "hospital",
  "university",
  "airport",
]);

/**
 * Create a road connecting two districts.
 * CITY-501: Road class is context-dependent — arterial when either district is a
 * major type (downtown, commercial, industrial, hospital, university, airport),
 * collector otherwise. Highways are never auto-generated; they must be explicitly
 * placed by the user.
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

  // CITY-501: Use arterial for major districts, collector for minor (e.g. residential-to-residential)
  const isMajorConnection =
    MAJOR_DISTRICT_TYPES.has(fromDistrict.type) || MAJOR_DISTRICT_TYPES.has(toDistrict.type);
  const roadClass: RoadClass = isMajorConnection ? "arterial" : "collector";

  return {
    id: generateId(`inter-district-${fromDistrict.id}-${toDistrict.id}`),
    name: generateRoadName(roadClass, fromDistrict, toDistrict, fromCentroid, toCentroid, connectionDistance),
    roadClass,
    line: { points: pathPoints },
  };
}

/**
 * Generate short connector roads between collector streets at adjacent district
 * boundaries (CITY-382).
 *
 * When two districts are placed side by side, their internal street grids are
 * independent — different rotation angles and spacing offsets. This function
 * finds collector-class road endpoints that terminate near a shared boundary
 * and creates short connector segments so the street networks link up.
 *
 * Algorithm:
 * 1. For each existing district, check if its polygon boundary is close enough
 *    to the new district's boundary to be considered "adjacent" (vertex-to-vertex
 *    distance < maxGap).
 * 2. Collect deduplicated collector-class road endpoints from both districts.
 * 3. Build a distance-sorted list of cross-boundary endpoint pairs within maxGap.
 * 4. Greedily match closest pairs (each endpoint used at most once), capped at
 *    MAX_CONNECTIONS_PER_PAIR to avoid overcrowding.
 *
 * The resulting connectors are short collector-class roads that bridge the gap
 * between adjacent district polygon boundaries.
 *
 * @param newDistrict - The newly placed district
 * @param newDistrictRoads - Roads generated for the new district (internal grid)
 * @param existingDistricts - All existing districts to check adjacency against
 * @param existingRoads - All existing roads (used to find adjacent district endpoints)
 * @param maxGap - Maximum world-unit distance between endpoints to create a connector
 *                 (default 5 — generous enough for small polygon gaps)
 * @returns Array of short connector roads
 */
export function generateCrossBoundaryConnections(
  newDistrict: District,
  newDistrictRoads: Road[],
  existingDistricts: District[],
  existingRoads: Road[],
  maxGap: number = 5
): Road[] {
  const MAX_CONNECTIONS_PER_PAIR = 6;
  const connectorRoads: Road[] = [];

  // Get deduplicated collector endpoints from the new district
  const newEndpoints = getCollectorEndpoints(newDistrictRoads, newDistrict.id);
  if (newEndpoints.length === 0) return connectorRoads;

  for (const existingDistrict of existingDistricts) {
    // Skip parks/airports — they have no street grid
    if (existingDistrict.type === "park" || existingDistrict.type === "airport") continue;

    // Quick adjacency check: minimum vertex-to-vertex distance
    const boundaryDist = minPolygonVertexDistance(
      newDistrict.polygon.points,
      existingDistrict.polygon.points
    );
    // Use 2x maxGap as adjacency threshold (generous, since vertex-to-vertex
    // overestimates the actual polygon-to-polygon distance)
    if (boundaryDist > maxGap * 2) continue;

    // Get deduplicated collector endpoints from the existing district
    const existingEndpoints = getCollectorEndpoints(
      existingRoads.filter((r) => r.districtId === existingDistrict.id),
      existingDistrict.id
    );
    if (existingEndpoints.length === 0) continue;

    // Build distance-sorted list of candidate pairs
    const pairs: Array<{ newIdx: number; existIdx: number; dist: number }> = [];
    for (let i = 0; i < newEndpoints.length; i++) {
      for (let j = 0; j < existingEndpoints.length; j++) {
        const d = distance(newEndpoints[i], existingEndpoints[j]);
        if (d <= maxGap && d > 0.01) {
          // d > 0.01 filters out endpoints that are essentially the same point
          pairs.push({ newIdx: i, existIdx: j, dist: d });
        }
      }
    }
    pairs.sort((a, b) => a.dist - b.dist);

    // Greedy matching: each endpoint used at most once
    const usedNew = new Set<number>();
    const usedExisting = new Set<number>();
    let connectionsForPair = 0;

    for (const pair of pairs) {
      if (connectionsForPair >= MAX_CONNECTIONS_PER_PAIR) break;
      if (usedNew.has(pair.newIdx) || usedExisting.has(pair.existIdx)) continue;

      usedNew.add(pair.newIdx);
      usedExisting.add(pair.existIdx);
      connectionsForPair++;

      connectorRoads.push({
        id: generateId(`connector-${newDistrict.id}-${existingDistrict.id}-${connectionsForPair}`),
        roadClass: "collector",
        line: {
          points: [newEndpoints[pair.newIdx], existingEndpoints[pair.existIdx]],
        },
        districtId: newDistrict.id,
      });
    }
  }

  return connectorRoads;
}

/**
 * Extract deduplicated collector-class road endpoints.
 *
 * Every road in the street grid has exactly 2 points (start, end), both of
 * which lie on the district polygon boundary (they are polygon-clipping
 * intersection points). This function collects all unique endpoints from
 * collector roads belonging to the given district.
 *
 * Deduplication uses a 2-decimal precision key to merge endpoints that share
 * the same grid intersection (e.g., two perpendicular collectors meeting at
 * a boundary point).
 */
function getCollectorEndpoints(roads: Road[], districtId: string): Point[] {
  const endpoints: Point[] = [];
  const seen = new Set<string>();
  const key = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;

  for (const road of roads) {
    if (road.roadClass !== "collector") continue;
    if (road.districtId !== districtId) continue;
    if (road.line.points.length < 2) continue;

    for (const pt of [road.line.points[0], road.line.points[road.line.points.length - 1]]) {
      const k = key(pt);
      if (!seen.has(k)) {
        seen.add(k);
        endpoints.push(pt);
      }
    }
  }

  return endpoints;
}

/**
 * Minimum vertex-to-vertex distance between two polygons.
 *
 * This is an approximation of the true minimum polygon-to-polygon distance
 * (which would require vertex-to-edge checks). It's sufficient for adjacency
 * detection when used with a generous threshold multiplier.
 */
function minPolygonVertexDistance(poly1: Point[], poly2: Point[]): number {
  let minDist = Infinity;
  for (const p1 of poly1) {
    for (const p2 of poly2) {
      const d = distance(p1, p2);
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
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

/**
 * CITY-430: Generate a short local-class road connecting a transit station
 * to the nearest road in its district.
 *
 * Transit stations are placed inside districts but have no road segment
 * extending to them. This function bridges that gap by finding the closest
 * point on any district road and creating a short "Station Access" road.
 *
 * @param stationPosition - The station's world-space position
 * @param districtRoads - Roads belonging to the station's district
 * @param districtId - ID of the district the station belongs to
 * @returns A local-class access road, or null if the station is already
 *          close enough to a road (< 5 world units)
 */
export function generateStationAccessRoad(
  stationPosition: { x: number; y: number },
  districtRoads: Road[],
  districtId: string
): Road | null {
  if (districtRoads.length === 0) return null;

  const MIN_DISTANCE = 5; // Don't generate if station is already on/near a road

  let bestPoint: Point | null = null;
  let bestDist = Infinity;

  for (const road of districtRoads) {
    const points = road.line.points;
    if (points.length < 2) continue;

    // Check each segment of the road
    for (let i = 0; i < points.length - 1; i++) {
      const closest = nearestPointOnSegment(stationPosition, points[i], points[i + 1]);
      const dist = distance(stationPosition, closest);
      if (dist < bestDist) {
        bestDist = dist;
        bestPoint = closest;
      }
    }
  }

  if (!bestPoint || bestDist < MIN_DISTANCE) return null;

  return {
    id: generateId(`station-access-${districtId}`),
    name: "Station Access",
    roadClass: "local",
    line: {
      points: [
        { x: stationPosition.x, y: stationPosition.y },
        bestPoint,
      ],
    },
    districtId,
  };
}
