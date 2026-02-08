/**
 * Context for managing road endpoint drag state (CITY-147).
 *
 * Tracks which road endpoint is being dragged and provides methods
 * for starting, updating, and completing drag operations.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type { Point } from "./layers/types";

/**
 * Information about a road endpoint being dragged.
 */
export interface EndpointDragState {
  /** ID of the road being dragged */
  roadId: string;
  /** Index of the endpoint being dragged (0 for start, length-1 for end) */
  endpointIndex: number;
  /** Original position before dragging started */
  originalPosition: Point;
  /** Current drag position (follows cursor or snaps) */
  currentPosition: Point;
  /** Whether the current position is snapped to a target */
  isSnapped: boolean;
  /** ID of the snap target (e.g., district ID if snapped to perimeter) */
  snapTargetId?: string;
  /** Description of what we're snapping to */
  snapDescription?: string;
}

/**
 * Result of completing an endpoint drag operation.
 */
export interface EndpointDragResult {
  /** ID of the road that was modified */
  roadId: string;
  /** Index of the endpoint that was moved */
  endpointIndex: number;
  /** New position of the endpoint */
  newPosition: Point;
  /** Whether the endpoint was snapped to a target */
  wasSnapped: boolean;
  /** ID of the snap target if snapped */
  snapTargetId?: string;
}

interface EndpointDragContextValue {
  /** Current drag state, or null if not dragging */
  dragState: EndpointDragState | null;
  /** Whether we're currently dragging an endpoint */
  isDragging: boolean;
  /** Start dragging a road endpoint */
  startDrag: (
    roadId: string,
    endpointIndex: number,
    originalPosition: Point
  ) => void;
  /** Update the drag position */
  updateDrag: (
    position: Point,
    options?: {
      isSnapped?: boolean;
      snapTargetId?: string;
      snapDescription?: string;
    }
  ) => void;
  /** Complete the drag operation and return the result */
  completeDrag: () => EndpointDragResult | null;
  /** Cancel the drag operation (revert to original position) */
  cancelDrag: () => void;
}

const EndpointDragContext = createContext<EndpointDragContextValue | null>(
  null
);

interface EndpointDragProviderProps {
  children: ReactNode;
  /** Callback when a drag operation is completed */
  onDragComplete?: (result: EndpointDragResult) => void;
  /** Callback when a drag operation is cancelled */
  onDragCancel?: (roadId: string) => void;
}

export function EndpointDragProvider({
  children,
  onDragComplete,
  onDragCancel,
}: EndpointDragProviderProps) {
  const [dragState, setDragState] = useState<EndpointDragState | null>(null);

  const startDrag = useCallback(
    (roadId: string, endpointIndex: number, originalPosition: Point) => {
      setDragState({
        roadId,
        endpointIndex,
        originalPosition,
        currentPosition: originalPosition,
        isSnapped: false,
      });
    },
    []
  );

  const updateDrag = useCallback(
    (
      position: Point,
      options?: {
        isSnapped?: boolean;
        snapTargetId?: string;
        snapDescription?: string;
      }
    ) => {
      setDragState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentPosition: position,
          isSnapped: options?.isSnapped ?? false,
          snapTargetId: options?.snapTargetId,
          snapDescription: options?.snapDescription,
        };
      });
    },
    []
  );

  const completeDrag = useCallback(() => {
    if (!dragState) return null;

    const result: EndpointDragResult = {
      roadId: dragState.roadId,
      endpointIndex: dragState.endpointIndex,
      newPosition: dragState.currentPosition,
      wasSnapped: dragState.isSnapped,
      snapTargetId: dragState.snapTargetId,
    };

    setDragState(null);
    onDragComplete?.(result);
    return result;
  }, [dragState, onDragComplete]);

  const cancelDrag = useCallback(() => {
    if (dragState) {
      onDragCancel?.(dragState.roadId);
    }
    setDragState(null);
  }, [dragState, onDragCancel]);

  const value: EndpointDragContextValue = useMemo(
    () => ({
      dragState,
      isDragging: dragState !== null,
      startDrag,
      updateDrag,
      completeDrag,
      cancelDrag,
    }),
    [dragState, startDrag, updateDrag, completeDrag, cancelDrag]
  );

  return (
    <EndpointDragContext.Provider value={value}>
      {children}
    </EndpointDragContext.Provider>
  );
}

/**
 * Hook to access endpoint drag functionality.
 * Throws if not within an EndpointDragProvider.
 */
export function useEndpointDrag(): EndpointDragContextValue {
  const context = useContext(EndpointDragContext);
  if (!context) {
    throw new Error(
      "useEndpointDrag must be used within an EndpointDragProvider"
    );
  }
  return context;
}

/**
 * Hook to optionally access endpoint drag functionality.
 * Returns null if not within an EndpointDragProvider (safe to use anywhere).
 */
export function useEndpointDragOptional(): EndpointDragContextValue | null {
  return useContext(EndpointDragContext);
}
