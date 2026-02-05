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
  /** Size of a city block in meters (50-300) */
  block_size_meters: number;
  /** Size of a district in meters (200-1000) */
  district_size_meters: number;
}

/** Default world settings */
export const DEFAULT_WORLD_SETTINGS: WorldSettings = {
  grid_organic: 0.5,
  sprawl_compact: 0.5,
  historic_modern: 0.5,
  transit_car: 0.5,
  block_size_meters: 100,
  district_size_meters: 500,
};

/** City scale presets for different city types */
export interface CityScalePreset {
  name: string;
  description: string;
  block_size_meters: number;
  district_size_meters: number;
}

export const CITY_SCALE_PRESETS: Record<string, CityScalePreset> = {
  manhattan: {
    name: "Manhattan",
    description: "Dense urban grid with small blocks",
    block_size_meters: 80,
    district_size_meters: 300,
  },
  portland: {
    name: "Portland",
    description: "Small walkable blocks, medium districts",
    block_size_meters: 60,
    district_size_meters: 400,
  },
  houston: {
    name: "Houston",
    description: "Large sprawling blocks and districts",
    block_size_meters: 200,
    district_size_meters: 800,
  },
  european: {
    name: "European",
    description: "Irregular small blocks, compact districts",
    block_size_meters: 70,
    district_size_meters: 350,
  },
  default: {
    name: "Default",
    description: "Standard American city layout",
    block_size_meters: 100,
    district_size_meters: 500,
  },
};

export interface WorldCreate {
  name: string;
  seed?: number;
  settings?: Partial<WorldSettings>;
}

export interface WorldUpdate {
  name?: string;
  settings?: Partial<WorldSettings>;
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

/** API district types - must match backend DistrictType enum */
export type DistrictType =
  | "residential"
  | "downtown"
  | "commercial"
  | "industrial"
  | "hospital"
  | "university"
  | "k12"
  | "park"
  | "airport";

export interface DistrictCreate {
  world_id: UUID;
  type: DistrictType;
  geometry: Record<string, unknown>;
  name?: string;
  density?: number;
  max_height?: number;
  transit_access?: boolean;
  historic?: boolean;
}

export interface DistrictUpdate {
  type?: DistrictType;
  name?: string;
  geometry?: Record<string, unknown>;
  density?: number;
  max_height?: number;
  transit_access?: boolean;
  historic?: boolean;
}

export interface DistrictBulkCreate {
  districts: DistrictCreate[];
}

export interface District {
  id: UUID;
  world_id: UUID;
  type: DistrictType;
  name?: string;
  geometry: Record<string, unknown>;
  density: number;
  max_height: number;
  transit_access: boolean;
  historic: boolean;
  created_at: DateTime;
  updated_at: DateTime;
}

// ============================================================================
// Neighborhood Types
// ============================================================================

export interface NeighborhoodCreate {
  world_id: UUID;
  name: string;
  geometry: Record<string, unknown>;
  label_color?: string;
  accent_color?: string;
}

export interface NeighborhoodUpdate {
  name?: string;
  geometry?: Record<string, unknown>;
  label_color?: string;
  accent_color?: string;
}

export interface NeighborhoodBulkCreate {
  neighborhoods: NeighborhoodCreate[];
}

export interface Neighborhood {
  id: UUID;
  world_id: UUID;
  name: string;
  geometry: Record<string, unknown>;
  label_color?: string;
  accent_color?: string;
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
// Transit Types
// ============================================================================

export type StationType = "subway" | "rail";

export type LineType = "subway" | "rail";

export interface TransitPoint {
  x: number;
  y: number;
}

export interface TransitStationCreate {
  world_id: UUID;
  district_id: UUID;
  station_type: StationType;
  name: string;
  position_x: number;
  position_y: number;
  is_terminus?: boolean;
}

export interface TransitStationUpdate {
  district_id?: UUID;
  station_type?: StationType;
  name?: string;
  position_x?: number;
  position_y?: number;
  is_terminus?: boolean;
}

export interface TransitStation {
  id: UUID;
  world_id: UUID;
  district_id: UUID;
  station_type: StationType;
  name: string;
  position_x: number;
  position_y: number;
  is_terminus: boolean;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface TransitStationBulkCreate {
  stations: TransitStationCreate[];
}

export interface TransitLineCreate {
  world_id: UUID;
  line_type: LineType;
  name: string;
  color?: string;
  is_auto_generated?: boolean;
}

export interface TransitLineUpdate {
  line_type?: LineType;
  name?: string;
  color?: string;
  is_auto_generated?: boolean;
}

export interface TransitLine {
  id: UUID;
  world_id: UUID;
  line_type: LineType;
  name: string;
  color: string;
  is_auto_generated: boolean;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface TransitLineBulkCreate {
  lines: TransitLineCreate[];
}

export interface TransitLineSegmentCreate {
  line_id: UUID;
  from_station_id: UUID;
  to_station_id: UUID;
  geometry?: TransitPoint[];
  is_underground?: boolean;
  order_in_line: number;
}

export interface TransitLineSegmentUpdate {
  from_station_id?: UUID;
  to_station_id?: UUID;
  geometry?: TransitPoint[];
  is_underground?: boolean;
  order_in_line?: number;
}

export interface TransitLineSegment {
  id: UUID;
  line_id: UUID;
  from_station_id: UUID;
  to_station_id: UUID;
  geometry: TransitPoint[];
  is_underground: boolean;
  order_in_line: number;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface TransitLineSegmentBulkCreate {
  segments: TransitLineSegmentCreate[];
}

export interface TransitLineWithSegments {
  id: UUID;
  world_id: UUID;
  line_type: LineType;
  name: string;
  color: string;
  is_auto_generated: boolean;
  segments: TransitLineSegment[];
  created_at: DateTime;
  updated_at: DateTime;
}

export interface TransitNetwork {
  world_id: UUID;
  stations: TransitStation[];
  lines: TransitLineWithSegments[];
}

export interface TransitNetworkStats {
  world_id: UUID;
  total_stations: number;
  total_lines: number;
  total_segments: number;
  stations_by_type: Record<string, number>;
  lines_by_type: Record<string, number>;
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
