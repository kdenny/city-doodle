/**
 * Context for managing transit line drawing state.
 *
 * Provides state and methods for click-to-connect station transit line drawing.
 * Used by the "transit-line" tool to create manual transit lines.
 *
 * Flow:
 * 1. User clicks station A -> sets firstStation
 * 2. User clicks station B -> creates segment from A to B, sets firstStation to B
 * 3. User continues clicking stations to extend the line
 * 4. User presses ESC or double-clicks to finish
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import type { RailStationData } from "./layers";
import type { LineType } from "../../api/types";
import { RAIL_LINE_HEX } from "./transitColors";

export interface TransitLineProperties {
  name: string;
  color: string;
  type: LineType;
}

interface TransitLineDrawingState {
  /** Whether we're in transit line drawing mode */
  isDrawing: boolean;
  /** The first station selected (start of current segment) */
  firstStation: RailStationData | null;
  /** Stations connected so far (ordered) */
  connectedStations: RailStationData[];
  /** The line being created/extended (after first segment is made) */
  lineId: string | null;
  /** Line properties set by user */
  lineProperties: TransitLineProperties | null;
  /** Current mouse position for preview line */
  previewPosition: { x: number; y: number } | null;
  /** Station currently being hovered (for highlighting) */
  hoveredStation: RailStationData | null;
}

interface TransitLineDrawingContextValue {
  /** Current drawing state */
  state: TransitLineDrawingState;
  /** Start transit line drawing mode, optionally with pre-set properties */
  startDrawing: (properties?: TransitLineProperties) => void;
  /** Select a station (first click sets start, subsequent clicks create segments) */
  selectStation: (station: RailStationData) => Promise<void>;
  /** Update preview position (mouse move) */
  setPreviewPosition: (position: { x: number; y: number } | null) => void;
  /** Set hovered station (for highlighting) */
  setHoveredStation: (station: RailStationData | null) => void;
  /** Set line properties (name, color, type) */
  setLineProperties: (properties: TransitLineProperties) => void;
  /** Set the line ID after it's created */
  setLineId: (lineId: string) => void;
  /** Complete the drawing (finish the line) */
  completeDrawing: () => void;
  /** Cancel the current drawing */
  cancelDrawing: () => void;
  /** Undo the last connection */
  undoLastConnection: () => void;
  /** Check if a station is already connected in the current line */
  isStationConnected: (stationId: string) => boolean;
  /** Check if drawing can be completed (has at least one segment) */
  canComplete: () => boolean;
  /** CITY-363: Extend an existing line from a terminus station */
  extendLine: (
    lineId: string,
    terminus: RailStationData,
    properties: TransitLineProperties
  ) => void;
}


const INITIAL_STATE: TransitLineDrawingState = {
  isDrawing: false,
  firstStation: null,
  connectedStations: [],
  lineId: null,
  lineProperties: null,
  previewPosition: null,
  hoveredStation: null,
};

const TransitLineDrawingContext = createContext<TransitLineDrawingContextValue | null>(null);

interface TransitLineDrawingProviderProps {
  children: ReactNode;
  /** Callback when a segment is created (station A -> station B).
   *  Returns the line ID (existing or newly created) so the drawing
   *  context can track which line subsequent segments belong to. */
  onSegmentCreate?: (
    fromStation: RailStationData,
    toStation: RailStationData,
    lineProperties: TransitLineProperties,
    lineId: string | null
  ) => Promise<string | null> | void;
  /** Callback when line drawing is completed */
  onLineComplete?: (
    stations: RailStationData[],
    lineProperties: TransitLineProperties,
    lineId: string | null
  ) => void;
  /** CITY-538: Callback when a segment is undone (should delete from DB) */
  onSegmentUndo?: (
    fromStationId: string,
    toStationId: string,
    lineId: string | null
  ) => Promise<void> | void;
  /** Number of existing lines (for auto-naming) */
  existingLineCount?: number;
  /** Names of existing lines (to avoid collisions) */
  existingLineNames?: string[];
  /** Colors of existing lines (to avoid collisions) */
  existingLineColors?: string[];
}

