/**
 * TypeScript types matching the API Pydantic schemas.
 * These should be kept in sync with apps/api/src/city_api/schemas/
 */

// ============================================================================
// Common Types
// ============================================================================

/** UUID string type */
export type UUID = string;

/** ISO datetime string */
export type DateTime = string;

// ============================================================================
// User & Auth Types
// ============================================================================

export interface UserCreate {
  email: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserResponse {
  id: UUID;
  email: string;
  created_at: DateTime;
}

export interface SessionResponse {
  token: string;
  expires_at: DateTime;
}

export interface AuthResponse {
  user: UserResponse;
  session: SessionResponse;
}

// ============================================================================
// World Types
// ============================================================================

export interface WorldSettings {
  /** 0 = strict grid, 1 = fully organic street layout */
  grid_organic: number;
  /** 0 = sprawling suburbs, 1 = dense urban core */
  sprawl_compact: number;
  /** 0 = historic preservation focus, 1 = modern redevelopment */
  historic_modern: number;
  /** 0 = transit-oriented, 1 = car-dependent */
  transit_car: number;
}

export interface WorldCreate {
  name: string;
  seed?: number;
  settings?: WorldSettings;
}

export interface WorldUpdate {
  name?: string;
  settings?: WorldSettings;
}

export interface World {
  id: UUID;
  name: string;
  seed: number;
  settings: WorldSettings;
  created_at: DateTime;
  updated_at: DateTime;
}

// ============================================================================
// Tile Types
// ============================================================================

export interface TerrainData {
  elevation: number[][];
  water_bodies: Record<string, unknown>[];
  vegetation: Record<string, unknown>[];
}

export interface TileFeatures {
  roads: Record<string, unknown>[];
  buildings: Record<string, unknown>[];
  pois: Record<string, unknown>[];
}

export interface TileCreate {
  world_id: UUID;
  tx: number;
  ty: number;
}

export interface TileUpdate {
  terrain_data?: TerrainData;
  features?: TileFeatures;
}

export interface Tile {
  id: UUID;
  world_id: UUID;
  tx: number;
  ty: number;
  terrain_data: TerrainData;
  features: TileFeatures;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface TileLockCreate {
  duration_seconds?: number;
}

export interface TileLock {
  tile_id: UUID;
  user_id: UUID;
  locked_at: DateTime;
  expires_at: DateTime;
}

// ============================================================================
// Job Types
// ============================================================================

export type JobType =
  | "terrain_generation"
  | "seed_placement"
  | "growth_simulation"
  | "vmt_calculation"
  | "city_growth"
  | "export_png"
  | "export_gif";

export type JobStatus =
  | "pending"
  | "running"
  | "claimed"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobCreate {
  type: JobType;
  tile_id?: UUID;
  params?: Record<string, unknown>;
}

export interface Job {
  id: UUID;
  user_id: UUID;
  type: JobType;
  status: JobStatus;
  tile_id?: UUID;
  params: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  created_at: DateTime;
  started_at?: DateTime;
  completed_at?: DateTime;
}

// ============================================================================
// District Types
// ============================================================================

export type DistrictType =
  | "residential"
  | "commercial"
  | "industrial"
  | "mixed_use"
  | "park"
  | "civic"
  | "transit_hub";

export interface DistrictCreate {
  tile_id: UUID;
  type: DistrictType;
  geometry: Record<string, unknown>;
  name?: string;
}

export interface District {
  id: UUID;
  tile_id: UUID;
  type: DistrictType;
  name?: string;
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
  created_at: DateTime;
  updated_at: DateTime;
}

// ============================================================================
// Placed Seed Types
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface PlacedSeedCreate {
  seed_type_id: string;
  position: Position;
}

export interface PlacedSeedBulkCreate {
  seeds: PlacedSeedCreate[];
}

export interface PlacedSeed {
  id: UUID;
  world_id: UUID;
  seed_type_id: string;
  position: Position;
  placed_at: DateTime;
}

// ============================================================================
// API Error Types
// ============================================================================

export interface ApiError {
  detail: string | { message: string; [key: string]: unknown };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}
