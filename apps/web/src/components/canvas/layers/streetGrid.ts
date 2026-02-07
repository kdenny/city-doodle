/**
 * Street grid generation algorithm for filling districts with road networks.
 *
 * Generates a rotated grid of streets within a polygon boundary,
 * clipped to the district shape. Streets are assigned hierarchy levels:
 * - Perimeter streets (touching boundary) → COLLECTOR class
 * - Every 3-4 blocks, internal street → COLLECTOR class
 * - All other internal streets → LOCAL class
 *
 * Grid orientation can be:
 * - Semi-random based on centroid position (±15°)
 * - Explicitly set by the user
 * - Transit-oriented (toward nearest transit station)
 *
 * Jitter is applied to local streets for organic feel (2-6% of spacing),
 * while collectors remain on the clean grid for structural clarity.
 */

import type { Road, Point, DistrictType, RoadClass } from "./types";
import { generateId } from "../../../utils/idGenerator";
import {
  getPolygonBounds,
  lineIntersectsPolygon,
  pointInPolygon,
  getPolygonCentroid,
  rotatePoint,
} from "./geometry";

/**
 * Seeded random number generator for deterministic district generation.
 * Uses a linear congruential generator (LCG) algorithm.
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Get an integer in range [min, max) */
  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }
}

/** Options for transit-oriented grid generation. */
export interface TransitGridOptions {
  /** Transit station positions for orientation */
  transitStations?: Point[];
  /** Transit-car slider value (0 = transit-oriented, 1 = car-dependent) */
  transitCar?: number;
}

/**
 * Calculate grid rotation angle based on district centroid.
 *
 * Produces an angle between -15 and +15 degrees from north (in radians).
 * The result is deterministic for a given centroid position and RNG state,
 * blending a random base angle with a centroid-derived influence so that
 * nearby districts get subtly different orientations.
 *
 * @param centroid - District centroid used for positional influence
 * @param rng - Seeded RNG (consumed once per call)
 * @returns Rotation angle in radians
 */
function calculateGridRotation(centroid: Point, rng: SeededRandom): number {
  const centroidInfluence = (centroid.x + centroid.y) % 10 / 10;
  const maxAngleDegrees = 15;
  const baseAngle = rng.range(-maxAngleDegrees, maxAngleDegrees);
  const angleDegrees = baseAngle * (0.8 + centroidInfluence * 0.2);
  return (angleDegrees * Math.PI) / 180;
}

/**
 * Find the nearest transit station to a point.
 * Returns null if no stations provided or array is empty.
 */
function findNearestStation(
  point: Point,
  stations: Point[]
): { station: Point; distance: number } | null {
  if (!stations || stations.length === 0) return null;

  let nearest = stations[0];
  let minDist = Math.sqrt(
    (point.x - nearest.x) ** 2 + (point.y - nearest.y) ** 2
  );

  for (let i = 1; i < stations.length; i++) {
    const dist = Math.sqrt(
      (point.x - stations[i].x) ** 2 + (point.y - stations[i].y) ** 2
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = stations[i];
    }
  }

  return { station: nearest, distance: minDist };
}

/**
 * Calculate the angle from a point toward a target.
 * Returns angle in radians, normalized to grid orientation.
 */
function calculateAngleTowardTarget(from: Point, target: Point): number {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  return Math.atan2(dx, -dy);
}

/**
 * Calculate transit-oriented grid rotation.
 *
 * When `transitCar` is low (< 0.5), blends the grid angle toward the nearest
 * transit station so that streets lead naturally to transit stops. At
 * `transitCar` >= 0.5 the result equals {@link calculateGridRotation}.
 *
 * @param centroid - District centroid
 * @param rng - Seeded RNG
 * @param transitStations - Known transit station positions (may be empty)
 * @param transitCar - Slider value: 0 = fully transit-oriented, 1 = car-dependent
 * @returns Rotation angle in radians
 */
function calculateTransitOrientedGridRotation(
  centroid: Point,
  rng: SeededRandom,
  transitStations?: Point[],
  transitCar: number = 0.5
): number {
  const standardAngle = calculateGridRotation(centroid, rng);

  if (transitCar >= 0.5 || !transitStations || transitStations.length === 0) {
    return standardAngle;
  }

  const nearest = findNearestStation(centroid, transitStations);
  if (!nearest) {
    return standardAngle;
  }

  const stationAngle = calculateAngleTowardTarget(centroid, nearest.station);

  // Blend: at transit_car=0, fully station-oriented; at 0.5, equal blend
  const blendFactor = transitCar * 2;

  let angleDiff = stationAngle - standardAngle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  return stationAngle - angleDiff * blendFactor;
}

