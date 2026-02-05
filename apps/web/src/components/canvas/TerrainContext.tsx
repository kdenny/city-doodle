/**
 * Context for sharing terrain data (water features, coastlines, etc.)
 * across components that need it for collision detection.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { TerrainData, WaterFeature } from "./layers/types";

interface TerrainContextValue {
  /** Current terrain data */
  terrainData: TerrainData | null;
  /** Set terrain data */
  setTerrainData: (data: TerrainData) => void;
  /** Get water features for collision detection */
  getWaterFeatures: () => WaterFeature[];
  /** Check if terrain is loaded */
  isLoaded: boolean;
}

const TerrainContext = createContext<TerrainContextValue | null>(null);

interface TerrainProviderProps {
  children: ReactNode;
  /** Initial terrain data */
  initialData?: TerrainData;
}

export function TerrainProvider({
  children,
  initialData,
}: TerrainProviderProps) {
  const [terrainData, setTerrainDataState] = useState<TerrainData | null>(
    initialData ?? null
  );

  const setTerrainData = useCallback((data: TerrainData) => {
    setTerrainDataState(data);
  }, []);

  const getWaterFeatures = useCallback((): WaterFeature[] => {
    return terrainData?.water ?? [];
  }, [terrainData]);

  const isLoaded = terrainData !== null;

  const value: TerrainContextValue = {
    terrainData,
    setTerrainData,
    getWaterFeatures,
    isLoaded,
  };

  return (
    <TerrainContext.Provider value={value}>{children}</TerrainContext.Provider>
  );
}

/**
 * Hook to access terrain context.
 * Throws if not within a TerrainProvider.
 */
export function useTerrain(): TerrainContextValue {
  const context = useContext(TerrainContext);
  if (!context) {
    throw new Error("useTerrain must be used within a TerrainProvider");
  }
  return context;
}

/**
 * Hook to optionally access terrain context.
 * Returns null if not within a TerrainProvider.
 */
export function useTerrainOptional(): TerrainContextValue | null {
  return useContext(TerrainContext);
}
