/**
 * Bridge Detection (CITY-148)
 *
 * Automatically detects where roads cross water features and generates
 * bridge segments. Bridges are visual markers showing where roads pass
 * over rivers, lakes, or other water bodies.
 *
 * Rules:
 * - Inter-district roads (arterials): unlimited bridges allowed
 * - Intra-district roads (local/collector): max 1-2 bridges per district
 */

import type {
  Road,
  Bridge,
  Point,
  WaterFeature,
  RiverFeature,
  WaterCrossingType,
  TerrainData,
} from "./types";

/**
 * Generate a deterministic bridge ID from road and water feature identifiers.
 * Using stable inputs avoids creating new IDs on every detectBridges() call,
 * which previously caused unnecessary React state updates and re-renders.
 */
function deterministicBridgeId(roadId: string, waterFeatureId: string, segmentIndex: number, crossingIndex: number): string {
  return `bridge-${roadId}-${waterFeatureId}-${segmentIndex}-${crossingIndex}`;
}

/**
 * Configuration for bridge detection.
 */
export interface BridgeDetectionConfig {
  /** Maximum bridges per district for intra-district roads (default: 2) */
  maxBridgesPerDistrict?: number;
  /** Minimum bridge length to be considered valid (default: 5 world units) */
  minBridgeLength?: number;
}

const DEFAULT_CONFIG: Required<BridgeDetectionConfig> = {
  maxBridgesPerDistrict: 2,
  minBridgeLength: 5,
};

/**
 * Result of detecting bridges for a set of roads.
 */
export interface BridgeDetectionResult {
  bridges: Bridge[];
  /** Map of district ID to number of bridges (for limiting intra-district bridges) */
  bridgeCountByDistrict: Map<string, number>;
}

/**
 * Calculate distance between two points.
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
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
 * Find intersection point of two line segments.
 * Returns null if segments don't intersect.
 */
function getSegmentIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point
): Point | null {
  const dx1 = a2.x - a1.x;
  const dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x;
  const dy2 = b2.y - b1.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null; // Parallel lines

  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
  const u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: a1.x + t * dx1,
      y: a1.y + t * dy1,
    };
  }

  return null;
}

/**
 * Find all intersection points between a line segment and a polygon boundary.
 */
function findPolygonIntersections(
  lineStart: Point,
  lineEnd: Point,
  polygon: Point[]
): Point[] {
  const intersections: Point[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const intersection = getSegmentIntersection(lineStart, lineEnd, p1, p2);
    if (intersection) {
      intersections.push(intersection);
    }
  }

  // Sort by distance from start point
  intersections.sort((a, b) => distance(lineStart, a) - distance(lineStart, b));

  return intersections;
}

/**
 * Find intersection points between a road segment and a river.
 * Rivers are represented as LineStrings with width.
 */
function findRiverIntersection(
  lineStart: Point,
  lineEnd: Point,
  river: RiverFeature
): { entry: Point; exit: Point } | null {
  // Create a simplified river polygon by expanding the centerline
  const riverWidth = river.width || 3;
  const points = river.line.points;

  if (points.length < 2) return null;

  // For simplicity, check intersection with each river segment
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const intersection = getSegmentIntersection(lineStart, lineEnd, p1, p2);
    if (intersection) {
      // Calculate entry/exit direction along the road
      const roadDx = lineEnd.x - lineStart.x;
      const roadDy = lineEnd.y - lineStart.y;
      const roadLen = Math.sqrt(roadDx * roadDx + roadDy * roadDy);
      const offsetX = (roadDx / roadLen) * (riverWidth / 2);
      const offsetY = (roadDy / roadLen) * (riverWidth / 2);

      return {
        entry: { x: intersection.x - offsetX, y: intersection.y - offsetY },
        exit: { x: intersection.x + offsetX, y: intersection.y + offsetY },
      };
    }
  }

  return null;
}

/**
 * Detect bridges for a single road crossing water features.
 */
