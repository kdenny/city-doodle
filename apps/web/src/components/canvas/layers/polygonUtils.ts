/**
 * Polygon utility functions for clipping, intersection, and validation.
 *
 * Used for clipping districts against water features.
 */

import type { Point, WaterFeature } from "./types";
import { metersToWorldUnits } from "./districtGenerator";

/**
 * Check if a point is inside a polygon using ray casting algorithm.
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
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
 * Calculate the intersection point of two line segments.
 * Returns null if segments don't intersect.
 */
function lineIntersection(
  p1: Point, p2: Point,
  p3: Point, p4: Point
): Point | null {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 0.0001) return null;

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
  }

  return null;
}

/**
 * Calculate the bounding box of a polygon.
 */
export function getPolygonBounds(points: Point[]): {
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
 * Check if two bounding boxes overlap.
 */
function boundsOverlap(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

/**
 * Calculate the area of a polygon using the shoelace formula.
 * Returns positive for counter-clockwise, negative for clockwise.
 */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }

  return area / 2;
}

/**
 * Check if a district polygon overlaps with any water features.
 */
export function overlapsWater(
  districtPoints: Point[],
  waterFeatures: WaterFeature[]
): boolean {
  const districtBounds = getPolygonBounds(districtPoints);

  for (const water of waterFeatures) {
    const waterBounds = getPolygonBounds(water.polygon.points);

    // Quick bounds check
    if (!boundsOverlap(districtBounds, waterBounds)) {
      continue;
    }

    // Check if any district point is inside water
    for (const point of districtPoints) {
      if (pointInPolygon(point, water.polygon.points)) {
        return true;
      }
    }

    // Check if any water point is inside district
    for (const point of water.polygon.points) {
      if (pointInPolygon(point, districtPoints)) {
        return true;
      }
    }

    // Check for edge intersections
    for (let i = 0; i < districtPoints.length; i++) {
      const d1 = districtPoints[i];
      const d2 = districtPoints[(i + 1) % districtPoints.length];

      for (let j = 0; j < water.polygon.points.length; j++) {
        const w1 = water.polygon.points[j];
        const w2 = water.polygon.points[(j + 1) % water.polygon.points.length];

        if (lineIntersection(d1, d2, w1, w2)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Sutherland-Hodgman polygon clipping algorithm.
 * Clips the subject polygon against the clip polygon (keeps inside).
 */
export function sutherlandHodgmanClip(
  subject: Point[],
  clip: Point[]
): Point[] {
  let output = [...subject];

  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) break;

    const clipEdgeStart = clip[i];
    const clipEdgeEnd = clip[(i + 1) % clip.length];

    const input = output;
    output = [];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];

      const currentInside = isLeft(clipEdgeStart, clipEdgeEnd, current);
      const previousInside = isLeft(clipEdgeStart, clipEdgeEnd, previous);

      if (currentInside) {
        if (!previousInside) {
          const intersection = lineLineIntersection(
            previous, current,
            clipEdgeStart, clipEdgeEnd
          );
          if (intersection) output.push(intersection);
        }
        output.push(current);
      } else if (previousInside) {
        const intersection = lineLineIntersection(
          previous, current,
          clipEdgeStart, clipEdgeEnd
        );
        if (intersection) output.push(intersection);
      }
    }
  }

  return output;
}

/**
 * Check if point c is to the left of line from a to b.
 */
function isLeft(a: Point, b: Point, c: Point): boolean {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) >= 0;
}

/**
 * Line-line intersection for Sutherland-Hodgman.
 */
function lineLineIntersection(
  p1: Point, p2: Point,
  p3: Point, p4: Point
): Point | null {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  };
}

/**
 * Clip a district polygon to exclude water areas.
 * Returns the clipped polygon (land-only area).
 *
 * This uses polygon difference: district - water_union
 *
 * For simplicity, we use a point-based approach:
 * 1. Find points inside land (not in any water)
 * 2. Reconstruct polygon from valid segments
 */
export function clipDistrictToLand(
  districtPoints: Point[],
  waterFeatures: WaterFeature[]
): Point[] {
  if (waterFeatures.length === 0) {
    return districtPoints;
  }

  // For each water feature, clip the district
  let result = [...districtPoints];

  for (const water of waterFeatures) {
    const waterBounds = getPolygonBounds(water.polygon.points);
    const districtBounds = getPolygonBounds(result);

    // Skip if no overlap
    if (!boundsOverlap(districtBounds, waterBounds)) {
      continue;
    }

    // Invert the water polygon for clipping (keep outside)
    // We need to keep the part of district that's NOT in water
    result = clipPolygonOutsideRegion(result, water.polygon.points);

    if (result.length < 3) {
      return []; // Completely in water
    }
  }

  return result;
}

