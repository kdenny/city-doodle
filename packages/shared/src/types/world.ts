/**
 * World model - represents a user's city map
 */

export interface WorldSettings {
  /** 0 = strict grid, 1 = fully organic street layout */
  grid_organic: number
  /** 0 = sprawling suburbs, 1 = dense urban core */
  sprawl_compact: number
  /** 0 = historic preservation focus, 1 = modern redevelopment */
  historic_modern: number
  /** 0 = transit-oriented, 1 = car-dependent */
  transit_car: number
  /** Whether to generate beaches along coastlines */
  beach_enabled?: boolean
  /** Multiplier for beach width (0.5 = narrow, 2.0 = wide) */
  beach_width_multiplier?: number
}

export interface WorldCreate {
  name: string
  /** Random seed for generation */
  seed?: number | null
  settings?: WorldSettings
}

export interface World {
  id: string
  name: string
  seed: number
  settings: WorldSettings
  created_at: string
  updated_at: string
}