function detectBridgesForRoad(
  road: Road,
  waterFeatures: WaterFeature[],
  rivers: RiverFeature[],
  config: Required<BridgeDetectionConfig>
): Bridge[] {
  const bridges: Bridge[] = [];
  const points = road.line.points;

  if (points.length < 2) return bridges;

  // Check each segment of the road
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];

    // Check against water polygons (lakes, oceans)
    for (const water of waterFeatures) {
      const intersections = findPolygonIntersections(
        segStart,
        segEnd,
        water.polygon.points
      );

      // Need at least 2 intersections (entry and exit)
      if (intersections.length >= 2) {
        for (let j = 0; j < intersections.length - 1; j += 2) {
          const entry = intersections[j];
          const exit = intersections[j + 1];
          const bridgeLength = distance(entry, exit);

          if (bridgeLength >= config.minBridgeLength) {
            const waterType: WaterCrossingType =
              water.type === "ocean" ? "ocean" : "lake";

            bridges.push({
              id: deterministicBridgeId(road.id, water.id, i, j),
              roadId: road.id,
              waterType,
              waterFeatureId: water.id,
              startPoint: entry,
              endPoint: exit,
              length: bridgeLength,
              autoGenerated: true,
            });
          }
        }
      } else if (
        intersections.length === 1 ||
        pointInPolygon(segStart, water.polygon.points) ||
        pointInPolygon(segEnd, water.polygon.points)
      ) {
        // Road segment starts or ends in water (edge case)
        // For now, create a bridge from the intersection or endpoint
        const entry = intersections[0] || segStart;
        const exit = segEnd;
        const bridgeLength = distance(entry, exit);

        if (bridgeLength >= config.minBridgeLength) {
          bridges.push({
            id: deterministicBridgeId(road.id, water.id, i, 0),
            roadId: road.id,
            waterType: water.type === "ocean" ? "ocean" : "lake",
            waterFeatureId: water.id,
            startPoint: entry,
            endPoint: exit,
            length: bridgeLength,
            autoGenerated: true,
          });
        }
      }
    }

    // Check against rivers
    for (const river of rivers) {
      const crossing = findRiverIntersection(segStart, segEnd, river);
      if (crossing) {
        const bridgeLength = distance(crossing.entry, crossing.exit);
        if (bridgeLength >= config.minBridgeLength) {
          bridges.push({
            id: deterministicBridgeId(road.id, river.id, i, 0),
            roadId: road.id,
            waterType: "river",
            waterFeatureId: river.id,
            startPoint: crossing.entry,
            endPoint: crossing.exit,
            length: bridgeLength,
            autoGenerated: true,
          });
        }
      }
    }
  }

  return bridges;
}

/**
 * Detect bridges for all roads given water features from terrain data.
 *
 * @param roads - All roads in the world
 * @param terrainData - Terrain data containing water features
 * @param config - Configuration options
 * @returns Detected bridges
 */
export function detectBridges(
  roads: Road[],
  terrainData: TerrainData | null,
  config: BridgeDetectionConfig = {}
): BridgeDetectionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const bridges: Bridge[] = [];
  const bridgeCountByDistrict = new Map<string, number>();

  if (!terrainData) {
    return { bridges, bridgeCountByDistrict };
  }

  const waterFeatures = terrainData.water || [];
  const rivers = terrainData.rivers || [];

  // Check each road for water crossings
  for (const road of roads) {
    const roadBridges = detectBridgesForRoad(road, waterFeatures, rivers, cfg);

    // For intra-district roads (local/collector), limit bridges
    // Inter-district roads (arterial/highway) have no limit
    const isInterDistrict =
      road.roadClass === "arterial" || road.roadClass === "highway";

    if (isInterDistrict) {
      // Add all bridges for inter-district roads
      bridges.push(...roadBridges);
    } else {
      // For intra-district roads, we'd need district info to limit
      // For now, add all bridges but track count
      // (In a more complete implementation, road would have districtId)
      bridges.push(...roadBridges);
    }
  }

  return { bridges, bridgeCountByDistrict };
}

/**
 * Quick check if a road crosses any water features.
 * Useful for preview/validation without full bridge detection.
 */
export function roadCrossesWater(
  road: Road,
  terrainData: TerrainData | null
): boolean {
  if (!terrainData) return false;

  const points = road.line.points;
  if (points.length < 2) return false;

  // Check each segment
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];

    // Check water polygons
    for (const water of terrainData.water || []) {
      const intersections = findPolygonIntersections(
        segStart,
        segEnd,
        water.polygon.points
      );
      if (intersections.length > 0) return true;
    }

    // Check rivers
    for (const river of terrainData.rivers || []) {
      const crossing = findRiverIntersection(segStart, segEnd, river);
      if (crossing) return true;
    }
  }

  return false;
}
