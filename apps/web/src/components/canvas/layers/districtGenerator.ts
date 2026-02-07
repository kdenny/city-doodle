/**
 * District geometry generator for creating district polygons with street grids.
 *
 * When a district seed is placed, this generates:
 * - A polygon around the placement point (rounded rectangle or organic shape)
 * - A street grid within the district bounds with proper hierarchy
 *
 * Street Grid Algorithm (CITY-142):
 * - Block sizes vary by district type and density
 * - Grid orientation is semi-random based on district centroid
 * - Perimeter streets are COLLECTOR class
 * - Internal streets are LOCAL class, with every 3-4 blocks upgraded to COLLECTOR
 */

import type { District, Road, Point, DistrictType, RoadClass } from "./types";
import { generateDistrictName } from "../../../utils/nameGenerator";
import { generateId } from "../../../utils/idGenerator";
import {
  metersToWorldUnits,
  worldUnitsToMeters,
  milesToWorldUnits,
  worldUnitsToMiles,
} from "../../../utils/worldConstants";

// Re-export conversion functions for backwards compatibility
export { metersToWorldUnits, worldUnitsToMeters, milesToWorldUnits, worldUnitsToMiles };

/**
 * Base block sizes by district type (in meters).
 * These represent typical real-world block dimensions.
 */
export const BASE_BLOCK_SIZES: Record<string, number> = {
  downtown: 60,        // Dense urban core, small walkable blocks
  residential_high: 80,
  mixed_use: 90,
  commercial: 100,
  residential_med: 120,
  residential: 120,    // Default residential maps to medium density
  residential_low: 150,
  industrial: 200,     // Large blocks for warehouses/factories
  // Special types that don't get street grids
  park: 0,
  airport: 0,
  hospital: 100,
  university: 100,
  k12: 100,
};

/**
 * Scale settings for district and block sizes.
 */
export interface ScaleSettings {
  /** Size of a city block in meters (50-300) */
  blockSizeMeters: number;
  /** Size of a district in meters (1000-6000) */
  districtSizeMeters: number;
  /** Sprawl-compact slider value (0-1), affects size multiplier */
  sprawlCompact?: number;
}

/**
 * Default scale settings for ~4 sq mi districts.
 * A typical urban block is about 150m x 150m (~500 feet).
 * A district is about 3200m (~2 miles) for ~4 sq mi area.
 */
export const DEFAULT_SCALE_SETTINGS: ScaleSettings = {
  blockSizeMeters: 150,
  districtSizeMeters: 3200,  // ~2 miles, yields ~4 sq mi
  sprawlCompact: 0.5,
};


/**
 * Convert sprawl_compact (0-1) to density (0-10) and calculate block size multiplier.
 *
 * Formula from ticket: actual_size = base_size * (1.5 - density/10)
 * - sprawl_compact 0 → density 0 → multiplier 1.5 (sparse, large blocks)
 * - sprawl_compact 1 → density 10 → multiplier 0.5 (dense, small blocks)
 */
function calculateDensityMultiplier(sprawlCompact: number): number {
  // Map sprawl_compact (0-1) to density (0-10)
  const density = sprawlCompact * 10;
  // Apply ticket formula: multiplier = 1.5 - density/10
  return 1.5 - density / 10;
}

/**
 * Get the base block size for a district type.
 */
function getBaseBlockSize(districtType: DistrictType): number {
  return BASE_BLOCK_SIZES[districtType] ?? BASE_BLOCK_SIZES.residential;
}

/**
 * Apply sprawl/compact multiplier to a size value.
 * sprawlCompact = 0 means sprawling (larger), sprawlCompact = 1 means compact (smaller)
 * @deprecated Use calculateDensityMultiplier for block sizes
 */
function applySprawlCompactMultiplier(
  baseValue: number,
  sprawlCompact: number
): number {
  // Multiplier ranges from 1.5 (sprawl) to 0.7 (compact)
  const multiplier = 1.5 - sprawlCompact * 0.8;
  return baseValue * multiplier;
}

/**
 * Configuration for district generation.
 */
