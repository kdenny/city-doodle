/**
 * District geometry generator for creating district polygons with street grids.
 *
 * When a district seed is placed, this generates:
 * - A polygon around the placement point (rounded rectangle or organic shape)
 * - A street grid within the district bounds (local roads in a grid pattern)
 */

import type { District, Road, Point, DistrictType, RoadClass } from "./types";
import { generateDistrictName } from "../../../utils/nameGenerator";

/**
 * Scale settings for district and block sizes.
 */
export interface ScaleSettings {
  /** Size of a city block in meters (50-300) */
  blockSizeMeters: number;
  /** Size of a district in meters (200-1000) */
  districtSizeMeters: number;
  /** Sprawl-compact slider value (0-1), affects size multiplier */
  sprawlCompact?: number;
}

/**
 * Default scale settings matching common city layouts.
 * A typical urban block is about 100m x 100m (~330 feet).
 * A district is typically 400-800m across (~0.25-0.5 miles).
 */
export const DEFAULT_SCALE_SETTINGS: ScaleSettings = {
  blockSizeMeters: 100,
  districtSizeMeters: 600,
  sprawlCompact: 0.5,
};

/**
 * World scale constants.
 *
 * The world is a 3x3 tile grid, 768 world units across, representing 50 miles x 50 miles.
 * This gives us the conversion factor between world units and real-world measurements.
 */
const WORLD_SIZE_UNITS = 768;
const WORLD_SIZE_MILES = 50;
const METERS_PER_MILE = 1609.34;
const WORLD_SIZE_METERS = WORLD_SIZE_MILES * METERS_PER_MILE; // ~80,467 meters

/**
 * Convert meters to world units.
 *
 * 768 world units = 50 miles = 80,467 meters
 * So 1 meter = 768 / 80467 ≈ 0.00954 world units
 * Or 1 world unit ≈ 104.8 meters
 */
export function metersToWorldUnits(meters: number): number {
  return (meters / WORLD_SIZE_METERS) * WORLD_SIZE_UNITS;
}

/**
 * Convert world units to meters.
 */
export function worldUnitsToMeters(units: number): number {
  return (units / WORLD_SIZE_UNITS) * WORLD_SIZE_METERS;
}

/**
 * Convert miles to world units.
 */
export function milesToWorldUnits(miles: number): number {
  return (miles / WORLD_SIZE_MILES) * WORLD_SIZE_UNITS;
}

/**
 * Convert world units to miles.
 */
export function worldUnitsToMiles(units: number): number {
  return (units / WORLD_SIZE_UNITS) * WORLD_SIZE_MILES;
}

/**
 * Apply sprawl/compact multiplier to a size value.
 * sprawlCompact = 0 means sprawling (larger), sprawlCompact = 1 means compact (smaller)
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
}

const DEFAULT_CONFIG: Required<Omit<DistrictGenerationConfig, "scaleSettings">> & {
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
): Required<Omit<DistrictGenerationConfig, "scaleSettings">> & {
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

  return {
    size: config.size ?? effectiveDistrictSize,
    minSize: config.minSize ?? effectiveDistrictSize * 0.7,
    maxSize: config.maxSize ?? effectiveDistrictSize * 1.3,
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
 * Generate a unique ID for a district or road.
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
 * Generate a street grid within a polygon.
 * Creates horizontal and vertical streets clipped to the polygon bounds.
 */
function generateStreetGrid(
  polygon: Point[],
  spacing: number,
  roadClass: RoadClass,
  districtId: string,
  rng: SeededRandom
): Road[] {
  const bounds = getPolygonBounds(polygon);
  const roads: Road[] = [];

  // Add some padding and slight offset for variety
  const offsetX = rng.range(-spacing / 4, spacing / 4);
  const offsetY = rng.range(-spacing / 4, spacing / 4);

  // Generate horizontal streets
  let streetIndex = 0;
  for (let y = bounds.minY + spacing / 2 + offsetY; y < bounds.maxY - spacing / 4; y += spacing) {
    // Find intersections with polygon
    const intersections = lineIntersectsPolygon(
      bounds.minX - 10, y,
      bounds.maxX + 10, y,
      polygon
    );

    // Create road segments from pairs of intersections
    for (let i = 0; i < intersections.length - 1; i += 2) {
      if (intersections[i + 1]) {
        // Add slight variation to make it look more organic
        const jitter = rng.range(-2, 2);
        roads.push({
          id: generateId(`${districtId}-street-h-${streetIndex}`),
          roadClass,
          line: {
            points: [
              { x: intersections[i].x, y: intersections[i].y + jitter },
              { x: intersections[i + 1].x, y: intersections[i + 1].y + jitter },
            ],
          },
        });
        streetIndex++;
      }
    }
  }

  // Generate vertical streets
  for (let x = bounds.minX + spacing / 2 + offsetX; x < bounds.maxX - spacing / 4; x += spacing) {
    // Find intersections with polygon
    const intersections = lineIntersectsPolygon(
      x, bounds.minY - 10,
      x, bounds.maxY + 10,
      polygon
    );

    // Create road segments from pairs of intersections
    for (let i = 0; i < intersections.length - 1; i += 2) {
      if (intersections[i + 1]) {
        const jitter = rng.range(-2, 2);
        roads.push({
          id: generateId(`${districtId}-street-v-${streetIndex}`),
          roadClass,
          line: {
            points: [
              { x: intersections[i].x + jitter, y: intersections[i].y },
              { x: intersections[i + 1].x + jitter, y: intersections[i + 1].y },
            ],
          },
        });
        streetIndex++;
      }
    }
  }

  return roads;
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

  // Use position to seed the RNG for deterministic results
  const seed = Math.floor(position.x * 1000 + position.y * 7919);
  const rng = new SeededRandom(seed);

  // Vary the size slightly
  const size = rng.range(cfg.minSize, cfg.maxSize);
  const districtType = seedIdToDistrictType(seedId);
  const districtId = generateId(`district`);

  // Choose polygon shape based on district type and organic factor
  let polygonPoints: Point[];

  if (districtType === "downtown" || districtType === "commercial") {
    // More rectangular for urban areas
    const width = size * rng.range(0.8, 1.2);
    const height = size * rng.range(0.7, 1.0);
    polygonPoints = generateRoundedRectangle(
      position.x,
      position.y,
      width,
      height,
      size * 0.1
    );
  } else if (districtType === "park" || districtType === "airport") {
    // More organic for parks, larger for airports
    const factor = districtType === "airport" ? 1.5 : 1.0;
    polygonPoints = generateOrganicPolygon(
      position.x,
      position.y,
      size * factor / 2,
      cfg.polygonPoints + rng.intRange(0, 4),
      cfg.organicFactor + 0.2,
      rng
    );
  } else {
    // Default organic shape with some variation
    polygonPoints = generateOrganicPolygon(
      position.x,
      position.y,
      size / 2,
      cfg.polygonPoints,
      cfg.organicFactor,
      rng
    );
  }

  // Generate district
  const district: District = {
    id: districtId,
    type: districtType,
    name: getDistrictName(districtType, seed),
    polygon: { points: polygonPoints },
    isHistoric: false,
  };

  // Generate street grid within the district
  // Parks and airports don't have street grids
  let roads: Road[] = [];
  if (districtType !== "park" && districtType !== "airport") {
    const streetSpacing = districtType === "downtown" ? cfg.streetSpacing * 0.7 : cfg.streetSpacing;
    roads = generateStreetGrid(
      polygonPoints,
      streetSpacing,
      cfg.streetClass,
      districtId,
      rng
    );
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
