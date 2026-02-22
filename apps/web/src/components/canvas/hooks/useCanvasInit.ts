/**
 * Hook encapsulating PixiJS application creation, viewport setup, layer instantiation,
 * resize handling, and visibility-change pausing.
 *
 * Extracted from MapCanvas to reduce the component's line count (CITY-231).
 */

import { useEffect, useRef, type MutableRefObject } from "react";
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
  RoadEndpointLayer,
  TransitLineDrawingLayer,
  WalkabilityOverlayLayer,
  generateMockTerrain,
  generateMockFeatures,
  generateMockLabels,
  type LayerVisibility,
} from "../layers";
import type { GeographicSetting } from "../../../api/types";
import { TILE_SIZE, WORLD_TILES, WORLD_SIZE } from "../../../utils/worldConstants";
import { composeTileFeatures } from "../layers/terrainTransformer";
import type { TerrainData } from "../layers";

export interface CanvasLayerRefs {
  appRef: MutableRefObject<Application | null>;
  viewportRef: MutableRefObject<Viewport | null>;
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
}

interface UseCanvasInitParams {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  layerRefs: CanvasLayerRefs;
  seed: number;
  geographicSetting?: GeographicSetting;
  showMockFeatures: boolean;
  layerVisibility: LayerVisibility;
  tiles: Array<{ features?: unknown; tx: number; ty: number; terrain_status?: string }> | undefined;
  setTerrainDataRef: MutableRefObject<((data: TerrainData) => void) | undefined>;
  onReady: () => void;
}

/**
 * Initialises the PixiJS application, viewport, and all rendering layers.
 *
 * The effect runs once (keyed on `seed` + `geographicSetting`) and cleans up
 * all GPU resources when the component unmounts or deps change.
 */