export interface DistrictGenerationConfig {
  /** Base size of the district (width/height) in world units */
  size?: number;
  /** Minimum size of the district */
  minSize?: number;
  /** Maximum size of the district */
  maxSize?: number;
  /** Number of polygon points for organic shapes */
  polygonPoints?: number;
  /** How "organic" vs "grid" the shape should be (0-1) */
  organicFactor?: number;
  /** Spacing between streets in the grid */
  streetSpacing?: number;
  /** Road class for internal streets */
  streetClass?: RoadClass;
  /** Scale settings for configurable block/district sizes */
  scaleSettings?: ScaleSettings;
  /**
   * Explicit seed for random generation.
   * When provided, overrides the position-based seed for deterministic results.
   * Same seed + settings = same district geometry.
   */
  seed?: number;
  /**
   * Transit station positions for transit-oriented grid generation.
   * When provided with low transit_car value, grid will orient toward nearest station.
   */
  transitStations?: Point[];
  /**
   * Transit-car slider value (0-1).
   * 0 = transit-oriented (grid orients toward stations)
   * 1 = car-dependent (standard grid orientation)
   */
  transitCar?: number;
  /**
   * Era year for the district (e.g. 1200-2024).
   * Historic eras produce smaller, tighter blocks; modern eras produce larger blocks.
   */
  eraYear?: number;
}

const DEFAULT_CONFIG: Required<Omit<DistrictGenerationConfig, "scaleSettings" | "seed" | "transitStations" | "transitCar" | "eraYear">> & {
  scaleSettings: ScaleSettings;
} = {
  size: 120,
  minSize: 80,
  maxSize: 160,
  polygonPoints: 8,
  organicFactor: 0.3,
  streetSpacing: 30,
  streetClass: "local",
  scaleSettings: DEFAULT_SCALE_SETTINGS,
};

/**
 * Calculate effective district config based on scale settings.
 */
export function getEffectiveDistrictConfig(
  config: DistrictGenerationConfig = {}
): Required<Omit<DistrictGenerationConfig, "scaleSettings" | "seed" | "transitStations" | "transitCar" | "eraYear">> & {
  scaleSettings: ScaleSettings;
} {
  const scaleSettings = config.scaleSettings ?? DEFAULT_SCALE_SETTINGS;
  const sprawlCompact = scaleSettings.sprawlCompact ?? 0.5;

  // Calculate base district size from settings
  const baseDistrictSize = metersToWorldUnits(scaleSettings.districtSizeMeters);
  const effectiveDistrictSize = applySprawlCompactMultiplier(
    baseDistrictSize,
    sprawlCompact
  );

  // Calculate street spacing from block size
  const baseBlockSize = metersToWorldUnits(scaleSettings.blockSizeMeters);
  const effectiveStreetSpacing = applySprawlCompactMultiplier(
    baseBlockSize,
    sprawlCompact
  );

  // When an explicit size is provided (e.g. drag-to-size), use it directly
  const baseSize = config.size ?? effectiveDistrictSize;
  return {
    size: baseSize,
    minSize: config.size ? baseSize : (config.minSize ?? effectiveDistrictSize * 0.7),
    maxSize: config.size ? baseSize : (config.maxSize ?? effectiveDistrictSize * 1.3),
    polygonPoints: config.polygonPoints ?? DEFAULT_CONFIG.polygonPoints,
    organicFactor: config.organicFactor ?? DEFAULT_CONFIG.organicFactor,
    streetSpacing: config.streetSpacing ?? effectiveStreetSpacing * 0.3, // ~30% of block for streets
    streetClass: config.streetClass ?? DEFAULT_CONFIG.streetClass,
    scaleSettings,
  };
}

/**
 * Result of generating district geometry.
 */
export interface GeneratedDistrict {
  district: District;
  roads: Road[];
}

/**
 * Seeded random number generator for deterministic results.
 */
