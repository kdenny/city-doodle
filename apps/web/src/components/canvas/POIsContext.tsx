/**
 * Granular context for POI-related state and operations.
 *
 * Components that only need POI data should use `usePOIs()` instead
 * of `useFeatures()` to avoid re-renders when districts, roads, or neighborhoods change.
 *
 * This context is provided by FeaturesProvider — it shares the same underlying
 * state but exposes only POI-related slices and methods.
 */

import { createContext, useContext } from "react";
import type { POI } from "./layers";

/** Read-only POI state. */
export interface POIsStateValue {
  /** All POIs in the current world */
  pois: POI[];
  /** Whether POI data is still loading */
  isLoading: boolean;
}

/** POI mutation methods. */
export interface POIsDispatchValue {
  /** Add a POI */
  addPOI: (poi: POI) => void;
  /** Remove a POI by ID */
  removePOI: (id: string) => void;
  /** Update a POI */
  updatePOI: (id: string, updates: Partial<Omit<POI, "id">>) => void;
}

/** Combined POIs context value. */
export interface POIsContextValue extends POIsStateValue, POIsDispatchValue {}

export const POIsStateContext = createContext<POIsStateValue | null>(null);
export const POIsDispatchContext = createContext<POIsDispatchValue | null>(null);

/**
 * Hook to access read-only POI state.
 * Components using this will NOT re-render when districts, roads, or neighborhoods change.
 */
export function usePOIsState(): POIsStateValue {
  const context = useContext(POIsStateContext);
  if (!context) {
    throw new Error("usePOIsState must be used within a FeaturesProvider");
  }
  return context;
}

/** Optionally access read-only POI state. */
export function usePOIsStateOptional(): POIsStateValue | null {
  return useContext(POIsStateContext);
}

/**
 * Hook to access POI mutation methods.
 * Components using this will NOT re-render when POI data changes.
 */
export function usePOIsDispatch(): POIsDispatchValue {
  const context = useContext(POIsDispatchContext);
  if (!context) {
    throw new Error("usePOIsDispatch must be used within a FeaturesProvider");
  }
  return context;
}

/** Optionally access POI mutation methods. */
export function usePOIsDispatchOptional(): POIsDispatchValue | null {
  return useContext(POIsDispatchContext);
}

/**
 * Convenience hook combining POI state and dispatch.
 * Prefer usePOIsState() or usePOIsDispatch() for better render performance.
 */
export function usePOIs(): POIsContextValue {
  const state = usePOIsState();
  const dispatch = usePOIsDispatch();
  return { ...state, ...dispatch };
}

/** Optionally access combined POI state and dispatch. */
export function usePOIsOptional(): POIsContextValue | null {
  const state = useContext(POIsStateContext);
  const dispatch = useContext(POIsDispatchContext);
  if (!state || !dispatch) return null;
  return { ...state, ...dispatch };
}