export function useCanvasInit({
  containerRef,
  layerRefs,
  seed,
  geographicSetting,
  showMockFeatures,
  layerVisibility,
  tiles,
  setTerrainDataRef,
  onReady,
}: UseCanvasInitParams) {
  // Stable ref to layerVisibility so the init closure reads the latest value
  const layerVisibilityRef = useRef(layerVisibility);
  layerVisibilityRef.current = layerVisibility;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeCleanup: (() => void) | null = null;

    const init = async () => {
      const app = new Application();
      await app.init({
        background: "#f5f5f5",
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (cancelled) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas as HTMLCanvasElement);

      const viewport = new Viewport({
        screenWidth: container.clientWidth,
        screenHeight: container.clientHeight,
        worldWidth: WORLD_SIZE,
        worldHeight: WORLD_SIZE,
        events: app.renderer.events,
      });

      app.stage.addChild(viewport);

      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clampZoom({ minScale: 0.25, maxScale: 4 });

      viewport.moveCenter(WORLD_SIZE / 2, WORLD_SIZE / 2);

      // --- Layers (bottom → top) ---
      const terrainLayer = new TerrainLayer();
      viewport.addChild(terrainLayer.getContainer());

      // CITY-588/585: Use real terrain from ALL tiles with features, not just the first.
      // Primary signal: terrain_status === 'ready'. Fallback: inspect features content.
      const tilesWithFeatures = tiles?.filter(
        (t) =>
          t.terrain_status === "ready" ||
          (t.features &&
            typeof t.features === "object" &&
            "type" in (t.features as Record<string, unknown>))
      ) ?? [];

      const terrainData = tilesWithFeatures.length > 0
        ? composeTileFeatures(tilesWithFeatures.map((t) => ({
            features: t.features as unknown,
            tx: t.tx,
            ty: t.ty,
          })))
        : generateMockTerrain(WORLD_SIZE, seed, geographicSetting);

      // CITY-587: Structured terrain source logging with tile/feature counts
      if (tilesWithFeatures.length > 0) {
        const featureCount = tilesWithFeatures.reduce((sum, t) => {
          const fc = t.features as unknown as { features?: unknown[] };
          return sum + (fc?.features?.length ?? 0);
        }, 0);
        console.info(
          '[Terrain] Using backend-generated terrain',
          {
            seed,
            geographicSetting: geographicSetting ?? 'default',
            tileCount: tilesWithFeatures.length,
            featureCount,
          }
        );
      } else {
        console.warn(
          '[Terrain] Falling back to mock terrain generation (no valid tile features found)',
          { seed, geographicSetting: geographicSetting ?? 'default', tilesProvided: !!tiles, tileCount: tiles?.length ?? 0 }
        );
      }

      // CITY-590: Log failed tile errors for visibility
      const failedTile = (tiles as Array<{ terrain_status?: string; terrain_error?: string; id?: string }> | undefined)?.find(
        (t) => t.terrain_status === 'failed'
      );
      if (failedTile) {
        console.error(
          '[Terrain] Terrain generation failed',
          { tileId: failedTile.id, error: failedTile.terrain_error }
        );
      }

      terrainLayer.setData(terrainData);
      terrainLayer.setVisibility(layerVisibilityRef.current);
      setTerrainDataRef.current?.(terrainData);

      const featuresLayer = new FeaturesLayer();
      viewport.addChild(featuresLayer.getContainer());
      if (showMockFeatures) {
        const featuresData = generateMockFeatures(WORLD_SIZE, seed);
        featuresLayer.setData({ ...featuresData, neighborhoods: [] });
      } else {
        featuresLayer.setData({ districts: [], roads: [], pois: [], neighborhoods: [], bridges: [] });
      }
      featuresLayer.setVisibility(layerVisibilityRef.current);

      const labelLayer = new LabelLayer();
      viewport.addChild(labelLayer.getContainer());
      if (showMockFeatures) {
        const labelData = generateMockLabels(WORLD_SIZE, seed);
        labelLayer.setData(labelData);
      } else {
        labelLayer.setData({ labels: [], seed });
      }
      labelLayer.setVisibility(layerVisibilityRef.current);

      const roadEndpointLayer = new RoadEndpointLayer();
      viewport.addChild(roadEndpointLayer.getContainer());

      const seedsLayer = new SeedsLayer();
      viewport.addChild(seedsLayer.getContainer());

      const walkabilityOverlayLayer = new WalkabilityOverlayLayer();
      viewport.addChild(walkabilityOverlayLayer.container);

      const railStationLayer = new RailStationLayer();
      viewport.addChild(railStationLayer.getContainer());

      const subwayStationLayer = new SubwayStationLayer();
      viewport.addChild(subwayStationLayer.getContainer());

      const transitLineDrawingLayer = new TransitLineDrawingLayer();
      viewport.addChild(transitLineDrawingLayer.getContainer());

      const drawingLayer = new DrawingLayer();
      viewport.addChild(drawingLayer.getContainer());

      // Tile grid
      const gridContainer = new Container();
      gridContainer.label = "grid";
      viewport.addChild(gridContainer);

      const grid = new Graphics();
      gridContainer.addChild(grid);
      grid.setStrokeStyle({ width: 1, color: 0xcccccc });
      for (let x = 0; x <= WORLD_TILES; x++) {
        grid.moveTo(x * TILE_SIZE, 0);
        grid.lineTo(x * TILE_SIZE, WORLD_SIZE);
      }
      for (let y = 0; y <= WORLD_TILES; y++) {
        grid.moveTo(0, y * TILE_SIZE);
        grid.lineTo(WORLD_SIZE, y * TILE_SIZE);
      }
      grid.stroke();

      const boundary = new Graphics();
      boundary.setStrokeStyle({ width: 2, color: 0x666666 });
      boundary.rect(0, 0, WORLD_SIZE, WORLD_SIZE);
      boundary.stroke();
      gridContainer.addChild(boundary);

      if (cancelled) {
        terrainLayer.destroy();
        featuresLayer.destroy();
        labelLayer.destroy();
        roadEndpointLayer.destroy();
        seedsLayer.destroy();
        railStationLayer.destroy();
        walkabilityOverlayLayer.destroy();
        subwayStationLayer.destroy();
        transitLineDrawingLayer.destroy();
        drawingLayer.destroy();
        app.destroy(true, { children: true });
        return;
      }

      // Store refs
      layerRefs.appRef.current = app;
      layerRefs.viewportRef.current = viewport;
      layerRefs.terrainLayerRef.current = terrainLayer;
      layerRefs.featuresLayerRef.current = featuresLayer;
      layerRefs.labelLayerRef.current = labelLayer;
      layerRefs.roadEndpointLayerRef.current = roadEndpointLayer;
      layerRefs.seedsLayerRef.current = seedsLayer;
      layerRefs.railStationLayerRef.current = railStationLayer;
      layerRefs.walkabilityOverlayLayerRef.current = walkabilityOverlayLayer;
      layerRefs.subwayStationLayerRef.current = subwayStationLayer;
      layerRefs.transitLineDrawingLayerRef.current = transitLineDrawingLayer;
      layerRefs.drawingLayerRef.current = drawingLayer;
      layerRefs.gridContainerRef.current = gridContainer;
      onReady();

      // Resize handler
      const handleResize = () => {
        if (layerRefs.viewportRef.current && container) {
          layerRefs.viewportRef.current.resize(container.clientWidth, container.clientHeight);
        }
      };

      // CITY-532: Pause ticker when tab is backgrounded
      const handleVisibilityChange = () => {
        if (document.hidden) {
          app.ticker.stop();
        } else {
          viewport.plugins.get("decelerate")?.reset?.();
          app.ticker.start();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("resize", handleResize);
      resizeCleanup = () => {
        window.removeEventListener("resize", handleResize);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    };

    init();

    return () => {
      cancelled = true;
      resizeCleanup?.();

      if (layerRefs.terrainLayerRef.current) { layerRefs.terrainLayerRef.current.destroy(); layerRefs.terrainLayerRef.current = null; }
      if (layerRefs.featuresLayerRef.current) { layerRefs.featuresLayerRef.current.destroy(); layerRefs.featuresLayerRef.current = null; }
      if (layerRefs.labelLayerRef.current) { layerRefs.labelLayerRef.current.destroy(); layerRefs.labelLayerRef.current = null; }
      if (layerRefs.roadEndpointLayerRef.current) { layerRefs.roadEndpointLayerRef.current.destroy(); layerRefs.roadEndpointLayerRef.current = null; }
      if (layerRefs.seedsLayerRef.current) { layerRefs.seedsLayerRef.current.destroy(); layerRefs.seedsLayerRef.current = null; }
      if (layerRefs.railStationLayerRef.current) { layerRefs.railStationLayerRef.current.destroy(); layerRefs.railStationLayerRef.current = null; }
      if (layerRefs.walkabilityOverlayLayerRef.current) { layerRefs.walkabilityOverlayLayerRef.current.destroy(); layerRefs.walkabilityOverlayLayerRef.current = null; }
      if (layerRefs.subwayStationLayerRef.current) { layerRefs.subwayStationLayerRef.current.destroy(); layerRefs.subwayStationLayerRef.current = null; }
      if (layerRefs.transitLineDrawingLayerRef.current) { layerRefs.transitLineDrawingLayerRef.current.destroy(); layerRefs.transitLineDrawingLayerRef.current = null; }
      if (layerRefs.drawingLayerRef.current) { layerRefs.drawingLayerRef.current.destroy(); layerRefs.drawingLayerRef.current = null; }
      if (layerRefs.appRef.current) {
        layerRefs.appRef.current.destroy(true, { children: true });
        layerRefs.appRef.current = null;
        layerRefs.viewportRef.current = null;
        layerRefs.gridContainerRef.current = null;
      }
    };
  }, [seed, geographicSetting]);
}