class SeededRandom {
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


/**
 * Map seed type IDs to district types.
 */
export function seedIdToDistrictType(seedId: string): DistrictType {
  const mapping: Record<string, DistrictType> = {
    residential: "residential",
    downtown: "downtown",
    shopping: "commercial",
    commercial: "commercial",
    industrial: "industrial",
    hospital: "hospital",
    university: "university",
    k12: "k12",
    park: "park",
    airport: "airport",
  };
  return mapping[seedId] ?? "residential";
}

/**
 * Get a display name for a district type.
 * Delegates to the centralized name generator utility.
 */
function getDistrictName(type: DistrictType, seed: number): string {
  return generateDistrictName(type, { seed });
}

/**
 * Generate an organic polygon around a center point.
 * Creates a shape that's roughly circular but with some variation.
 */
function generateOrganicPolygon(
  centerX: number,
  centerY: number,
  baseRadius: number,
  numPoints: number,
  organicFactor: number,
  rng: SeededRandom
): Point[] {
  const points: Point[] = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    // Add some random variation to the radius
    const radiusVariation = 1 - organicFactor / 2 + rng.next() * organicFactor;
    const radius = baseRadius * radiusVariation;

    // Also add slight angular offset for more organic feel
    const angleOffset = (rng.next() - 0.5) * organicFactor * (Math.PI / numPoints);
    const finalAngle = angle + angleOffset;

    points.push({
      x: centerX + Math.cos(finalAngle) * radius,
      y: centerY + Math.sin(finalAngle) * radius,
    });
  }

  return points;
}

/**
 * Generate a rounded rectangle polygon.
 */
function generateRoundedRectangle(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  cornerRadius: number,
  pointsPerCorner: number = 3
): Point[] {
  const points: Point[] = [];
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  // Ensure corner radius doesn't exceed half the smaller dimension
  const maxRadius = Math.min(halfWidth, halfHeight);
  const r = Math.min(cornerRadius, maxRadius);

  // Generate points for each corner
  const corners = [
    { cx: centerX + halfWidth - r, cy: centerY - halfHeight + r, startAngle: -Math.PI / 2, endAngle: 0 },
    { cx: centerX + halfWidth - r, cy: centerY + halfHeight - r, startAngle: 0, endAngle: Math.PI / 2 },
    { cx: centerX - halfWidth + r, cy: centerY + halfHeight - r, startAngle: Math.PI / 2, endAngle: Math.PI },
    { cx: centerX - halfWidth + r, cy: centerY - halfHeight + r, startAngle: Math.PI, endAngle: 3 * Math.PI / 2 },
  ];

  for (const corner of corners) {
    for (let i = 0; i <= pointsPerCorner; i++) {
      const t = i / pointsPerCorner;
      const angle = corner.startAngle + (corner.endAngle - corner.startAngle) * t;
      points.push({
        x: corner.cx + Math.cos(angle) * r,
        y: corner.cy + Math.sin(angle) * r,
      });
    }
  }

  return points;
}

/**
 * Calculate the bounding box of a polygon.
 */
