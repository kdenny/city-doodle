/**
 * Context for managing placement state across components.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { SeedType } from "./types";

interface PlacementState {
  selectedSeed: SeedType | null;
  isPlacing: boolean;
  previewPosition: { x: number; y: number } | null;
}

interface PlacementContextValue extends PlacementState {
  selectSeed: (seed: SeedType | null) => void;
  startPlacing: () => void;
  cancelPlacing: () => void;
  setPreviewPosition: (position: { x: number; y: number } | null) => void;
  confirmPlacement: (position: { x: number; y: number }) => void;
}

const PlacementContext = createContext<PlacementContextValue | null>(null);

interface PlacementProviderProps {
  children: ReactNode;
  onPlaceSeed?: (seed: SeedType, position: { x: number; y: number }) => void;
}

export function PlacementProvider({ children, onPlaceSeed }: PlacementProviderProps) {
  const [state, setState] = useState<PlacementState>({
    selectedSeed: null,
    isPlacing: false,
    previewPosition: null,
  });

  const selectSeed = useCallback((seed: SeedType | null) => {
    setState((prev) => ({
      ...prev,
      selectedSeed: seed,
      isPlacing: seed !== null,
      previewPosition: null,
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
    });
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
        onPlaceSeed(state.selectedSeed, position);
      }
      // Stay in placement mode with same seed selected for quick consecutive placements
      setState((prev) => ({
        ...prev,
        previewPosition: null,
      }));
    },
    [state.selectedSeed, onPlaceSeed]
  );

  const value: PlacementContextValue = {
    ...state,
    selectSeed,
    startPlacing,
    cancelPlacing,
    setPreviewPosition,
    confirmPlacement,
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
