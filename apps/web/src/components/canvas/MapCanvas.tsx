import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useContext,
} from "react";
import { Application, Container, Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
  TerrainLayer,
  FeaturesLayer,
  LabelLayer,
  SeedsLayer,
  DrawingLayer,
  RailStationLayer,
  SubwayStationLayer,
  generateMockTerrain,
  generateMockFeatures,
  generateMockLabels,
  DEFAULT_LAYER_VISIBILITY,
  type LayerVisibility,
  type PlacedSeedData,
  type HitTestResult,
  type FeaturesData,
  type Neighborhood,
} from "./layers";
import { useDrawingOptional } from "./DrawingContext";
import { LayerControls } from "./LayerControls";
import {
  exportCanvasAsPng,
  captureCanvasAsPng,
  type ExportOptions,
  type ExportResult,
} from "./useCanvasExport";
import { MapCanvasContextInternal } from "./MapCanvasContext";
import { useFeaturesOptional } from "./FeaturesContext";
import { useTerrainOptional } from "./TerrainContext";
import { useTransitOptional } from "./TransitContext";
import { useZoomOptional } from "../shell/ZoomContext";
import { usePlacementOptional, usePlacedSeedsOptional } from "../palette";
import { useSelectionContextOptional } from "../build-view/SelectionContext";
import type { SelectedFeature } from "../build-view/SelectionContext";
import type { District, Road, POI } from "./layers";

// Tile size in world coordinates
const TILE_SIZE = 256;
// World size (3x3 grid of tiles for now)
const WORLD_TILES = 3;
const WORLD_SIZE = TILE_SIZE * WORLD_TILES;

interface MapCanvasProps {
  className?: string;
  seed?: number;
  /** Controlled zoom level from parent - synced with viewport */
  zoom?: number;
  /** Callback when zoom changes (from wheel/pinch) */
  onZoomChange?: (zoom: number) => void;
  /** Whether to show mock features (set false for new empty worlds) */
  showMockFeatures?: boolean;
  /** Callback when a feature is clicked for selection */
  onFeatureSelect?: (feature: SelectedFeature) => void;
}

/**
 * Imperative handle exposed by MapCanvas for export functionality.
 */