/**
 * Check if a road segment is a short perimeter segment that runs along the polygon
 * boundary rather than crossing through the district interior.
 *
 * All clipped segments have endpoints on the polygon boundary (they are intersection
 * points), so we can't use endpoint proximity alone. Instead, check if the segment
 * is short relative to the district size — short segments near the boundary are
 * perimeter roads, while long segments that span the district are interior roads.
 */
function isPerimeterRoad(
  start: Point,
  end: Point,
  polygon: Point[],
  _tolerance: number = 2
): boolean {
  // Compute the segment length
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLength = Math.sqrt(dx * dx + dy * dy);

  // Estimate district size from polygon bounds
  const bounds = getPolygonBounds(polygon);
  const districtSize = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  // A perimeter segment is one that's very short relative to the district
  // (less than 30% of the district size — it clips a corner rather than crossing through)
  return segmentLength < districtSize * 0.3;
}

/**
 * Generate a street grid within a polygon with proper street hierarchy.
 *
 * Algorithm:
 * 1. Compute a rotated bounding box that fully covers the polygon
 * 2. Generate horizontal and vertical lines at regular spacing
 * 3. Rotate each line by the grid angle around the polygon centroid
 * 4. Clip each rotated line to the polygon boundary
 * 5. Validate segment midpoints are inside the polygon (handles concave shapes)
 * 6. Assign hierarchy: perimeter → collector, every N blocks → collector, rest → local
 * 7. Apply perpendicular jitter to local streets (collectors stay on grid)
 *
 * @param polygon - District boundary polygon
 * @param spacing - Distance between parallel streets (in world units)
 * @param _roadClass - Ignored (hierarchy determines class)
 * @param districtId - ID prefix for generated road IDs
 * @param rng - Seeded RNG for deterministic generation
 * @param districtType - Affects jitter magnitude (downtown = less)
 * @param explicitGridAngle - Optional angle override (radians)
 * @param transitOptions - Optional transit-oriented generation config
 * @returns Generated roads and the grid angle used
 */
