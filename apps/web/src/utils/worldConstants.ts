/**
 * World and canvas constants for City Doodle.
 *
 * These constants define the world coordinate system and conversion
 * factors between world units and real-world measurements.
 */

// =============================================================================
// Canvas/Tile Constants
// =============================================================================

/** Size of a single tile in world coordinates */
export const TILE_SIZE = 256;

/** Number of tiles in the world grid (3x3) */
export const WORLD_TILES = 3;

/** Total world size in world units (768 = 256 * 3) */
export const WORLD_SIZE = TILE_SIZE * WORLD_TILES;

// =============================================================================
// Real-World Scale Constants
// =============================================================================

/** The world represents this many miles across */
export const WORLD_SIZE_MILES = 50;

/** Standard meters per mile conversion */
export const METERS_PER_MILE = 1609.34;

/** World size in meters (50 miles = ~80,467 meters) */
export const WORLD_SIZE_METERS = WORLD_SIZE_MILES * METERS_PER_MILE;

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert meters to world units.
 *
 * 768 world units = 50 miles = 80,467 meters
 * So 1 meter = 768 / 80467 ≈ 0.00954 world units
 * Or 1 world unit ≈ 104.8 meters
 */
export function metersToWorldUnits(meters: number): number {
  return (meters / WORLD_SIZE_METERS) * WORLD_SIZE;
}

/**
 * Convert world units to meters.
 */
export function worldUnitsToMeters(units: number): number {
  return (units / WORLD_SIZE) * WORLD_SIZE_METERS;
}

/**
 * Convert miles to world units.
 */
export function milesToWorldUnits(miles: number): number {
  return (miles / WORLD_SIZE_MILES) * WORLD_SIZE;
}

/**
 * Convert world units to miles.
 */
export function worldUnitsToMiles(units: number): number {
  return (units / WORLD_SIZE) * WORLD_SIZE_MILES;
}
