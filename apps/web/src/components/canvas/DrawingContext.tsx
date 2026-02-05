/**
 * Context for managing polygon drawing state.
 *
 * Provides state and methods for click-to-place vertex polygon drawing.
 * Used by the "draw" tool to create neighborhoods.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { Point } from "./layers";

export type DrawingMode = "neighborhood" | "cityLimits" | "split" | null;

interface DrawingState {
  /** Current drawing mode */
  mode: DrawingMode;
  /** Vertices placed so far */
  vertices: Point[];
  /** Whether we're in the middle of drawing */
  isDrawing: boolean;
  /** Preview point (mouse position for next potential vertex) */
  previewPoint: Point | null;
}

interface DrawingContextValue {
  /** Current drawing state */
  state: DrawingState;
  /** Start drawing in the given mode */
  startDrawing: (mode: DrawingMode) => void;
  /** Add a vertex at the given position */
  addVertex: (point: Point) => void;
  /** Update the preview point (mouse position) */
  setPreviewPoint: (point: Point | null) => void;
  /** Complete the drawing (close the polygon) */
  completeDrawing: () => Point[] | null;
  /** Cancel the current drawing */
  cancelDrawing: () => void;
  /** Undo the last vertex */
  undoLastVertex: () => void;
  /** Check if the drawing can be completed (has enough vertices) */
  canComplete: () => boolean;
}

const INITIAL_STATE: DrawingState = {
  mode: null,
  vertices: [],
  isDrawing: false,
  previewPoint: null,
};

const DrawingContext = createContext<DrawingContextValue | null>(null);

interface DrawingProviderProps {
  children: ReactNode;
  /** Callback when a polygon is completed */
  onPolygonComplete?: (points: Point[], mode: DrawingMode) => void;
}

export function DrawingProvider({ children, onPolygonComplete }: DrawingProviderProps) {
  const [state, setState] = useState<DrawingState>(INITIAL_STATE);

  const startDrawing = useCallback((mode: DrawingMode) => {
    setState({
      mode,
      vertices: [],
      isDrawing: true,
      previewPoint: null,
    });
  }, []);

  const addVertex = useCallback((point: Point) => {
    setState((prev) => {
      if (!prev.isDrawing) return prev;
      return {
        ...prev,
        vertices: [...prev.vertices, point],
      };
    });
  }, []);

  const setPreviewPoint = useCallback((point: Point | null) => {
    setState((prev) => ({
      ...prev,
      previewPoint: point,
    }));
  }, []);

  const canComplete = useCallback(() => {
    // Need at least 3 vertices for a valid polygon
    return state.vertices.length >= 3;
  }, [state.vertices.length]);

  const completeDrawing = useCallback(() => {
    if (!canComplete()) return null;

    const completedPolygon = [...state.vertices];
    const completedMode = state.mode;

    // Reset state
    setState(INITIAL_STATE);

    // Notify callback
    if (onPolygonComplete && completedMode) {
      onPolygonComplete(completedPolygon, completedMode);
    }

    return completedPolygon;
  }, [state.vertices, state.mode, canComplete, onPolygonComplete]);

  const cancelDrawing = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const undoLastVertex = useCallback(() => {
    setState((prev) => {
      if (!prev.isDrawing || prev.vertices.length === 0) return prev;
      return {
        ...prev,
        vertices: prev.vertices.slice(0, -1),
      };
    });
  }, []);

  const value: DrawingContextValue = {
    state,
    startDrawing,
    addVertex,
    setPreviewPoint,
    completeDrawing,
    cancelDrawing,
    undoLastVertex,
    canComplete,
  };

  return (
    <DrawingContext.Provider value={value}>
      {children}
    </DrawingContext.Provider>
  );
}

/**
 * Hook to access drawing context.
 * Throws if not within a DrawingProvider.
 */
export function useDrawing(): DrawingContextValue {
  const context = useContext(DrawingContext);
  if (!context) {
    throw new Error("useDrawing must be used within a DrawingProvider");
  }
  return context;
}

/**
 * Hook to optionally access drawing context.
 * Returns null if not within a DrawingProvider.
 */
export function useDrawingOptional(): DrawingContextValue | null {
  return useContext(DrawingContext);
}
