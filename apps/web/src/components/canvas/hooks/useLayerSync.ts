/**
 * Hook grouping all useEffects that sync React context state to PixiJS layer refs.
 *
 * Covers: features, transit stations, drawing state, seeds, walkability,
 * tile updates, layer visibility, subway tunnels, view-mode auto-toggles,
 * selected road highlighting, road endpoints, snap engine, drag previews,
 * seed previews, placement errors, rail/subway station previews, transit
 * highlighting, and transit line drawing state.
 *
 * Extracted from MapCanvas to reduce the component's line count (CITY-231).
 */

import { useEffect, useRef, type MutableRefObject } from "react";
import type {
  TerrainLayer,
  FeaturesLayer,
  LabelLayer,
  SeedsLayer,
  DrawingLayer,
  RailStationLayer,
  SubwayStationLayer,
  RoadEndpointLayer,
  TransitLineDrawingLayer,
  WalkabilityOverlayLayer,
  LayerVisibility,
  FeaturesData,
  PlacedSeedData,
  RailStationData,
  TrackSegmentData,
  SubwayStationData,
  SubwayTunnelData,
} from "../layers";
import type { SeedCategory } from "../../palette";
import type { Container } from "pixi.js";
import type { SnapEngine, SnapLineSegment } from "../snap";
import type { SelectedFeature } from "../../build-view/SelectionContext";
import { MINIMUM_STATION_DISTANCE } from "../TransitContext";
import { transformTileFeatures } from "../layers/terrainTransformer";
import { getEffectiveDistrictConfig } from "../layers/districtGenerator";
import type { TerrainData } from "../layers";

/** Minimal subset of TransitContext used by layer sync effects. */
interface TransitContextSlice {
  railStations: RailStationData[];
  subwayStations: SubwayStationData[];
  trackSegments: TrackSegmentData[];
  subwayTunnels: SubwayTunnelData[];
  transitNetwork: {
    stations: Array<{ position_x: number; position_y: number; station_type: string }>;
    lines: Array<{ name: string; color: string; segments: Array<{ from_station_id: string; to_station_id: string }> }>;
  } | null;
  highlightedLineId: string | null;
  getStationIdsForLine: (lineId: string) => string[];
  getSegmentIdsForLine: (lineId: string) => string[];
  validateRailStationPlacement: (position: { x: number; y: number }) => { isValid: boolean };
  validateSubwayStationPlacement: (position: { x: number; y: number }) => { isValid: boolean };
}

/** Minimal subset of DrawingContext used by layer sync effects. */
interface DrawingContextSlice {
  state: {
    vertices: Array<{ x: number; y: number }>;
    previewPoint: { x: number; y: number } | null;
    isDrawing: boolean;
    isFreehandActive: boolean;
    mode: string | null;
    roadClass?: string;
  };
}

/** Minimal subset of EndpointDragContext used by layer sync effects. */
interface EndpointDragContextSlice {
  dragState: {
    roadId: string;
    endpointIndex: number;
    currentPosition: { x: number; y: number };
    isSnapped: boolean;
  } | null;
}

/** Minimal subset of PlacementContext used by layer sync effects. */
interface PlacementContextSlice {
  isPlacing: boolean;
  previewPosition: { x: number; y: number } | null;
  selectedSeed: { id: string; category: SeedCategory; icon: string; label?: string } | null;
  dragSize: number | null;
  /** CITY-560: Whether a drag-to-define operation is in progress */
  isDraggingSize?: boolean;
  /** CITY-560: First corner of the drag-to-define rectangle */
  dragOrigin?: { x: number; y: number } | null;
  /** CITY-560: Second corner of the drag-to-define rectangle */
  dragCorner?: { x: number; y: number } | null;
  placementPersonality?: { sprawl_compact?: number } | null;
  placementError?: { x: number; y: number } | null;
}

/** Minimal subset of PlacedSeedsContext used by layer sync effects. */
interface PlacedSeedsContextSlice {
  seeds: Array<{ id: string; seed: { id: string; category: SeedCategory; icon: string; label: string }; position: { x: number; y: number } }>;
}

