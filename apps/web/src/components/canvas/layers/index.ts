export { TerrainLayer } from "./TerrainLayer";
export { FeaturesLayer, generateMockFeatures } from "./FeaturesLayer";
export type { HitTestResult } from "./FeaturesLayer";
export { LabelLayer, generateMockLabels } from "./LabelLayer";
export { SeedsLayer } from "./SeedsLayer";
export { DrawingLayer } from "./DrawingLayer";
export { RailStationLayer } from "./RailStationLayer";
export { SubwayStationLayer, toSubwayStationData } from "./SubwayStationLayer";
export { TransitLineDrawingLayer } from "./TransitLineDrawingLayer";
export { RoadEndpointLayer } from "./RoadEndpointLayer";
export type { EndpointHitResult, EndpointDragPreview } from "./RoadEndpointLayer";
export type { PlacedSeedData, PreviewSeedData } from "./SeedsLayer";
export type { RailStationData, TrackSegmentData, RailStationPreviewData } from "./RailStationLayer";
export type { SubwayStationData, SubwayStationPreviewData, SubwayTunnelData } from "./SubwayStationLayer";
export type { TransitLineDrawingState } from "./TransitLineDrawingLayer";
export { generateMockTerrain } from "./mockTerrain";
export {
  generateDistrictGeometry,
  wouldOverlap,
  seedIdToDistrictType,
  metersToWorldUnits,
  worldUnitsToMeters,
  milesToWorldUnits,
  worldUnitsToMiles,
  regenerateStreetGridWithAngle,
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
  splitPolygonWithLine,
  findDistrictAtPoint,
} from "./polygonUtils";
export type { ClipResult, SplitResult } from "./polygonUtils";
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
  CityLimits,
  Road,
  RoadClass,
  POI,
  POIType,
  Bridge,
  WaterCrossingType,
  Interchange,
  InterchangeType,
  FeaturesData,
  LabelData,
  LabelConfig,
  LabelLayerData,
  LabelType,
} from "./types";
export { DEFAULT_LAYER_VISIBILITY, DEFAULT_DISTRICT_PERSONALITY } from "./types";
export {
  findDistrictsCrossedByArterial,
  validateDiagonalForDistrict,
  splitGridStreetsAtArterial,
} from "./diagonalArterialValidator";
export type { DiagonalValidationResult, GridAdjustmentResult } from "./diagonalArterialValidator";
export { detectBridges, roadCrossesWater } from "./bridgeDetection";
export type { BridgeDetectionConfig, BridgeDetectionResult } from "./bridgeDetection";
export {
  requiresArterialAdjacency,
  districtRequiresArterialAdjacency,
  isAdjacentToArterial,
  isDistrictAdjacentToArterial,
  findNearestArterial,
  findConnectionCandidates,
  generateArterialConnections,
  DISTRICT_TYPES_REQUIRING_ARTERIAL,
} from "./poiArterialValidator";
export type {
  ConnectionCandidate,
  ArterialGenerationResult,
} from "./poiArterialValidator";

