/**
 * Park geometry generator for creating parks with internal features and road connections.
 *
 * Parks can be placed OUTSIDE of districts (unlike transit stations) and auto-connect
 * to the nearest road network. Parks have configurable sizes from pocket parks to
 * large city parks.
 *
 * Features:
 * - Organic polygon shapes that look natural
 * - Internal paths/trails for larger parks
 * - Pond features for community+ sized parks
 * - Auto-connection to nearest road network
 * - Deterministic generation based on position seed
 */

import type { Point, Road, RoadClass, Polygon, District } from "./types";
import { ParkSize, PARK_SIZE_CONFIG } from "../../palette/types";
import { generateId } from "../../../utils/idGenerator";

/**
 * Configuration for park generation.
 */
export interface ParkGenerationConfig {
  /** Park size preset */
  size: ParkSize;
  /** Custom radius override (in world units) */
  customRadius?: number;
  /** Organic factor for shape variation (0-1, default 0.4) */
  organicFactor?: number;
  /** Number of polygon points (default 12) */
  polygonPoints?: number;
  /** Explicit seed for deterministic generation */
  seed?: number;
}

/**
 * Result of generating a park.
 */
export interface GeneratedPark {
  /** The park polygon boundary */
  polygon: Polygon;
  /** Internal paths/trails */
  paths: Road[];
  /** Pond features (as polygons) */
  ponds: Polygon[];
  /** Connection point to nearest road */
  connectionPoint: Point | null;
  /** Generated park name */
  name: string;
}

/**
 * Road segment for finding nearest connection point.
 */
export interface RoadSegment {
  id: string;
  start: Point;
  end: Point;
  roadClass: RoadClass;
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

  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }

  /** Pick a random item from an array */
  pick<T>(items: T[]): T {
    return items[this.intRange(0, items.length)];
  }
}


/**
 * Calculate distance between two points.
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the nearest point on a line segment to a given point.
 */
function nearestPointOnSegment(point: Point, segStart: Point, segEnd: Point): Point {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return segStart;

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };
}

/**
 * Check if a point is inside a polygon using ray casting.
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
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
 * Park name components for generation.
 */
const PARK_NAME_PREFIXES = [
  "Green", "Oak", "Maple", "Cedar", "Pine", "Willow", "Birch", "Elm",
  "Meadow", "Valley", "River", "Lake", "Hill", "Forest", "Grove",
  "Sunset", "Sunrise", "Golden", "Silver", "Crystal", "Peaceful",
  "Heritage", "Memorial", "Liberty", "Freedom", "Unity", "Harmony",
];

const PARK_NAME_SUFFIXES = [
  "Park", "Gardens", "Commons", "Green", "Square", "Plaza",
  "Reserve", "Preserve", "Sanctuary", "Woods", "Trail",
];

/**
 * Generate a park name based on seed.
 */
function generateParkName(rng: SeededRandom, size: ParkSize): string {
  const prefix = rng.pick(PARK_NAME_PREFIXES);
  const suffix = rng.pick(PARK_NAME_SUFFIXES);

  // Larger parks sometimes have more elaborate names
  if (size === "city" || size === "regional") {
    if (rng.next() > 0.5) {
      return `${prefix} ${suffix}`;
    }
    return `The ${prefix} ${suffix}`;
  }

  return `${prefix} ${suffix}`;
}

/**
 * Generate an organic polygon for the park boundary.
 */
function generateParkPolygon(
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

    // More variation for parks than districts - they're more natural
    const radiusVariation = 1 - organicFactor / 2 + rng.next() * organicFactor;
    const radius = baseRadius * radiusVariation;

    // Angular offset for organic feel
    const angleOffset = (rng.next() - 0.5) * organicFactor * (Math.PI / numPoints) * 1.5;
    const finalAngle = angle + angleOffset;

    points.push({
      x: centerX + Math.cos(finalAngle) * radius,
      y: centerY + Math.sin(finalAngle) * radius,
    });
  }

  return points;
}

/**
 * Generate internal paths for a park.
 * Creates a natural-looking path network within the park.
 */
