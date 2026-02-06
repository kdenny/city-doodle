/**
 * Douglas-Peucker path simplification algorithm.
 *
 * Reduces the number of points in a polygon while preserving its shape.
 * Used for freehand drawing to convert high-density mouse samples into
 * a clean polygon with fewer vertices.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculate perpendicular distance from a point to a line segment.
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Handle degenerate case where line segment is a point
  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
    );
  }

  const lineLengthSquared = dx * dx + dy * dy;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
        lineLengthSquared
    )
  );

  const projectionX = lineStart.x + t * dx;
  const projectionY = lineStart.y + t * dy;

  return Math.sqrt(
    (point.x - projectionX) ** 2 + (point.y - projectionY) ** 2
  );
}

/**
 * Douglas-Peucker algorithm for path simplification.
 *
 * @param points - Array of points to simplify
 * @param epsilon - Maximum distance threshold for point elimination
 * @returns Simplified array of points
 */
export function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with maximum distance from the line between first and last
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

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIndex), epsilon);

    // Concatenate results, removing duplicate point at the junction
    return [...left.slice(0, -1), ...right];
  }

  // All points are within epsilon, return just endpoints
  return [first, last];
}

/**
 * Simplify a polygon path with Douglas-Peucker algorithm.
 *
 * This is a wrapper that handles the closed polygon case by treating
 * the path as a ring and ensuring the result is still a valid polygon.
 *
 * @param points - Polygon vertices
 * @param epsilon - Simplification tolerance (higher = fewer points)
 * @returns Simplified polygon vertices
 */
export function simplifyPolygon(points: Point[], epsilon: number): Point[] {
  if (points.length < 4) {
    // Need at least 3 unique points for a valid polygon
    return points;
  }

  // For closed polygons, we process as open path and let caller handle closure
  const simplified = douglasPeucker(points, epsilon);

  // Ensure we still have a valid polygon (minimum 3 points)
  if (simplified.length < 3) {
    // Fall back to returning first, middle, and last points
    const mid = Math.floor(points.length / 2);
    return [points[0], points[mid], points[points.length - 1]];
  }

  return simplified;
}

/**
 * Calculate a reasonable epsilon value based on path dimensions.
 *
 * @param points - Path points
 * @param targetReduction - Target reduction ratio (e.g., 0.1 = 10% of original points)
 * @returns Suggested epsilon value
 */
export function calculateAutoEpsilon(points: Point[], targetReduction = 0.15): number {
  if (points.length < 3) return 1;

  // Calculate bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  // Use a percentage of the diagonal as epsilon
  const diagonal = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);

  // Scale epsilon based on how many points we want to keep
  // More points = lower epsilon = more detail preserved
  return diagonal * targetReduction * 0.02;
}
