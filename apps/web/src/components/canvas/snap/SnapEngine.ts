/**
 * Snap engine for finding snap points near a cursor position.
 *
 * Uses a spatial index for efficient queries and supports multiple
 * snap point types (vertex, midpoint, nearest, intersection).
 */

import { SpatialIndex } from "./SpatialIndex";
import type {
  Point,
  SnapPoint,
  SnapLineSegment,
  SnapConfig,
  SnapResult,
  SnapGeometryProvider,
  BoundingBox,
} from "./types";
import { DEFAULT_SNAP_CONFIG } from "./types";

/**
 * Calculate the distance between two points.
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the nearest point on a line segment to a given point.
 */
function nearestPointOnSegment(
  point: Point,
  p1: Point,
  p2: Point
): { point: Point; t: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Degenerate segment (point)
    return { point: { x: p1.x, y: p1.y }, t: 0 };
  }

  // Project point onto line, clamped to segment
  const t = Math.max(
    0,
    Math.min(1, ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq)
  );

  return {
    point: {
      x: p1.x + t * dx,
      y: p1.y + t * dy,
    },
    t,
  };
}

/**
 * Find the midpoint of a line segment.
 */
function midpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Find intersection point of two line segments, if any.
 */
function segmentIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point
): Point | null {
  const dxa = a2.x - a1.x;
  const dya = a2.y - a1.y;
  const dxb = b2.x - b1.x;
  const dyb = b2.y - b1.y;

  const denominator = dxa * dyb - dya * dxb;

  // Parallel lines
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  const dxab = b1.x - a1.x;
  const dyab = b1.y - a1.y;

  const t = (dxab * dyb - dyab * dxb) / denominator;
  const u = (dxab * dya - dyab * dxa) / denominator;

  // Check if intersection is within both segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: a1.x + t * dxa,
      y: a1.y + t * dya,
    };
  }

  return null;
}

export class SnapEngine {
  private index: SpatialIndex;
  private config: SnapConfig;
  private providers: SnapGeometryProvider[] = [];

  constructor(config: Partial<SnapConfig> = {}) {
    this.config = { ...DEFAULT_SNAP_CONFIG, ...config };
    this.index = new SpatialIndex();
  }

  /**
   * Updates the snap configuration.
   */
  setConfig(config: Partial<SnapConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): SnapConfig {
    return { ...this.config };
  }

  /**
   * Registers a geometry provider.
   */
  registerProvider(provider: SnapGeometryProvider): void {
    this.providers.push(provider);
    this.rebuildIndex();
  }

  /**
   * Unregisters a geometry provider.
   */
  unregisterProvider(provider: SnapGeometryProvider): void {
    const idx = this.providers.indexOf(provider);
    if (idx >= 0) {
      this.providers.splice(idx, 1);
      this.rebuildIndex();
    }
  }

  /**
   * Clears all providers and rebuilds the index.
   */
  clearProviders(): void {
    this.providers = [];
    this.index.clear();
  }

  /**
   * Rebuilds the spatial index from all providers.
   */
  rebuildIndex(): void {
    this.index.clear();

    for (const provider of this.providers) {
      const segments = provider.getLineSegments();
      this.index.insertAll(segments);
    }
  }

  /**
   * Manually inserts line segments into the index.
   */
  insertSegments(segments: SnapLineSegment[]): void {
    this.index.insertAll(segments);
  }

  /**
   * Clears the index.
   */
  clear(): void {
    this.index.clear();
  }

  /**
   * Finds the best snap point near a cursor position.
   */
  findSnapPoint(cursorX: number, cursorY: number): SnapResult {
    const cursor: Point = { x: cursorX, y: cursorY };
    const candidates: SnapPoint[] = [];

    // Query nearby segments
    const nearbySegments = this.index.query(cursor, this.config.threshold);

    // Filter by geometry type if configured
    const filteredSegments =
      this.config.geometryTypes && this.config.geometryTypes.length > 0
        ? nearbySegments.filter((s) =>
            this.config.geometryTypes!.includes(s.geometryType)
          )
        : nearbySegments;

    // Find snap points from each segment
    for (const segment of filteredSegments) {
      // Vertex snapping
      if (this.config.snapToVertex) {
        this.addVertexSnapPoints(cursor, segment, candidates);
      }

      // Midpoint snapping
      if (this.config.snapToMidpoint) {
        this.addMidpointSnapPoint(cursor, segment, candidates);
      }

      // Nearest point snapping
      if (this.config.snapToNearest) {
        this.addNearestSnapPoint(cursor, segment, candidates);
      }
    }

    // Intersection snapping (requires comparing pairs of segments)
    if (this.config.snapToIntersection && filteredSegments.length > 1) {
      this.addIntersectionSnapPoints(cursor, filteredSegments, candidates);
    }

    // Filter by threshold and sort by distance
    const validCandidates = candidates
      .filter((c) => c.distance <= this.config.threshold)
      .sort((a, b) => a.distance - b.distance);

    return {
      snapPoint: validCandidates[0] || null,
      candidates: validCandidates,
    };
  }

  private addVertexSnapPoints(
    cursor: Point,
    segment: SnapLineSegment,
    candidates: SnapPoint[]
  ): void {
    const { p1, p2, geometryId, geometryType } = segment;

    // Start vertex
    const d1 = distance(cursor, p1);
    candidates.push({
      x: p1.x,
      y: p1.y,
      type: "vertex",
      geometryId,
      geometryType,
      distance: d1,
    });

    // End vertex
    const d2 = distance(cursor, p2);
    candidates.push({
      x: p2.x,
      y: p2.y,
      type: "vertex",
      geometryId,
      geometryType,
      distance: d2,
    });
  }

  private addMidpointSnapPoint(
    cursor: Point,
    segment: SnapLineSegment,
    candidates: SnapPoint[]
  ): void {
    const { p1, p2, geometryId, geometryType } = segment;
    const mid = midpoint(p1, p2);
    const d = distance(cursor, mid);

    candidates.push({
      x: mid.x,
      y: mid.y,
      type: "midpoint",
      geometryId,
      geometryType,
      distance: d,
    });
  }

  private addNearestSnapPoint(
    cursor: Point,
    segment: SnapLineSegment,
    candidates: SnapPoint[]
  ): void {
    const { p1, p2, geometryId, geometryType } = segment;
    const { point: nearest, t } = nearestPointOnSegment(cursor, p1, p2);

    // Don't add if it's at a vertex (already covered)
    if (t > 0.01 && t < 0.99) {
      const d = distance(cursor, nearest);
      candidates.push({
        x: nearest.x,
        y: nearest.y,
        type: "nearest",
        geometryId,
        geometryType,
        distance: d,
      });
    }
  }

  private addIntersectionSnapPoints(
    cursor: Point,
    segments: SnapLineSegment[],
    candidates: SnapPoint[]
  ): void {
    // Check pairs of segments for intersections
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i];
        const s2 = segments[j];

        // Skip if same geometry
        if (s1.geometryId === s2.geometryId) continue;

        const intersection = segmentIntersection(s1.p1, s1.p2, s2.p1, s2.p2);
        if (intersection) {
          const d = distance(cursor, intersection);

          candidates.push({
            x: intersection.x,
            y: intersection.y,
            type: "intersection",
            geometryId: `${s1.geometryId}:${s2.geometryId}`,
            geometryType: "intersection",
            distance: d,
          });
        }
      }
    }
  }

  /**
   * Gets the bounding box of all indexed geometry.
   */
  getBounds(): BoundingBox | null {
    return this.index.getBounds();
  }
}