function generateInternalPaths(
  polygon: Point[],
  centerX: number,
  centerY: number,
  radius: number,
  featureDensity: number,
  rng: SeededRandom,
  parkId: string
): Road[] {
  const paths: Road[] = [];

  if (featureDensity < 0.1) return paths;

  // Calculate number of paths based on density and size
  const numPaths = Math.floor(2 + featureDensity * 6);

  for (let i = 0; i < numPaths; i++) {
    // Generate path from near edge to near center (or across)
    const startAngle = rng.range(0, Math.PI * 2);
    const endAngle = startAngle + rng.range(Math.PI * 0.5, Math.PI * 1.5);

    const startRadius = radius * rng.range(0.6, 0.9);
    const endRadius = radius * rng.range(0.3, 0.7);

    const start: Point = {
      x: centerX + Math.cos(startAngle) * startRadius,
      y: centerY + Math.sin(startAngle) * startRadius,
    };

    const end: Point = {
      x: centerX + Math.cos(endAngle) * endRadius,
      y: centerY + Math.sin(endAngle) * endRadius,
    };

    // Skip if start or end is outside polygon
    if (!pointInPolygon(start, polygon) || !pointInPolygon(end, polygon)) {
      continue;
    }

    // Create curved path with waypoints
    const pathPoints: Point[] = [start];

    // Add 1-3 intermediate waypoints for curved paths
    const numWaypoints = rng.intRange(1, 4);
    for (let j = 0; j < numWaypoints; j++) {
      const t = (j + 1) / (numWaypoints + 1);
      const midX = start.x + (end.x - start.x) * t;
      const midY = start.y + (end.y - start.y) * t;

      // Add perpendicular offset for curve
      const perpX = -(end.y - start.y);
      const perpY = end.x - start.x;
      const perpLen = Math.sqrt(perpX * perpX + perpY * perpY);
      const offset = rng.range(-radius * 0.2, radius * 0.2);

      const waypoint: Point = {
        x: midX + (perpX / perpLen) * offset,
        y: midY + (perpY / perpLen) * offset,
      };

      if (pointInPolygon(waypoint, polygon)) {
        pathPoints.push(waypoint);
      }
    }

    pathPoints.push(end);

    paths.push({
      id: generateId(`${parkId}-path-${i}`),
      roadClass: "trail",
      line: { points: pathPoints },
      name: `${i === 0 ? "Main" : "Secondary"} Trail`,
    });
  }

  return paths;
}

/**
 * Generate pond features for larger parks.
 */
function generatePonds(
  parkPolygon: Point[],
  centerX: number,
  centerY: number,
  radius: number,
  featureDensity: number,
  rng: SeededRandom
): Polygon[] {
  const ponds: Polygon[] = [];

  // Only generate ponds for higher density (larger parks)
  if (featureDensity < 0.4) return ponds;

  // 50% chance of having a pond
  if (rng.next() > 0.5) return ponds;

  const numPonds = featureDensity > 0.6 ? rng.intRange(1, 3) : 1;

  for (let i = 0; i < numPonds; i++) {
    // Place pond at random location within park
    const angle = rng.range(0, Math.PI * 2);
    const dist = radius * rng.range(0.1, 0.5);

    const pondCenterX = centerX + Math.cos(angle) * dist;
    const pondCenterY = centerY + Math.sin(angle) * dist;

    // Pond size relative to park
    const pondRadius = radius * rng.range(0.1, 0.25);

    // Generate organic pond shape
    const pondPoints = generateParkPolygon(
      pondCenterX,
      pondCenterY,
      pondRadius,
      8 + rng.intRange(0, 5),
      0.5, // High organic factor for natural look
      rng
    );

    // Verify pond is within park
    const allInside = pondPoints.every(p => pointInPolygon(p, parkPolygon));
    if (allInside) {
      ponds.push({ points: pondPoints });
    }
  }

  return ponds;
}

/**
 * Find the nearest road segment to a park and return the connection point.
 * Returns the point on the park boundary closest to the nearest road,
 * and the point on the road to connect to.
 */
export function findNearestRoadConnection(
  parkPolygon: Point[],
  roads: RoadSegment[],
  maxDistance: number = 50 // Maximum distance to search for roads
): { parkEdgePoint: Point; roadPoint: Point; roadId: string } | null {
  if (roads.length === 0) return null;

  let nearestConnection: {
    parkEdgePoint: Point;
    roadPoint: Point;
    roadId: string;
    distance: number;
  } | null = null;

  // Check each point on park boundary against each road segment
  for (let i = 0; i < parkPolygon.length; i++) {
    const p1 = parkPolygon[i];
    const p2 = parkPolygon[(i + 1) % parkPolygon.length];

    // Sample points along this edge
    const numSamples = 5;
    for (let s = 0; s <= numSamples; s++) {
      const t = s / numSamples;
      const edgePoint: Point = {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
      };

      // Find nearest road to this edge point
      for (const road of roads) {
        const roadPoint = nearestPointOnSegment(edgePoint, road.start, road.end);
        const dist = distance(edgePoint, roadPoint);

        if (dist <= maxDistance && (!nearestConnection || dist < nearestConnection.distance)) {
          nearestConnection = {
            parkEdgePoint: edgePoint,
            roadPoint,
            roadId: road.id,
            distance: dist,
          };
        }
      }
    }
  }

  if (nearestConnection) {
    return {
      parkEdgePoint: nearestConnection.parkEdgePoint,
      roadPoint: nearestConnection.roadPoint,
      roadId: nearestConnection.roadId,
    };
  }

  return null;
}

/**
 * Generate a connection road from park to nearest road.
 */
function generateConnectionRoad(
  parkEdgePoint: Point,
  roadPoint: Point,
  parkId: string
): Road {
  return {
    id: generateId(`${parkId}-connection`),
    roadClass: "local",
    line: { points: [parkEdgePoint, roadPoint] },
    name: "Park Access Road",
  };
}

