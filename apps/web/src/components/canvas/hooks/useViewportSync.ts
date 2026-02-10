/**
 * Hook encapsulating viewport zoom syncing, viewport bounds tracking,
 * and viewport event listeners.
 *
 * Extracted from MapCanvas to reduce the component's line count (CITY-231).
 */

import { useEffect, type MutableRefObject } from "react";
import type { Viewport } from "pixi-viewport";
import type { FeaturesLayer } from "../layers";

interface UseViewportSyncParams {
  isReady: boolean;
  viewportRef: MutableRefObject<Viewport | null>;
  featuresLayerRef: MutableRefObject<FeaturesLayer | null>;
  zoom: number | undefined;
  onZoomChange: ((zoom: number) => void) | undefined;
}

/**
 * Syncs a controlled zoom prop to the PixiJS viewport, reports zoom changes
 * back to the parent, and keeps the features layer's viewport bounds updated
 * for spatial road culling (CITY-421).
 */
export function useViewportSync({
  isReady,
  viewportRef,
  featuresLayerRef,
  zoom,
  onZoomChange,
}: UseViewportSyncParams) {
  // Sync zoom prop → viewport
  useEffect(() => {
    if (isReady && viewportRef.current && zoom !== undefined) {
      const currentZoom = viewportRef.current.scale.x;
      if (Math.abs(currentZoom - zoom) > 0.01) {
        viewportRef.current.setZoom(zoom, true);
      }
    }
  }, [zoom, isReady]);

  // Sync zoom → features layer for zoom-based road visibility
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

    viewport.on("zoomed-end", handleZoomEnd);
    viewport.on("wheel-scroll", handleZoomEnd);
    viewport.on("pinch-end", handleZoomEnd);

    return () => {
      viewport.off("zoomed-end", handleZoomEnd);
      viewport.off("wheel-scroll", handleZoomEnd);
      viewport.off("pinch-end", handleZoomEnd);
    };
  }, [isReady, onZoomChange]);

  // CITY-421: Sync viewport bounds to features layer for spatial road culling
  useEffect(() => {
    if (!isReady || !viewportRef.current || !featuresLayerRef.current) return;

    const viewport = viewportRef.current;
    const featuresLayer = featuresLayerRef.current;

    const syncBounds = () => {
      const corner = viewport.corner;
      const screenW = viewport.screenWidth / viewport.scale.x;
      const screenH = viewport.screenHeight / viewport.scale.y;
      featuresLayer.setViewportBounds({
        minX: corner.x,
        minY: corner.y,
        maxX: corner.x + screenW,
        maxY: corner.y + screenH,
      });
    };

    viewport.on("moved", syncBounds);
    viewport.on("zoomed-end", syncBounds);
    syncBounds();

    return () => {
      viewport.off("moved", syncBounds);
      viewport.off("zoomed-end", syncBounds);
    };
  }, [isReady]);
}
