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

export interface LayerVisibility {
  water: boolean;
  coastlines: boolean;
  rivers: boolean;
  contours: boolean;
  grid: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  water: true,
  coastlines: true,
  rivers: true,
  contours: false,
  grid: true,
};