/**
 * Extract road segments from existing roads for connection finding.
 */
export function extractRoadSegments(roads: Road[]): RoadSegment[] {
  const segments: RoadSegment[] = [];

  for (const road of roads) {
    const points = road.line.points;
    for (let i = 0; i < points.length - 1; i++) {
      segments.push({
        id: road.id,
        start: points[i],
        end: points[i + 1],
        roadClass: road.roadClass,
      });
    }
  }

  return segments;
}

/**
 * Get park size from seed ID (e.g., "park_neighborhood" -> "neighborhood").
 */
export function getParkSizeFromSeedId(seedId: string): ParkSize {
  const sizeMap: Record<string, ParkSize> = {
    park_pocket: "pocket",
    park_neighborhood: "neighborhood",
    park_community: "community",
    park_regional: "regional",
    park_city: "city",
    park: "neighborhood", // Default for legacy "park" seed
  };
  return sizeMap[seedId] ?? "neighborhood";
}

/**
 * Generate a complete park with polygon, features, and road connection.
 *
 * @param position - Center position for the park
 * @param seedId - The park seed type ID (e.g., "park_neighborhood")
 * @param existingRoads - Existing roads to connect to
 * @param config - Optional configuration overrides
 * @returns Generated park with all features
 */
export function generatePark(
  position: { x: number; y: number },
  seedId: string,
  existingRoads: Road[] = [],
  config: Partial<ParkGenerationConfig> = {}
): GeneratedPark {
  const size = config.size ?? getParkSizeFromSeedId(seedId);
  const sizeConfig = PARK_SIZE_CONFIG[size];

  // Use explicit seed if provided, otherwise derive from position
  const seed = config.seed ?? Math.floor(position.x * 1000 + position.y * 7919);
  const rng = new SeededRandom(seed);

  const parkId = generateId("park");

  // Calculate radius with some variation
  const baseRadius = config.customRadius ?? sizeConfig.radiusWorldUnits;
  const radius = baseRadius * rng.range(0.9, 1.1);

  // Generate organic polygon
  const organicFactor = config.organicFactor ?? 0.4;
  const numPoints = config.polygonPoints ?? 12;
  const polygonPoints = generateParkPolygon(
    position.x,
    position.y,
    radius,
    numPoints,
    organicFactor,
    rng
  );

  const polygon: Polygon = { points: polygonPoints };

  // Generate internal features based on size
  const paths: Road[] = sizeConfig.hasInternalFeatures
    ? generateInternalPaths(
        polygonPoints,
        position.x,
        position.y,
        radius,
        sizeConfig.featureDensity,
        rng,
        parkId
      )
    : [];

  const ponds: Polygon[] = sizeConfig.hasInternalFeatures
    ? generatePonds(
        polygonPoints,
        position.x,
        position.y,
        radius,
        sizeConfig.featureDensity,
        rng
      )
    : [];

  // Find and create road connection
  let connectionPoint: Point | null = null;
  const roadSegments = extractRoadSegments(existingRoads);
  const connection = findNearestRoadConnection(polygonPoints, roadSegments);

  if (connection) {
    connectionPoint = connection.parkEdgePoint;
    const connectionRoad = generateConnectionRoad(
      connection.parkEdgePoint,
      connection.roadPoint,
      parkId
    );
    paths.push(connectionRoad);
  }

  // Generate name
  const name = generateParkName(rng, size);

  return {
    polygon,
    paths,
    ponds,
    connectionPoint,
    name,
  };
}

/**
 * Check if a park would overlap with existing districts or parks.
 */
export function wouldParkOverlap(
  parkPolygon: Point[],
  existingDistricts: District[],
  existingParks: Polygon[] = []
): boolean {
  // Get park bounds for quick rejection
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const point of parkPolygon) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  // Check against districts
  for (const district of existingDistricts) {
    const distPoints = district.polygon.points;

    // Quick bounds check
    let dMinX = Infinity, dMaxX = -Infinity;
    let dMinY = Infinity, dMaxY = -Infinity;
    for (const p of distPoints) {
      dMinX = Math.min(dMinX, p.x);
      dMaxX = Math.max(dMaxX, p.x);
      dMinY = Math.min(dMinY, p.y);
      dMaxY = Math.max(dMaxY, p.y);
    }

    if (maxX < dMinX || minX > dMaxX || maxY < dMinY || minY > dMaxY) {
      continue;
    }

    // Check for actual overlap
    for (const point of parkPolygon) {
      if (pointInPolygon(point, distPoints)) {
        return true;
      }
    }
    for (const point of distPoints) {
      if (pointInPolygon(point, parkPolygon)) {
        return true;
      }
    }
  }

  // Check against existing parks
  for (const existingPark of existingParks) {
    const epPoints = existingPark.points;

    for (const point of parkPolygon) {
      if (pointInPolygon(point, epPoints)) {
        return true;
      }
    }
    for (const point of epPoints) {
      if (pointInPolygon(point, parkPolygon)) {
        return true;
      }
    }
  }

  return false;
}