/** Minimal subset of TransitLineDrawingContext used by layer sync effects. */
interface TransitLineDrawingContextSlice {
  state: {
    isDrawing: boolean;
    firstStation: RailStationData | null;
    connectedStations: RailStationData[];
    previewPosition: { x: number; y: number } | null;
    hoveredStation: RailStationData | null;
    lineProperties: { color?: string; type?: string; name?: string } | null;
  };
}

/** Minimal subset of FeaturesContext used by layer sync effects. */
interface FeaturesContextSlice {
  features: FeaturesData;
}

/** Minimal subset of SelectionContext used by layer sync effects. */
interface SelectionContextSlice {
  selection: SelectedFeature | null;
}

interface UseLayerSyncParams {
  isReady: boolean;
  // Layer refs
  terrainLayerRef: MutableRefObject<TerrainLayer | null>;
  featuresLayerRef: MutableRefObject<FeaturesLayer | null>;
  labelLayerRef: MutableRefObject<LabelLayer | null>;
  seedsLayerRef: MutableRefObject<SeedsLayer | null>;
  drawingLayerRef: MutableRefObject<DrawingLayer | null>;
  railStationLayerRef: MutableRefObject<RailStationLayer | null>;
  subwayStationLayerRef: MutableRefObject<SubwayStationLayer | null>;
  roadEndpointLayerRef: MutableRefObject<RoadEndpointLayer | null>;
  walkabilityOverlayLayerRef: MutableRefObject<WalkabilityOverlayLayer | null>;
  transitLineDrawingLayerRef: MutableRefObject<TransitLineDrawingLayer | null>;
  gridContainerRef: MutableRefObject<Container | null>;
  setTerrainDataRef: MutableRefObject<((data: TerrainData) => void) | undefined>;
  // Context values
  layerVisibility: LayerVisibility;
  setLayerVisibility: React.Dispatch<React.SetStateAction<LayerVisibility>>;
  viewMode: string;
  featuresContext: FeaturesContextSlice | null;
  transitContext: TransitContextSlice | null;
  drawingContext: DrawingContextSlice | null;
  endpointDragContext: EndpointDragContextSlice | null;
  placementContext: PlacementContextSlice | null;
  placedSeedsContext: PlacedSeedsContextSlice | null;
  selectionContext: SelectionContextSlice | null;
  transitLineDrawingContext: TransitLineDrawingContextSlice | null;
  snapEngine: SnapEngine;
  showMockFeatures: boolean;
  tiles: Array<{ features?: unknown }> | undefined;
}