function getPolygonBounds(points: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
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
 * Check if a line segment intersects a polygon edge.
 * Used to clip street grid to district bounds.
 */
function lineIntersectsPolygon(
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
 * Calculate intersection point of two line segments.
 */
function lineLineIntersection(
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
 * Check if a point is inside a polygon using ray casting.
 */
function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
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
 * Calculate grid rotation angle based on district centroid.
 * Returns an angle between -15 and +15 degrees from north (in radians).
 *
 * The angle is deterministic based on the centroid position.
 * The centroid is used to seed the RNG for consistent results.
 */
function calculateGridRotation(centroid: Point, rng: SeededRandom): number {
  // Use centroid to influence the angle calculation for variation
  // The RNG is already seeded by position, but we use centroid for extra determinism
  const centroidInfluence = (centroid.x + centroid.y) % 10 / 10; // 0-1 value
  const maxAngleDegrees = 15;
  const baseAngle = rng.range(-maxAngleDegrees, maxAngleDegrees);
  // Blend RNG angle with centroid-influenced offset for more natural variation
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
 * Grid streets will be perpendicular and parallel to this direction.
 */
function calculateAngleTowardTarget(from: Point, target: Point): number {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  // atan2 returns angle from positive x-axis, we want angle from north (negative y)
  // Rotate by 90 degrees to align with grid orientation
  return Math.atan2(dx, -dy);
}

/**
 * Calculate transit-oriented grid rotation.
 * When transit_car is low (< 0.5), orients grid toward nearest transit station.
 * When transit_car is high (>= 0.5), uses standard random orientation.
 *
 * @param centroid - Center of the district
 * @param rng - Seeded random number generator
 * @param transitStations - Array of transit station positions
 * @param transitCar - Transit-car slider value (0 = transit-oriented, 1 = car-dependent)
 * @returns Grid rotation angle in radians
 */
function calculateTransitOrientedGridRotation(
  centroid: Point,
  rng: SeededRandom,
  transitStations?: Point[],
  transitCar: number = 0.5
): number {
  // Standard orientation as fallback
  const standardAngle = calculateGridRotation(centroid, rng);

  // If car-dependent (transit_car >= 0.5) or no stations, use standard orientation
  if (transitCar >= 0.5 || !transitStations || transitStations.length === 0) {
    return standardAngle;
  }

  // Find nearest station
  const nearest = findNearestStation(centroid, transitStations);
  if (!nearest) {
    return standardAngle;
  }

  // Calculate angle toward the station
  const stationAngle = calculateAngleTowardTarget(centroid, nearest.station);

  // Blend between station-oriented and standard based on transit_car
  // At transit_car = 0, fully station-oriented
  // At transit_car = 0.5, equal blend
  const blendFactor = transitCar * 2; // 0 to 1 as transit_car goes 0 to 0.5

  // Normalize angles for proper interpolation
  let angleDiff = stationAngle - standardAngle;
  // Ensure we take the shorter path around the circle
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  // Interpolate between station angle and standard angle
  return stationAngle - angleDiff * blendFactor;
}

/**
 * Calculate the centroid of a polygon.
 */
function getPolygonCentroid(polygon: Point[]): Point {
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
 * Rotate a point around a center by a given angle.
 */
function rotatePoint(point: Point, center: Point, angle: number): Point {
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
 * Check if a road segment is on the perimeter (touches the district boundary).
 * Perimeter roads are those where both endpoints are on the polygon edge.
 */
function isPerimeterRoad(
  start: Point,
  end: Point,
  polygon: Point[],
  tolerance: number = 2
): boolean {
  // Check if both endpoints are close to the polygon boundary
  const startOnBoundary = isPointNearPolygonEdge(start, polygon, tolerance);
  const endOnBoundary = isPointNearPolygonEdge(end, polygon, tolerance);
  return startOnBoundary && endOnBoundary;
}

/**
 * Check if a point is near any edge of the polygon.
 */
function isPointNearPolygonEdge(
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

/**
 * Calculate the distance from a point to a line segment.
 */
function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
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
 * Options for transit-oriented grid generation.
 */
interface TransitGridOptions {
  /** Transit station positions for orientation */
  transitStations?: Point[];
  /** Transit-car slider value (0 = transit-oriented, 1 = car-dependent) */
  transitCar?: number;
}

/**
 * Generate a street grid within a polygon with proper street hierarchy.
 *
 * Street Hierarchy (CITY-142):
 * - Perimeter streets (touching boundary) = COLLECTOR class
 * - Every 3-4 blocks, internal street upgraded to COLLECTOR
 * - All other internal streets = LOCAL class
 *
 * Grid is rotated by a semi-random angle based on district position,
 * or by an explicitly provided angle. When transit options are provided
 * and transit_car is low, grid orients toward nearest transit station.
 */
function generateStreetGrid(
  polygon: Point[],
  spacing: number,
  _roadClass: RoadClass, // Ignored - we determine class based on hierarchy
  districtId: string,
  rng: SeededRandom,
  districtType: DistrictType = "residential",
  explicitGridAngle?: number,
  transitOptions?: TransitGridOptions
): { roads: Road[]; gridAngle: number } {
  const bounds = getPolygonBounds(polygon);
  const centroid = getPolygonCentroid(polygon);
  const roads: Road[] = [];

  // Use explicit angle if provided, otherwise calculate based on transit orientation
  let rotationAngle: number;
  if (explicitGridAngle !== undefined) {
    rotationAngle = explicitGridAngle;
  } else if (transitOptions) {
    // Use transit-oriented calculation when transit options provided
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

  // CITY-328: Scale jitter with block spacing and reduce magnitude.
  // Downtown gets minimal jitter; other types get proportional jitter.
  // Jitter shifts the whole road uniformly (not per-endpoint).
  const jitterScale = districtType === "downtown" ? 0.02 : 0.06;
  const maxJitter = spacing * jitterScale;

  // CITY-331: Use tight rotated bounding box instead of diagonal.
  // After rotation by angle θ, a rectangle needs expanded bounds:
  //   newHalfW = hw*|cos(θ)| + hh*|sin(θ)|
  //   newHalfH = hw*|sin(θ)| + hh*|cos(θ)|
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
    // Create a line across the expanded bounds, then rotate it
    const lineStart: Point = { x: expandedBounds.minX, y };
    const lineEnd: Point = { x: expandedBounds.maxX, y };

    // Rotate the line around the centroid
    const rotatedStart = rotatePoint(lineStart, centroid, rotationAngle);
    const rotatedEnd = rotatePoint(lineEnd, centroid, rotationAngle);

    // Find intersections with the actual polygon
    const intersections = lineIntersectsPolygon(
      rotatedStart.x,
      rotatedStart.y,
      rotatedEnd.x,
      rotatedEnd.y,
      polygon
    );

    // Create road segments from validated pairs of intersections
    for (let i = 0; i < intersections.length - 1; i += 2) {
      if (!intersections[i + 1]) continue;

      // CITY-327/329: Validate pair by checking midpoint is inside polygon.
      // This handles concave polygons where distance-sorted pairs may not
      // form valid road segments, and odd intersection counts.
      const midX = (intersections[i].x + intersections[i + 1].x) / 2;
      const midY = (intersections[i].y + intersections[i + 1].y) / 2;
      if (!pointInPolygon(midX, midY, polygon)) continue;

      // CITY-330: Check perimeter using ORIGINAL intersection points (before jitter)
      let roadClass: RoadClass = "local";
      if (isPerimeterRoad(intersections[i], intersections[i + 1], polygon)) {
        roadClass = "collector";
      } else if (hStreetCount % collectorInterval === 0) {
        roadClass = "collector";
      }

      // CITY-328: Apply same jitter value to both endpoints (shift, don't skew).
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
      });
      streetIndex++;
    }
    hStreetCount++;
  }

  // Generate vertical streets (in rotated space)
  for (
    let x = expandedBounds.minX + spacing / 2;
    x < expandedBounds.maxX;
    x += spacing
  ) {
    const lineStart: Point = { x, y: expandedBounds.minY };
    const lineEnd: Point = { x, y: expandedBounds.maxY };

    // Rotate the line around the centroid
    const rotatedStart = rotatePoint(lineStart, centroid, rotationAngle);
    const rotatedEnd = rotatePoint(lineEnd, centroid, rotationAngle);

    // Find intersections with polygon
    const intersections = lineIntersectsPolygon(
      rotatedStart.x,
      rotatedStart.y,
      rotatedEnd.x,
      rotatedEnd.y,
      polygon
    );

    // Create road segments from validated pairs of intersections
    for (let i = 0; i < intersections.length - 1; i += 2) {
      if (!intersections[i + 1]) continue;

      // CITY-327/329: Validate pair by checking midpoint is inside polygon
      const midX = (intersections[i].x + intersections[i + 1].x) / 2;
      const midY = (intersections[i].y + intersections[i + 1].y) / 2;
      if (!pointInPolygon(midX, midY, polygon)) continue;

      // CITY-330: Check perimeter using original intersection points
      let roadClass: RoadClass = "local";
      if (isPerimeterRoad(intersections[i], intersections[i + 1], polygon)) {
        roadClass = "collector";
      } else if (vStreetCount % collectorInterval === 0) {
        roadClass = "collector";
      }

      // CITY-328: Uniform jitter, skip for collectors
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
      });
      streetIndex++;
    }
    vStreetCount++;
  }

  return { roads, gridAngle: rotationAngle };
}

/**
 * Generate district geometry (polygon + street grid) at a given position.
 *
 * @param position - Center position for the district
 * @param seedId - The seed type ID (e.g., "residential", "downtown")
 * @param config - Optional configuration for the generation
 * @returns Generated district polygon and internal roads
 */
export function generateDistrictGeometry(
  position: { x: number; y: number },
  seedId: string,
  config: DistrictGenerationConfig = {}
): GeneratedDistrict {
  // Use effective config which applies scale settings
  const cfg = getEffectiveDistrictConfig(config);

  // Use explicit seed if provided, otherwise derive from position for deterministic results
  const seed = config.seed ?? Math.floor(position.x * 1000 + position.y * 7919);
  const rng = new SeededRandom(seed);

  // Vary the size slightly
  const size = rng.range(cfg.minSize, cfg.maxSize);
  const districtType = seedIdToDistrictType(seedId);
  const districtId = generateId(`district`);

  // Choose polygon shape based on organic factor and district type.
  // organicFactor (from grid_organic slider) controls the blend:
  //   0.0 = strict grid (rectangular)
  //   1.0 = fully organic (irregular polygon)
  // District type provides a bias: downtown/commercial lean rectangular,
  // park/airport always organic regardless of slider.
  let polygonPoints: Point[];

  if (districtType === "park" || districtType === "airport") {
    // Parks and airports are always organic shapes
    const factor = districtType === "airport" ? 1.5 : 1.0;
    polygonPoints = generateOrganicPolygon(
      position.x,
      position.y,
      size * factor / 2,
      cfg.polygonPoints + rng.intRange(0, 4),
      Math.max(cfg.organicFactor, 0.3) + 0.2,
      rng
    );
  } else {
    // For all other district types, use organicFactor to blend shape.
    // Downtown/commercial get a bias toward rectangular (subtract 0.2).
    const typeBias = (districtType === "downtown" || districtType === "commercial") ? -0.2 : 0;
    const effectiveOrganic = Math.max(0, Math.min(1, cfg.organicFactor + typeBias));

    if (effectiveOrganic < 0.3) {
      // Grid-dominant: rectangular shape with slight rounding
      const width = size * rng.range(0.8, 1.2);
      const height = size * rng.range(0.7, 1.0);
      polygonPoints = generateRoundedRectangle(
        position.x,
        position.y,
        width,
        height,
        size * (0.05 + effectiveOrganic * 0.15)
      );
    } else if (effectiveOrganic < 0.6) {
      // Blended: organic polygon with fewer points and less variation
      polygonPoints = generateOrganicPolygon(
        position.x,
        position.y,
        size / 2,
        cfg.polygonPoints - 2 + rng.intRange(0, 2),
        effectiveOrganic * 0.6,
        rng
      );
    } else {
      // Organic-dominant: full organic shape with more variation
      polygonPoints = generateOrganicPolygon(
        position.x,
        position.y,
        size / 2,
        cfg.polygonPoints + rng.intRange(0, 3),
        effectiveOrganic,
        rng
      );
    }
  }

  // Determine if district is historic based on era_year
  const eraYear = config.eraYear ?? 2024;
  const isHistoric = eraYear <= 1940;

  // Generate district
  const district: District = {
    id: districtId,
    type: districtType,
    name: getDistrictName(districtType, seed),
    polygon: { points: polygonPoints },
    isHistoric,
  };

  // Generate street grid within the district
  // Parks and airports don't have street grids
  let roads: Road[] = [];
  if (districtType !== "park" && districtType !== "airport") {
    // Calculate type-specific block size with density multiplier
    const baseBlockSize = getBaseBlockSize(districtType);
    const sprawlCompact = cfg.scaleSettings.sprawlCompact ?? 0.5;
    const densityMultiplier = calculateDensityMultiplier(sprawlCompact);

    // Apply era-based block size adjustment:
    // Historic eras (pre-1940) have smaller, tighter blocks (walking-scale).
    // Modern eras (post-1960) have larger blocks (car-scale).
    // Multiplier: 0.7 at year 1200, 1.0 at 1940, 1.2 at 2024
    const eraMultiplier = eraYear <= 1940
      ? 0.7 + 0.3 * ((eraYear - 1200) / 740)
      : 1.0 + 0.2 * ((eraYear - 1940) / 84);
    const effectiveBlockSize = metersToWorldUnits(baseBlockSize * densityMultiplier * eraMultiplier);

    // Build transit options if available
    const transitOptions: TransitGridOptions | undefined =
      config.transitStations || config.transitCar !== undefined
        ? {
            transitStations: config.transitStations,
            transitCar: config.transitCar,
          }
        : undefined;

    const gridResult = generateStreetGrid(
      polygonPoints,
      effectiveBlockSize,
      cfg.streetClass, // This is now ignored - hierarchy determines class
      districtId,
      rng,
      districtType,
      undefined, // No explicit grid angle
      transitOptions
    );
    roads = gridResult.roads;
    // Store the grid angle for future editing
    district.gridAngle = gridResult.gridAngle;
  }

  return { district, roads };
}

/**
 * Check if a district would overlap with existing districts.
 */
export function wouldOverlap(
  newPolygon: Point[],
  existingDistricts: District[]
): boolean {
  const newBounds = getPolygonBounds(newPolygon);

  for (const existing of existingDistricts) {
    const existingBounds = getPolygonBounds(existing.polygon.points);

    // Quick bounds check
    if (
      newBounds.maxX < existingBounds.minX ||
      newBounds.minX > existingBounds.maxX ||
      newBounds.maxY < existingBounds.minY ||
      newBounds.minY > existingBounds.maxY
    ) {
      continue;
    }

    // Check if any point of new polygon is inside existing
    for (const point of newPolygon) {
      if (pointInPolygon(point.x, point.y, existing.polygon.points)) {
        return true;
      }
    }

    // Check if any point of existing polygon is inside new
    for (const point of existing.polygon.points) {
      if (pointInPolygon(point.x, point.y, newPolygon)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Regenerate the street grid for a district with a new polygon.
 * Used after water clipping to ensure streets fit the clipped boundary.
 *
 * @param clippedPolygon - The clipped district polygon
 * @param districtId - The district ID for road naming
 * @param districtType - The district type for block sizing
 * @param position - Original district position (for deterministic RNG)
 * @param sprawlCompact - Sprawl-compact slider value (0-1)
 * @param gridAngle - Optional explicit grid angle (if not provided, calculated from position)
 * @param transitOptions - Optional transit options for transit-oriented grid generation
 * @returns Object with roads array and the grid angle used
 */
export function regenerateStreetGridForClippedDistrict(
  clippedPolygon: Point[],
  districtId: string,
  districtType: DistrictType,
  position: { x: number; y: number },
  sprawlCompact: number = 0.5,
  gridAngle?: number,
  transitOptions?: { transitStations?: Point[]; transitCar?: number }
): { roads: Road[]; gridAngle: number } {
  // Don't generate streets for parks or airports
  if (districtType === "park" || districtType === "airport") {
    return { roads: [], gridAngle: gridAngle ?? 0 };
  }

  // Need at least 3 points for a valid polygon
  if (clippedPolygon.length < 3) {
    return { roads: [], gridAngle: gridAngle ?? 0 };
  }

  // Use position to seed the RNG for deterministic results
  const seed = Math.floor(position.x * 1000 + position.y * 7919);
  const rng = new SeededRandom(seed);

  // Calculate type-specific block size with density multiplier
  const baseBlockSize = getBaseBlockSize(districtType);
  const densityMultiplier = calculateDensityMultiplier(sprawlCompact);
  const effectiveBlockSize = metersToWorldUnits(baseBlockSize * densityMultiplier);

  return generateStreetGrid(
    clippedPolygon,
    effectiveBlockSize,
    "local", // Ignored - hierarchy determines class
    districtId,
    rng,
    districtType,
    gridAngle,
    transitOptions
  );
}

/**
 * Regenerate the street grid for a district with a new grid angle.
 * Used when the user rotates the grid via the inspector panel.
 * Note: When user explicitly sets an angle, transit orientation is not applied.
 *
 * @param district - The district to regenerate streets for
 * @param newGridAngle - The new grid angle in radians
 * @param sprawlCompact - Sprawl-compact slider value (0-1)
 * @returns Object with new roads array and the grid angle
 */
export function regenerateStreetGridWithAngle(
  district: District,
  newGridAngle: number,
  sprawlCompact: number = 0.5
): { roads: Road[]; gridAngle: number } {
  // Don't generate streets for parks or airports
  if (district.type === "park" || district.type === "airport") {
    return { roads: [], gridAngle: newGridAngle };
  }

  const polygonPoints = district.polygon.points;

  // Need at least 3 points for a valid polygon
  if (polygonPoints.length < 3) {
    return { roads: [], gridAngle: newGridAngle };
  }

  // Get centroid for position-based seed
  const centroid = getPolygonCentroid(polygonPoints);
  const seed = Math.floor(centroid.x * 1000 + centroid.y * 7919);
  const rng = new SeededRandom(seed);

  // Calculate type-specific block size with density multiplier
  const baseBlockSize = getBaseBlockSize(district.type);
  const densityMultiplier = calculateDensityMultiplier(sprawlCompact);
  const effectiveBlockSize = metersToWorldUnits(baseBlockSize * densityMultiplier);

  // Explicit grid angle overrides transit orientation, so no transit options needed
  return generateStreetGrid(
    polygonPoints,
    effectiveBlockSize,
    "local", // Ignored - hierarchy determines class
    district.id,
    rng,
    district.type,
    newGridAngle,
    undefined // No transit options when angle is explicitly set
  );
}
