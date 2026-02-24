/**
 * Granular context for neighborhood-related state and operations.
 *
 * Components that only need neighborhood data should use `useNeighborhoods()` instead
 * of `useFeatures()` to avoid re-renders when districts, roads, or POIs change.
 *
 * This context is provided by FeaturesProvider — it shares the same underlying
 * state but exposes only neighborhood-related slices and methods.
 */

import { createContext, useContext } from "react";
import type { Neighborhood } from "./layers";

/** Read-only neighborhood state. */
export interface NeighborhoodsStateValue {
  /** All neighborhoods in the current world */
  neighborhoods: Neighborhood[];
  /** Whether neighborhood data is still loading */
  isLoading: boolean;
}

/** Neighborhood mutation methods. */
export interface NeighborhoodsDispatchValue {
  /** Add a neighborhood with explicit geometry */
  addNeighborhood: (neighborhood: Neighborhood) => void;
  /** Remove a neighborhood by ID */
  removeNeighborhood: (id: string) => void;
  /** Update a neighborhood */
  updateNeighborhood: (id: string, updates: Partial<Omit<Neighborhood, "id">>) => void;
}

/** Combined neighborhoods context value. */
export interface NeighborhoodsContextValue extends NeighborhoodsStateValue, NeighborhoodsDispatchValue {}

export const NeighborhoodsStateContext = createContext<NeighborhoodsStateValue | null>(null);
export const NeighborhoodsDispatchContext = createContext<NeighborhoodsDispatchValue | null>(null);

/**
 * Hook to access read-only neighborhood state.
 * Components using this will NOT re-render when districts, roads, or POIs change.
 */
export function useNeighborhoodsState(): NeighborhoodsStateValue {
  const context = useContext(NeighborhoodsStateContext);
  if (!context) {
    throw new Error("useNeighborhoodsState must be used within a FeaturesProvider");
  }
  return context;
}

/** Optionally access read-only neighborhood state. */
export function useNeighborhoodsStateOptional(): NeighborhoodsStateValue | null {
  return useContext(NeighborhoodsStateContext);
}

/**
 * Hook to access neighborhood mutation methods.
 * Components using this will NOT re-render when neighborhood data changes.
 */
export function useNeighborhoodsDispatch(): NeighborhoodsDispatchValue {
  const context = useContext(NeighborhoodsDispatchContext);
  if (!context) {
    throw new Error("useNeighborhoodsDispatch must be used within a FeaturesProvider");
  }
  return context;
}

/** Optionally access neighborhood mutation methods. */
export function useNeighborhoodsDispatchOptional(): NeighborhoodsDispatchValue | null {
  return useContext(NeighborhoodsDispatchContext);
}

/**
 * Convenience hook combining neighborhood state and dispatch.
 * Prefer useNeighborhoodsState() or useNeighborhoodsDispatch() for better render performance.
 */
export function useNeighborhoods(): NeighborhoodsContextValue {
  const state = useNeighborhoodsState();
  const dispatch = useNeighborhoodsDispatch();
  return { ...state, ...dispatch };
}

/** Optionally access combined neighborhood state and dispatch. */
export function useNeighborhoodsOptional(): NeighborhoodsContextValue | null {
  const state = useContext(NeighborhoodsStateContext);
  const dispatch = useContext(NeighborhoodsDispatchContext);
  if (!state || !dispatch) return null;
  return { ...state, ...dispatch };
}
