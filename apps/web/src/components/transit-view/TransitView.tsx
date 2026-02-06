import { ReactNode, useCallback, useState } from "react";
import { TransitLinesPanel, TransitLine } from "./TransitLinesPanel";
import { TransitLineInspector } from "./TransitLineInspector";
import { useTransitLinesData } from "./useTransitLinesData";
import { useTransitOptional } from "../canvas/TransitContext";

interface TransitViewProps {
  children: ReactNode;
  /** Optional lines to display (overrides fetched data if provided) */
  lines?: TransitLine[];
  onLineClick?: (line: TransitLine) => void;
}

/**
 * Transit view wrapper that displays the transit lines panel
 * connected to real transit network data from TransitContext.
 *
 * When transit data is available through context, it displays
 * actual transit lines. Otherwise shows an empty state.
 */
export function TransitView({
  children,
  lines: propLines,
  onLineClick,
}: TransitViewProps) {
  // Get transit context (may be null if not in provider)
  const transitContext = useTransitOptional();

  // Track selected line for editing
  const [selectedLine, setSelectedLine] = useState<TransitLine | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Transform network data to panel format
  const networkLines = useTransitLinesData(transitContext?.transitNetwork);

  // Use prop lines if provided, otherwise use context network lines
  const lines = propLines ?? networkLines;

  const handleLineClick = useCallback(
    (line: TransitLine) => {
      onLineClick?.(line);
      // Open inspector for editing
      setSelectedLine(line);
      // Highlight line on map (CITY-195)
      if (transitContext) {
        // Toggle: if already highlighted, clear; otherwise highlight
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
  }, []);

  const handleUpdateLine = useCallback(
    async (lineId: string, updates: { name?: string; color?: string }) => {
      if (!transitContext?.updateLine) return;

      setIsUpdating(true);
      try {
        const success = await transitContext.updateLine(lineId, updates);
        if (success) {
          // Update local selected line state to reflect changes
          setSelectedLine((prev) =>
            prev && prev.id === lineId
              ? { ...prev, ...updates }
              : prev
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

  // Clear highlight when clicking on the map background
  const handleBackgroundClick = useCallback(() => {
    transitContext?.setHighlightedLineId(null);
  }, [transitContext]);

  return (
    <div className="relative w-full h-full" onClick={handleBackgroundClick}>
      {/* Map content (with transit emphasis) */}
      <div className="absolute inset-0 transit-view-overlay">
        {children}
      </div>

      {/* Transit lines panel (right) */}
      <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
        <TransitLinesPanel
          lines={lines}
          onLineClick={handleLineClick}
          isLoading={transitContext?.isLoading ?? false}
          highlightedLineId={transitContext?.highlightedLineId ?? null}
        />
      </div>

      {/* Line inspector (left, shown when a line is selected) */}
      {selectedLine && (
        <div className="absolute top-4 left-4">
          <TransitLineInspector
            line={selectedLine}
            onUpdate={handleUpdateLine}
            onDelete={handleDeleteLine}
            onClose={handleCloseInspector}
            isUpdating={isUpdating}
          />
        </div>
      )}

      {/* Note: No build tools visible in Transit View */}
      {/* Note: No timelapse controls visible */}
    </div>
  );
}
