/**
 * Path simplification utilities for freehand drawing.
 *
 * Uses the Douglas-Peucker algorithm to reduce the number of points
 * in a path while preserving the overall shape.
 */

import type { Point } from "./layers";

/**
 * Calculate the perpendicular distance from a point to a line segment.
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Line length squared
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Line segment is a point
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  // Calculate projection parameter
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;

  if (t < 0) {
    // Closest point is lineStart
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  if (t > 1) {
    // Closest point is lineEnd
    const pdx = point.x - lineEnd.x;
    const pdy = point.y - lineEnd.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  // Closest point is on the line segment
  const closestX = lineStart.x + t * dx;
  const closestY = lineStart.y + t * dy;
  const pdx = point.x - closestX;
  const pdy = point.y - closestY;
  return Math.sqrt(pdx * pdx + pdy * pdy);
}

/**
 * Douglas-Peucker algorithm for path simplification.
 *
 * Recursively removes points that are within the tolerance distance
 * of the line between the endpoints.
 *
 * @param points - Array of points to simplify
 * @param tolerance - Maximum distance a point can be from the simplified line
 * @returns Simplified array of points
 */
export function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with the maximum distance from the line between first and last
  let maxDistance = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If the max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    // Split at maxIndex and simplify both halves
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);

    // Combine results (excluding duplicate point at maxIndex)
    return [...left.slice(0, -1), ...right];
  } else {
    // All points are within tolerance, only keep endpoints
    return [first, last];
  }
}

/**
 * Simplify a path with adaptive tolerance based on path length.
 *
 * Longer paths get more aggressive simplification to keep
 * the vertex count manageable.
 *
 * @param points - Array of points to simplify
 * @param baseTolerance - Base tolerance value (default: 3)
 * @param maxVertices - Target maximum vertex count (default: 50)
 * @returns Simplified array of points
 */
export function simplifyPath(
  points: Point[],
  baseTolerance: number = 3,
  maxVertices: number = 50
): Point[] {
  if (points.length <= 3) {
    return points;
  }

  // Calculate path length
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    pathLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Start with base tolerance
  let tolerance = baseTolerance;
  let simplified = douglasPeucker(points, tolerance);

  // Increase tolerance if still too many vertices
  while (simplified.length > maxVertices && tolerance < pathLength / 10) {
    tolerance *= 1.5;
    simplified = douglasPeucker(points, tolerance);
  }

  return simplified;
}

/**
 * Sample points at regular intervals during freehand drawing.
 * This helps avoid too many points from high-frequency mouse events.
 *
 * @param lastPoint - Last sampled point
 * @param newPoint - New point to potentially sample
 * @param minDistance - Minimum distance between samples (default: 5)
 * @returns true if the new point should be sampled
 */
export function shouldSamplePoint(
  lastPoint: Point | null,
  newPoint: Point,
  minDistance: number = 5
): boolean {
  if (!lastPoint) return true;

  const dx = newPoint.x - lastPoint.x;
  const dy = newPoint.y - lastPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance >= minDistance;
}
