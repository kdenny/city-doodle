/**
 * Granular context for road-related state and operations.
 *
 * Components that only need road data should use `useRoads()` instead
 * of `useFeatures()` to avoid re-renders when districts, POIs, or neighborhoods change.
 *
 * This context is provided by FeaturesProvider — it shares the same underlying
 * state but exposes only road-related slices and methods.
 */

import { createContext, useContext } from "react";
import type { Road, Bridge, Interchange } from "./layers";

/** Read-only road state. */
export interface RoadsStateValue {
  /** All roads in the current world */
  roads: Road[];
  /** Bridges where roads cross water (auto-generated) */
  bridges: Bridge[];
  /** Highway interchanges (auto-generated) */
  interchanges: Interchange[];
  /** Whether road data is still loading */
  isLoading: boolean;
}

/** Road mutation methods. */
export interface RoadsDispatchValue {
  /** Append roads to local state (does not persist — caller handles API sync). */
  addRoads: (roads: Road[]) => void;
  /** Add interchanges (auto-detected at highway-road crossings) */
  addInterchanges: (interchanges: Interchange[]) => void;
  /** Optimistically remove a road by ID. Persists deletion to API and rolls back on failure. */
  removeRoad: (id: string) => void;
  /** Optimistically update a road's properties. Persists to API and rolls back on failure. */
  updateRoad: (id: string, updates: Partial<Omit<Road, "id">>) => void;
}

/** Combined roads context value. */
export interface RoadsContextValue extends RoadsStateValue, RoadsDispatchValue {}

export const RoadsStateContext = createContext<RoadsStateValue | null>(null);
export const RoadsDispatchContext = createContext<RoadsDispatchValue | null>(null);

/**
 * Hook to access read-only road state.
 * Components using this will NOT re-render when districts, POIs, or neighborhoods change.
 */
export function useRoadsState(): RoadsStateValue {
  const context = useContext(RoadsStateContext);
  if (!context) {
    throw new Error("useRoadsState must be used within a FeaturesProvider");
  }
  return context;
}

/** Optionally access read-only road state. */
export function useRoadsStateOptional(): RoadsStateValue | null {
  return useContext(RoadsStateContext);
}

/**
 * Hook to access road mutation methods.
 * Components using this will NOT re-render when road data changes.
 */
export function useRoadsDispatch(): RoadsDispatchValue {
  const context = useContext(RoadsDispatchContext);
  if (!context) {
    throw new Error("useRoadsDispatch must be used within a FeaturesProvider");
  }
  return context;
}

/** Optionally access road mutation methods. */
export function useRoadsDispatchOptional(): RoadsDispatchValue | null {
  return useContext(RoadsDispatchContext);
}

/**
 * Convenience hook combining road state and dispatch.
 * Prefer useRoadsState() or useRoadsDispatch() for better render performance.
 */
export function useRoads(): RoadsContextValue {
  const state = useRoadsState();
  const dispatch = useRoadsDispatch();
  return { ...state, ...dispatch };
}

/** Optionally access combined road state and dispatch. */
export function useRoadsOptional(): RoadsContextValue | null {
  const state = useContext(RoadsStateContext);
  const dispatch = useContext(RoadsDispatchContext);
  if (!state || !dispatch) return null;
  return { ...state, ...dispatch };
}
