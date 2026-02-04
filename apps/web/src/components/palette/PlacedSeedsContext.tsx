/**
 * Context for managing placed seeds on the canvas.
 *
 * Stores seeds that have been placed by the user and provides
 * methods to add, remove, and update them.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { SeedType } from "./types";

/**
 * A seed that has been placed on the canvas.
 */
export interface PlacedSeed {
  id: string;
  seed: SeedType;
  position: { x: number; y: number };
  placedAt: number; // timestamp
}

interface PlacedSeedsContextValue {
  seeds: PlacedSeed[];
  addSeed: (seed: SeedType, position: { x: number; y: number }) => PlacedSeed;
  removeSeed: (id: string) => void;
  updateSeedPosition: (id: string, position: { x: number; y: number }) => void;
  clearSeeds: () => void;
}

const PlacedSeedsContext = createContext<PlacedSeedsContextValue | null>(null);

interface PlacedSeedsProviderProps {
  children: ReactNode;
  /** Optional callback when a seed is added */
  onSeedAdded?: (seed: PlacedSeed) => void;
  /** Optional callback when a seed is removed */
  onSeedRemoved?: (id: string) => void;
}

/**
 * Generate a unique ID for a placed seed.
 */
function generateSeedId(): string {
  return `seed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function PlacedSeedsProvider({
  children,
  onSeedAdded,
  onSeedRemoved,
}: PlacedSeedsProviderProps) {
  const [seeds, setSeeds] = useState<PlacedSeed[]>([]);

  const addSeed = useCallback(
    (seedType: SeedType, position: { x: number; y: number }): PlacedSeed => {
      const newSeed: PlacedSeed = {
        id: generateSeedId(),
        seed: seedType,
        position,
        placedAt: Date.now(),
      };

      setSeeds((prev) => [...prev, newSeed]);
      onSeedAdded?.(newSeed);

      return newSeed;
    },
    [onSeedAdded]
  );

  const removeSeed = useCallback(
    (id: string) => {
      setSeeds((prev) => prev.filter((s) => s.id !== id));
      onSeedRemoved?.(id);
    },
    [onSeedRemoved]
  );

  const updateSeedPosition = useCallback(
    (id: string, position: { x: number; y: number }) => {
      setSeeds((prev) =>
        prev.map((s) => (s.id === id ? { ...s, position } : s))
      );
    },
    []
  );

  const clearSeeds = useCallback(() => {
    setSeeds([]);
  }, []);

  const value: PlacedSeedsContextValue = {
    seeds,
    addSeed,
    removeSeed,
    updateSeedPosition,
    clearSeeds,
  };

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
