/**
 * Context for managing placement state across components.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { SeedType } from "./types";
import type { DistrictPersonality } from "../canvas/layers/types";
import { DEFAULT_DISTRICT_PERSONALITY } from "../canvas/layers/types";
import { generateRandomSeed } from "../build-view/SeedControl";

interface PlacementState {
  selectedSeed: SeedType | null;
  isPlacing: boolean;
  previewPosition: { x: number; y: number } | null;
  /** Personality settings to use when placing a district */
  placementPersonality: DistrictPersonality;
  /** Seed for deterministic procedural generation */
  placementSeed: number;
  /** Drag-to-size: center position where drag started */
  dragOrigin: { x: number; y: number } | null;
  /** Drag-to-size: current radius from drag distance */
  dragSize: number | null;
}

interface PlacementContextValue extends PlacementState {
  selectSeed: (seed: SeedType | null) => void;
  startPlacing: () => void;
  cancelPlacing: () => void;
  setPreviewPosition: (position: { x: number; y: number } | null) => void;
  confirmPlacement: (position: { x: number; y: number }, size?: number) => void;
  /** Update the personality settings for district placement */
  setPlacementPersonality: (personality: DistrictPersonality) => void;
  /** Update the seed for deterministic procedural generation */
  setPlacementSeed: (seed: number) => void;
  /** Generate a new random seed for placement */
  shufflePlacementSeed: () => void;
  /** Start drag-to-size: record the center position */
  startDragSize: (origin: { x: number; y: number }) => void;
  /** Update drag-to-size: set the current size from drag distance */
  updateDragSize: (size: number) => void;
  /** Cancel drag-to-size without placing */
  cancelDragSize: () => void;
  /** Whether a drag-to-size operation is in progress */
  isDraggingSize: boolean;
}

const PlacementContext = createContext<PlacementContextValue | null>(null);

interface PlacementProviderProps {
  children: ReactNode;
  onPlaceSeed?: (
    seed: SeedType,
    position: { x: number; y: number },
    personality?: DistrictPersonality,
    generationSeed?: number,
    fixedSize?: number
  ) => void;
}

export function PlacementProvider({ children, onPlaceSeed }: PlacementProviderProps) {
  const [state, setState] = useState<PlacementState>({
    selectedSeed: null,
    isPlacing: false,
    previewPosition: null,
    placementPersonality: DEFAULT_DISTRICT_PERSONALITY,
    placementSeed: generateRandomSeed(),
    dragOrigin: null,
    dragSize: null,
  });

  const selectSeed = useCallback((seed: SeedType | null) => {
    setState((prev) => ({
      ...prev,
      selectedSeed: seed,
      isPlacing: seed !== null,
      previewPosition: null,
      // Reset personality to defaults and generate new seed when selecting a new seed type
      placementPersonality: DEFAULT_DISTRICT_PERSONALITY,
      placementSeed: generateRandomSeed(),
      dragOrigin: null,
      dragSize: null,
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
      placementSeed: generateRandomSeed(),
      dragOrigin: null,
      dragSize: null,
    });
  }, []);

  const setPlacementPersonality = useCallback((personality: DistrictPersonality) => {
    setState((prev) => ({
      ...prev,
      placementPersonality: personality,
    }));
  }, []);

  const setPlacementSeed = useCallback((seed: number) => {
    setState((prev) => ({
      ...prev,
      placementSeed: seed,
    }));
  }, []);

  const shufflePlacementSeed = useCallback(() => {
    setState((prev) => ({
      ...prev,
      placementSeed: generateRandomSeed(),
    }));
  }, []);

  const setPreviewPosition = useCallback((position: { x: number; y: number } | null) => {
    setState((prev) => ({
      ...prev,
      previewPosition: position,
    }));
  }, []);

  const startDragSize = useCallback((origin: { x: number; y: number }) => {
    setState((prev) => ({
      ...prev,
      dragOrigin: origin,
      dragSize: null,
      previewPosition: origin,
    }));
  }, []);

  const updateDragSize = useCallback((size: number) => {
    setState((prev) => ({
      ...prev,
      dragSize: size,
    }));
  }, []);

  const cancelDragSize = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dragOrigin: null,
      dragSize: null,
    }));
  }, []);

  const isDraggingSize = state.dragOrigin !== null;

  const confirmPlacement = useCallback(
    (position: { x: number; y: number }, size?: number) => {
      if (state.selectedSeed && onPlaceSeed) {
        // Pass personality, seed, and optional size for district seeds
        if (state.selectedSeed.category === "district") {
          onPlaceSeed(state.selectedSeed, position, state.placementPersonality, state.placementSeed, size);
        } else {
          onPlaceSeed(state.selectedSeed, position);
        }
      }
      // Stay in placement mode with same seed selected for quick consecutive placements
      // Generate a new seed for the next placement so they're not all identical
      setState((prev) => ({
        ...prev,
        previewPosition: null,
        placementSeed: generateRandomSeed(),
        dragOrigin: null,
        dragSize: null,
      }));
    },
    [state.selectedSeed, state.placementPersonality, state.placementSeed, onPlaceSeed]
  );

  const value: PlacementContextValue = {
    ...state,
    selectSeed,
    startPlacing,
    cancelPlacing,
    setPreviewPosition,
    confirmPlacement,
    setPlacementPersonality,
    setPlacementSeed,
    shufflePlacementSeed,
    startDragSize,
    updateDragSize,
    cancelDragSize,
    isDraggingSize,
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
