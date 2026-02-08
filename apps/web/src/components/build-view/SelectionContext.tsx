/**
 * Context for managing feature selection state across components.
 *
 * Tracks the currently selected feature (district, road, or POI) and provides
 * methods to select, update, delete, and clear the selection.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type {
  SelectedFeature,
  SelectedDistrict,
  SelectedRoad,
  SelectedPOI,
  SelectedNeighborhood,
  SelectedRailStation,
  SelectedSubwayStation,
} from "./InspectorPanel";

interface SelectionContextValue {
  /** The currently selected feature, or null if nothing is selected */
  selection: SelectedFeature;
  /** Select a feature (district, road, or POI) */
  selectFeature: (feature: SelectedFeature) => void;
  /** Clear the current selection */
  clearSelection: () => void;
  /** Update the current selection with new properties */
  updateSelection: (feature: SelectedFeature) => void;
  /** Delete the currently selected feature */
  deleteSelection: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

interface SelectionProviderProps {
  children: ReactNode;
  /** Callback when a feature is selected */
  onSelect?: (feature: SelectedFeature) => void;
  /** Callback when a feature is updated (properties changed) */
  onUpdate?: (feature: SelectedFeature) => void;
  /** Callback when a feature is deleted */
  onDelete?: (feature: SelectedFeature) => void;
}

export function SelectionProvider({
  children,
  onSelect,
  onUpdate,
  onDelete,
}: SelectionProviderProps) {
  const [selection, setSelection] = useState<SelectedFeature>(null);

  const selectFeature = useCallback(
    (feature: SelectedFeature) => {
      setSelection(feature);
      onSelect?.(feature);
    },
    [onSelect]
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
    onSelect?.(null);
  }, [onSelect]);

  const updateSelection = useCallback(
    (feature: SelectedFeature) => {
      setSelection(feature);
      onUpdate?.(feature);
    },
    [onUpdate]
  );

  const deleteSelection = useCallback(() => {
    if (selection) {
      onDelete?.(selection);
      setSelection(null);
    }
  }, [selection, onDelete]);

  const value: SelectionContextValue = useMemo(
    () => ({
      selection,
      selectFeature,
      clearSelection,
      updateSelection,
      deleteSelection,
    }),
    [selection, selectFeature, clearSelection, updateSelection, deleteSelection]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

/**
 * Hook to access selection functionality.
 * Throws if not within a SelectionProvider.
 */
export function useSelectionContext(): SelectionContextValue {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error(
      "useSelectionContext must be used within a SelectionProvider"
    );
  }
  return context;
}

/**
 * Hook to optionally access selection functionality.
 * Returns null if not within a SelectionProvider (safe to use anywhere).
 */
export function useSelectionContextOptional(): SelectionContextValue | null {
  return useContext(SelectionContext);
}

// Re-export types for convenience
export type {
  SelectedFeature,
  SelectedDistrict,
  SelectedRoad,
  SelectedPOI,
  SelectedNeighborhood,
  SelectedRailStation,
  SelectedSubwayStation,
};
