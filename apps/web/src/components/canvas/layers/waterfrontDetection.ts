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
import { getPolygonBounds } from "./polygonUtils";

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
 * CITY-617: Grid-based spatial index for water polygon boundary queries.
 *
 * Each water feature is inserted into every cell its bounding box overlaps,
 * expanded by a buffer. A point query returns only water features whose
 * expanded bounding box covers the queried cell.
 */
class WaterBoundarySpatialIndex {
  private cellSize: number;
  private grid: Map<string, WaterFeature[]> = new Map();

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  build(waterFeatures: WaterFeature[], buffer: number): void {
    this.grid.clear();
    for (const water of waterFeatures) {
      const bounds = getPolygonBounds(water.polygon.points);
      const minCellX = Math.floor((bounds.minX - buffer) / this.cellSize);
      const minCellY = Math.floor((bounds.minY - buffer) / this.cellSize);
      const maxCellX = Math.floor((bounds.maxX + buffer) / this.cellSize);
      const maxCellY = Math.floor((bounds.maxY + buffer) / this.cellSize);

      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cy = minCellY; cy <= maxCellY; cy++) {
          const key = `${cx},${cy}`;
          let bucket = this.grid.get(key);
          if (!bucket) {
            bucket = [];
            this.grid.set(key, bucket);
          }
          bucket.push(water);
        }
      }
    }
  }

  getCandidates(x: number, y: number): WaterFeature[] {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    return this.grid.get(key) || [];
  }
}

/**
 * CITY-617: Grid-based spatial index for river centerline queries.
 *
 * Each river is inserted into every cell its bounding box (expanded by
 * half-width + buffer) overlaps.
 */
class RiverBoundarySpatialIndex {
  private cellSize: number;
  private grid: Map<string, RiverFeature[]> = new Map();

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  build(rivers: RiverFeature[], buffer: number): void {
    this.grid.clear();
    for (const river of rivers) {
      const pts = river.line.points;
      if (pts.length < 2) continue;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      // Expand by half the river width + buffer
      const expand = (river.width || 3) / 2 + buffer;
      const minCellX = Math.floor((minX - expand) / this.cellSize);
      const minCellY = Math.floor((minY - expand) / this.cellSize);
      const maxCellX = Math.floor((maxX + expand) / this.cellSize);
      const maxCellY = Math.floor((maxY + expand) / this.cellSize);

      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cy = minCellY; cy <= maxCellY; cy++) {
          const key = `${cx},${cy}`;
          let bucket = this.grid.get(key);
          if (!bucket) {
            bucket = [];
            this.grid.set(key, bucket);
          }
          bucket.push(river);
        }
      }
    }
  }

  getCandidates(x: number, y: number): RiverFeature[] {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    return this.grid.get(key) || [];
  }
}

/**
 * CITY-617: Grid-based spatial index for beach polygon boundary queries.
 */
class BeachBoundarySpatialIndex {
  private cellSize: number;
  private grid: Map<string, BeachFeature[]> = new Map();

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  build(beaches: BeachFeature[], buffer: number): void {
    this.grid.clear();
    for (const beach of beaches) {
      const bounds = getPolygonBounds(beach.polygon.points);
      const minCellX = Math.floor((bounds.minX - buffer) / this.cellSize);
      const minCellY = Math.floor((bounds.minY - buffer) / this.cellSize);
      const maxCellX = Math.floor((bounds.maxX + buffer) / this.cellSize);
      const maxCellY = Math.floor((bounds.maxY + buffer) / this.cellSize);

      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cy = minCellY; cy <= maxCellY; cy++) {
          const key = `${cx},${cy}`;
          let bucket = this.grid.get(key);
          if (!bucket) {
            bucket = [];
            this.grid.set(key, bucket);
          }
          bucket.push(beach);
        }
      }
    }
  }

  getCandidates(x: number, y: number): BeachFeature[] {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    return this.grid.get(key) || [];
  }
}

/**
 * CITY-617: Bundled spatial indices for waterfront detection.
 * Built once per detectWaterfrontRoads() call.
 */
interface WaterfrontSpatialIndices {
  waterIndex: WaterBoundarySpatialIndex;
  riverIndex: RiverBoundarySpatialIndex;
  beachIndex: BeachBoundarySpatialIndex;
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
 *
 * CITY-617: When a spatial index is provided, only nearby beaches are checked.
 */
function pointToNearestBeachDistance(
  point: Point,
  beaches: BeachFeature[],
  beachIndex?: BeachBoundarySpatialIndex
): number {
  const candidates = beachIndex ? beachIndex.getCandidates(point.x, point.y) : beaches;
  let minDist = Infinity;
  for (const beach of candidates) {
    const d = pointToPolygonBoundaryDistance(point, beach.polygon.points);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Calculate the minimum distance from a point to any water feature
 * (water polygons + rivers).
 *
 * CITY-617: When spatial indices are provided, only nearby features are checked.
 */
function pointToNearestWaterDistance(
  point: Point,
  waterFeatures: WaterFeature[],
  rivers: RiverFeature[],
  indices?: WaterfrontSpatialIndices
): number {
  let minDist = Infinity;

  const waterCandidates = indices ? indices.waterIndex.getCandidates(point.x, point.y) : waterFeatures;
  for (const water of waterCandidates) {
    const d = pointToPolygonBoundaryDistance(point, water.polygon.points);
    if (d < minDist) minDist = d;
  }

  const riverCandidates = indices ? indices.riverIndex.getCandidates(point.x, point.y) : rivers;
  for (const river of riverCandidates) {
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
 *
 * CITY-617: When spatial indices are provided, only nearby features are checked
 * per sample point instead of iterating all features.
 */
function classifyRoad(
  road: Road,
  waterFeatures: WaterFeature[],
  rivers: RiverFeature[],
  beaches: BeachFeature[],
  config: Required<WaterfrontDetectionConfig>,
  indices?: WaterfrontSpatialIndices
): WaterfrontType | null {
  const pts = road.line.points;
  if (pts.length < 2) return null;

  const samples = sampleRoadPoints(road, config.sampleCount);
  if (samples.length === 0) return null;

  let nearWaterCount = 0;
  let nearBeachCount = 0;

  for (const sample of samples) {
    const waterDist = pointToNearestWaterDistance(sample, waterFeatures, rivers, indices);
    if (waterDist <= config.waterfrontThreshold) {
      nearWaterCount++;
    }

    if (beaches.length > 0) {
      const beachDist = pointToNearestBeachDistance(sample, beaches, indices?.beachIndex);
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
 * CITY-617: Builds spatial indices once for water features, rivers, and beaches,
 * then passes them to per-road classification for O(1) proximity lookups instead
 * of O(n) brute-force iteration.
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

  // CITY-617: Build spatial indices once for all feature types.
  // The buffer ensures features near a cell boundary are still found.
  const maxBuffer = Math.max(cfg.waterfrontThreshold, cfg.boardwalkThreshold);
  const waterIndex = new WaterBoundarySpatialIndex();
  waterIndex.build(waterFeatures, maxBuffer);
  const riverIndex = new RiverBoundarySpatialIndex();
  riverIndex.build(rivers, maxBuffer);
  const beachIndex = new BeachBoundarySpatialIndex();
  beachIndex.build(beaches, maxBuffer);
  const indices: WaterfrontSpatialIndices = { waterIndex, riverIndex, beachIndex };

  for (const road of roads) {
    const classification = classifyRoad(road, waterFeatures, rivers, beaches, cfg, indices);
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