export function useLayerSync(params: UseLayerSyncParams) {
  const {
    isReady,
    terrainLayerRef,
    featuresLayerRef,
    labelLayerRef,
    seedsLayerRef,
    drawingLayerRef,
    railStationLayerRef,
    subwayStationLayerRef,
    roadEndpointLayerRef,
    walkabilityOverlayLayerRef,
    transitLineDrawingLayerRef,
    gridContainerRef,
    setTerrainDataRef,
    layerVisibility,
    setLayerVisibility,
    viewMode,
    featuresContext,
    transitContext,
    drawingContext,
    endpointDragContext,
    placementContext,
    placedSeedsContext,
    selectionContext,
    transitLineDrawingContext,
    snapEngine,
    showMockFeatures,
    tiles,
  } = params;

  // CITY-395: Auto-enable subway tunnel toggle when entering transit view
  useEffect(() => {
    if (viewMode === "transit" && !layerVisibility.subwayTunnels) {
      setLayerVisibility((prev) => ({ ...prev, subwayTunnels: true }));
    }
  }, [viewMode]);

  // Sync subway tunnel rendering with visibility state
  useEffect(() => {
    if (!subwayStationLayerRef.current) return;
    subwayStationLayerRef.current.setTunnelsVisible(layerVisibility.subwayTunnels);
  }, [layerVisibility.subwayTunnels, isReady]);

  // CITY-439: Update terrain when tile data loads from API (after canvas init)
  useEffect(() => {
    if (!isReady || !terrainLayerRef.current || !tiles) return;
    const tileWithFeatures = tiles.find(
      (t) => t.features && typeof t.features === "object" && "type" in (t.features as unknown as Record<string, unknown>)
    );
    if (!tileWithFeatures) return;

    const terrainData = transformTileFeatures(tileWithFeatures.features as unknown);
    if (terrainData.water.length > 0 || terrainData.coastlines.length > 0 || terrainData.rivers.length > 0) {
      // CITY-573: Log when real terrain replaces mock terrain
      console.info(
        '[Terrain] Real terrain replacing mock terrain from API tile data',
        {
          waterFeatures: terrainData.water.length,
          coastlines: terrainData.coastlines.length,
          rivers: terrainData.rivers.length,
          contours: terrainData.contours.length,
          beaches: terrainData.beaches.length,
        }
      );
      terrainLayerRef.current.setData(terrainData);
      setTerrainDataRef.current?.(terrainData);
    }
  }, [tiles, isReady]);

  // Update visibility when state changes (after initial mount)
  useEffect(() => {
    if (isReady) {
      if (terrainLayerRef.current) terrainLayerRef.current.setVisibility(layerVisibility);
      if (featuresLayerRef.current) featuresLayerRef.current.setVisibility(layerVisibility);
      if (labelLayerRef.current) labelLayerRef.current.setVisibility(layerVisibility);
      if (gridContainerRef.current) gridContainerRef.current.visible = layerVisibility.grid;
      if (subwayStationLayerRef.current) subwayStationLayerRef.current.setTunnelsVisible(layerVisibility.subwayTunnels);
      if (railStationLayerRef.current) railStationLayerRef.current.setLabelsVisible(layerVisibility.labels);
      if (subwayStationLayerRef.current) subwayStationLayerRef.current.setLabelsVisible(layerVisibility.labels);
    }
  }, [layerVisibility, isReady]);

  // Sync selected feature to features layer for road highlighting (CITY-250)
  const selectedFeature = selectionContext?.selection ?? null;
  useEffect(() => {
    if (!isReady || !featuresLayerRef.current) return;
    const roadId = selectedFeature && selectedFeature.type === "road" ? selectedFeature.id : null;
    featuresLayerRef.current.setSelectedRoadId(roadId);
  }, [isReady, selectedFeature]);

  // Update features layer when context features change
  // CITY-231: Guard with ref to skip redundant merges when features reference hasn't changed.
  // Initialized to undefined (not current features) so the first sync always runs.
  const prevFeaturesRef = useRef<FeaturesData | undefined>(undefined);
  useEffect(() => {
    if (!isReady || !featuresLayerRef.current || !featuresContext) return;

    // Skip if the features object reference is identical (no actual change)
    if (featuresContext.features === prevFeaturesRef.current) return;
    prevFeaturesRef.current = featuresContext.features;

    const currentData = featuresLayerRef.current.getData();

    if (
      featuresContext.features.districts.length > 0 ||
      featuresContext.features.roads.length > 0 ||
      featuresContext.features.pois.length > 0 ||
      featuresContext.features.neighborhoods.length > 0
    ) {
      const contextDistrictIds = new Set(featuresContext.features.districts.map((d) => d.id));
      const contextRoadIds = new Set(featuresContext.features.roads.map((r) => r.id));
      const contextPoiIds = new Set(featuresContext.features.pois.map((p) => p.id));

      const baseData: FeaturesData =
        showMockFeatures && currentData
          ? {
              districts: currentData.districts.filter((d) => !contextDistrictIds.has(d.id)),
              roads: currentData.roads.filter((r) => !contextRoadIds.has(r.id)),
              pois: currentData.pois.filter((p) => !contextPoiIds.has(p.id)),
              neighborhoods: [],
              bridges: currentData.bridges || [],
            }
          : { districts: [], roads: [], pois: [], neighborhoods: [], bridges: [] };

      const mergedData: FeaturesData = {
        districts: [...baseData.districts, ...featuresContext.features.districts],
        roads: [...baseData.roads, ...featuresContext.features.roads],
        pois: [...baseData.pois, ...featuresContext.features.pois],
        neighborhoods: [...featuresContext.features.neighborhoods],
        bridges: [...(baseData.bridges || []), ...(featuresContext.features.bridges || [])],
      };

      featuresLayerRef.current.setData(mergedData);
    }
  }, [isReady, featuresContext?.features, showMockFeatures]);

  // Update road endpoint layer when selection changes (CITY-147)
  useEffect(() => {
    if (!isReady || !roadEndpointLayerRef.current) return;

    const allRoads = [
      ...(featuresContext?.features.roads || []),
      ...(featuresLayerRef.current?.getData()?.roads || []),
    ];
    roadEndpointLayerRef.current.setRoads(allRoads);

    const selection = selectionContext?.selection;
    if (selection?.type === "road") {
      const selectedRoad = allRoads.find((r) => r.id === selection.id);
      roadEndpointLayerRef.current.setSelectedRoad(selectedRoad || null);
    } else {
      roadEndpointLayerRef.current.setSelectedRoad(null);
    }
  }, [isReady, selectionContext?.selection, featuresContext?.features.roads]);

  // Update snap engine with district perimeters (CITY-147)
  // CITY-231: Debounce by 100ms so rapid district additions don't cause N rebuilds
  useEffect(() => {
    if (!isReady) return;

    const timer = setTimeout(() => {
      const districts = featuresContext?.features.districts || [];
      const segments: SnapLineSegment[] = [];
      for (const district of districts) {
        const points = district.polygon.points;
        if (points.length < 3) continue;
        for (let i = 0; i < points.length; i++) {
          const p1 = points[i];
          const p2 = points[(i + 1) % points.length];
          segments.push({ p1, p2, geometryId: district.id, geometryType: "district" });
        }
      }
      snapEngine.clear();
      snapEngine.insertSegments(segments);
    }, 100);

    return () => clearTimeout(timer);
  }, [isReady, featuresContext?.features.districts, snapEngine]);

  // Sync drag preview to endpoint layer (CITY-147)
  useEffect(() => {
    if (!isReady || !roadEndpointLayerRef.current) return;

    if (endpointDragContext?.dragState) {
      roadEndpointLayerRef.current.setDragPreview({
        roadId: endpointDragContext.dragState.roadId,
        endpointIndex: endpointDragContext.dragState.endpointIndex,
        currentPosition: endpointDragContext.dragState.currentPosition,
        isSnapped: endpointDragContext.dragState.isSnapped,
      });
    } else {
      roadEndpointLayerRef.current.setDragPreview(null);
    }
  }, [isReady, endpointDragContext?.dragState]);

  // Update seeds layer when placed seeds change
  useEffect(() => {
    if (!isReady || !seedsLayerRef.current || !placedSeedsContext) return;

    const seedsData: PlacedSeedData[] = placedSeedsContext.seeds.map((ps) => ({
      id: ps.id,
      seedId: ps.seed.id,
      category: ps.seed.category,
      icon: ps.seed.icon,
      label: ps.seed.label,
      position: ps.position,
    }));
    seedsLayerRef.current.setSeeds(seedsData);
  }, [isReady, placedSeedsContext?.seeds]);

  // Update seed preview when preview position changes
  useEffect(() => {
    if (!isReady || !seedsLayerRef.current) return;

    if (placementContext?.isPlacing && placementContext.previewPosition && placementContext.selectedSeed) {
      let previewSize = placementContext.dragSize ?? undefined;
      if (!previewSize && placementContext.selectedSeed.category === "district") {
        const personality = placementContext.placementPersonality;
        const effectiveCfg = getEffectiveDistrictConfig({
          scaleSettings: {
            blockSizeMeters: 100,
            districtSizeMeters: 3200,
            sprawlCompact: personality?.sprawl_compact ?? 0.5,
          },
        });
        previewSize = effectiveCfg.size;
      }

      seedsLayerRef.current.setPreview({
        seedId: placementContext.selectedSeed.id,
        category: placementContext.selectedSeed.category,
        icon: placementContext.selectedSeed.icon,
        position: placementContext.previewPosition,
        size: previewSize,
        // CITY-560: Pass dragOrigin so SeedsLayer can draw the rectangle preview
        dragOrigin: placementContext.isDraggingSize ? placementContext.dragOrigin ?? undefined : undefined,
      });
    } else {
      seedsLayerRef.current.setPreview(null);
    }
  }, [
    isReady,
    placementContext?.isPlacing,
    placementContext?.previewPosition,
    placementContext?.selectedSeed,
    placementContext?.dragSize,
    placementContext?.dragCorner,
    placementContext?.placementPersonality,
    placementContext?.isDraggingSize,
    placementContext?.dragOrigin,
  ]);

  // Show placement error flash
  useEffect(() => {
    if (!isReady || !seedsLayerRef.current || !placementContext?.placementError) return;
    seedsLayerRef.current.showPlacementError(placementContext.placementError);
  }, [isReady, placementContext?.placementError]);

  // Update drawing layer when drawing state changes
  useEffect(() => {
    if (!isReady || !drawingLayerRef.current || !drawingContext) return;

    drawingLayerRef.current.setState({
      vertices: drawingContext.state.vertices,
      previewPoint: drawingContext.state.previewPoint,
      isDrawing: drawingContext.state.isDrawing,
      isFreehandActive: drawingContext.state.isFreehandActive,
      mode: drawingContext.state.mode,
      roadClass: drawingContext.state.roadClass,
    });
  }, [
    isReady,
    drawingContext?.state.vertices,
    drawingContext?.state.previewPoint,
    drawingContext?.state.isDrawing,
    drawingContext?.state.isFreehandActive,
  ]);

  // CITY-259: Show/hide walkability overlay based on view mode
  useEffect(() => {
    if (!walkabilityOverlayLayerRef.current) return;
    walkabilityOverlayLayerRef.current.setVisible(viewMode === "density");
  }, [viewMode, isReady]);

  // CITY-259: Update walkability overlay with transit station positions
  useEffect(() => {
    if (!walkabilityOverlayLayerRef.current || viewMode !== "density") return;
    const stations: { x: number; y: number; stationType: "rail" | "subway" }[] = [];
    if (transitContext?.transitNetwork) {
      for (const s of transitContext.transitNetwork.stations) {
        stations.push({
          x: s.position_x,
          y: s.position_y,
          stationType: s.station_type as "rail" | "subway",
        });
      }
    }
    walkabilityOverlayLayerRef.current.update(stations);
  }, [transitContext?.transitNetwork, viewMode, isReady]);

  // Update rail station layer when transit context changes
  useEffect(() => {
    if (!isReady || !railStationLayerRef.current || !transitContext) return;
    railStationLayerRef.current.setStations(transitContext.railStations);
    railStationLayerRef.current.setTracks(transitContext.trackSegments);
  }, [isReady, transitContext?.railStations, transitContext?.trackSegments]);

  // Update rail station preview when placing a rail_station seed
  useEffect(() => {
    if (!isReady || !railStationLayerRef.current) return;

    if (
      placementContext?.isPlacing &&
      placementContext.previewPosition &&
      placementContext.selectedSeed?.id === "rail_station" &&
      transitContext
    ) {
      const validation = transitContext.validateRailStationPlacement(placementContext.previewPosition);
      const previewPos = placementContext.previewPosition;
      const isTooClose = transitContext.railStations.some((station) => {
        const dx = previewPos.x - station.position.x;
        const dy = previewPos.y - station.position.y;
        return Math.sqrt(dx * dx + dy * dy) < MINIMUM_STATION_DISTANCE;
      });
      railStationLayerRef.current.setPreview({
        position: previewPos,
        isValid: validation.isValid,
        isTooClose,
      });
    } else {
      railStationLayerRef.current.setPreview(null);
    }
  }, [
    isReady,
    placementContext?.isPlacing,
    placementContext?.previewPosition,
    placementContext?.selectedSeed?.id,
    transitContext,
  ]);

  // Update subway station layer when transit context changes
  useEffect(() => {
    if (!isReady || !subwayStationLayerRef.current || !transitContext) return;
    subwayStationLayerRef.current.setStations(transitContext.subwayStations);
    subwayStationLayerRef.current.setTunnels(transitContext.subwayTunnels);
  }, [isReady, transitContext?.subwayStations, transitContext?.subwayTunnels]);

  // Update subway station preview when placing a subway seed
  useEffect(() => {
    if (!isReady || !subwayStationLayerRef.current) return;

    if (
      placementContext?.isPlacing &&
      placementContext.previewPosition &&
      placementContext.selectedSeed?.id === "subway" &&
      transitContext
    ) {
      const validation = transitContext.validateSubwayStationPlacement(placementContext.previewPosition);
      const previewPos = placementContext.previewPosition;
      const isTooClose = transitContext.subwayStations.some((station) => {
        const dx = previewPos.x - station.position.x;
        const dy = previewPos.y - station.position.y;
        return Math.sqrt(dx * dx + dy * dy) < MINIMUM_STATION_DISTANCE;
      });
      subwayStationLayerRef.current.setPreview({
        position: previewPos,
        isValid: validation.isValid,
        isTooClose,
      });
    } else {
      subwayStationLayerRef.current.setPreview(null);
    }
  }, [
    isReady,
    placementContext?.isPlacing,
    placementContext?.previewPosition,
    placementContext?.selectedSeed?.id,
    transitContext,
  ]);

  // Update transit layer highlighting when highlightedLineId changes (CITY-195)
  useEffect(() => {
    if (!isReady || !transitContext) return;

    const { highlightedLineId, getStationIdsForLine, getSegmentIdsForLine } = transitContext;

    if (highlightedLineId) {
      const stationIds = getStationIdsForLine(highlightedLineId);
      const segmentIds = getSegmentIdsForLine(highlightedLineId);
      if (railStationLayerRef.current) railStationLayerRef.current.setHighlight(stationIds, segmentIds);
      if (subwayStationLayerRef.current) subwayStationLayerRef.current.setHighlight(stationIds, segmentIds);
    } else {
      if (railStationLayerRef.current) railStationLayerRef.current.setHighlight([], []);
      if (subwayStationLayerRef.current) subwayStationLayerRef.current.setHighlight([], []);
    }
  }, [isReady, transitContext?.highlightedLineId, transitContext?.getStationIdsForLine, transitContext?.getSegmentIdsForLine]);

  // Update transit line drawing layer when drawing state changes
  useEffect(() => {
    if (!isReady || !transitLineDrawingLayerRef.current || !transitContext) return;

    const isLineDrawing = transitLineDrawingContext?.state.isDrawing ?? false;
    const firstStation = transitLineDrawingContext?.state.firstStation;
    const connectedStations = transitLineDrawingContext?.state.connectedStations ?? [];
    const previewPosition = transitLineDrawingContext?.state.previewPosition;
    const hoveredStation = transitLineDrawingContext?.state.hoveredStation;
    const lineColor = transitLineDrawingContext?.state.lineProperties?.color ?? "#B22222";

    const firstStationData = firstStation ? { id: firstStation.id, position: firstStation.position } : null;
    const connectedStationsData = connectedStations.map((s: RailStationData) => ({
      id: s.id,
      position: s.position,
    }));
    const hoveredStationData = hoveredStation ? { id: hoveredStation.id, position: hoveredStation.position } : null;

    transitLineDrawingLayerRef.current.setState({
      isDrawing: isLineDrawing,
      firstStation: firstStationData,
      connectedStations: connectedStationsData,
      previewPosition: previewPosition || null,
      hoveredStation: hoveredStationData,
      lineColor,
    });
  }, [
    isReady,
    transitContext,
    transitLineDrawingContext?.state.isDrawing,
    transitLineDrawingContext?.state.firstStation,
    transitLineDrawingContext?.state.connectedStations,
    transitLineDrawingContext?.state.previewPosition,
    transitLineDrawingContext?.state.hoveredStation,
    transitLineDrawingContext?.state.lineProperties?.color,
  ]);
}
