/**
 * Pure geometry helper functions for polygon, line, and point operations.
 *
 * These are low-level math operations used by street grid generation,
 * district overlap detection, and other spatial computations.
 * For higher-level polygon operations (clipping, area, splitting),
 * see polygonUtils.ts.
 */

import type { Point } from "./types";

/**
 * Calculate the axis-aligned bounding box of a polygon.
 *
 * @param points - Polygon vertices
 * @returns Object with minX, maxX, minY, maxY bounds
 */
export function getPolygonBounds(points: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
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
 * Find all intersection points where a line segment crosses polygon edges.
 * Results are sorted by distance from the line start point.
 *
 * Used by street grid generation to clip grid lines to district boundaries.
 *
 * @param x1 - Line segment start X
 * @param y1 - Line segment start Y
 * @param x2 - Line segment end X
 * @param y2 - Line segment end Y
 * @param polygon - Polygon vertices (closed loop, last edge connects back to first)
 * @returns Intersection points sorted by distance from (x1, y1)
 */
export function lineIntersectsPolygon(
  x1: number, y1: number,
  x2: number, y2: number,
  polygon: Point[]
): Point[] {
  const intersections: Point[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const intersection = lineLineIntersection(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y);
    if (intersection) {
      intersections.push(intersection);
    }
  }

  // Sort by distance from start point
  intersections.sort((a, b) => {
    const distA = (a.x - x1) ** 2 + (a.y - y1) ** 2;
    const distB = (b.x - x1) ** 2 + (b.y - y1) ** 2;
    return distA - distB;
  });

  return intersections;
}

/**
 * Calculate intersection point of two line segments using parametric form.
 * Uses the standard line-line intersection formula with parameters t and u,
 * where t ∈ [0,1] means the intersection is on the first segment and
 * u ∈ [0,1] means it's on the second.
 *
 * @param x1 - First segment start X
 * @param y1 - First segment start Y
 * @param x2 - First segment end X
 * @param y2 - First segment end Y
 * @param x3 - Second segment start X
 * @param y3 - Second segment start Y
 * @param x4 - Second segment end X
 * @param y4 - Second segment end Y
 * @returns Intersection point, or null if segments are parallel or don't intersect
 */
export function lineLineIntersection(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): Point | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
}

/**
 * Check if a point is inside a polygon using the ray casting algorithm.
 * Casts a ray from the point to the right (+X) and counts edge crossings;
 * an odd count means inside.
 *
 * @param x - Test point X coordinate
 * @param y - Test point Y coordinate
 * @param polygon - Polygon vertices (minimum 3)
 * @returns true if the point is inside the polygon
 */
export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate the geometric centroid of a polygon (average of all vertices).
 * Note: This is the vertex centroid, not the area centroid. For convex polygons
 * with evenly distributed vertices the difference is negligible.
 *
 * @param polygon - Polygon vertices
 * @returns Centroid point, or (0,0) for empty polygons
 */
export function getPolygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const point of polygon) {
    sumX += point.x;
    sumY += point.y;
  }
  return {
    x: sumX / polygon.length,
    y: sumY / polygon.length,
  };
}

/**
 * Rotate a point around a center by a given angle using a 2D rotation matrix.
 *
 * @param point - The point to rotate
 * @param center - The center of rotation
 * @param angle - Rotation angle in radians (positive = counter-clockwise)
 * @returns New rotated point
 */
export function rotatePoint(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/**
 * Calculate the shortest distance from a point to a line segment.
 * Projects the point onto the infinite line, then clamps the projection
 * parameter t to [0, 1] so the nearest point stays on the segment.
 *
 * @param point - The test point
 * @param lineStart - Segment start endpoint
 * @param lineEnd - Segment end endpoint
 * @returns Euclidean distance from point to nearest point on segment
 */
export function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Line segment is a point
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  // Project point onto line, clamped to segment
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Check if a point is within tolerance distance of any polygon edge.
 * Used to detect perimeter roads whose endpoints are clipped to the boundary.
 *
 * @param point - The test point
 * @param polygon - Polygon vertices
 * @param tolerance - Maximum distance in world units to be considered "near"
 * @returns true if point is within tolerance of any edge
 */
export function isPointNearPolygonEdge(
  point: Point,
  polygon: Point[],
  tolerance: number
): boolean {
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    const dist = pointToLineDistance(point, p1, p2);
    if (dist < tolerance) return true;
  }
  return false;
}
