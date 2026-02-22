/**
 * Waterfront road detection (CITY-181)
 *
 * Detects roads adjacent to water features and marks them as riverfront
 * drives or boardwalks. This runs after terrain and road generation, similar
 * to bridge detection (CITY-148).
 *
 * ## Detection algorithm
 * For each road segment, sample points along its length and measure the
 * minimum distance to any water polygon boundary or river centerline.
 * Roads within the threshold distance are marked as waterfront.
 *
 * ## Waterfront types
 * - **riverfront_drive**: Arterial or collector roads running along water
 *   (rivers, lakes, ocean). These get wider rendering with a landscaped
 *   median effect.
 * - **boardwalk**: Trail or local roads adjacent to beach features.
 *   Rendered with a wooden plank-style dashed pattern.
 *
 * ## Rendering
 * Waterfront roads use distinct styles defined in FeaturesLayer.ts:
 * - Riverfront drives: wider stroke, teal-tinted median line
 * - Boardwalks: warm brown plank color with wider dashed pattern
 */

import type {
  Road,
  Point,
  WaterFeature,
  RiverFeature,
  BeachFeature,
  TerrainData,
  WaterfrontType,
} from "./types";

/**
 * Configuration for waterfront detection.
 */
export interface WaterfrontDetectionConfig {
  /** Maximum distance in world units from a road to water to be considered waterfront (default: 5) */
  waterfrontThreshold?: number;
  /** Maximum distance in world units from a road to a beach to be considered a boardwalk (default: 3) */
  boardwalkThreshold?: number;
  /**
   * Minimum fraction of road length that must be near water to qualify (default: 0.4).
   * Prevents roads that only briefly touch water from being classified as waterfront.
   */
  minWaterfrontFraction?: number;
  /** Number of sample points along each road segment (default: 8) */
  sampleCount?: number;
}

const DEFAULT_CONFIG: Required<WaterfrontDetectionConfig> = {
  waterfrontThreshold: 5,
  boardwalkThreshold: 3,
  minWaterfrontFraction: 0.4,
  sampleCount: 8,
};

/**
 * Result of waterfront detection.
 */
