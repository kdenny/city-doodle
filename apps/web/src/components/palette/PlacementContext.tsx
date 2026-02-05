/**
 * Context for managing placement state across components.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { SeedType } from "./types";
import type { DistrictPersonality } from "../canvas/layers/types";
import { DEFAULT_DISTRICT_PERSONALITY } from "../canvas/layers/types";

interface PlacementState {
  selectedSeed: SeedType | null;
  isPlacing: boolean;
  previewPosition: { x: number; y: number } | null;
  /** Personality settings to use when placing a district */
  placementPersonality: DistrictPersonality;
}

interface PlacementContextValue extends PlacementState {
  selectSeed: (seed: SeedType | null) => void;
  startPlacing: () => void;
  cancelPlacing: () => void;
  setPreviewPosition: (position: { x: number; y: number } | null) => void;
  confirmPlacement: (position: { x: number; y: number }) => void;
  /** Update the personality settings for district placement */
  setPlacementPersonality: (personality: DistrictPersonality) => void;
}

const PlacementContext = createContext<PlacementContextValue | null>(null);

interface PlacementProviderProps {
  children: ReactNode;
  onPlaceSeed?: (
    seed: SeedType,
    position: { x: number; y: number },
    personality?: DistrictPersonality
  ) => void;
}

export function PlacementProvider({ children, onPlaceSeed }: PlacementProviderProps) {
  const [state, setState] = useState<PlacementState>({
    selectedSeed: null,
    isPlacing: false,
    previewPosition: null,
    placementPersonality: DEFAULT_DISTRICT_PERSONALITY,
  });

  const selectSeed = useCallback((seed: SeedType | null) => {
    setState((prev) => ({
      ...prev,
      selectedSeed: seed,
      isPlacing: seed !== null,
      previewPosition: null,
      // Reset personality to defaults when selecting a new seed
      placementPersonality: DEFAULT_DISTRICT_PERSONALITY,
    }));
  }, []);

  const startPlacing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPlacing: prev.selectedSeed !== null,
    }));
  }, []);

  const cancelPlacing = useCallback(() => {
    setState({
      selectedSeed: null,
      isPlacing: false,
      previewPosition: null,
      placementPersonality: DEFAULT_DISTRICT_PERSONALITY,
    });
  }, []);

  const setPlacementPersonality = useCallback((personality: DistrictPersonality) => {
    setState((prev) => ({
      ...prev,
      placementPersonality: personality,
    }));
  }, []);

  const setPreviewPosition = useCallback((position: { x: number; y: number } | null) => {
    setState((prev) => ({
      ...prev,
      previewPosition: position,
    }));
  }, []);

  const confirmPlacement = useCallback(
    (position: { x: number; y: number }) => {
      if (state.selectedSeed && onPlaceSeed) {
        // Pass personality for district seeds
        if (state.selectedSeed.category === "district") {
          onPlaceSeed(state.selectedSeed, position, state.placementPersonality);
        } else {
          onPlaceSeed(state.selectedSeed, position);
        }
      }
      // Stay in placement mode with same seed selected for quick consecutive placements
      setState((prev) => ({
        ...prev,
        previewPosition: null,
      }));
    },
    [state.selectedSeed, state.placementPersonality, onPlaceSeed]
  );

  const value: PlacementContextValue = {
    ...state,
    selectSeed,
    startPlacing,
    cancelPlacing,
    setPreviewPosition,
    confirmPlacement,
    setPlacementPersonality,
  };

  return (
    <PlacementContext.Provider value={value}>
      {children}
    </PlacementContext.Provider>
  );
}

export function usePlacement() {
  const context = useContext(PlacementContext);
  if (!context) {
    throw new Error("usePlacement must be used within a PlacementProvider");
  }
  return context;
}

export function usePlacementOptional(): PlacementContextValue | null {
  return useContext(PlacementContext);
}
