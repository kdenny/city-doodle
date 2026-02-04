import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ZoomContextValue {
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  minZoom: number;
  maxZoom: number;
}

const ZoomContext = createContext<ZoomContextValue | null>(null);

interface ZoomProviderProps {
  children: ReactNode;
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export function ZoomProvider({
  children,
  initialZoom = 1,
  minZoom = 0.25,
  maxZoom = 4,
  onZoomChange,
}: ZoomProviderProps) {
  const [zoom, setZoomState] = useState(initialZoom);

  const setZoom = useCallback(
    (newZoom: number) => {
      const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
      setZoomState(clampedZoom);
      onZoomChange?.(clampedZoom);
    },
    [minZoom, maxZoom, onZoomChange]
  );

  const zoomIn = useCallback(() => {
    setZoom(zoom * 1.25);
  }, [zoom, setZoom]);

  const zoomOut = useCallback(() => {
    setZoom(zoom / 1.25);
  }, [zoom, setZoom]);

  return (
    <ZoomContext.Provider
      value={{
        zoom,
        setZoom,
        zoomIn,
        zoomOut,
        minZoom,
        maxZoom,
      }}
    >
      {children}
    </ZoomContext.Provider>
  );
}

export function useZoom(): ZoomContextValue {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error("useZoom must be used within a ZoomProvider");
  }
  return context;
}

export function useZoomOptional(): ZoomContextValue | null {
  return useContext(ZoomContext);
}
