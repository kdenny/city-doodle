/**
 * Context for managing polygon drawing state.
 *
 * Provides state and methods for click-to-place vertex polygon drawing
 * and freehand drawing mode.
 * Used by the "draw" tool to create neighborhoods and city limits.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { Point } from "./layers";
import { simplifyPath, shouldSamplePoint } from "./pathSimplification";

export type DrawingMode = "neighborhood" | "cityLimits" | "split" | "road" | null;

/** Input mode for drawing: click-to-place or freehand */
export type DrawingInputMode = "click" | "freehand";

interface DrawingState {
  /** Current drawing mode */
  mode: DrawingMode;
  /** Input mode: click-to-place or freehand */
  inputMode: DrawingInputMode;
  /** Vertices placed so far */
  vertices: Point[];
  /** Whether we're in the middle of drawing */
  isDrawing: boolean;
  /** Preview point (mouse position for next potential vertex) */
  previewPoint: Point | null;
  /** Whether freehand drawing is actively happening (mouse held down) */
  isFreehandActive: boolean;
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
  /** Toggle between click and freehand input modes */
  setInputMode: (mode: DrawingInputMode) => void;
  /** Start freehand drawing (mouse down) */
  startFreehand: (point: Point) => void;
  /** Add a point during freehand drawing (mouse move while held) */
  addFreehandPoint: (point: Point) => void;
  /** End freehand drawing and simplify path (mouse up) */
  endFreehand: () => Point[] | null;
}

const INITIAL_STATE: DrawingState = {
  mode: null,
  inputMode: "click",
  vertices: [],
  isDrawing: false,
  previewPoint: null,
  isFreehandActive: false,
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
    setState((prev) => ({
      mode,
      inputMode: prev.inputMode,
      vertices: [],
      isDrawing: true,
      previewPoint: null,
      isFreehandActive: false,
    }));
  }, []);

  const setInputMode = useCallback((inputMode: DrawingInputMode) => {
    setState((prev) => ({
      ...prev,
      inputMode,
    }));
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
    // Split and road modes only need 2 vertices (a line/polyline)
    if (state.mode === "split" || state.mode === "road") {
      return state.vertices.length >= 2;
    }
    // Other modes need at least 3 vertices for a valid polygon
    return state.vertices.length >= 3;
  }, [state.vertices.length, state.mode]);

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

  const startFreehand = useCallback((point: Point) => {
    setState((prev) => {
      if (!prev.isDrawing) return prev;
      return {
        ...prev,
        vertices: [point],
        isFreehandActive: true,
      };
    });
  }, []);

  const addFreehandPoint = useCallback((point: Point) => {
    setState((prev) => {
      if (!prev.isDrawing || !prev.isFreehandActive) return prev;
      // Only sample if point is far enough from last point
      const lastPoint = prev.vertices[prev.vertices.length - 1] || null;
      if (!shouldSamplePoint(lastPoint, point)) return prev;
      return {
        ...prev,
        vertices: [...prev.vertices, point],
      };
    });
  }, []);

  const endFreehand = useCallback(() => {
    if (!state.isFreehandActive || state.vertices.length < 3) {
      // Cancel if not enough points
      setState(INITIAL_STATE);
      return null;
    }

    // Simplify the path
    const simplifiedVertices = simplifyPath(state.vertices);
    const completedMode = state.mode;

    // Reset state
    setState(INITIAL_STATE);

    // Notify callback
    if (onPolygonComplete && completedMode) {
      onPolygonComplete(simplifiedVertices, completedMode);
    }

    return simplifiedVertices;
  }, [state.isFreehandActive, state.vertices, state.mode, onPolygonComplete]);

  const value: DrawingContextValue = {
    state,
    startDrawing,
    addVertex,
    setPreviewPoint,
    completeDrawing,
    cancelDrawing,
    undoLastVertex,
    canComplete,
    setInputMode,
    startFreehand,
    addFreehandPoint,
    endFreehand,
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
