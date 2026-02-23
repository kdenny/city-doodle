export { MapCanvas } from "./MapCanvas";
export type { MapCanvasHandle } from "./MapCanvas";
export {
  captureCanvasAsPng,
  downloadBlob,
  generateExportFilename,
  exportCanvasAsPng,
} from "./useCanvasExport";
export type { ExportOptions, ExportResult } from "./useCanvasExport";
export {
  MapCanvasProvider,
  useMapCanvasExport,
  useMapCanvasExportOptional,
} from "./MapCanvasContext";
export {
  FeaturesProvider,
  useFeatures,
  useFeaturesOptional,
  useFeaturesState,
  useFeaturesStateOptional,
  useFeaturesDispatch,
  useFeaturesDispatchOptional,
} from "./FeaturesContext";
export type { AddDistrictResult, FeaturesStateValue, FeaturesDispatchValue } from "./FeaturesContext";
// Granular domain contexts (CITY-245)
export {
  useDistricts,
  useDistrictsOptional,
  useDistrictsState,
  useDistrictsStateOptional,
  useDistrictsDispatch,
  useDistrictsDispatchOptional,
} from "./DistrictsContext";
export type { DistrictsStateValue, DistrictsDispatchValue, DistrictsContextValue } from "./DistrictsContext";
export {
  useRoads,
  useRoadsOptional,
  useRoadsState,
  useRoadsStateOptional,
  useRoadsDispatch,
  useRoadsDispatchOptional,
} from "./RoadsContext";
export type { RoadsStateValue, RoadsDispatchValue, RoadsContextValue } from "./RoadsContext";
export {
  usePOIs,
  usePOIsOptional,
  usePOIsState,
  usePOIsStateOptional,
  usePOIsDispatch,
  usePOIsDispatchOptional,
} from "./POIsContext";
export type { POIsStateValue, POIsDispatchValue, POIsContextValue } from "./POIsContext";
export {
  useNeighborhoods,
  useNeighborhoodsOptional,
  useNeighborhoodsState,
  useNeighborhoodsStateOptional,
  useNeighborhoodsDispatch,
  useNeighborhoodsDispatchOptional,
} from "./NeighborhoodsContext";
export type { NeighborhoodsStateValue, NeighborhoodsDispatchValue, NeighborhoodsContextValue } from "./NeighborhoodsContext";
export {
  TerrainProvider,
  useTerrain,
  useTerrainOptional,
} from "./TerrainContext";
export {
  TransitProvider,
  useTransit,
  useTransitOptional,
} from "./TransitContext";
export type { RailStationValidation, CreateLineParams, DeletionSafetyCheck } from "./TransitContext";
export {
  TransitLineDrawingProvider,
  useTransitLineDrawing,
  useTransitLineDrawingOptional,
} from "./TransitLineDrawingContext";
export type { TransitLineProperties } from "./TransitLineDrawingContext";
export {
  usePopulationStats,
  calculatePopulation,
} from "./usePopulationStats";
export type { PopulationStats } from "./usePopulationStats";
