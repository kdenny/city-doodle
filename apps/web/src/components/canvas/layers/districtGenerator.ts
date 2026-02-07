/**
 * District geometry generator for creating district polygons with street grids.
 *
 * When a district seed is placed, this generates:
 * - A polygon around the placement point (rounded rectangle or organic shape)
 * - A street grid within the district bounds with proper hierarchy
 *
 * Geometry helpers are in ./geometry.ts; the grid algorithm is in ./streetGrid.ts.
 */

import type { District, Road, Point, DistrictType, RoadClass } from "./types";
import { generateDistrictName, type NamingContext } from "../../../utils/nameGenerator";
import { generateId } from "../../../utils/idGenerator";
import {
  metersToWorldUnits,
  worldUnitsToMeters,
  milesToWorldUnits,
  worldUnitsToMiles,
} from "../../../utils/worldConstants";
import { getPolygonBounds, getPolygonCentroid, pointInPolygon } from "./geometry";
import { polygonArea } from "./polygonUtils";
import { SeededRandom, generateStreetGrid, type TransitGridOptions } from "./streetGrid";
import polygonClipping from "polygon-clipping";

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
  /**
   * Naming context for context-aware name generation (CITY-380).
   * Provides world name, adjacent district names, and nearby water feature names.
   */
  namingContext?: NamingContext;
}

const DEFAULT_CONFIG: Required<Omit<DistrictGenerationConfig, "scaleSettings" | "seed" | "transitStations" | "transitCar" | "eraYear" | "namingContext">> & {
  scaleSettings: ScaleSettings;
} = {
  size: 120,
  minSize: 80,
  maxSize: 160,
  polygonPoints: 8,
  organicFactor: 0.15,
  streetSpacing: 30,
  streetClass: "local",
  scaleSettings: DEFAULT_SCALE_SETTINGS,
};

/**
 * Calculate effective district config based on scale settings.
 */
export function getEffectiveDistrictConfig(
  config: DistrictGenerationConfig = {}
): Required<Omit<DistrictGenerationConfig, "scaleSettings" | "seed" | "transitStations" | "transitCar" | "eraYear" | "namingContext">> & {
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
    streetSpacing: config.streetSpacing ?? effectiveStreetSpacing * 0.5, // ~50% of block for streets
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
    park_pocket: "park",
    park_neighborhood: "park",
    park_community: "park",
    park_regional: "park",
    park_city: "park",
    airport: "airport",
  };
  return mapping[seedId] ?? "residential";
}

/**
 * Get a display name for a district type.
 * Delegates to the centralized name generator utility.
 * Passes naming context for context-aware park/airport naming (CITY-380).
 */
function getDistrictName(type: DistrictType, seed: number, namingContext?: NamingContext): string {
  return generateDistrictName(type, { seed }, namingContext);
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
    name: getDistrictName(districtType, seed, config.namingContext),
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
 * CITY-384: Result of clipping a new district against existing districts.
 */
export interface DistrictClipResult {
  /** Clipped polygon (empty if nothing remains) */
  clippedPolygon: Point[];
  /** IDs of districts that share a boundary with the clipped polygon */
  adjacentDistrictIds: string[];
  /** Whether the original polygon needed clipping */
  wasClipped: boolean;
  /** Whether the remaining area is too small for a valid district */
  tooSmall: boolean;
}

/**
 * CITY-384: Clip a new district polygon against existing districts.
 *
 * Uses polygon-clipping library to compute the difference (subtraction)
 * of the new polygon minus all overlapping existing districts. The result
 * is a polygon that fits flush against its neighbors with shared boundaries.
 *
 * @param newPolygon - The proposed new district polygon
 * @param existingDistricts - All existing districts to clip against
 * @param minAreaWorldUnits - Minimum area in world units squared (default: 4 blocks)
 * @returns Clip result with the clipped polygon and adjacency info
 */
export function clipDistrictAgainstExisting(
  newPolygon: Point[],
  existingDistricts: District[],
  minAreaWorldUnits: number = 400
): DistrictClipResult {
  if (newPolygon.length < 3) {
    return { clippedPolygon: [], adjacentDistrictIds: [], wasClipped: false, tooSmall: true };
  }

  // Find which existing districts actually overlap
  const overlapping: District[] = [];
  const newBounds = getPolygonBounds(newPolygon);

  for (const existing of existingDistricts) {
    const existingBounds = getPolygonBounds(existing.polygon.points);

    // Quick AABB check
    if (
      newBounds.maxX < existingBounds.minX ||
      newBounds.minX > existingBounds.maxX ||
      newBounds.maxY < existingBounds.minY ||
      newBounds.minY > existingBounds.maxY
    ) {
      continue;
    }

    // Detailed point-in-polygon check (either direction)
    let overlaps = false;
    for (const point of newPolygon) {
      if (pointInPolygon(point.x, point.y, existing.polygon.points)) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      for (const point of existing.polygon.points) {
        if (pointInPolygon(point.x, point.y, newPolygon)) {
          overlaps = true;
          break;
        }
      }
    }

    if (overlaps) {
      overlapping.push(existing);
    }
  }

  // No overlap — return original polygon unchanged
  if (overlapping.length === 0) {
    return {
      clippedPolygon: newPolygon,
      adjacentDistrictIds: [],
      wasClipped: false,
      tooSmall: false,
    };
  }

  // Convert Point[] to polygon-clipping format: [[[x,y], [x,y], ...]]
  // polygon-clipping uses GeoJSON-style rings: number[][][]
  const toRing = (pts: Point[]): [number, number][] =>
    pts.map((p) => [p.x, p.y]);

  let result: [number, number][][][] = [[toRing(newPolygon)]];

  // Subtract each overlapping district
  for (const existing of overlapping) {
    const clipPoly: [number, number][][][] = [[toRing(existing.polygon.points)]];
    result = polygonClipping.difference(result, clipPoly) as [number, number][][][];
    if (result.length === 0) break;
  }

  if (result.length === 0) {
    return { clippedPolygon: [], adjacentDistrictIds: overlapping.map((d) => d.id), wasClipped: true, tooSmall: true };
  }

  // If multiple polygons result, pick the largest
  let bestPoly: [number, number][] = result[0][0];
  if (result.length > 1) {
    let bestArea = 0;
    for (const multiPoly of result) {
      const ring = multiPoly[0]; // outer ring
      const pts = ring.map(([x, y]) => ({ x, y }));
      const area = Math.abs(polygonArea(pts));
      if (area > bestArea) {
        bestArea = area;
        bestPoly = ring;
      }
    }
  }

  // Convert back to Point[]
  const clippedPolygon = bestPoly.map(([x, y]) => ({ x, y }));

  // Validate area
  const area = Math.abs(polygonArea(clippedPolygon));
  if (area < minAreaWorldUnits) {
    return {
      clippedPolygon,
      adjacentDistrictIds: overlapping.map((d) => d.id),
      wasClipped: true,
      tooSmall: true,
    };
  }

  return {
    clippedPolygon,
    adjacentDistrictIds: overlapping.map((d) => d.id),
    wasClipped: true,
    tooSmall: false,
  };
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