export interface WaterfrontDetectionResult {
  /** Roads with waterfrontType set (only roads that were modified) */
  waterfrontRoads: Map<string, WaterfrontType>;
  /** Total count of riverfront drives detected */
  riverfrontCount: number;
  /** Total count of boardwalks detected */
  boardwalkCount: number;
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
 * Calculate the minimum distance from a point to a line segment.
 */
function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Calculate the minimum distance from a point to a polygon boundary.
 * Only checks distance to edges (not whether the point is inside).
 */
function pointToPolygonBoundaryDistance(point: Point, polygon: Point[]): number {
  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const d = pointToSegmentDistance(point, a, b);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Calculate the minimum distance from a point to a river centerline.
 */
function pointToRiverDistance(point: Point, river: RiverFeature): number {
  const pts = river.line.points;
  if (pts.length < 2) return Infinity;

  let minDist = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointToSegmentDistance(point, pts[i], pts[i + 1]);
    // Account for river width: the actual water edge is riverWidth/2 from centerline
    const adjustedDist = Math.max(0, d - (river.width || 3) / 2);
    if (adjustedDist < minDist) minDist = adjustedDist;
  }
  return minDist;
}

/**
 * Calculate the minimum distance from a point to any beach polygon boundary.
 */
function pointToNearestBeachDistance(point: Point, beaches: BeachFeature[]): number {
  let minDist = Infinity;
  for (const beach of beaches) {
    const d = pointToPolygonBoundaryDistance(point, beach.polygon.points);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Calculate the minimum distance from a point to any water feature
 * (water polygons + rivers).
 */
function pointToNearestWaterDistance(
  point: Point,
  waterFeatures: WaterFeature[],
  rivers: RiverFeature[]
): number {
  let minDist = Infinity;

  for (const water of waterFeatures) {
    const d = pointToPolygonBoundaryDistance(point, water.polygon.points);
    if (d < minDist) minDist = d;
  }

  for (const river of rivers) {
    const d = pointToRiverDistance(point, river);
    if (d < minDist) minDist = d;
  }

  return minDist;
}

/**
 * Sample points evenly along a road's polyline.
 */
function sampleRoadPoints(road: Road, count: number): Point[] {
  const pts = road.line.points;
  if (pts.length < 2 || count < 2) return [...pts];

  // Calculate total road length
  let totalLength = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    totalLength += distance(pts[i], pts[i + 1]);
  }
  if (totalLength === 0) return [pts[0]];

  const samples: Point[] = [];
  const stepLength = totalLength / (count - 1);

  let segIdx = 0;
  let segProgress = 0; // distance along current segment
  let segLen = distance(pts[0], pts[1]);

  for (let s = 0; s < count; s++) {
    const targetDist = s * stepLength;

    // Walk along segments to find the right position
    let accumulated = 0;
    segIdx = 0;
    segLen = distance(pts[0], pts[1]);

    for (let i = 0; i < pts.length - 1; i++) {
      const len = distance(pts[i], pts[i + 1]);
      if (accumulated + len >= targetDist || i === pts.length - 2) {
        segIdx = i;
        segProgress = targetDist - accumulated;
        segLen = len;
        break;
      }
      accumulated += len;
    }

    const t = segLen > 0 ? Math.min(1, segProgress / segLen) : 0;
    samples.push({
      x: pts[segIdx].x + (pts[segIdx + 1].x - pts[segIdx].x) * t,
      y: pts[segIdx].y + (pts[segIdx + 1].y - pts[segIdx].y) * t,
    });
  }

  return samples;
}

/**
 * Determine waterfront type for a single road.
 * Returns null if the road is not a waterfront road.
 */
function classifyRoad(
  road: Road,
  waterFeatures: WaterFeature[],
  rivers: RiverFeature[],
  beaches: BeachFeature[],
  config: Required<WaterfrontDetectionConfig>
): WaterfrontType | null {
  const pts = road.line.points;
  if (pts.length < 2) return null;

  const samples = sampleRoadPoints(road, config.sampleCount);
  if (samples.length === 0) return null;

  let nearWaterCount = 0;
  let nearBeachCount = 0;

  for (const sample of samples) {
    const waterDist = pointToNearestWaterDistance(sample, waterFeatures, rivers);
    if (waterDist <= config.waterfrontThreshold) {
      nearWaterCount++;
    }

    if (beaches.length > 0) {
      const beachDist = pointToNearestBeachDistance(sample, beaches);
      if (beachDist <= config.boardwalkThreshold) {
        nearBeachCount++;
      }
    }
  }

  const waterfrontFraction = nearWaterCount / samples.length;
  const beachFraction = nearBeachCount / samples.length;

  // Boardwalk: trail or local road near a beach with sufficient coverage
  if (
    beachFraction >= config.minWaterfrontFraction &&
    (road.roadClass === "trail" || road.roadClass === "local")
  ) {
    return "boardwalk";
  }

  // Riverfront drive: any road (preferring arterial/collector) near water with sufficient coverage
  if (waterfrontFraction >= config.minWaterfrontFraction) {
    return "riverfront_drive";
  }

  return null;
}

/**
 * Detect waterfront roads from terrain data.
 *
 * Examines all roads against water features, rivers, and beaches from the
 * terrain data. Roads within threshold distance of water for a sufficient
 * fraction of their length are classified as waterfront.
 *
 * @param roads - All roads in the world
 * @param terrainData - Terrain data containing water features, rivers, and beaches
 * @param config - Optional configuration overrides
 * @returns Map of road ID to waterfront type, plus summary counts
 */
export function detectWaterfrontRoads(
  roads: Road[],
  terrainData: TerrainData | null,
  config: WaterfrontDetectionConfig = {}
): WaterfrontDetectionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const waterfrontRoads = new Map<string, WaterfrontType>();
  let riverfrontCount = 0;
  let boardwalkCount = 0;

  if (!terrainData) {
    return { waterfrontRoads, riverfrontCount, boardwalkCount };
  }

  const waterFeatures = terrainData.water || [];
  const rivers = terrainData.rivers || [];
  const beaches = terrainData.beaches || [];

  // Early exit if no water features at all
  if (waterFeatures.length === 0 && rivers.length === 0) {
    return { waterfrontRoads, riverfrontCount, boardwalkCount };
  }

  for (const road of roads) {
    const classification = classifyRoad(road, waterFeatures, rivers, beaches, cfg);
    if (classification) {
      waterfrontRoads.set(road.id, classification);
      if (classification === "riverfront_drive") {
        riverfrontCount++;
      } else {
        boardwalkCount++;
      }
    }
  }

  return { waterfrontRoads, riverfrontCount, boardwalkCount };
}

/**
 * Apply waterfront detection results to a roads array.
 * Returns a new array with waterfrontType set on matching roads.
 * Roads not in the detection results have their waterfrontType cleared.
 *
 * @param roads - Original roads array
 * @param result - Detection result from detectWaterfrontRoads
 * @returns New roads array with waterfrontType applied (or same reference if unchanged)
 */
export function applyWaterfrontTypes(
  roads: Road[],
  result: WaterfrontDetectionResult
): Road[] {
  if (result.waterfrontRoads.size === 0) {
    // Check if any roads currently have a waterfrontType that needs clearing
    const needsClearing = roads.some((r) => r.waterfrontType);
    if (!needsClearing) return roads;
  }

  let changed = false;
  const updated = roads.map((road) => {
    const newType = result.waterfrontRoads.get(road.id) ?? undefined;
    if (road.waterfrontType !== newType) {
      changed = true;
      return { ...road, waterfrontType: newType };
    }
    return road;
  });

  return changed ? updated : roads;
}
