import { ReactNode, useCallback, useState } from "react";
import { TransitLinesPanel, TransitLine } from "./TransitLinesPanel";
import { TransitLineInspector } from "./TransitLineInspector";
import { useTransitLinesData } from "./useTransitLinesData";
import { useTransitOptional } from "../canvas/TransitContext";
import { useViewMode } from "../shell/ViewModeContext";

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
  const { setViewMode } = useViewMode();

  const [selectedLine, setSelectedLine] = useState<TransitLine | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const networkLines = useTransitLinesData(transitContext?.transitNetwork);
  const lines = propLines ?? networkLines;

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
      </div>
    </div>
  );
}
