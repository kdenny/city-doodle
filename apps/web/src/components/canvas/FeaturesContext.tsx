/**
 * Context for managing features data (districts, roads, POIs).
 *
 * Provides methods to add, remove, and update features. Districts can be
 * added with auto-generated street grids when seeds are placed.
 *
 * When a worldId is provided, districts are persisted to the backend API.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import type { District, Road, POI, FeaturesData, Point } from "./layers";
import {
  generateDistrictGeometry,
  wouldOverlap,
  type DistrictGenerationConfig,
  type GeneratedDistrict,
} from "./layers/districtGenerator";
import {
  useWorldDistricts,
  useCreateDistrict,
  useDeleteDistrict,
} from "../../api/hooks";
import type {
  District as ApiDistrict,
  DistrictType as ApiDistrictType,
} from "../../api/types";

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
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

const FeaturesContext = createContext<FeaturesContextValue | null>(null);

interface FeaturesProviderProps {
  children: ReactNode;
  /** World ID for persisting districts to the backend */
  worldId?: string;
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

/**
 * Map frontend district type to API district type.
 * The API has more granular residential types.
 */
function toApiDistrictType(frontendType: string): ApiDistrictType {
  const mapping: Record<string, ApiDistrictType> = {
    residential: "residential_med",
    downtown: "commercial",
    commercial: "commercial",
    industrial: "industrial",
    hospital: "civic",
    university: "civic",
    k12: "civic",
    park: "park",
    airport: "transit",
  };
  return mapping[frontendType] || "mixed_use";
}

/**
 * Map API district type back to frontend type.
 */
function fromApiDistrictType(apiType: ApiDistrictType): string {
  const mapping: Record<ApiDistrictType, string> = {
    residential_low: "residential",
    residential_med: "residential",
    residential_high: "downtown",
    commercial: "commercial",
    industrial: "industrial",
    mixed_use: "commercial",
    park: "park",
    civic: "hospital",
    transit: "airport",
  };
  return mapping[apiType] || "commercial";
}

/**
 * Convert frontend polygon to GeoJSON geometry.
 */
function toGeoJsonGeometry(points: Point[]): Record<string, unknown> {
  // Close the polygon if not already closed
  const coords = points.map((p) => [p.x, p.y]);
  if (
    coords.length > 0 &&
    (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1])
  ) {
    coords.push([coords[0][0], coords[0][1]]);
  }
  return {
    type: "Polygon",
    coordinates: [coords],
  };
}

/**
 * Convert GeoJSON geometry to frontend polygon points.
 */
function fromGeoJsonGeometry(geometry: Record<string, unknown>): Point[] {
  if (geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) {
    return [];
  }
  const coords = geometry.coordinates[0] as number[][];
  if (!Array.isArray(coords)) return [];
  // Remove the closing point if present
  const points = coords.map((c) => ({ x: c[0], y: c[1] }));
  if (
    points.length > 1 &&
    points[0].x === points[points.length - 1].x &&
    points[0].y === points[points.length - 1].y
  ) {
    points.pop();
  }
  return points;
}

/**
 * Convert API district to frontend district.
 */
function fromApiDistrict(apiDistrict: ApiDistrict): District {
  return {
    id: apiDistrict.id,
    type: fromApiDistrictType(apiDistrict.type) as District["type"],
    name: apiDistrict.name || `${apiDistrict.type} district`,
    polygon: { points: fromGeoJsonGeometry(apiDistrict.geometry) },
    isHistoric: apiDistrict.historic,
  };
}

export function FeaturesProvider({
  children,
  worldId,
  initialFeatures = EMPTY_FEATURES,
  onFeaturesChange,
}: FeaturesProviderProps) {
  const [features, setFeaturesState] = useState<FeaturesData>(initialFeatures);
  const [isInitialized, setIsInitialized] = useState(!worldId);

  // Track pending operations for optimistic updates
  const pendingCreates = useRef<Set<string>>(new Set());

  // API hooks - only enabled when worldId is provided
  const {
    data: apiDistricts,
    isLoading: isLoadingDistricts,
    error: loadError,
  } = useWorldDistricts(worldId || "", {
    enabled: !!worldId,
  });

  const createDistrictMutation = useCreateDistrict();
  const deleteDistrictMutation = useDeleteDistrict();

  // Load districts from API when data is available
  useEffect(() => {
    if (worldId && apiDistricts) {
      const loadedDistricts = apiDistricts.map(fromApiDistrict);
      setFeaturesState((prev) => ({
        ...prev,
        districts: loadedDistricts,
      }));
      setIsInitialized(true);
    }
  }, [worldId, apiDistricts]);

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

      const tempId = generated.district.id;

      // Optimistically add to local state
      updateFeatures((prev) => ({
        ...prev,
        districts: [...prev.districts, generated.district],
        roads: [...prev.roads, ...generated.roads],
      }));

      // Persist to API if worldId is provided
      if (worldId) {
        pendingCreates.current.add(tempId);

        createDistrictMutation.mutate(
          {
            worldId,
            data: {
              type: toApiDistrictType(generated.district.type),
              name: generated.district.name,
              geometry: toGeoJsonGeometry(generated.district.polygon.points),
              historic: generated.district.isHistoric || false,
            },
          },
          {
            onSuccess: (apiDistrict) => {
              // Replace temp ID with real ID from API
              pendingCreates.current.delete(tempId);
              updateFeatures((prev) => ({
                ...prev,
                districts: prev.districts.map((d) =>
                  d.id === tempId ? { ...d, id: apiDistrict.id } : d
                ),
                // Also update road IDs that reference the district
                roads: prev.roads.map((r) =>
                  r.id.startsWith(tempId)
                    ? { ...r, id: r.id.replace(tempId, apiDistrict.id) }
                    : r
                ),
              }));
            },
            onError: (error) => {
              // Remove the optimistically added district on error
              pendingCreates.current.delete(tempId);
              updateFeatures((prev) => ({
                ...prev,
                districts: prev.districts.filter((d) => d.id !== tempId),
                roads: prev.roads.filter((r) => !r.id.startsWith(tempId)),
              }));
              console.error("Failed to save district:", error);
            },
          }
        );
      }

      return generated;
    },
    [worldId, features.districts, updateFeatures, createDistrictMutation]
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
      // Find the district first
      const districtToRemove = features.districts.find((d) => d.id === id);
      if (!districtToRemove) return;

      // Optimistically remove from local state
      updateFeatures((prev) => {
        const districtPrefix = id;
        return {
          ...prev,
          districts: prev.districts.filter((d) => d.id !== id),
          roads: prev.roads.filter((r) => !r.id.startsWith(districtPrefix)),
        };
      });

      // Delete from API if worldId is provided and not a pending create
      if (worldId && !pendingCreates.current.has(id)) {
        deleteDistrictMutation.mutate(
          { districtId: id, worldId },
          {
            onError: (error) => {
              // Re-add the district on error
              updateFeatures((prev) => ({
                ...prev,
                districts: [...prev.districts, districtToRemove],
              }));
              console.error("Failed to delete district:", error);
            },
          }
        );
      }
    },
    [worldId, features.districts, updateFeatures, deleteDistrictMutation]
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

  const isLoading = !isInitialized || (!!worldId && isLoadingDistricts);
  const error = loadError || null;

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
    isLoading,
    error,
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