export function generateStreetGrid(
  polygon: Point[],
  spacing: number,
  _roadClass: RoadClass,
  districtId: string,
  rng: SeededRandom,
  districtType: DistrictType = "residential",
  explicitGridAngle?: number,
  transitOptions?: TransitGridOptions
): { roads: Road[]; gridAngle: number } {
  const bounds = getPolygonBounds(polygon);
  const centroid = getPolygonCentroid(polygon);
  const roads: Road[] = [];

  // Determine grid rotation
  let rotationAngle: number;
  if (explicitGridAngle !== undefined) {
    rotationAngle = explicitGridAngle;
  } else if (transitOptions) {
    rotationAngle = calculateTransitOrientedGridRotation(
      centroid,
      rng,
      transitOptions.transitStations,
      transitOptions.transitCar
    );
  } else {
    rotationAngle = calculateGridRotation(centroid, rng);
  }

  // Collector interval: upgrade to collector every 3-4 blocks
  const collectorInterval = rng.intRange(3, 5);

  // CITY-328: Scale jitter with block spacing. Downtown gets minimal jitter.
  const jitterScale = districtType === "downtown" ? 0.02 : 0.06;
  const maxJitter = spacing * jitterScale;

  // CITY-331: Tight rotated bounding box.
  // After rotation by θ, a rectangle needs expanded bounds:
  //   newHalfW = hw*|cos(θ)| + hh*|sin(θ)|
  const halfWidth = (bounds.maxX - bounds.minX) / 2;
  const halfHeight = (bounds.maxY - bounds.minY) / 2;
  const cosA = Math.abs(Math.cos(rotationAngle));
  const sinA = Math.abs(Math.sin(rotationAngle));
  const expandedHalfW = halfWidth * cosA + halfHeight * sinA + spacing;
  const expandedHalfH = halfWidth * sinA + halfHeight * cosA + spacing;
  const expandedBounds = {
    minX: centroid.x - expandedHalfW,
    maxX: centroid.x + expandedHalfW,
    minY: centroid.y - expandedHalfH,
    maxY: centroid.y + expandedHalfH,
  };

  let streetIndex = 0;
  let hStreetCount = 0;
  let vStreetCount = 0;

  // Generate horizontal streets (in rotated space)
  for (
    let y = expandedBounds.minY + spacing / 2;
    y < expandedBounds.maxY;
    y += spacing
  ) {
    const lineStart: Point = { x: expandedBounds.minX, y };
    const lineEnd: Point = { x: expandedBounds.maxX, y };

    const rotatedStart = rotatePoint(lineStart, centroid, rotationAngle);
    const rotatedEnd = rotatePoint(lineEnd, centroid, rotationAngle);

    const intersections = lineIntersectsPolygon(
      rotatedStart.x, rotatedStart.y,
      rotatedEnd.x, rotatedEnd.y,
      polygon
    );

    let producedSegment = false;
    for (let i = 0; i < intersections.length - 1; i += 2) {
      if (!intersections[i + 1]) continue;

      // CITY-327/329: Validate pair by checking midpoint is inside polygon
      const midX = (intersections[i].x + intersections[i + 1].x) / 2;
      const midY = (intersections[i].y + intersections[i + 1].y) / 2;
      if (!pointInPolygon(midX, midY, polygon)) continue;

      // CITY-369/372: Check if this is a short perimeter segment
      let roadClass: RoadClass = "local";
      if (isPerimeterRoad(intersections[i], intersections[i + 1], polygon)) {
        roadClass = "collector";
      } else if (hStreetCount % collectorInterval === 0) {
        roadClass = "collector";
      }

      // CITY-328: Apply same jitter to both endpoints (shift, don't skew).
      // Collectors get no jitter to maintain clean grid structure.
      const jitter = roadClass === "collector" ? 0 : rng.range(-maxJitter, maxJitter);
      const dx = intersections[i + 1].x - intersections[i].x;
      const dy = intersections[i + 1].y - intersections[i].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const perpX = len > 0 ? -dy / len : 0;
      const perpY = len > 0 ? dx / len : 0;

      const startPoint: Point = {
        x: intersections[i].x + perpX * jitter,
        y: intersections[i].y + perpY * jitter,
      };
      const endPoint: Point = {
        x: intersections[i + 1].x + perpX * jitter,
        y: intersections[i + 1].y + perpY * jitter,
      };

      roads.push({
        id: generateId(`${districtId}-street-h-${streetIndex}`),
        roadClass,
        line: { points: [startPoint, endPoint] },
        districtId,
      });
      streetIndex++;
      producedSegment = true;
    }
    if (producedSegment) hStreetCount++;
  }

  // Generate vertical streets (in rotated space)
  for (
    let x = expandedBounds.minX + spacing / 2;
    x < expandedBounds.maxX;
    x += spacing
  ) {
    const lineStart: Point = { x, y: expandedBounds.minY };
    const lineEnd: Point = { x, y: expandedBounds.maxY };

    const rotatedStart = rotatePoint(lineStart, centroid, rotationAngle);
    const rotatedEnd = rotatePoint(lineEnd, centroid, rotationAngle);

    const intersections = lineIntersectsPolygon(
      rotatedStart.x, rotatedStart.y,
      rotatedEnd.x, rotatedEnd.y,
      polygon
    );

    let producedSegment = false;
    for (let i = 0; i < intersections.length - 1; i += 2) {
      if (!intersections[i + 1]) continue;

      const midX = (intersections[i].x + intersections[i + 1].x) / 2;
      const midY = (intersections[i].y + intersections[i + 1].y) / 2;
      if (!pointInPolygon(midX, midY, polygon)) continue;

      let roadClass: RoadClass = "local";
      if (isPerimeterRoad(intersections[i], intersections[i + 1], polygon)) {
        roadClass = "collector";
      } else if (vStreetCount % collectorInterval === 0) {
        roadClass = "collector";
      }

      const jitter = roadClass === "collector" ? 0 : rng.range(-maxJitter, maxJitter);
      const dx = intersections[i + 1].x - intersections[i].x;
      const dy = intersections[i + 1].y - intersections[i].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const perpX = len > 0 ? -dy / len : 0;
      const perpY = len > 0 ? dx / len : 0;

      const startPoint: Point = {
        x: intersections[i].x + perpX * jitter,
        y: intersections[i].y + perpY * jitter,
      };
      const endPoint: Point = {
        x: intersections[i + 1].x + perpX * jitter,
        y: intersections[i + 1].y + perpY * jitter,
      };

      roads.push({
        id: generateId(`${districtId}-street-v-${streetIndex}`),
        roadClass,
        line: { points: [startPoint, endPoint] },
        districtId,
      });
      streetIndex++;
      producedSegment = true;
    }
    if (producedSegment) vStreetCount++;
  }

  return { roads, gridAngle: rotationAngle };
}
