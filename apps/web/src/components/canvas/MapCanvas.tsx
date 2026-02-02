import { useEffect, useRef, useState, useCallback } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
  TerrainLayer,
  generateMockTerrain,
  DEFAULT_LAYER_VISIBILITY,
  type LayerVisibility,
} from "./layers";
import { LayerControls } from "./LayerControls";

// Tile size in world coordinates
const TILE_SIZE = 256;
// World size (3x3 grid of tiles for now)
const WORLD_TILES = 3;
const WORLD_SIZE = TILE_SIZE * WORLD_TILES;

interface MapCanvasProps {
  className?: string;
  seed?: number;
}

export function MapCanvas({ className, seed = 12345 }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const terrainLayerRef = useRef<TerrainLayer | null>(null);
  const gridContainerRef = useRef<Container | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(
    DEFAULT_LAYER_VISIBILITY
  );

  // Handle layer visibility changes
  const handleVisibilityChange = useCallback(
    (visibility: LayerVisibility) => {
      setLayerVisibility(visibility);

      // Update terrain layer visibility
      if (terrainLayerRef.current) {
        terrainLayerRef.current.setVisibility(visibility);
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

      // Create and add terrain layer (below grid)
      const terrainLayer = new TerrainLayer();
      viewport.addChild(terrainLayer.getContainer());

      // Generate and set terrain data
      const terrainData = generateMockTerrain(WORLD_SIZE, seed);
      terrainLayer.setData(terrainData);
      terrainLayer.setVisibility(layerVisibility);

      // Create tile grid (above terrain)
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
        app.destroy(true, { children: true });
        return;
      }

      // Store refs
      appRef.current = app;
      viewportRef.current = viewport;
      terrainLayerRef.current = terrainLayer;
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
      if (gridContainerRef.current) {
        gridContainerRef.current.visible = layerVisibility.grid;
      }
    }
  }, [layerVisibility, isReady]);

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
