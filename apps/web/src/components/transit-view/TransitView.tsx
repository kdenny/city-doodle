import { ReactNode, useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { TransitLinesPanel, TransitLine } from "./TransitLinesPanel";
import { TransitLineInspector } from "./TransitLineInspector";
import type { SegmentDisplayData } from "./TransitLineInspector";
import { useTransitLinesData } from "./useTransitLinesData";
import { useTransitOptional } from "../canvas/TransitContext";
import { useTransitLineDrawingOptional } from "../canvas/TransitLineDrawingContext";
import type { TransitLineProperties } from "../canvas/TransitLineDrawingContext";
import { usePlacementOptional } from "../palette/PlacementContext";
import { SEED_TYPES } from "../palette/types";
import { useViewMode } from "../shell/ViewModeContext";
import { TransitLinePropertiesDialog } from "../build-view/TransitLinePropertiesDialog";
import { useDeleteTransitLineSegment } from "../../api/hooks";

interface TransitViewProps {
  children: ReactNode;
  /** Optional lines to display (overrides fetched data if provided) */
  lines?: TransitLine[];
  onLineClick?: (line: TransitLine) => void;
}

/**
 * Transit view wrapper with a left sidebar for transit line management
 * connected to real transit network data from TransitContext.
 *
 * Layout: left sidebar (lines list + inspector) | map canvas
 */
export function TransitView({
  children,
  lines: propLines,
  onLineClick,
}: TransitViewProps) {
  const transitContext = useTransitOptional();
  const transitLineDrawingContext = useTransitLineDrawingOptional();
  const placementContext = usePlacementOptional();
  const { setViewMode } = useViewMode();
  const { worldId } = useParams<{ worldId: string }>();
  const deleteSegmentMutation = useDeleteTransitLineSegment();

  const [selectedLine, setSelectedLine] = useState<TransitLine | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showLinePropertiesDialog, setShowLinePropertiesDialog] = useState(false);

  const networkLines = useTransitLinesData(transitContext?.transitNetwork);
  const lines = propLines ?? networkLines;

  // Station placement via PlacementContext
  const subwaySeed = SEED_TYPES.find((s) => s.id === "subway") ?? null;
  const railSeed = SEED_TYPES.find((s) => s.id === "rail_station") ?? null;

  const handlePlaceSubwayStation = useCallback(() => {
    if (placementContext && subwaySeed) {
      // Cancel any active line drawing before starting placement
      if (transitLineDrawingContext?.state.isDrawing) {
        transitLineDrawingContext.cancelDrawing();
      }
      placementContext.selectSeed(subwaySeed);
    }
  }, [placementContext, subwaySeed, transitLineDrawingContext]);

  const handlePlaceRailStation = useCallback(() => {
    if (placementContext && railSeed) {
      // Cancel any active line drawing before starting placement
      if (transitLineDrawingContext?.state.isDrawing) {
        transitLineDrawingContext.cancelDrawing();
      }
      placementContext.selectSeed(railSeed);
    }
  }, [placementContext, railSeed, transitLineDrawingContext]);

  const placingStationType: "subway" | "rail" | null =
    placementContext?.isPlacing && placementContext.selectedSeed?.id === "subway"
      ? "subway"
      : placementContext?.isPlacing &&
          placementContext.selectedSeed?.id === "rail_station"
        ? "rail"
        : null;

  // Line drawing via TransitLineDrawingContext
  const handleDrawNewLine = useCallback(() => {
    if (transitLineDrawingContext?.state.isDrawing) {
      // Already drawing - complete the current line
      transitLineDrawingContext.completeDrawing();
      return;
    }
    setShowLinePropertiesDialog(true);
  }, [transitLineDrawingContext]);

  const handleLinePropertiesConfirm = useCallback(
    (properties: TransitLineProperties) => {
      setShowLinePropertiesDialog(false);
      if (transitLineDrawingContext) {
        // Cancel any active station placement
        placementContext?.cancelPlacing();
        transitLineDrawingContext.setLineProperties(properties);
        transitLineDrawingContext.startDrawing();
      }
    },
    [transitLineDrawingContext, placementContext]
  );

  const handleLinePropertiesCancel = useCallback(() => {
    setShowLinePropertiesDialog(false);
  }, []);

  const isDrawingLine = transitLineDrawingContext?.state.isDrawing ?? false;

  const handleLineClick = useCallback(
    (line: TransitLine) => {
      onLineClick?.(line);
      // Toggle selection: clicking same line deselects
      setSelectedLine((prev) => (prev?.id === line.id ? null : line));
      // Highlight line on map
      if (transitContext) {
        if (transitContext.highlightedLineId === line.id) {
          transitContext.setHighlightedLineId(null);
        } else {
          transitContext.setHighlightedLineId(line.id);
        }
      }
    },
    [onLineClick, transitContext]
  );

  const handleCloseInspector = useCallback(() => {
    setSelectedLine(null);
    transitContext?.setHighlightedLineId(null);
  }, [transitContext]);

  const handleUpdateLine = useCallback(
    async (lineId: string, updates: { name?: string; color?: string }) => {
      if (!transitContext?.updateLine) return;

      setIsUpdating(true);
      try {
        const success = await transitContext.updateLine(lineId, updates);
        if (success) {
          setSelectedLine((prev) =>
            prev && prev.id === lineId ? { ...prev, ...updates } : prev
          );
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [transitContext]
  );

  const handleDeleteLine = useCallback(
    async (lineId: string) => {
      if (!transitContext?.deleteLine) return;
      const success = await transitContext.deleteLine(lineId);
      if (success) {
        setSelectedLine(null);
        transitContext.setHighlightedLineId(null);
      }
    },
    [transitContext]
  );

  // CITY-363: Extend an existing line from its terminus
  const handleExtendLine = useCallback(
    (lineId: string) => {
      if (!transitContext || !transitLineDrawingContext) return;

      const network = transitContext.transitNetwork;
      if (!network) return;

      const line = network.lines.find((l) => l.id === lineId);
      if (!line || line.segments.length === 0) return;

      // Find terminus stations (stations that appear in only one segment endpoint)
      const stationOccurrences = new Map<string, number>();
      for (const seg of line.segments) {
        stationOccurrences.set(seg.from_station_id, (stationOccurrences.get(seg.from_station_id) || 0) + 1);
        stationOccurrences.set(seg.to_station_id, (stationOccurrences.get(seg.to_station_id) || 0) + 1);
      }

      // A terminus appears in exactly 1 segment endpoint
      const terminusIds = Array.from(stationOccurrences.entries())
        .filter(([, count]) => count === 1)
        .map(([id]) => id);

      if (terminusIds.length === 0) return;

      // Use the last terminus (end of line) — find the station with the highest order segment
      const lastSegment = line.segments.reduce((a, b) =>
        a.order_in_line > b.order_in_line ? a : b
      );
      const lastTerminusId = terminusIds.includes(lastSegment.to_station_id)
        ? lastSegment.to_station_id
        : terminusIds[terminusIds.length - 1];

      // Find the station data for rendering (filter by line type to prevent mixing)
      const stationPool = line.line_type === "subway"
        ? transitContext.subwayStations
        : transitContext.railStations;
      const terminus = stationPool.find((s) => s.id === lastTerminusId);
      if (!terminus) return;

      // Cancel any active placement
      placementContext?.cancelPlacing();

      // Start extension mode
      transitLineDrawingContext.extendLine(lineId, terminus, {
        name: line.name,
        color: line.color,
        type: line.line_type,
      });
    },
    [transitContext, transitLineDrawingContext, placementContext]
  );

  // CITY-367: Compute segment display data for the selected line
  const selectedLineSegments: SegmentDisplayData[] | undefined = useMemo(() => {
    if (!selectedLine || !transitContext?.transitNetwork) return undefined;
    const network = transitContext.transitNetwork;
    const line = network.lines.find((l) => l.id === selectedLine.id);
    if (!line || line.segments.length === 0) return undefined;

    return line.segments.map((seg) => {
      const fromStation = network.stations.find((s) => s.id === seg.from_station_id);
      const toStation = network.stations.find((s) => s.id === seg.to_station_id);
      return {
        id: seg.id,
        fromStationName: fromStation?.name ?? "Unknown",
        toStationName: toStation?.name ?? "Unknown",
        orderInLine: seg.order_in_line,
      };
    });
  }, [selectedLine, transitContext?.transitNetwork]);

  // CITY-367: Delete a segment
  const handleDeleteSegment = useCallback(
    (segmentId: string) => {
      if (!selectedLine) return;
      deleteSegmentMutation.mutate({
        segmentId,
        lineId: selectedLine.id,
        worldId,
      });
    },
    [selectedLine, deleteSegmentMutation, worldId]
  );

  const handleBackgroundClick = useCallback(() => {
    transitContext?.setHighlightedLineId(null);
  }, [transitContext]);

  const handleSwitchToBuild = useCallback(() => {
    setViewMode("build");
  }, [setViewMode]);

  return (
    <div className="flex w-full h-full">
      {/* Left sidebar */}
      <div
        className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Transit lines list */}
        <div className="flex-1 overflow-y-auto">
          <TransitLinesPanel
            lines={lines}
            onLineClick={handleLineClick}
            isLoading={transitContext?.isLoading ?? false}
            highlightedLineId={transitContext?.highlightedLineId ?? null}
            onSwitchToBuild={handleSwitchToBuild}
            onPlaceSubwayStation={handlePlaceSubwayStation}
            onPlaceRailStation={handlePlaceRailStation}
            onDrawNewLine={handleDrawNewLine}
            placingStationType={placingStationType}
            isDrawingLine={isDrawingLine}
          />
        </div>

        {/* Line inspector (below lines list when a line is selected) */}
        {selectedLine && (
          <div className="border-t border-gray-200 overflow-y-auto max-h-[50%]">
            <TransitLineInspector
              line={selectedLine}
              onUpdate={handleUpdateLine}
              onDelete={handleDeleteLine}
              onExtend={handleExtendLine}
              onClose={handleCloseInspector}
              isUpdating={isUpdating}
              isExtending={isDrawingLine}
              segments={selectedLineSegments}
              onDeleteSegment={handleDeleteSegment}
            />
          </div>
        )}
      </div>

      {/* Map content */}
      <div className="flex-1 relative" onClick={handleBackgroundClick}>
        <div className="absolute inset-0 transit-view-overlay">
          {children}
        </div>

        {/* Placement mode indicator */}
        {placingStationType && (
          <div className="absolute top-4 left-4 z-10 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span className="text-lg">
              {placingStationType === "subway" ? "🚇" : "🚂"}
            </span>
            <span className="text-sm font-medium">
              Click on a district to place{" "}
              {placingStationType === "subway" ? "subway" : "rail"} station
            </span>
            <button
              onClick={() => placementContext?.cancelPlacing()}
              className="ml-2 text-blue-200 hover:text-white text-xs"
            >
              Cancel (Esc)
            </button>
          </div>
        )}

        {/* Drawing mode indicator */}
        {isDrawingLine && transitLineDrawingContext && (
          <div className="absolute top-4 left-4 z-10 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span className="text-sm font-medium">
              {transitLineDrawingContext.state.connectedStations.length === 0
                ? "Click a station to start"
                : "Click another station to extend"}
              {transitLineDrawingContext.state.connectedStations.length >= 2 && (
                <> — Press <kbd className="px-1 py-0.5 bg-blue-500 rounded text-xs font-mono">Enter</kbd> to finish</>
              )}
            </span>
            {transitLineDrawingContext.state.connectedStations.length >= 2 && (
              <button
                onClick={() => transitLineDrawingContext.undoLastConnection()}
                className="ml-1 text-blue-200 hover:text-white text-xs"
              >
                Undo (Ctrl+Z)
              </button>
            )}
            <button
              onClick={() => transitLineDrawingContext.cancelDrawing()}
              className="ml-1 text-blue-200 hover:text-white text-xs"
            >
              Cancel (Esc)
            </button>
          </div>
        )}
      </div>

      {/* Transit line properties dialog */}
      <TransitLinePropertiesDialog
        isOpen={showLinePropertiesDialog}
        initialProperties={
          transitLineDrawingContext?.state.lineProperties || undefined
        }
        onConfirm={handleLinePropertiesConfirm}
        onCancel={handleLinePropertiesCancel}
      />
    </div>
  );
}