/**
 * Clip a polygon to keep only the part outside a region.
 * This is the complement of Sutherland-Hodgman.
 */
function clipPolygonOutsideRegion(
  subject: Point[],
  region: Point[]
): Point[] {
  // Find all points that are outside the region
  const outsidePoints: Point[] = [];
  const intersectionPoints: { point: Point; index: number }[] = [];

  // Collect points and intersections
  for (let i = 0; i < subject.length; i++) {
    const current = subject[i];
    const next = subject[(i + 1) % subject.length];
    const currentInside = pointInPolygon(current, region);
    const nextInside = pointInPolygon(next, region);

    if (!currentInside) {
      outsidePoints.push(current);
    }

    // Check for intersection with region boundary
    if (currentInside !== nextInside) {
      for (let j = 0; j < region.length; j++) {
        const r1 = region[j];
        const r2 = region[(j + 1) % region.length];
        const intersection = lineIntersection(current, next, r1, r2);
        if (intersection) {
          intersectionPoints.push({ point: intersection, index: i });
          outsidePoints.push(intersection);
          break;
        }
      }
    }
  }

  // If no points are outside, the whole polygon is inside water
  if (outsidePoints.length < 3) {
    return [];
  }

  // Reconstruct the polygon from outside points
  // This is simplified - for complex shapes we'd need proper polygon boolean ops
  return outsidePoints;
}

/**
 * Result of clipping a district against water.
 */
export interface ClipResult {
  /** Whether the district overlaps water at all */
  overlapsWater: boolean;
  /** The clipped polygon (land-only area), empty if fully in water */
  clippedPolygon: Point[];
  /** Original polygon for preview comparison */
  originalPolygon: Point[];
  /** Whether the clipped area is too small (below minimum) */
  tooSmall: boolean;
  /** The area of the clipped polygon */
  clippedArea: number;
  /** The area of the original polygon */
  originalArea: number;
}

/**
 * Minimum block size for area calculations (in meters).
 * A district needs to be at least 2 blocks in each dimension.
 * A typical city block is about 100m, so 2 blocks = 200m minimum.
 */
const MIN_BLOCK_SIZE_METERS = 100;
const MIN_BLOCKS = 2;
const MIN_DISTRICT_METERS = MIN_BLOCK_SIZE_METERS * MIN_BLOCKS; // 200 meters minimum

/**
 * Check if a clipped polygon meets the minimum size requirements.
 * District must be at least 2 blocks wide and 2 blocks long.
 */
export function meetsMinimumSize(
  points: Point[],
  districtType: string
): boolean {
  // Industrial and shopping can be just a single arterial road
  if (districtType === "industrial" || districtType === "commercial" || districtType === "shopping") {
    return points.length >= 3; // Just needs to be a valid polygon
  }

  if (points.length < 3) return false;

  const bounds = getPolygonBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  // Convert minimum size from meters to world units
  const minDimensionWorldUnits = metersToWorldUnits(MIN_DISTRICT_METERS);

  return width >= minDimensionWorldUnits && height >= minDimensionWorldUnits;
}

/**
 * Result of splitting a polygon with a line.
 */
export interface SplitResult {
  /** Whether the split was successful */
  success: boolean;
  /** The two resulting polygons (empty if split failed) */
  polygons: [Point[], Point[]] | null;
  /** Error message if split failed */
  error?: string;
}

/**
 * Split a polygon with a line defined by two points.
 * Returns two new polygons if the line crosses the polygon.
 *
 * @param polygon - The polygon to split
 * @param lineStart - Start point of the split line
 * @param lineEnd - End point of the split line
 * @returns SplitResult with two polygons or error
 */
