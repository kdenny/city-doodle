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
}

export interface CoastlineFeature {
  id: string;
  line: Line;
}

export interface RiverFeature {
  id: string;
  line: Line;
  width: number; // varies along length
}

export interface ContourLine {
  id: string;
  elevation: number;
  line: Line;
}

export interface TerrainData {
  water: WaterFeature[];
  coastlines: CoastlineFeature[];
  rivers: RiverFeature[];
  contours: ContourLine[];
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

export interface District {
  id: string;
  type: DistrictType;
  name: string;
  polygon: Polygon;
  isHistoric?: boolean;
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

export interface FeaturesData {
  districts: District[];
  roads: Road[];
  pois: POI[];
}

export interface LayerVisibility {
  water: boolean;
  coastlines: boolean;
  rivers: boolean;
  contours: boolean;
  districts: boolean;
  roads: boolean;
  pois: boolean;
  grid: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  water: true,
  coastlines: true,
  rivers: true,
  contours: false,
  districts: true,
  roads: true,
  pois: true,
  grid: true,
};