export function TransitLineDrawingProvider({
  children,
  onSegmentCreate,
  onLineComplete,
  onSegmentUndo,
  existingLineNames = [],
  existingLineColors = [],
}: TransitLineDrawingProviderProps) {
  const [state, setState] = useState<TransitLineDrawingState>(INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // CITY-535: Refs to prevent race condition during rapid station clicks
  const segmentCreatingRef = useRef(false);
  const lineIdRef = useRef<string | null>(null);

  const startDrawing = useCallback((properties?: TransitLineProperties) => {
    // Find first unused color and name to avoid collisions after deletions
    const usedColors = new Set(existingLineColors);
    let color = RAIL_LINE_HEX[0];
    for (const c of RAIL_LINE_HEX) {
      if (!usedColors.has(c)) { color = c; break; }
    }

    const usedNames = new Set(existingLineNames);
    let name = `Line 1`;
    for (let n = 1; ; n++) {
      const candidate = `Line ${n}`;
      if (!usedNames.has(candidate)) { name = candidate; break; }
    }

    const lineProperties: TransitLineProperties = properties ?? {
      name,
      color,
      type: "rail",
    };

    lineIdRef.current = null;
    segmentCreatingRef.current = false;

    setState({
      isDrawing: true,
      firstStation: null,
      connectedStations: [],
      lineId: null,
      lineProperties,
      previewPosition: null,
      hoveredStation: null,
    });
  }, [existingLineColors, existingLineNames]);

  const selectStation = useCallback(
    async (station: RailStationData) => {
      const current = stateRef.current;
      if (!current.isDrawing) return;

      // If no first station yet, this is the first click
      if (!current.firstStation) {
        setState((prev) => ({
          ...prev,
          firstStation: station,
          connectedStations: [station],
        }));
        return;
      }

      // Can't connect to the same station
      if (station.id === current.firstStation.id) return;

      // CITY-535: Prevent concurrent segment creation (race condition)
      if (segmentCreatingRef.current) return;

      // Capture values before updating state
      const fromStation = current.firstStation;
      const { lineProperties } = current;
      // Use ref for lineId to get the most up-to-date value
      const lineId = lineIdRef.current;

      // Update state: move to next station
      setState((prev) => ({
        ...prev,
        firstStation: station,
        connectedStations: [...prev.connectedStations, station],
      }));

      // Create segment (side effect outside of setState updater)
      if (lineProperties && onSegmentCreate) {
        segmentCreatingRef.current = true;
        try {
          const returnedLineId = await onSegmentCreate(fromStation, station, lineProperties, lineId);
          if (returnedLineId) {
            lineIdRef.current = returnedLineId;
            setState((s) => ({ ...s, lineId: returnedLineId }));
          }
        } catch (err) {
          console.error("Failed to create transit line segment:", err);
        } finally {
          segmentCreatingRef.current = false;
        }
      }
    },
    [onSegmentCreate]
  );

  const setPreviewPosition = useCallback(
    (position: { x: number; y: number } | null) => {
      setState((prev) => ({
        ...prev,
        previewPosition: position,
      }));
    },
    []
  );

  const setHoveredStation = useCallback((station: RailStationData | null) => {
    setState((prev) => ({
      ...prev,
      hoveredStation: station,
    }));
  }, []);

  const setLineProperties = useCallback((properties: TransitLineProperties) => {
    setState((prev) => ({
      ...prev,
      lineProperties: properties,
    }));
  }, []);

  const setLineId = useCallback((lineId: string) => {
    setState((prev) => ({
      ...prev,
      lineId,
    }));
  }, []);

  const canComplete = useCallback(() => {
    // Need at least 2 connected stations (1 segment) to complete
    return state.connectedStations.length >= 2;
  }, [state.connectedStations.length]);

  const completeDrawing = useCallback(() => {
    if (!canComplete()) return;

    // Notify callback
    if (onLineComplete && state.lineProperties) {
      onLineComplete(state.connectedStations, state.lineProperties, state.lineId);
    }

    // Reset state
    lineIdRef.current = null;
    segmentCreatingRef.current = false;
    setState(INITIAL_STATE);
  }, [state.connectedStations, state.lineProperties, state.lineId, canComplete, onLineComplete]);

  const cancelDrawing = useCallback(() => {
    lineIdRef.current = null;
    segmentCreatingRef.current = false;
    setState(INITIAL_STATE);
  }, []);

  /**
   * CITY-363: Start extending an existing line from a terminus station.
   * Pre-populates the drawing state with the existing line's ID and properties,
   * so new segments are added to the existing line rather than creating a new one.
   */
  const extendLine = useCallback(
    (lineId: string, terminus: RailStationData, properties: TransitLineProperties) => {
      lineIdRef.current = lineId;
      segmentCreatingRef.current = false;

      setState({
        isDrawing: true,
        firstStation: terminus,
        connectedStations: [terminus],
        lineId,
        lineProperties: properties,
        previewPosition: null,
        hoveredStation: null,
      });
    },
    []
  );

  const undoLastConnection = useCallback(() => {
    const current = stateRef.current;
    if (!current.isDrawing || current.connectedStations.length <= 1) return;

    const stations = current.connectedStations;
    const lastStation = stations[stations.length - 1];
    const prevStation = stations[stations.length - 2];

    // CITY-538: Delete the segment from the database
    if (onSegmentUndo && prevStation && lastStation) {
      onSegmentUndo(prevStation.id, lastStation.id, lineIdRef.current);
    }

    const newConnectedStations = stations.slice(0, -1);
    const newFirstStation = newConnectedStations[newConnectedStations.length - 1] || null;

    setState((prev) => ({
      ...prev,
      connectedStations: newConnectedStations,
      firstStation: newFirstStation,
    }));
  }, [onSegmentUndo]);

  const isStationConnected = useCallback(
    (stationId: string) => {
      return state.connectedStations.some((s) => s.id === stationId);
    },
    [state.connectedStations]
  );

  const value: TransitLineDrawingContextValue = {
    state,
    startDrawing,
    selectStation,
    setPreviewPosition,
    setHoveredStation,
    setLineProperties,
    setLineId,
    completeDrawing,
    cancelDrawing,
    extendLine,
    undoLastConnection,
    isStationConnected,
    canComplete,
  };

  return (
    <TransitLineDrawingContext.Provider value={value}>
      {children}
    </TransitLineDrawingContext.Provider>
  );
}

/**
 * Hook to access transit line drawing context.
 * Throws if not within a TransitLineDrawingProvider.
 */
export function useTransitLineDrawing(): TransitLineDrawingContextValue {
  const context = useContext(TransitLineDrawingContext);
  if (!context) {
    throw new Error(
      "useTransitLineDrawing must be used within a TransitLineDrawingProvider"
    );
  }
  return context;
}

/**
 * Hook to optionally access transit line drawing context.
 * Returns null if not within a TransitLineDrawingProvider.
 */
export function useTransitLineDrawingOptional(): TransitLineDrawingContextValue | null {
  return useContext(TransitLineDrawingContext);
}
