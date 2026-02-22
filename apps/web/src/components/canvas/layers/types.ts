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

/**
 * Lake type classifications based on geological origin and shape.
 * Used to determine visual rendering style and naming.
 */
export type LakeType =
  | "glacial"   // Irregular shores, formed by glacial activity (Great Lakes, Finger Lakes)
  | "crater"    // Circular, volcanic caldera (Crater Lake)
  | "oxbow"     // Crescent-shaped, formed from river meander cutoff
  | "reservoir" // Man-made with dam at one end
  | "rift"      // Long, narrow, deep (Lake Victoria, Lake Baikal)
  | "pond"      // Small body of water
  | "kettle";   // Small, circular, formed by glacial ice blocks

export interface WaterFeature {
  id: string;
  type: "ocean" | "lake";
  polygon: Polygon;
  /** Auto-generated or user-edited name for lakes (oceans typically don't have names) */
  name?: string;
  /** Lake classification based on shape/origin (only for type="lake") */
  lakeType?: LakeType;
  /** Shape metrics for lake classification */
  metrics?: {
    circularity?: number;  // 0-1, how circular (1 = perfect circle)
    elongation?: number;   // Ratio of long/short axis
    avgDepth?: number;     // Average depth below water level
    maxDepth?: number;     // Maximum depth
  };
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

export interface BarrierIslandFeature {
  id: string;
  polygon: Polygon;
  islandIndex?: number;
  width?: number;
}

export interface TidalFlatFeature {
  id: string;
  polygon: Polygon;
}

export interface DuneRidgeFeature {
  id: string;
  line: Line;
  height?: number;
}

export interface InletFeature {
  id: string;
  polygon: Polygon;
  width?: number;
}

export interface TerrainData {
  water: WaterFeature[];
  coastlines: CoastlineFeature[];
  rivers: RiverFeature[];
  contours: ContourLine[];
  beaches: BeachFeature[];
  barrierIslands: BarrierIslandFeature[];
  tidalFlats: TidalFlatFeature[];
  duneRidges: DuneRidgeFeature[];
  inlets: InletFeature[];
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
  /**
   * Block density on a 0-10 scale.
   * Affects block size per formula: actual_size = base_size * (1.5 - density/10)
   * 0 = sparse (rural, large lots), 10 = dense (urban core, small blocks)
   */
  density?: number;
}

/** Default personality values (balanced/neutral, Contemporary era) */
export const DEFAULT_DISTRICT_PERSONALITY: DistrictPersonality = {
  grid_organic: 0.5,
  sprawl_compact: 0.5,
  transit_car: 0.5,
  era_year: 2024, // Contemporary/Present
  density: 5, // Medium density
};

/**
 * Default density values by district type (0-10 scale).
 * Used when a district doesn't have an explicit density override.
 */
export const DEFAULT_DENSITY_BY_TYPE: Record<DistrictType, number> = {
  residential: 3, // Low-medium residential
  downtown: 8, // Dense urban core
  commercial: 6, // Moderate commercial
  industrial: 3, // Sparse industrial
  hospital: 5, // Medium density campus
  university: 4, // Campus with green space
  k12: 4, // School campus
  park: 1, // Very sparse (mostly open space)
  airport: 2, // Sparse infrastructure
};

export interface District {
  id: string;
  type: DistrictType;
  name: string;
  polygon: Polygon;
  isHistoric?: boolean;
  /** Per-district personality settings */
  personality?: DistrictPersonality;
  /**
   * Grid orientation angle in radians.
   * If not set, a default angle is calculated from the district position.
   * Range: typically -π/12 to π/12 (-15° to +15°) but can be any angle.
   */
  gridAngle?: number;
  /** Pond features inside park districts (CITY-378) */
  ponds?: Polygon[];
  /** Custom fill color as hex string (e.g. "#ff0000"). Uses type default if not set. (CITY-408) */
  fillColor?: string;
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
  /** The district this road belongs to, if any. Used for ownership association. */
  districtId?: string;
}

/**
 * Type of water feature a bridge crosses
 */
export type WaterCrossingType = "ocean" | "lake" | "river" | "bay";

/**
 * A bridge segment where a road crosses water.
 * Bridges are auto-generated when roads cross water features.
 */
export interface Bridge {
  id: string;
  /** ID of the road this bridge is part of */
  roadId: string;
  /** Type of water being crossed */
  waterType: WaterCrossingType;
  /** ID of the water feature being crossed (if available) */
  waterFeatureId?: string;
  /** Start point of the bridge (where road enters water) */
  startPoint: Point;
  /** End point of the bridge (where road exits water) */
  endPoint: Point;
  /** Length of the bridge crossing in world units */
  length: number;
  /** Whether this bridge was auto-generated or manually placed */
  autoGenerated: boolean;
}

// POI types
export type POIType =
  | "hospital"
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
  /** Optional polygon footprint for campus/compound POIs (university, hospital, shopping) */
  footprint?: Point[];
  /** District that owns this POI (for cleanup on district deletion) */
  districtId?: string;
}

export interface Neighborhood {
  id: string;
  name: string;
  polygon: Polygon;
  labelColor?: string;
  accentColor?: string;
}

/**
 * City limits boundary - the official boundary of the city/municipality.
 * Distinct from districts and neighborhoods.
 * Only one city limits boundary per world.
 */
export interface CityLimits {
  /** Unique identifier for the city limits */
  id: string;
  /** The boundary polygon (can be non-contiguous with multiple polygons for enclaves) */
  boundary: Polygon;
  /** City name */
  name: string;
  /** Year the city was established (for historical tracking) */
  established?: number;
}

/** Interchange type classifications */
export type InterchangeType = "diamond" | "cloverleaf" | "partial_clover";

/**
 * A highway interchange connecting a highway to an arterial road.
 * Auto-generated where user-drawn highways cross existing arterials.
 */
export interface Interchange {
  id: string;
  /** Interchange type (diamond is default) */
  type: InterchangeType;
  /** Position of the interchange (intersection point) */
  position: Point;
  /** ID of the highway */
  highwayId: string;
  /** ID of the connected arterial/collector road */
  connectedRoadId: string;
}

export interface FeaturesData {
  districts: District[];
  roads: Road[];
  pois: POI[];
  neighborhoods: Neighborhood[];
  /** Bridges where roads cross water features (auto-generated) */
  bridges: Bridge[];
  /** Highway interchanges (auto-generated at highway-arterial crossings) */
  interchanges?: Interchange[];
  /** City limits boundary (only one per world) */
  cityLimits?: CityLimits;
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
  barrierIslands: boolean;
  tidalFlats: boolean;
  duneRidges: boolean;
  inlets: boolean;
  neighborhoods: boolean;
  cityLimits: boolean;
  districts: boolean;
  roads: boolean;
  bridges: boolean;
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
  barrierIslands: true,
  tidalFlats: true,
  duneRidges: true,
  inlets: true,
  neighborhoods: true,
  cityLimits: true,
  districts: true,
  roads: true,
  bridges: true,
  pois: true,
  grid: true,
  labels: true,
  subwayTunnels: false,
};
