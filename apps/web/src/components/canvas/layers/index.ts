export { TerrainLayer } from "./TerrainLayer";
export { FeaturesLayer, generateMockFeatures } from "./FeaturesLayer";
export type { HitTestResult } from "./FeaturesLayer";
export { LabelLayer, generateMockLabels } from "./LabelLayer";
export { SeedsLayer } from "./SeedsLayer";
export { DrawingLayer } from "./DrawingLayer";
export { RailStationLayer } from "./RailStationLayer";
export { SubwayStationLayer, toSubwayStationData } from "./SubwayStationLayer";
export type { PlacedSeedData, PreviewSeedData } from "./SeedsLayer";
export type { RailStationData, TrackSegmentData, RailStationPreviewData } from "./RailStationLayer";
export type { SubwayStationData, SubwayStationPreviewData, SubwayTunnelData } from "./SubwayStationLayer";
export { generateMockTerrain } from "./mockTerrain";
export {
  generateDistrictGeometry,
  wouldOverlap,
  seedIdToDistrictType,
  metersToWorldUnits,
  worldUnitsToMeters,
  milesToWorldUnits,
  worldUnitsToMiles,
} from "./districtGenerator";
export type {
  DistrictGenerationConfig,
  GeneratedDistrict,
} from "./districtGenerator";
export {
  clipAndValidateDistrict,
  overlapsWater,
  meetsMinimumSize,
  pointInPolygon,
  polygonArea,
  getPolygonBounds,
} from "./polygonUtils";
export type { ClipResult } from "./polygonUtils";
export type {
  TerrainData,
  LayerVisibility,
  Point,
  Polygon,
  Line,
  WaterFeature,
  CoastlineFeature,
  RiverFeature,
  ContourLine,
  District,
  DistrictType,
  DistrictPersonality,
  Neighborhood,
  Road,
  RoadClass,
  POI,
  POIType,
  Bridge,
  WaterCrossingType,
  FeaturesData,
  LabelData,
  LabelConfig,
  LabelLayerData,
  LabelType,
} from "./types";
export { DEFAULT_LAYER_VISIBILITY, DEFAULT_DISTRICT_PERSONALITY } from "./types";
export { detectBridges, roadCrossesWater } from "./bridgeDetection";
export type { BridgeDetectionConfig, BridgeDetectionResult } from "./bridgeDetection";
