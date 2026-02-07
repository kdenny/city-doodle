import { ReactNode, useCallback, useState } from "react";
import { TransitLinesPanel, TransitLine } from "./TransitLinesPanel";
import { TransitLineInspector } from "./TransitLineInspector";
import { useTransitLinesData } from "./useTransitLinesData";
import { useTransitOptional } from "../canvas/TransitContext";
import { useTransitLineDrawingOptional } from "../canvas/TransitLineDrawingContext";
import type { TransitLineProperties } from "../canvas/TransitLineDrawingContext";
import { usePlacementOptional } from "../palette/PlacementContext";
import { SEED_TYPES } from "../palette/types";
import { useViewMode } from "../shell/ViewModeContext";
import { TransitLinePropertiesDialog } from "../build-view/TransitLinePropertiesDialog";

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
      placementContext.selectSeed(subwaySeed);
    }
  }, [placementContext, subwaySeed]);

  const handlePlaceRailStation = useCallback(() => {
    if (placementContext && railSeed) {
      placementContext.selectSeed(railSeed);
    }
  }, [placementContext, railSeed]);

  const isPlacingStation =
    placementContext?.isPlacing &&
    (placementContext.selectedSeed?.id === "subway" ||
      placementContext.selectedSeed?.id === "rail_station");

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
            isPlacingStation={isPlacingStation}
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
              onClose={handleCloseInspector}
              isUpdating={isUpdating}
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
        {isPlacingStation && (
          <div className="absolute top-4 left-4 z-10 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span className="text-lg">
              {placementContext?.selectedSeed?.id === "subway" ? "🚇" : "🚂"}
            </span>
            <span className="text-sm font-medium">
              Click on a district to place{" "}
              {placementContext?.selectedSeed?.id === "subway"
                ? "subway"
                : "rail"}{" "}
              station
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
        {isDrawingLine && (
          <div className="absolute top-4 left-4 z-10 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span className="text-sm font-medium">
              Click stations to draw line. Press Enter to finish.
            </span>
            <button
              onClick={() => transitLineDrawingContext?.cancelDrawing()}
              className="ml-2 text-blue-200 hover:text-white text-xs"
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
