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
  useMemo,
  ReactNode,
} from "react";
import type { Point } from "./layers";
import type { RoadClass } from "./layers/types";
import { simplifyPath, shouldSamplePoint } from "./pathSimplification";

export type DrawingMode = "neighborhood" | "cityLimits" | "split" | "road" | null;

/** Input mode for drawing: click-to-place or freehand */
export type DrawingInputMode = "click" | "freehand";

/** Feature type that can be split */
export type SplitTargetType = "district" | "neighborhood";

/** Information about the feature selected for splitting */
export interface SplitTarget {
  /** Type of feature being split */
  type: SplitTargetType;
  /** ID of the feature being split */
  id: string;
  /** Name of the feature (for toast messages) */
  name: string;
}

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
  /** Selected road class for road drawing mode */
  roadClass: RoadClass;
  /** CITY-565: Feature selected for splitting (null = waiting for selection) */
  splitTarget: SplitTarget | null;
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
  /** Set the road class for road drawing mode */
  setRoadClass: (roadClass: RoadClass) => void;
  /** CITY-565: Set the split target feature */
  setSplitTarget: (target: SplitTarget) => void;
}

const INITIAL_STATE: DrawingState = {
  mode: null,
  inputMode: "click",
  vertices: [],
  isDrawing: false,
  previewPoint: null,
  isFreehandActive: false,
  roadClass: "arterial",
  splitTarget: null,
};

const DrawingContext = createContext<DrawingContextValue | null>(null);

interface DrawingProviderProps {
  children: ReactNode;
  /** Callback when a polygon is completed */
  onPolygonComplete?: (points: Point[], mode: DrawingMode, roadClass?: RoadClass, splitTarget?: SplitTarget | null) => void;
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
      roadClass: prev.roadClass,
      splitTarget: null,
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
    const completedRoadClass = state.roadClass;
    const completedSplitTarget = state.splitTarget;

    // Reset state
    setState(INITIAL_STATE);

    // Notify callback
    if (onPolygonComplete && completedMode) {
      onPolygonComplete(completedPolygon, completedMode, completedRoadClass, completedSplitTarget);
    }

    return completedPolygon;
  }, [state.vertices, state.mode, state.roadClass, state.splitTarget, canComplete, onPolygonComplete]);

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

  const setRoadClass = useCallback((roadClass: RoadClass) => {
    setState((prev) => ({
      ...prev,
      roadClass,
    }));
  }, []);

  const setSplitTarget = useCallback((target: SplitTarget) => {
    setState((prev) => {
      if (!prev.isDrawing || prev.mode !== "split") return prev;
      return {
        ...prev,
        splitTarget: target,
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
    const completedRoadClass = state.roadClass;

    // Reset state
    setState(INITIAL_STATE);

    // Notify callback
    if (onPolygonComplete && completedMode) {
      onPolygonComplete(simplifiedVertices, completedMode, completedRoadClass);
    }

    return simplifiedVertices;
  }, [state.isFreehandActive, state.vertices, state.mode, state.roadClass, onPolygonComplete]);

  const value: DrawingContextValue = useMemo(
    () => ({
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
      setRoadClass,
      setSplitTarget,
    }),
    [
      state, startDrawing, addVertex, setPreviewPoint, completeDrawing,
      cancelDrawing, undoLastVertex, canComplete, setInputMode,
      startFreehand, addFreehandPoint, endFreehand, setRoadClass,
      setSplitTarget,
    ]
  );

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
