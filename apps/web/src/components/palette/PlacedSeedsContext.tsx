/**
 * Context for managing placed seeds on the canvas.
 *
 * Stores seeds that have been placed by the user and provides
 * methods to add, remove, and update them.
 *
 * When a worldId is provided, seeds are persisted to the backend API.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import type { SeedType } from "./types";
import { SEED_TYPES } from "./types";
import { useWorldSeeds, useCreateSeed, useDeleteSeed } from "../../api/hooks";
import type { PlacedSeed as ApiPlacedSeed } from "../../api/types";
import { generateId } from "../../utils/idGenerator";

/**
 * A seed that has been placed on the canvas.
 */
export interface PlacedSeed {
  id: string;
  seed: SeedType;
  position: { x: number; y: number };
  placedAt: number; // timestamp
  /** Optional metadata for park-specific configuration */
  metadata?: Record<string, unknown>;
}

interface PlacedSeedsContextValue {
  seeds: PlacedSeed[];
  addSeed: (
    seed: SeedType,
    position: { x: number; y: number },
    metadata?: Record<string, unknown>
  ) => PlacedSeed;
  removeSeed: (id: string) => void;
  updateSeedPosition: (id: string, position: { x: number; y: number }) => void;
  clearSeeds: () => void;
  isLoading: boolean;
  error: Error | null;
}

const PlacedSeedsContext = createContext<PlacedSeedsContextValue | null>(null);

interface PlacedSeedsProviderProps {
  children: ReactNode;
  /** World ID for persisting seeds to the backend. If not provided, seeds are only stored in memory. */
  worldId?: string;
  /** Optional callback when a seed is added */
  onSeedAdded?: (seed: PlacedSeed) => void;
  /** Optional callback when a seed is removed */
  onSeedRemoved?: (id: string) => void;
}


/**
 * Convert an API PlacedSeed to our internal PlacedSeed format.
 */
function fromApiSeed(apiSeed: ApiPlacedSeed): PlacedSeed | null {
  const seedType = SEED_TYPES.find((s) => s.id === apiSeed.seed_type_id);
  if (!seedType) {
    console.warn(`Unknown seed type: ${apiSeed.seed_type_id}`);
    return null;
  }
  return {
    id: apiSeed.id,
    seed: seedType,
    position: { x: apiSeed.position.x, y: apiSeed.position.y },
    placedAt: new Date(apiSeed.placed_at).getTime(),
    metadata: apiSeed.metadata,
  };
}

export function PlacedSeedsProvider({
  children,
  worldId,
  onSeedAdded,
  onSeedRemoved,
}: PlacedSeedsProviderProps) {
  const [seeds, setSeeds] = useState<PlacedSeed[]>([]);
  const [isInitialized, setIsInitialized] = useState(!worldId);

  // Track pending operations for optimistic updates
  const pendingCreates = useRef<Set<string>>(new Set());

  // API hooks - only enabled when worldId is provided
  const {
    data: apiSeeds,
    isLoading: isLoadingSeeds,
    error: loadError,
  } = useWorldSeeds(worldId || "", {
    enabled: !!worldId,
  });

  const createSeedMutation = useCreateSeed();
  const deleteSeedMutation = useDeleteSeed();

  // Sync seeds from API when data is loaded
  useEffect(() => {
    if (worldId && apiSeeds) {
      const convertedSeeds = apiSeeds
        .map(fromApiSeed)
        .filter((s): s is PlacedSeed => s !== null);
      setSeeds(convertedSeeds);
      setIsInitialized(true);
    }
  }, [worldId, apiSeeds]);

  const addSeed = useCallback(
    (
      seedType: SeedType,
      position: { x: number; y: number },
      metadata?: Record<string, unknown>
    ): PlacedSeed => {
      const tempId = generateId("seed");
      const newSeed: PlacedSeed = {
        id: tempId,
        seed: seedType,
        position,
        placedAt: Date.now(),
        metadata,
      };

      // Optimistically add the seed to local state
      setSeeds((prev) => [...prev, newSeed]);
      onSeedAdded?.(newSeed);

      // Persist to API if worldId is provided
      if (worldId) {
        pendingCreates.current.add(tempId);

        createSeedMutation.mutate(
          {
            worldId,
            data: {
              seed_type_id: seedType.id,
              position: { x: position.x, y: position.y },
              metadata,
            },
          },
          {
            onSuccess: (apiSeed) => {
              // Replace temp ID with real ID from API
              pendingCreates.current.delete(tempId);
              setSeeds((prev) =>
                prev.map((s) =>
                  s.id === tempId
                    ? {
                        ...s,
                        id: apiSeed.id,
                        placedAt: new Date(apiSeed.placed_at).getTime(),
                      }
                    : s
                )
              );
            },
            onError: (error) => {
              // Remove the optimistically added seed on error
              pendingCreates.current.delete(tempId);
              setSeeds((prev) => prev.filter((s) => s.id !== tempId));
              console.error("Failed to save seed:", error);
            },
          }
        );
      }

      return newSeed;
    },
    [worldId, onSeedAdded, createSeedMutation]
  );

  const removeSeed = useCallback(
    (id: string) => {
      // Find the seed first to verify it exists
      const seedToRemove = seeds.find((s) => s.id === id);
      if (!seedToRemove) return;

      // Optimistically remove from local state
      setSeeds((prev) => prev.filter((s) => s.id !== id));
      onSeedRemoved?.(id);

      // Delete from API if worldId is provided and it's not a pending create
      if (worldId && !pendingCreates.current.has(id)) {
        deleteSeedMutation.mutate(
          { seedId: id, worldId },
          {
            onError: (error) => {
              // Re-add the seed on error
              setSeeds((prev) => [...prev, seedToRemove]);
              console.error("Failed to delete seed:", error);
            },
          }
        );
      }
    },
    [worldId, seeds, onSeedRemoved, deleteSeedMutation]
  );

  const updateSeedPosition = useCallback(
    (id: string, position: { x: number; y: number }) => {
      setSeeds((prev) =>
        prev.map((s) => (s.id === id ? { ...s, position } : s))
      );
      // Note: Position updates are not persisted to the backend in this implementation.
      // If position persistence is needed, add an updateSeed API endpoint.
    },
    []
  );

  const clearSeeds = useCallback(() => {
    setSeeds([]);
    // Note: This only clears local state. If you need to clear seeds on the server,
    // call the deleteAll API endpoint separately.
  }, []);

  const isLoading = !isInitialized || (!!worldId && isLoadingSeeds);
  const error = loadError || null;

  const value: PlacedSeedsContextValue = useMemo(
    () => ({
      seeds,
      addSeed,
      removeSeed,
      updateSeedPosition,
      clearSeeds,
      isLoading,
      error,
    }),
    [seeds, addSeed, removeSeed, updateSeedPosition, clearSeeds, isLoading, error]
  );

  return (
    <PlacedSeedsContext.Provider value={value}>
      {children}
    </PlacedSeedsContext.Provider>
  );
}

export function usePlacedSeeds(): PlacedSeedsContextValue {
  const context = useContext(PlacedSeedsContext);
  if (!context) {
    throw new Error("usePlacedSeeds must be used within a PlacedSeedsProvider");
  }
  return context;
}

export function usePlacedSeedsOptional(): PlacedSeedsContextValue | null {
  return useContext(PlacedSeedsContext);
}