export function splitPolygonWithLine(
  polygon: Point[],
  lineStart: Point,
  lineEnd: Point
): SplitResult {
  if (polygon.length < 3) {
    return { success: false, polygons: null, error: "Invalid polygon" };
  }

  // Find all intersection points between the line and polygon edges
  const intersections: { point: Point; edgeIndex: number; t: number }[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const intersection = lineSegmentIntersection(lineStart, lineEnd, p1, p2);
    if (intersection) {
      intersections.push({
        point: intersection.point,
        edgeIndex: i,
        t: intersection.t,
      });
    }
  }

  // Need exactly 2 intersections to split
  if (intersections.length !== 2) {
    return {
      success: false,
      polygons: null,
      error: intersections.length === 0
        ? "Line does not cross the polygon"
        : intersections.length === 1
        ? "Line only touches one edge"
        : "Line crosses polygon multiple times",
    };
  }

  // Sort intersections by edge index
  intersections.sort((a, b) => a.edgeIndex - b.edgeIndex);

  const [int1, int2] = intersections;

  // Build the two polygons
  // Polygon 1: from int1 to int2 along the "forward" path
  // Polygon 2: from int2 to int1 along the "backward" path (rest of polygon)

  const polygon1: Point[] = [int1.point];
  const polygon2: Point[] = [int2.point];

  // Walk from int1's edge end to int2's intersection
  for (let i = int1.edgeIndex + 1; i <= int2.edgeIndex; i++) {
    polygon1.push(polygon[i]);
  }
  polygon1.push(int2.point);

  // Walk from int2's edge end back to int1's intersection
  for (let i = int2.edgeIndex + 1; i < polygon.length; i++) {
    polygon2.push(polygon[i]);
  }
  for (let i = 0; i <= int1.edgeIndex; i++) {
    polygon2.push(polygon[i]);
  }
  polygon2.push(int1.point);

  // Validate resulting polygons
  if (polygon1.length < 3 || polygon2.length < 3) {
    return { success: false, polygons: null, error: "Split resulted in invalid polygons" };
  }

  return { success: true, polygons: [polygon1, polygon2] };
}

/**
 * Find intersection between a line (infinite) and a line segment.
 * Returns the intersection point and the parameter t along the segment (0-1).
 */
function lineSegmentIntersection(
  lineStart: Point,
  lineEnd: Point,
  segStart: Point,
  segEnd: Point
): { point: Point; t: number } | null {
  const dx1 = lineEnd.x - lineStart.x;
  const dy1 = lineEnd.y - lineStart.y;
  const dx2 = segEnd.x - segStart.x;
  const dy2 = segEnd.y - segStart.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 0.0001) return null; // Parallel

  const dx3 = segStart.x - lineStart.x;
  const dy3 = segStart.y - lineStart.y;

  // Parameter along the line (not bounded)
  const s = (dx3 * dy2 - dy3 * dx2) / denom;
  // Parameter along the segment (must be 0-1)
  const t = (dx3 * dy1 - dy3 * dx1) / denom;

  // For the split line, we want the line to be unbounded (extend beyond the 2 points)
  // But we still check s is "reasonably" in range to avoid numerical issues
  if (t >= 0 && t <= 1 && s >= -100 && s <= 100) {
    return {
      point: {
        x: segStart.x + t * dx2,
        y: segStart.y + t * dy2,
      },
      t,
    };
  }

  return null;
}

/**
 * Find which district (if any) a point is inside.
 * Returns the district ID or null.
 */
export function findDistrictAtPoint(
  point: Point,
  districts: Array<{ id: string; polygon: { points: Point[] } }>
): string | null {
  for (const district of districts) {
    if (pointInPolygon(point, district.polygon.points)) {
      return district.id;
    }
  }
  return null;
}

/**
 * Clip a district polygon against water features and validate.
 *
 * @param districtPoints - The district polygon to clip
 * @param waterFeatures - Water features to clip against
 * @param districtType - Type of district for minimum size rules
 * @returns ClipResult with clipped polygon and validation info
 */
export function clipAndValidateDistrict(
  districtPoints: Point[],
  waterFeatures: WaterFeature[],
  districtType: string
): ClipResult {
  const originalArea = Math.abs(polygonArea(districtPoints));
  const hasWaterOverlap = overlapsWater(districtPoints, waterFeatures);

  if (!hasWaterOverlap) {
    return {
      overlapsWater: false,
      clippedPolygon: districtPoints,
      originalPolygon: districtPoints,
      tooSmall: !meetsMinimumSize(districtPoints, districtType),
      clippedArea: originalArea,
      originalArea,
    };
  }

  const clippedPolygon = clipDistrictToLand(districtPoints, waterFeatures);
  const clippedArea = clippedPolygon.length >= 3 ? Math.abs(polygonArea(clippedPolygon)) : 0;
  const tooSmall = !meetsMinimumSize(clippedPolygon, districtType);

  return {
    overlapsWater: true,
    clippedPolygon,
    originalPolygon: districtPoints,
    tooSmall,
    clippedArea,
    originalArea,
  };
}
