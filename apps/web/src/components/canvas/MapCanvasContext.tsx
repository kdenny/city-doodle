/**
 * Context for sharing MapCanvas export capabilities.
 *
 * This allows components like ExportView to access the canvas export
 * functionality without needing direct parent-child relationships.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { ExportOptions, ExportResult } from "./useCanvasExport";

interface MapCanvasContextValue {
  /** Whether the canvas is ready for export */
  isReady: boolean;
  /** Register the canvas export functions */
  registerCanvas: (handle: CanvasExportHandle | null) => void;
  /** Export the canvas as PNG and trigger download */
  exportAsPng: (options: ExportOptions) => Promise<void>;
  /** Capture the canvas as PNG (no download) */
  captureAsPng: (options: ExportOptions) => Promise<ExportResult>;
}

interface CanvasExportHandle {
  exportAsPng: (options: ExportOptions) => Promise<void>;
  captureAsPng: (options: ExportOptions) => Promise<ExportResult>;
  isReady: boolean;
}

const MapCanvasContext = createContext<MapCanvasContextValue | null>(null);

// Export for internal use by MapCanvas (to register itself)
export const MapCanvasContextInternal = MapCanvasContext;

interface MapCanvasProviderProps {
  children: ReactNode;
}

export function MapCanvasProvider({ children }: MapCanvasProviderProps) {
  const [canvasHandle, setCanvasHandle] = useState<CanvasExportHandle | null>(null);

  const registerCanvas = useCallback((handle: CanvasExportHandle | null) => {
    setCanvasHandle(handle);
  }, []);

  const exportAsPng = useCallback(
    async (options: ExportOptions) => {
      if (!canvasHandle?.isReady) {
        throw new Error("Canvas not ready for export");
      }
      return canvasHandle.exportAsPng(options);
    },
    [canvasHandle]
  );

  const captureAsPng = useCallback(
    async (options: ExportOptions) => {
      if (!canvasHandle?.isReady) {
        throw new Error("Canvas not ready for export");
      }
      return canvasHandle.captureAsPng(options);
    },
    [canvasHandle]
  );

  const value: MapCanvasContextValue = {
    isReady: canvasHandle?.isReady ?? false,
    registerCanvas,
    exportAsPng,
    captureAsPng,
  };

  return (
    <MapCanvasContext.Provider value={value}>
      {children}
    </MapCanvasContext.Provider>
  );
}

/**
 * Hook to access canvas export functionality.
 * Throws if not within a MapCanvasProvider.
 */
export function useMapCanvasExport() {
  const context = useContext(MapCanvasContext);
  if (!context) {
    throw new Error("useMapCanvasExport must be used within a MapCanvasProvider");
  }
  return context;
}

/**
 * Hook to optionally access canvas export functionality.
 * Returns null if not within a MapCanvasProvider (safe to use anywhere).
 */
export function useMapCanvasExportOptional() {
  return useContext(MapCanvasContext);
}
