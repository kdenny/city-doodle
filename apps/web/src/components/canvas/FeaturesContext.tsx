/**
 * Context for managing features data (districts, roads, POIs).
 *
 * Provides methods to add, remove, and update features. Districts can be
 * added with auto-generated street grids when seeds are placed.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { District, Road, POI, FeaturesData } from "./layers";
import {
  generateDistrictGeometry,
  wouldOverlap,
  type DistrictGenerationConfig,
  type GeneratedDistrict,
} from "./layers/districtGenerator";

interface FeaturesContextValue {
  /** Current features data */
  features: FeaturesData;
  /** Add a district at a position (generates geometry automatically) */
  addDistrict: (
    position: { x: number; y: number },
    seedId: string,
    config?: DistrictGenerationConfig
  ) => GeneratedDistrict | null;
  /** Add a district with explicit geometry */
  addDistrictWithGeometry: (district: District, roads?: Road[]) => void;
  /** Add a POI */
  addPOI: (poi: POI) => void;
  /** Add roads */
  addRoads: (roads: Road[]) => void;
  /** Remove a district by ID */
  removeDistrict: (id: string) => void;
  /** Remove a road by ID */
  removeRoad: (id: string) => void;
  /** Remove a POI by ID */
  removePOI: (id: string) => void;
  /** Update a district */
  updateDistrict: (id: string, updates: Partial<Omit<District, "id">>) => void;
  /** Clear all features */
  clearFeatures: () => void;
  /** Set all features data at once */
  setFeatures: (data: FeaturesData) => void;
}

const FeaturesContext = createContext<FeaturesContextValue | null>(null);

interface FeaturesProviderProps {
  children: ReactNode;
  /** Initial features data */
  initialFeatures?: FeaturesData;
  /** Callback when features change */
  onFeaturesChange?: (features: FeaturesData) => void;
}

const EMPTY_FEATURES: FeaturesData = {
  districts: [],
  roads: [],
  pois: [],
};

export function FeaturesProvider({
  children,
  initialFeatures = EMPTY_FEATURES,
  onFeaturesChange,
}: FeaturesProviderProps) {
  const [features, setFeaturesState] = useState<FeaturesData>(initialFeatures);

  // Helper to update features and notify
  const updateFeatures = useCallback(
    (updater: (prev: FeaturesData) => FeaturesData) => {
      setFeaturesState((prev) => {
        const next = updater(prev);
        onFeaturesChange?.(next);
        return next;
      });
    },
    [onFeaturesChange]
  );

  const addDistrict = useCallback(
    (
      position: { x: number; y: number },
      seedId: string,
      config?: DistrictGenerationConfig
    ): GeneratedDistrict | null => {
      // Generate district geometry
      const generated = generateDistrictGeometry(position, seedId, config);

      // Check for overlap with existing districts
      if (wouldOverlap(generated.district.polygon.points, features.districts)) {
        console.warn("District would overlap with existing district");
        return null;
      }

      updateFeatures((prev) => ({
        ...prev,
        districts: [...prev.districts, generated.district],
        roads: [...prev.roads, ...generated.roads],
      }));

      return generated;
    },
    [features.districts, updateFeatures]
  );

  const addDistrictWithGeometry = useCallback(
    (district: District, roads: Road[] = []) => {
      updateFeatures((prev) => ({
        ...prev,
        districts: [...prev.districts, district],
        roads: [...prev.roads, ...roads],
      }));
    },
    [updateFeatures]
  );

  const addPOI = useCallback(
    (poi: POI) => {
      updateFeatures((prev) => ({
        ...prev,
        pois: [...prev.pois, poi],
      }));
    },
    [updateFeatures]
  );

  const addRoads = useCallback(
    (roads: Road[]) => {
      updateFeatures((prev) => ({
        ...prev,
        roads: [...prev.roads, ...roads],
      }));
    },
    [updateFeatures]
  );

  const removeDistrict = useCallback(
    (id: string) => {
      updateFeatures((prev) => {
        // Also remove roads that belong to this district
        const districtPrefix = id;
        return {
          ...prev,
          districts: prev.districts.filter((d) => d.id !== id),
          roads: prev.roads.filter((r) => !r.id.startsWith(districtPrefix)),
        };
      });
    },
    [updateFeatures]
  );

  const removeRoad = useCallback(
    (id: string) => {
      updateFeatures((prev) => ({
        ...prev,
        roads: prev.roads.filter((r) => r.id !== id),
      }));
    },
    [updateFeatures]
  );

  const removePOI = useCallback(
    (id: string) => {
      updateFeatures((prev) => ({
        ...prev,
        pois: prev.pois.filter((p) => p.id !== id),
      }));
    },
    [updateFeatures]
  );

  const updateDistrict = useCallback(
    (id: string, updates: Partial<Omit<District, "id">>) => {
      updateFeatures((prev) => ({
        ...prev,
        districts: prev.districts.map((d) =>
          d.id === id ? { ...d, ...updates } : d
        ),
      }));
    },
    [updateFeatures]
  );

  const clearFeatures = useCallback(() => {
    updateFeatures(() => EMPTY_FEATURES);
  }, [updateFeatures]);

  const setFeatures = useCallback(
    (data: FeaturesData) => {
      updateFeatures(() => data);
    },
    [updateFeatures]
  );

  const value: FeaturesContextValue = {
    features,
    addDistrict,
    addDistrictWithGeometry,
    addPOI,
    addRoads,
    removeDistrict,
    removeRoad,
    removePOI,
    updateDistrict,
    clearFeatures,
    setFeatures,
  };

  return (
    <FeaturesContext.Provider value={value}>
      {children}
    </FeaturesContext.Provider>
  );
}

/**
 * Hook to access features context.
 * Throws if not within a FeaturesProvider.
 */
export function useFeatures(): FeaturesContextValue {
  const context = useContext(FeaturesContext);
  if (!context) {
    throw new Error("useFeatures must be used within a FeaturesProvider");
  }
  return context;
}

/**
 * Hook to optionally access features context.
 * Returns null if not within a FeaturesProvider.
 */
export function useFeaturesOptional(): FeaturesContextValue | null {
  return useContext(FeaturesContext);
}
