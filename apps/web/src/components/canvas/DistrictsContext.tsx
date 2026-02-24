/**
 * Granular context for district-related state and operations.
 *
 * Components that only need district data should use `useDistricts()` instead
 * of `useFeatures()` to avoid re-renders when roads, POIs, or neighborhoods change.
 *
 * This context is provided by FeaturesProvider — it shares the same underlying
 * state but exposes only district-related slices and methods.
 */

import { createContext, useContext } from "react";
import type { District, CityLimits } from "./layers";
import type { City } from "../../api/types";
import type { AddDistrictResult, AddDistrictConfig } from "./FeaturesContext";
import type { ClipResult } from "./layers/polygonUtils";

/** Read-only district state. */
export interface DistrictsStateValue {
  /** All districts in the current world */
  districts: District[];
  /** City limits boundary (only one per world) */
  cityLimits: CityLimits | undefined;
  /** Cities in this world */
  cities: City[];
  /** Whether district data is still loading */
  isLoading: boolean;
}

/** District mutation methods. */
export interface DistrictsDispatchValue {
  /** Add a district at a position (generates geometry automatically). Async: heavy computation runs in a Web Worker. */
  addDistrict: (
    position: { x: number; y: number },
    seedId: string,
    config?: AddDistrictConfig
  ) => Promise<AddDistrictResult>;
  /** Preview district placement to check for water clipping */
  previewDistrictPlacement: (
    position: { x: number; y: number },
    seedId: string,
    config?: AddDistrictConfig
  ) => ClipResult | null;
  /** Add a district with explicit geometry */
  addDistrictWithGeometry: (district: District, roads?: import("./layers").Road[]) => void;
  /** Remove a district by ID */
  removeDistrict: (id: string) => void;
  /** Update a district. Async: some updates (type, gridAngle) run in a Web Worker. */
  updateDistrict: (id: string, updates: Partial<Omit<District, "id">>) => Promise<void>;
  /** Set the city limits boundary */
  setCityLimits: (cityLimits: CityLimits) => void;
  /** Remove the city limits boundary */
  removeCityLimits: () => void;
  /** Regenerate street grids for multiple districts with a shared angle. Async: runs in Web Worker. */
  regenerateDistrictGrids: (districtIds: string[], gridAngle: number) => Promise<void>;
}

/** Combined districts context value. */
export interface DistrictsContextValue extends DistrictsStateValue, DistrictsDispatchValue {}

export const DistrictsStateContext = createContext<DistrictsStateValue | null>(null);
export const DistrictsDispatchContext = createContext<DistrictsDispatchValue | null>(null);

/**
 * Hook to access read-only district state.
 * Components using this will NOT re-render when roads, POIs, or neighborhoods change.
 */
export function useDistrictsState(): DistrictsStateValue {
  const context = useContext(DistrictsStateContext);
  if (!context) {
    throw new Error("useDistrictsState must be used within a FeaturesProvider");
  }
  return context;
}

/** Optionally access read-only district state. */
export function useDistrictsStateOptional(): DistrictsStateValue | null {
  return useContext(DistrictsStateContext);
}

/**
 * Hook to access district mutation methods.
 * Components using this will NOT re-render when district data changes.
 */
export function useDistrictsDispatch(): DistrictsDispatchValue {
  const context = useContext(DistrictsDispatchContext);
  if (!context) {
    throw new Error("useDistrictsDispatch must be used within a FeaturesProvider");
  }
  return context;
}

/** Optionally access district mutation methods. */
export function useDistrictsDispatchOptional(): DistrictsDispatchValue | null {
  return useContext(DistrictsDispatchContext);
}

/**
 * Convenience hook combining district state and dispatch.
 * Prefer useDistrictsState() or useDistrictsDispatch() for better render performance.
 */
export function useDistricts(): DistrictsContextValue {
  const state = useDistrictsState();
  const dispatch = useDistrictsDispatch();
  return { ...state, ...dispatch };
}

/** Optionally access combined district state and dispatch. */
export function useDistrictsOptional(): DistrictsContextValue | null {
  const state = useContext(DistrictsStateContext);
  const dispatch = useContext(DistrictsDispatchContext);
  if (!state || !dispatch) return null;
  return { ...state, ...dispatch };
}
