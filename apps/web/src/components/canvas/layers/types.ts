/**
 * Terrain data types for map rendering.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Polygon {
  points: Point[];
}

export interface Line {
  points: Point[];
  width?: number;
}

export interface WaterFeature {
  id: string;
  type: "ocean" | "lake";
  polygon: Polygon;
  /** Auto-generated or user-edited name for lakes (oceans typically don't have names) */
  name?: string;
}

export interface CoastlineFeature {
  id: string;
  line: Line;
}

export interface RiverFeature {
  id: string;
  line: Line;
  width: number; // varies along length
  /** Auto-generated or user-edited name */
  name?: string;
}

export interface ContourLine {
  id: string;
  elevation: number;
  line: Line;
}

/**
 * Beach types based on adjacent water body
 */
export type BeachType = "ocean" | "bay" | "lake" | "river";

export interface BeachFeature {
  id: string;
  /** Type of water body the beach is adjacent to */
  beachType: BeachType;
  polygon: Polygon;
  /** Average width of the beach in world units (varies based on slope) */
  width?: number;
  /** Optional name for the beach */
  name?: string;
}

export interface TerrainData {
  water: WaterFeature[];
  coastlines: CoastlineFeature[];
  rivers: RiverFeature[];
  contours: ContourLine[];
  beaches: BeachFeature[];
}

// District types matching the spec
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

/**
 * Personality settings for a district.
 * Each slider is 0.0-1.0, affecting how the district generates and grows.
 * Era year determines the architectural period.
 */
export interface DistrictPersonality {
  /** 0 = strict grid, 1 = fully organic street layout */
  grid_organic: number;
  /** 0 = sprawling suburbs, 1 = dense urban core */
  sprawl_compact: number;
  /** 0 = transit-oriented, 1 = car-dependent */
  transit_car: number;
  /**
   * The architectural era year for this district.
   * Replaces the 0-1 historic_modern slider.
   * Values: 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1850, 1875, 1900, 1920, 1940, 1960, 1980, 2024 (Present)
   */
  era_year: number;
}

/** Default personality values (balanced/neutral, Contemporary era) */
export const DEFAULT_DISTRICT_PERSONALITY: DistrictPersonality = {
  grid_organic: 0.5,
  sprawl_compact: 0.5,
  transit_car: 0.5,
  era_year: 2024, // Contemporary/Present
};

export interface District {
  id: string;
  type: DistrictType;
  name: string;
  polygon: Polygon;
  isHistoric?: boolean;
  /** Per-district personality settings */
  personality?: DistrictPersonality;
}

// Road hierarchy classes
export type RoadClass =
  | "highway"
  | "arterial"
  | "collector"
  | "local"
  | "trail";

export interface Road {
  id: string;
  name?: string;
  roadClass: RoadClass;
  line: Line;
}

// POI types
export type POIType =
  | "hospital"
  | "school"
  | "university"
  | "park"
  | "transit"
  | "shopping"
  | "civic"
  | "industrial";

export interface POI {
  id: string;
  name: string;
  type: POIType;
  position: Point;
}

export interface Neighborhood {
  id: string;
  name: string;
  polygon: Polygon;
  labelColor?: string;
  accentColor?: string;
}

export interface FeaturesData {
  districts: District[];
  roads: Road[];
  pois: POI[];
  neighborhoods: Neighborhood[];
}

// Label types
export type LabelType =
  | "district"
  | "water"
  | "road"
  | "poi"
  | "region"
  | "contour";

export interface LabelData {
  id: string;
  text: string;
  type: LabelType;
  position: Point;
  anchor?: Point; // For curved/angled labels
  rotation?: number; // Radians
  fontSize?: number;
  priority?: number; // Higher = more important, shown first
  bounds?: { width: number; height: number }; // For collision detection
}

export interface LabelConfig {
  fontFamily: string;
  baseFontSize: number;
  color: number;
  outlineColor: number;
  outlineWidth: number;
  maxRotation: number; // Max random rotation for organic feel
  jitterAmount: number; // Random position offset
}

export interface LabelLayerData {
  labels: LabelData[];
  seed: number; // For deterministic randomness
}

export interface LayerVisibility {
  water: boolean;
  beaches: boolean;
  coastlines: boolean;
  rivers: boolean;
  contours: boolean;
  districts: boolean;
  roads: boolean;
  pois: boolean;
  grid: boolean;
  labels: boolean;
  subwayTunnels: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  water: true,
  beaches: true,
  coastlines: true,
  rivers: true,
  contours: false,
  districts: true,
  roads: true,
  pois: true,
  grid: true,
  labels: true,
  subwayTunnels: false,
};
