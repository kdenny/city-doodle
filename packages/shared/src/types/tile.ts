/**
 * Tile models - represents a map tile and its lock state
 */

export interface TerrainData {
  /** 2D array of elevation values */
  elevation: number[][]
  /** Water feature polygons */
  water_bodies: Record<string, unknown>[]
  /** Vegetation area polygons */
  vegetation: Record<string, unknown>[]
}

export interface TileFeatures {
  /** Road geometries */
  roads: Record<string, unknown>[]
  /** Building footprints */
  buildings: Record<string, unknown>[]
  /** Points of interest */
  pois: Record<string, unknown>[]
}

export interface TileCreate {
  world_id: string
  /** Tile X coordinate */
  tx: number
  /** Tile Y coordinate */
  ty: number
}

export interface Tile {
  id: string
  world_id: string
  /** Tile X coordinate */
  tx: number
  /** Tile Y coordinate */
  ty: number
  terrain_data: TerrainData
  features: TileFeatures
  created_at: string
  updated_at: string
}

export interface TileLockCreate {
  tile_id: string
  /** Lock duration in seconds (60-3600) */
  duration_seconds?: number
}

export interface TileLock {
  tile_id: string
  user_id: string
  locked_at: string
  expires_at: string
}
