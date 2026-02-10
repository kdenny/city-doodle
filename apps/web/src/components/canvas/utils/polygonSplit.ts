/**
 * Polygon splitting utility using polygon-clipping library.
 *
 * Splits a polygon along a polyline by creating a thin "blade" polygon
 * from the line and using polygon difference to cut the polygon into pieces.
 *
 * CITY-565: Implement split tool for districts, cities, and neighborhoods.
 */

import polygonClipping from "polygon-clipping";
import type { Point } from "../layers";

/** Offset distance (in world units) for creating the blade polygon from a line. */
const BLADE_HALF_WIDTH = 0.1;

/**
 * Split a polygon along a polyline defined by points.
 * Returns the two largest resulting polygons, or null if the line
 * doesn't fully cross the polygon.
 *
 * @param polygonPoints - The polygon to split
 * @param linePoints - The polyline that cuts across the polygon (2+ points)
 * @returns Tuple of two polygon point arrays, or null if split failed
 */
export function splitPolygonByLine(
  polygonPoints: Point[],
  linePoints: Point[]
): [Point[], Point[]] | null {
  if (polygonPoints.length < 3 || linePoints.length < 2) {
    return null;
  }

  // 1. Create a thin "blade" polygon from the line by offsetting each side
  const blade = createBladePolygon(linePoints, BLADE_HALF_WIDTH);
  if (!blade || blade.length < 3) {
    return null;
  }

  // 2. Convert to polygon-clipping format: [ring][point][x,y]
  const subjectPoly: polygonClipping.Polygon = [
    polygonPoints.map((p) => [p.x, p.y] as [number, number]),
  ];
  const bladePoly: polygonClipping.Polygon = [
    blade.map((p) => [p.x, p.y] as [number, number]),
  ];

  // 3. Use polygon-clipping difference to cut the polygon
  let result: polygonClipping.MultiPolygon;
  try {
    result = polygonClipping.difference(subjectPoly, bladePoly);
  } catch {
    return null;
  }

  // 4. Need at least 2 pieces
  if (result.length < 2) {
    return null;
  }

  // 5. Convert results back to Point arrays and sort by area (largest first)
  const pieces: Point[][] = result.map((poly) =>
    // Take the outer ring (first ring), skip holes
    stripDuplicateClosingPoint(
      poly[0].map(([x, y]: [number, number]) => ({ x, y }))
    )
  );

  // Sort by absolute area descending
  pieces.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));

  // Return the two largest pieces
  if (pieces.length < 2 || pieces[0].length < 3 || pieces[1].length < 3) {
    return null;
  }

  return [pieces[0], pieces[1]];
}

/**
 * Validate that a split line crosses a polygon boundary on both sides.
 * The line must enter and exit the polygon to produce a valid split.
 *
 * @param polygonPoints - The polygon boundary
 * @param linePoints - The split line points
 * @returns true if the line crosses the polygon boundary at least twice
 */
export function validateSplitLine(
  polygonPoints: Point[],
  linePoints: Point[]
): boolean {
  if (polygonPoints.length < 3 || linePoints.length < 2) {
    return false;
  }

  // Count intersections between the line segments and polygon edges
  let intersectionCount = 0;

  for (let li = 0; li < linePoints.length - 1; li++) {
    const la = linePoints[li];
    const lb = linePoints[li + 1];

    for (let pi = 0; pi < polygonPoints.length; pi++) {
      const pa = polygonPoints[pi];
      const pb = polygonPoints[(pi + 1) % polygonPoints.length];

      if (segmentsIntersect(la, lb, pa, pb)) {
        intersectionCount++;
      }
    }
  }

  // Need at least 2 crossings (enter and exit)
  return intersectionCount >= 2;
}

/**
 * Create a thin polygon (blade) from a polyline by offsetting perpendicular
 * to each segment on both sides.
 */
