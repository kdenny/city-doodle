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
  generateMockTerrain,
  generateMockFeatures,
  generateMockLabels,
  DEFAULT_LAYER_VISIBILITY,
  type LayerVisibility,
} from "./layers";
import { LayerControls } from "./LayerControls";
import {
  exportCanvasAsPng,
  captureCanvasAsPng,
  type ExportOptions,
  type ExportResult,
} from "./useCanvasExport";
import { MapCanvasContextInternal } from "./MapCanvasContext";
import { useZoomOptional } from "../shell/ZoomContext";
import { usePlacementOptional } from "../palette";

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
  function MapCanvas({ className, seed = 12345, zoom: zoomProp, onZoomChange: onZoomChangeProp, showMockFeatures = true }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const terrainLayerRef = useRef<TerrainLayer | null>(null);
  const featuresLayerRef = useRef<FeaturesLayer | null>(null);
  const labelLayerRef = useRef<LabelLayer | null>(null);
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

      // Create and add features layer (above terrain)
      const featuresLayer = new FeaturesLayer();
      viewport.addChild(featuresLayer.getContainer());

      // Generate and set features data (only if showMockFeatures is enabled)
      if (showMockFeatures) {
        const featuresData = generateMockFeatures(WORLD_SIZE, seed);
        featuresLayer.setData(featuresData);
      } else {
        // Empty features for new worlds
        featuresLayer.setData({ districts: [], roads: [], pois: [] });
      }
      featuresLayer.setVisibility(layerVisibility);

      // Create and add label layer (above features, below grid)
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
        app.destroy(true, { children: true });
        return;
      }

      // Store refs
      appRef.current = app;
      viewportRef.current = viewport;
      terrainLayerRef.current = terrainLayer;
      featuresLayerRef.current = featuresLayer;
      labelLayerRef.current = labelLayer;
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

  // Handle clicks for seed placement
  useEffect(() => {
    if (!isReady || !viewportRef.current || !placementContext) return;

    const viewport = viewportRef.current;
    const { isPlacing, confirmPlacement, setPreviewPosition } = placementContext;

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

      // Update preview position if placing
      if (isPlacing) {
        const worldPos = viewport.toWorld(event.global.x, event.global.y);
        setPreviewPosition({ x: worldPos.x, y: worldPos.y });
      }
    };

    const handleClick = (event: { global: { x: number; y: number } }) => {
      // Don't trigger placement if we were dragging
      if (isDragging) return;

      if (isPlacing) {
        // Convert screen position to world position
        const worldPos = viewport.toWorld(event.global.x, event.global.y);
        confirmPlacement({ x: worldPos.x, y: worldPos.y });
      }
    };

    viewport.on("pointerdown", handlePointerDown);
    viewport.on("pointermove", handlePointerMove);
    viewport.on("pointerup", handleClick);

    return () => {
      viewport.off("pointerdown", handlePointerDown);
      viewport.off("pointermove", handlePointerMove);
      viewport.off("pointerup", handleClick);
    };
  }, [isReady, placementContext?.isPlacing, placementContext?.confirmPlacement, placementContext?.setPreviewPosition]);

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
