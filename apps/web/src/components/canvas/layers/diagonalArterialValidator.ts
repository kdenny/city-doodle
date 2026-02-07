/**
 * Diagonal arterial validator and grid adjustment module.
 *
 * When a user draws an arterial road that cuts diagonally through a district,
 * this module validates constraints (minimum angle, per-district limit) and
 * splits intersecting grid streets to create T-intersections.
 */

import type { Point, Road, District } from "./types";
import { pointInPolygon } from "./polygonUtils";

/** Minimum angle (radians) between arterial and grid to qualify as "diagonal" */
const MIN_DIAGONAL_ANGLE = Math.PI / 12; // 15 degrees

/** Maximum number of diagonal arterials allowed per district */
const MAX_DIAGONALS_PER_DISTRICT = 2;

/**
 * Find the intersection point of two line segments.
 * Returns null if segments don't intersect.
 */
function segmentIntersection(
  a1: Point, a2: Point,
  b1: Point, b2: Point
): Point | null {
  const dx1 = a2.x - a1.x;
  const dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x;
  const dy2 = b2.y - b1.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null;

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
 * Calculate the dominant angle of a polyline (from first to last point).
 */
function polylineAngle(points: Point[]): number {
  if (points.length < 2) return 0;
  return Math.atan2(
    points[points.length - 1].y - points[0].y,
    points[points.length - 1].x - points[0].x
  );
}

/**
 * Calculate the smallest angle difference between an arterial and a grid orientation.
 * Returns the acute angle in radians (0 to π/4).
 */
export function angleDiffFromGrid(arterialAngle: number, gridAngle: number): number {
  // Normalize the difference modulo π/2 (grid has 4-fold symmetry)
  let diff = Math.abs(arterialAngle - gridAngle) % (Math.PI / 2);
  if (diff > Math.PI / 4) diff = Math.PI / 2 - diff;
  return diff;
}

/**
 * Find which districts an arterial polyline passes through.
 * Checks if any arterial point lies inside each district polygon,
 * or if any arterial segment intersects the district boundary.
 */
export function findDistrictsCrossedByArterial(
  arterialPoints: Point[],
  districts: District[]
): District[] {
  return districts.filter((district) => {
    const poly = district.polygon.points;
    if (poly.length < 3) return false;

    // Check if any arterial point is inside the district
    for (const p of arterialPoints) {
      if (pointInPolygon(p, poly)) return true;
    }

    // Check if any arterial segment intersects the district boundary
    for (let i = 0; i < arterialPoints.length - 1; i++) {
      for (let j = 0; j < poly.length; j++) {
        const k = (j + 1) % poly.length;
        const hit = segmentIntersection(
          arterialPoints[i], arterialPoints[i + 1],
          poly[j], poly[k]
        );
        if (hit) return true;
      }
    }

    return false;
  });
}

export interface DiagonalValidationResult {
  /** Whether this arterial qualifies as a diagonal for the district */
  isDiagonal: boolean;
  /** Angle difference from grid in degrees */
  angleDeg: number;
  /** Warning message if constraints are violated, null if OK */
  warning: string | null;
}

/**
 * Validate whether an arterial is a valid diagonal for a given district.
 * Checks:
 * 1. Minimum 15° angle from grid orientation
 * 2. Maximum 2 diagonals per district
 */
export function validateDiagonalForDistrict(
  arterialPoints: Point[],
  district: District,
  existingRoads: Road[]
): DiagonalValidationResult {
  if (arterialPoints.length < 2) {
    return { isDiagonal: false, angleDeg: 0, warning: null };
  }

  const arterialAngle = polylineAngle(arterialPoints);
  const gridAngle = district.gridAngle ?? 0;
  const diff = angleDiffFromGrid(arterialAngle, gridAngle);
  const angleDeg = Math.round(diff * (180 / Math.PI));

  // Not diagonal enough - it's grid-aligned, which is fine but not a "diagonal"
  if (diff < MIN_DIAGONAL_ANGLE) {
    return { isDiagonal: false, angleDeg, warning: null };
  }

  // Count existing diagonal arterials in this district
  const existingDiagonals = countDiagonalArterials(district, existingRoads);
  if (existingDiagonals >= MAX_DIAGONALS_PER_DISTRICT) {
    return {
      isDiagonal: true,
      angleDeg,
      warning: `District "${district.name}" already has ${MAX_DIAGONALS_PER_DISTRICT} diagonal arterials (max limit)`,
    };
  }

  return { isDiagonal: true, angleDeg, warning: null };
}

/**
 * Count how many existing user-drawn arterial roads are diagonal
 * relative to the district's grid angle.
 */
function countDiagonalArterials(
  district: District,
  roads: Road[]
): number {
  const gridAngle = district.gridAngle ?? 0;
  const districtPoly = district.polygon.points;

  return roads.filter((r) => {
    if (r.roadClass !== "arterial") return false;
    // Skip district-internal generated roads (their IDs start with the district ID)
    if (r.id.startsWith(district.id)) return false;
    if (r.line.points.length < 2) return false;

    // Check if this road passes through the district
    const passesThroughDistrict = r.line.points.some((p) =>
      pointInPolygon(p, districtPoly)
    );
    if (!passesThroughDistrict) return false;

    // Check if it's diagonal
    const angle = polylineAngle(r.line.points);
    const diff = angleDiffFromGrid(angle, gridAngle);
    return diff >= MIN_DIAGONAL_ANGLE;
  }).length;
}

export interface SplitRoadResult {
  /** The first half of the split road (before the intersection) */
  road: Road;
  /** Points of the road */
  points: Point[];
}

export interface GridAdjustmentResult {
  /** Roads to remove (will be replaced by split versions) */
  removedRoadIds: string[];
  /** New roads to add (the split halves) */
  newRoads: Road[];
}

/**
 * Split district grid streets at intersections with a diagonal arterial.
 * Creates T-intersections where the grid meets the diagonal.
 *
 * @param districtId - ID of the district whose grid streets should be split
 * @param allRoads - All roads in the map
 * @param arterialPoints - The diagonal arterial polyline
 * @returns Roads to remove and new split roads to add
 */
export function splitGridStreetsAtArterial(
  districtId: string,
  allRoads: Road[],
  arterialPoints: Point[]
): GridAdjustmentResult {
  if (arterialPoints.length < 2) {
    return { removedRoadIds: [], newRoads: [] };
  }

  const removedRoadIds: string[] = [];
  const newRoads: Road[] = [];

  // Find roads belonging to this district (generated grid roads)
  const districtRoads = allRoads.filter(
    (r) => r.id.startsWith(districtId) && (r.roadClass === "local" || r.roadClass === "collector")
  );

  for (const road of districtRoads) {
    const roadPoints = road.line.points;
    if (roadPoints.length < 2) continue;

    // Find all intersection points between this road and the arterial
    const intersections: { segIndex: number; point: Point; t: number }[] = [];

    for (let ri = 0; ri < roadPoints.length - 1; ri++) {
      for (let ai = 0; ai < arterialPoints.length - 1; ai++) {
        const hit = segmentIntersection(
          roadPoints[ri], roadPoints[ri + 1],
          arterialPoints[ai], arterialPoints[ai + 1]
        );
        if (hit) {
          // Calculate t parameter along the road segment for ordering
          const dx = roadPoints[ri + 1].x - roadPoints[ri].x;
          const dy = roadPoints[ri + 1].y - roadPoints[ri].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const hitDx = hit.x - roadPoints[ri].x;
          const hitDy = hit.y - roadPoints[ri].y;
          const t = len > 0 ? Math.sqrt(hitDx * hitDx + hitDy * hitDy) / len : 0;

          intersections.push({ segIndex: ri, point: hit, t });
        }
      }
    }

    if (intersections.length === 0) continue;

    // Sort by segment index, then by t parameter
    intersections.sort((a, b) => a.segIndex - b.segIndex || a.t - b.t);

    // Split the road at intersection points
    removedRoadIds.push(road.id);

    // Build split segments
    let currentPoints: Point[] = [roadPoints[0]];
    let splitIndex = 0;
    let nextIntersection = intersections[0];
    let partNum = 0;

    for (let ri = 0; ri < roadPoints.length - 1; ri++) {
      // Add any intersection points on this segment
      while (nextIntersection && nextIntersection.segIndex === ri) {
        currentPoints.push(nextIntersection.point);

        // Emit this segment as a road if it has enough length
        if (currentPoints.length >= 2) {
          newRoads.push({
            id: `${road.id}-split-${partNum}`,
            name: road.name,
            roadClass: road.roadClass,
            line: { points: [...currentPoints] },
          });
          partNum++;
        }

        // Start new segment from intersection point
        currentPoints = [nextIntersection.point];
        splitIndex++;
        nextIntersection = intersections[splitIndex] ?? null;
      }

      // Add the end of this road segment
      currentPoints.push(roadPoints[ri + 1]);
    }

    // Emit the final segment
    if (currentPoints.length >= 2) {
      newRoads.push({
        id: `${road.id}-split-${partNum}`,
        name: road.name,
        roadClass: road.roadClass,
        line: { points: [...currentPoints] },
      });
    }
  }

  return { removedRoadIds, newRoads };
}