export interface MapCanvasHandle {
  /** Exports the canvas as PNG and triggers download */
  exportAsPng: (options: ExportOptions) => Promise<void>;
  /** Captures the canvas as PNG and returns the result (no download) */
  captureAsPng: (options: ExportOptions) => Promise<ExportResult>;
  /** Whether the canvas is ready for export */
  isReady: boolean;
}

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(
  function MapCanvas({ className, seed = 12345, zoom: zoomProp, onZoomChange: onZoomChangeProp, showMockFeatures = true, onFeatureSelect: onFeatureSelectProp }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const terrainLayerRef = useRef<TerrainLayer | null>(null);
  const featuresLayerRef = useRef<FeaturesLayer | null>(null);
  const labelLayerRef = useRef<LabelLayer | null>(null);
  const seedsLayerRef = useRef<SeedsLayer | null>(null);
  const drawingLayerRef = useRef<DrawingLayer | null>(null);
  const railStationLayerRef = useRef<RailStationLayer | null>(null);
  const subwayStationLayerRef = useRef<SubwayStationLayer | null>(null);
  const gridContainerRef = useRef<Container | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(
    DEFAULT_LAYER_VISIBILITY
  );

  // Try to get the context (may be null if not wrapped in provider)
  const canvasContext = useContext(MapCanvasContextInternal);

  // Get zoom from context if available, otherwise use props
  const zoomContext = useZoomOptional();
  const zoom = zoomContext?.zoom ?? zoomProp;
  const onZoomChange = zoomContext?.setZoom ?? onZoomChangeProp;

  // Get placement context for handling seed placement
  const placementContext = usePlacementOptional();

  // Get placed seeds context for rendering placed seeds
  const placedSeedsContext = usePlacedSeedsOptional();

  // Get selection context for handling feature selection
  const selectionContext = useSelectionContextOptional();
  const onFeatureSelect = onFeatureSelectProp ?? selectionContext?.selectFeature;

  // Get features context for dynamic features (districts, roads, POIs, neighborhoods)
  const featuresContext = useFeaturesOptional();

  // Get terrain context for sharing terrain data (water features) for collision detection
  const terrainContext = useTerrainOptional();

  // Get transit context for rail station placement and rendering
  const transitContext = useTransitOptional();

  // Ref to setTerrainData for use in init effect (avoids stale closure)
  const setTerrainDataRef = useRef(terrainContext?.setTerrainData);
  useEffect(() => {
    setTerrainDataRef.current = terrainContext?.setTerrainData;
  }, [terrainContext?.setTerrainData]);

  // Get drawing context for polygon drawing mode
  const drawingContext = useDrawingOptional();

  // Create the export handle object
  const exportHandle = {
    exportAsPng: async (options: ExportOptions) => {
      if (!appRef.current || !viewportRef.current) {
        throw new Error("Canvas not ready for export");
      }
      return exportCanvasAsPng(appRef.current, viewportRef.current, options);
    },
    captureAsPng: async (options: ExportOptions) => {
      if (!appRef.current || !viewportRef.current) {
        throw new Error("Canvas not ready for export");
      }
      return captureCanvasAsPng(appRef.current, viewportRef.current, options);
    },
    isReady,
  };

  // Expose export functionality via ref
  useImperativeHandle(ref, () => exportHandle, [isReady]);

  // Register with context if available
  useEffect(() => {
    if (canvasContext) {
      canvasContext.registerCanvas(isReady ? exportHandle : null);
      return () => {
        canvasContext.registerCanvas(null);
      };
    }
  }, [canvasContext, isReady]);

  // Handle layer visibility changes
  const handleVisibilityChange = useCallback(
    (visibility: LayerVisibility) => {
      setLayerVisibility(visibility);

      // Update terrain layer visibility
      if (terrainLayerRef.current) {
        terrainLayerRef.current.setVisibility(visibility);
      }

      // Update features layer visibility
      if (featuresLayerRef.current) {
        featuresLayerRef.current.setVisibility(visibility);
      }

      // Update label layer visibility
      if (labelLayerRef.current) {
        labelLayerRef.current.setVisibility(visibility);
      }

      // Update grid visibility
      if (gridContainerRef.current) {
        gridContainerRef.current.visible = visibility.grid;
      }

      // Update subway tunnel visibility (CITY-196)
      if (subwayStationLayerRef.current) {
        subwayStationLayerRef.current.setTunnelsVisible(visibility.subwayTunnels);
      }
    },
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Track if this effect has been cleaned up (for async safety)
    let cancelled = false;
    let resizeCleanup: (() => void) | null = null;

    const init = async () => {
      // Create PixiJS application
      const app = new Application();
      await app.init({
        background: "#f5f5f5",
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      // Check if unmounted during async init
      if (cancelled) {
        app.destroy(true);
        return;
      }

      // Add canvas to DOM
      container.appendChild(app.canvas as HTMLCanvasElement);

      // Create viewport with pan and zoom
      const viewport = new Viewport({
        screenWidth: container.clientWidth,
        screenHeight: container.clientHeight,
        worldWidth: WORLD_SIZE,
        worldHeight: WORLD_SIZE,
        events: app.renderer.events,
      });

      app.stage.addChild(viewport);

      // Enable interactions
      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clampZoom({
          minScale: 0.25,
          maxScale: 4,
        });

      // Center the viewport on the world
      viewport.moveCenter(WORLD_SIZE / 2, WORLD_SIZE / 2);

      // Create and add terrain layer (bottom)
      const terrainLayer = new TerrainLayer();
      viewport.addChild(terrainLayer.getContainer());

      // Generate and set terrain data
      const terrainData = generateMockTerrain(WORLD_SIZE, seed);
      terrainLayer.setData(terrainData);
      terrainLayer.setVisibility(layerVisibility);

      // Share terrain data with context for water collision detection
      setTerrainDataRef.current?.(terrainData);

      // Create and add features layer (above terrain)
      const featuresLayer = new FeaturesLayer();
      viewport.addChild(featuresLayer.getContainer());

      // Generate and set features data (only if showMockFeatures is enabled)
      if (showMockFeatures) {
        const featuresData = generateMockFeatures(WORLD_SIZE, seed);
        featuresLayer.setData({ ...featuresData, neighborhoods: [] });
      } else {
        // Empty features for new worlds
        featuresLayer.setData({ districts: [], roads: [], pois: [], neighborhoods: [] });
      }
      featuresLayer.setVisibility(layerVisibility);

      // Create and add label layer (above features, below seeds)
      const labelLayer = new LabelLayer();
      viewport.addChild(labelLayer.getContainer());

      // Generate and set label data (only if showMockFeatures is enabled)
      if (showMockFeatures) {
        const labelData = generateMockLabels(WORLD_SIZE, seed);
        labelLayer.setData(labelData);
      } else {
        // No labels for new worlds
        labelLayer.setData({ labels: [], seed });
      }
      labelLayer.setVisibility(layerVisibility);

      // Create and add seeds layer (above labels, below rail stations)
      const seedsLayer = new SeedsLayer();
      viewport.addChild(seedsLayer.getContainer());

      // Create and add rail station layer (above seeds, below subway stations)
      const railStationLayer = new RailStationLayer();
      viewport.addChild(railStationLayer.getContainer());

      // Create and add subway station layer (above rail stations, below drawing)
      const subwayStationLayer = new SubwayStationLayer();
      viewport.addChild(subwayStationLayer.getContainer());

      // Create and add drawing layer (above subway stations, below grid)
      const drawingLayer = new DrawingLayer();
      viewport.addChild(drawingLayer.getContainer());

      // Create tile grid (above all layers)
      const gridContainer = new Container();
      gridContainer.label = "grid";
      viewport.addChild(gridContainer);

      // Draw tile grid
      const grid = new Graphics();
      gridContainer.addChild(grid);

      // Grid lines (light gray)
      grid.setStrokeStyle({ width: 1, color: 0xcccccc });

      // Draw vertical lines
      for (let x = 0; x <= WORLD_TILES; x++) {
        grid.moveTo(x * TILE_SIZE, 0);
        grid.lineTo(x * TILE_SIZE, WORLD_SIZE);
      }

      // Draw horizontal lines
      for (let y = 0; y <= WORLD_TILES; y++) {
        grid.moveTo(0, y * TILE_SIZE);
        grid.lineTo(WORLD_SIZE, y * TILE_SIZE);
      }

      grid.stroke();

      // Draw tile coordinates
      for (let tx = 0; tx < WORLD_TILES; tx++) {
        for (let ty = 0; ty < WORLD_TILES; ty++) {
          const label = new Graphics();
          const x = tx * TILE_SIZE + TILE_SIZE / 2;
          const y = ty * TILE_SIZE + TILE_SIZE / 2;

          // Small center marker
          label.circle(x, y, 3);
          label.fill({ color: 0x999999 });
          gridContainer.addChild(label);
        }
      }

      // World boundary (darker)
      const boundary = new Graphics();
      boundary.setStrokeStyle({ width: 2, color: 0x666666 });
      boundary.rect(0, 0, WORLD_SIZE, WORLD_SIZE);
      boundary.stroke();
      gridContainer.addChild(boundary);

      // Check again if unmounted before storing refs
      if (cancelled) {
        terrainLayer.destroy();
        featuresLayer.destroy();
        labelLayer.destroy();
        seedsLayer.destroy();
        railStationLayer.destroy();
        subwayStationLayer.destroy();
        drawingLayer.destroy();
        app.destroy(true, { children: true });
        return;
      }

      // Store refs
      appRef.current = app;
      viewportRef.current = viewport;
      terrainLayerRef.current = terrainLayer;
      featuresLayerRef.current = featuresLayer;
      labelLayerRef.current = labelLayer;
      seedsLayerRef.current = seedsLayer;
      railStationLayerRef.current = railStationLayer;
      subwayStationLayerRef.current = subwayStationLayer;
      drawingLayerRef.current = drawingLayer;
      gridContainerRef.current = gridContainer;
      setIsReady(true);

      // Handle resize
      const handleResize = () => {
        if (viewportRef.current && container) {
          viewportRef.current.resize(container.clientWidth, container.clientHeight);
        }
      };

      window.addEventListener("resize", handleResize);
      resizeCleanup = () => window.removeEventListener("resize", handleResize);
    };

    init();

    // Cleanup
    return () => {
      cancelled = true;
      resizeCleanup?.();

      // Clean up using refs (which are set after async init completes)
      if (terrainLayerRef.current) {
        terrainLayerRef.current.destroy();
        terrainLayerRef.current = null;
      }
      if (featuresLayerRef.current) {
        featuresLayerRef.current.destroy();
        featuresLayerRef.current = null;
      }
      if (labelLayerRef.current) {
        labelLayerRef.current.destroy();
        labelLayerRef.current = null;
      }
      if (seedsLayerRef.current) {
        seedsLayerRef.current.destroy();
        seedsLayerRef.current = null;
      }
      if (railStationLayerRef.current) {
        railStationLayerRef.current.destroy();
        railStationLayerRef.current = null;
      }
      if (subwayStationLayerRef.current) {
        subwayStationLayerRef.current.destroy();
        subwayStationLayerRef.current = null;
      }
      if (drawingLayerRef.current) {
        drawingLayerRef.current.destroy();
        drawingLayerRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        viewportRef.current = null;
        gridContainerRef.current = null;
      }
    };
  }, [seed]);

  // Update visibility when state changes (after initial mount)
  useEffect(() => {
    if (isReady) {
      if (terrainLayerRef.current) {
        terrainLayerRef.current.setVisibility(layerVisibility);
      }
      if (featuresLayerRef.current) {
        featuresLayerRef.current.setVisibility(layerVisibility);
      }
      if (labelLayerRef.current) {
        labelLayerRef.current.setVisibility(layerVisibility);
      }
      if (gridContainerRef.current) {
        gridContainerRef.current.visible = layerVisibility.grid;
      }
      // Update subway tunnel visibility (CITY-196)
      if (subwayStationLayerRef.current) {
        subwayStationLayerRef.current.setTunnelsVisible(layerVisibility.subwayTunnels);
      }
    }
  }, [layerVisibility, isReady]);

  // Sync zoom from parent prop to viewport
  useEffect(() => {
    if (isReady && viewportRef.current && zoom !== undefined) {
      const currentZoom = viewportRef.current.scale.x;
      // Only update if significantly different to avoid loops
      if (Math.abs(currentZoom - zoom) > 0.01) {
        viewportRef.current.setZoom(zoom, true);
      }
    }
  }, [zoom, isReady]);

  // Sync zoom to features layer for zoom-based road visibility
  useEffect(() => {
    if (isReady && featuresLayerRef.current && zoom !== undefined) {
      featuresLayerRef.current.setZoom(zoom);
    }
  }, [zoom, isReady]);

  // Listen for viewport zoom changes and notify parent
  useEffect(() => {
    if (!isReady || !viewportRef.current || !onZoomChange) return;

    const viewport = viewportRef.current;

    const handleZoomEnd = () => {
      const newZoom = viewport.scale.x;
      onZoomChange(newZoom);
    };

    // Listen to zoom-end event from pixi-viewport
    viewport.on("zoomed-end", handleZoomEnd);
    // Also listen to wheel for immediate feedback
    viewport.on("wheel-scroll", handleZoomEnd);
    viewport.on("pinch-end", handleZoomEnd);

    return () => {
      viewport.off("zoomed-end", handleZoomEnd);
      viewport.off("wheel-scroll", handleZoomEnd);
      viewport.off("pinch-end", handleZoomEnd);
    };
  }, [isReady, onZoomChange]);

  // Update features layer when context features change
  useEffect(() => {
    if (!isReady || !featuresLayerRef.current || !featuresContext) return;

    // Merge mock features with context features
    // Context features are added on top of existing mock features
    const currentData = featuresLayerRef.current.getData();

    // If we have context features, combine them with any existing mock features
    // The context tracks user-placed features separately
    if (featuresContext.features.districts.length > 0 ||
        featuresContext.features.roads.length > 0 ||
        featuresContext.features.pois.length > 0 ||
        featuresContext.features.neighborhoods.length > 0) {

      // Start with mock features if they exist, otherwise empty
      const baseData: FeaturesData = showMockFeatures && currentData
        ? {
            // Keep only the original mock districts (filter out user-placed ones)
            districts: currentData.districts.filter(d =>
              !featuresContext.features.districts.some(fd => fd.id === d.id)
            ),
            roads: currentData.roads.filter(r =>
              !featuresContext.features.roads.some(fr => fr.id === r.id)
            ),
            pois: currentData.pois.filter(p =>
              !featuresContext.features.pois.some(fp => fp.id === p.id)
            ),
            neighborhoods: [],
          }
        : { districts: [], roads: [], pois: [], neighborhoods: [] };

      // Merge with context features
      const mergedData: FeaturesData = {
        districts: [...baseData.districts, ...featuresContext.features.districts],
        roads: [...baseData.roads, ...featuresContext.features.roads],
        pois: [...baseData.pois, ...featuresContext.features.pois],
        neighborhoods: [...featuresContext.features.neighborhoods],
      };

      featuresLayerRef.current.setData(mergedData);
    }
  }, [isReady, featuresContext?.features, showMockFeatures]);

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

    if (
      placementContext?.isPlacing &&
      placementContext.previewPosition &&
      placementContext.selectedSeed
    ) {
      seedsLayerRef.current.setPreview({
        seedId: placementContext.selectedSeed.id,
        category: placementContext.selectedSeed.category,
        icon: placementContext.selectedSeed.icon,
        position: placementContext.previewPosition,
      });
    } else {
      seedsLayerRef.current.setPreview(null);
    }
  }, [
    isReady,
    placementContext?.isPlacing,
    placementContext?.previewPosition,
    placementContext?.selectedSeed,
  ]);

  // Update drawing layer when drawing state changes
  useEffect(() => {
    if (!isReady || !drawingLayerRef.current || !drawingContext) return;

    drawingLayerRef.current.setState({
      vertices: drawingContext.state.vertices,
      previewPoint: drawingContext.state.previewPoint,
      isDrawing: drawingContext.state.isDrawing,
    });
  }, [
    isReady,
    drawingContext?.state.vertices,
    drawingContext?.state.previewPoint,
    drawingContext?.state.isDrawing,
  ]);

  // Update rail station layer when transit context changes
  useEffect(() => {
    if (!isReady || !railStationLayerRef.current || !transitContext) return;

    railStationLayerRef.current.setStations(transitContext.railStations);
    railStationLayerRef.current.setTracks(transitContext.trackSegments);
  }, [isReady, transitContext?.railStations, transitContext?.trackSegments]);

  // Update rail station preview when placing a rail_station seed
  useEffect(() => {
    if (!isReady || !railStationLayerRef.current) return;

    // Only show rail station preview if placing a rail_station seed
    if (
      placementContext?.isPlacing &&
      placementContext.previewPosition &&
      placementContext.selectedSeed?.id === "rail_station" &&
      transitContext
    ) {
      const validation = transitContext.validateRailStationPlacement(
        placementContext.previewPosition
      );
      railStationLayerRef.current.setPreview({
        position: placementContext.previewPosition,
        isValid: validation.isValid,
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

    // Only show subway station preview if placing a subway seed
    if (
      placementContext?.isPlacing &&
      placementContext.previewPosition &&
      placementContext.selectedSeed?.id === "subway" &&
      transitContext
    ) {
      const validation = transitContext.validateSubwayStationPlacement(
        placementContext.previewPosition
      );
      subwayStationLayerRef.current.setPreview({
        position: placementContext.previewPosition,
        isValid: validation.isValid,
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

  // Handle clicks for seed placement, feature selection, and polygon drawing
  useEffect(() => {
    if (!isReady || !viewportRef.current) return;

    const viewport = viewportRef.current;
    const isPlacing = placementContext?.isPlacing ?? false;
    const confirmPlacement = placementContext?.confirmPlacement;
    const setPreviewPosition = placementContext?.setPreviewPosition;
    const isDrawing = drawingContext?.state.isDrawing ?? false;
    const addVertex = drawingContext?.addVertex;
    const setDrawingPreviewPoint = drawingContext?.setPreviewPoint;
    const completeDrawing = drawingContext?.completeDrawing;
    const cancelDrawing = drawingContext?.cancelDrawing;
    const canComplete = drawingContext?.canComplete;

    // Track if we're dragging to avoid triggering click after drag
    let isDragging = false;
    let dragStartPos = { x: 0, y: 0 };
    const DRAG_THRESHOLD = 5;

    const handlePointerDown = (event: { global: { x: number; y: number } }) => {
      dragStartPos = { x: event.global.x, y: event.global.y };
      isDragging = false;
    };

    const handlePointerMove = (event: { global: { x: number; y: number } }) => {
      const dx = event.global.x - dragStartPos.x;
      const dy = event.global.y - dragStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        isDragging = true;
      }

      // Convert to world position
      const worldPos = viewport.toWorld(event.global.x, event.global.y);

      // Update preview position if placing seeds
      if (isPlacing && setPreviewPosition) {
        setPreviewPosition({ x: worldPos.x, y: worldPos.y });
      }

      // Update preview point if drawing
      if (isDrawing && setDrawingPreviewPoint) {
        setDrawingPreviewPoint({ x: worldPos.x, y: worldPos.y });
      }
    };

    const handleClick = (event: { global: { x: number; y: number } }) => {
      // Don't trigger placement if we were dragging
      if (isDragging) return;

      // Convert screen position to world position
      const worldPos = viewport.toWorld(event.global.x, event.global.y);

      // Handle drawing mode
      if (isDrawing && addVertex) {
        // Check if clicking near first vertex to close the polygon
        if (canComplete && canComplete() && drawingLayerRef.current?.isNearFirstVertex(worldPos)) {
          completeDrawing?.();
          return;
        }
        addVertex({ x: worldPos.x, y: worldPos.y });
        return;
      }

      // Handle seed placement mode
      if (isPlacing && confirmPlacement) {
        confirmPlacement({ x: worldPos.x, y: worldPos.y });
        return;
      }

      // Handle feature selection (default mode)
      if (onFeatureSelect && featuresLayerRef.current) {
        // Perform hit test and select feature
        const hitResult = featuresLayerRef.current.hitTest(worldPos.x, worldPos.y);
        if (hitResult) {
          const selectedFeature = hitTestResultToSelectedFeature(hitResult);
          onFeatureSelect(selectedFeature);
        } else {
          // Clicked on empty space - clear selection
          onFeatureSelect(null);
        }
      }
    };

    // Keyboard handlers for drawing
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isDrawing) return;

      if (event.key === "Escape") {
        event.preventDefault();
        cancelDrawing?.();
      } else if (event.key === "Enter" && canComplete && canComplete()) {
        event.preventDefault();
        completeDrawing?.();
      }
    };

    viewport.on("pointerdown", handlePointerDown);
    viewport.on("pointermove", handlePointerMove);
    viewport.on("pointerup", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      viewport.off("pointerdown", handlePointerDown);
      viewport.off("pointermove", handlePointerMove);
      viewport.off("pointerup", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isReady,
    placementContext?.isPlacing,
    placementContext?.confirmPlacement,
    placementContext?.setPreviewPosition,
    drawingContext?.state.isDrawing,
    drawingContext?.addVertex,
    drawingContext?.setPreviewPoint,
    drawingContext?.completeDrawing,
    drawingContext?.cancelDrawing,
    drawingContext?.canComplete,
    onFeatureSelect,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className || ""}`}
    >
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <span className="text-gray-500">Loading canvas...</span>
        </div>
      )}
      {isReady && (
        <LayerControls
          visibility={layerVisibility}
          onChange={handleVisibilityChange}
        />
      )}
    </div>
  );
  }
);

/**
 * Convert a hit test result to a SelectedFeature for the inspector panel.
 */
function hitTestResultToSelectedFeature(hitResult: HitTestResult): SelectedFeature {
  switch (hitResult.type) {
    case "district": {
      const district = hitResult.feature as District;
      return {
        type: "district",
        id: district.id,
        name: district.name,
        districtType: district.type,
        isHistoric: district.isHistoric ?? false,
      };
    }
    case "road": {
      const road = hitResult.feature as Road;
      return {
        type: "road",
        id: road.id,
        name: road.name,
        roadClass: road.roadClass,
      };
    }
    case "poi": {
      const poi = hitResult.feature as POI;
      return {
        type: "poi",
        id: poi.id,
        name: poi.name,
        poiType: poi.type,
      };
    }
    case "neighborhood": {
      const neighborhood = hitResult.feature as Neighborhood;
      return {
        type: "neighborhood",
        id: neighborhood.id,
        name: neighborhood.name,
      };
    }
  }
}