function createBladePolygon(
  linePoints: Point[],
  halfWidth: number
): Point[] | null {
  if (linePoints.length < 2) return null;

  // Extend the line beyond both endpoints to ensure it crosses the polygon fully
  const extendAmount = 2.0; // world units to extend past endpoints
  const extendedLine = extendLine(linePoints, extendAmount);

  const leftSide: Point[] = [];
  const rightSide: Point[] = [];

  for (let i = 0; i < extendedLine.length; i++) {
    let nx: number, ny: number;

    if (i === 0) {
      // First point: use direction of first segment
      const dx = extendedLine[1].x - extendedLine[0].x;
      const dy = extendedLine[1].y - extendedLine[0].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-10) return null;
      nx = -dy / len;
      ny = dx / len;
    } else if (i === extendedLine.length - 1) {
      // Last point: use direction of last segment
      const dx =
        extendedLine[i].x - extendedLine[i - 1].x;
      const dy =
        extendedLine[i].y - extendedLine[i - 1].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-10) return null;
      nx = -dy / len;
      ny = dx / len;
    } else {
      // Interior point: average normals of adjacent segments
      const dx1 = extendedLine[i].x - extendedLine[i - 1].x;
      const dy1 = extendedLine[i].y - extendedLine[i - 1].y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const dx2 = extendedLine[i + 1].x - extendedLine[i].x;
      const dy2 = extendedLine[i + 1].y - extendedLine[i].y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      const n1x = len1 > 1e-10 ? -dy1 / len1 : 0;
      const n1y = len1 > 1e-10 ? dx1 / len1 : 0;
      const n2x = len2 > 1e-10 ? -dy2 / len2 : 0;
      const n2y = len2 > 1e-10 ? dx2 / len2 : 0;

      const avgX = n1x + n2x;
      const avgY = n1y + n2y;
      const avgLen = Math.sqrt(avgX * avgX + avgY * avgY);
      if (avgLen < 1e-10) {
        nx = n1x;
        ny = n1y;
      } else {
        nx = avgX / avgLen;
        ny = avgY / avgLen;
      }
    }

    leftSide.push({
      x: extendedLine[i].x + nx * halfWidth,
      y: extendedLine[i].y + ny * halfWidth,
    });
    rightSide.push({
      x: extendedLine[i].x - nx * halfWidth,
      y: extendedLine[i].y - ny * halfWidth,
    });
  }

  // Form a closed polygon: left side forward, right side reversed
  return [...leftSide, ...rightSide.reverse()];
}

/**
 * Extend a polyline beyond its endpoints by a given distance.
 */
function extendLine(points: Point[], amount: number): Point[] {
  if (points.length < 2) return points;

  const result = [...points];

  // Extend start
  const dx0 = points[1].x - points[0].x;
  const dy0 = points[1].y - points[0].y;
  const len0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
  if (len0 > 1e-10) {
    result[0] = {
      x: points[0].x - (dx0 / len0) * amount,
      y: points[0].y - (dy0 / len0) * amount,
    };
  }

  // Extend end
  const last = points.length - 1;
  const dxN = points[last].x - points[last - 1].x;
  const dyN = points[last].y - points[last - 1].y;
  const lenN = Math.sqrt(dxN * dxN + dyN * dyN);
  if (lenN > 1e-10) {
    result[last] = {
      x: points[last].x + (dxN / lenN) * amount,
      y: points[last].y + (dyN / lenN) * amount,
    };
  }

  return result;
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
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return false;

  const dx = b1.x - a1.x;
  const dy = b1.y - a1.y;

  const t = (dx * d2y - dy * d2x) / denom;
  const u = (dx * d1y - dy * d1x) / denom;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Calculate the signed area of a polygon using the shoelace formula.
 */
function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return area / 2;
}

/**
 * Strip the duplicate closing point that polygon-clipping appends
 * (where the last point equals the first).
 */
function stripDuplicateClosingPoint(points: Point[]): Point[] {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (
    Math.abs(first.x - last.x) < 1e-6 &&
    Math.abs(first.y - last.y) < 1e-6
  ) {
    return points.slice(0, -1);
  }
  return points;
}

/**
 * Calculate the centroid of a polygon.
 */
export function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}
