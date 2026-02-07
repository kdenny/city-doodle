/**
 * Interchange detection for highways (CITY-150).
 *
 * Detects where a newly drawn highway crosses existing arterial/collector roads
 * and generates interchange markers at those intersection points.
 */

import type { Road, Point, Interchange, InterchangeType } from "./types";
import { generateId } from "../../../utils/idGenerator";

/**
 * Find intersection point of two line segments (p1-p2 and p3-p4).
 * Returns the intersection point if the segments cross, or null.
 */
function segmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null; // Parallel or coincident

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

  // Check if intersection is within both segments
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return {
    x: p1.x + t * d1x,
    y: p1.y + t * d1y,
  };
}

/**
 * Find all intersection points between two polylines.
 */
function findPolylineIntersections(
  lineA: Point[],
  lineB: Point[]
): Point[] {
  const intersections: Point[] = [];

  for (let i = 0; i < lineA.length - 1; i++) {
    for (let j = 0; j < lineB.length - 1; j++) {
      const pt = segmentIntersection(
        lineA[i],
        lineA[i + 1],
        lineB[j],
        lineB[j + 1]
      );
      if (pt) {
        // Deduplicate: skip if very close to an existing intersection
        const isDuplicate = intersections.some(
          (existing) =>
            Math.abs(existing.x - pt.x) < 1 &&
            Math.abs(existing.y - pt.y) < 1
        );
        if (!isDuplicate) {
          intersections.push(pt);
        }
      }
    }
  }

  return intersections;
}

/**
 * Detect interchanges where a highway crosses existing roads.
 *
 * Only arterial and collector roads generate interchanges (local streets
 * and trails don't connect to highways). Other highways create simple
 * crossings without interchanges.
 */
export function detectInterchanges(
  highway: Road,
  existingRoads: Road[],
  type: InterchangeType = "diamond"
): Interchange[] {
  const interchanges: Interchange[] = [];
  const highwayPoints = highway.line.points;

  if (highwayPoints.length < 2) return interchanges;

  for (const road of existingRoads) {
    // Only create interchanges with arterials and collectors
    if (road.roadClass !== "arterial" && road.roadClass !== "collector") {
      continue;
    }

    // Skip self
    if (road.id === highway.id) continue;

    const roadPoints = road.line.points;
    if (roadPoints.length < 2) continue;

    const intersections = findPolylineIntersections(highwayPoints, roadPoints);

    for (const position of intersections) {
      interchanges.push({
        id: generateId("interchange"),
        type,
        position,
        highwayId: highway.id,
        connectedRoadId: road.id,
      });
    }
  }

  return interchanges;
}

