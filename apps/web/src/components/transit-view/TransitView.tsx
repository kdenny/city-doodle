import { ReactNode, useCallback } from "react";
import { TransitLinesPanel, TransitLine } from "./TransitLinesPanel";
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

  // Transform network data to panel format
  const networkLines = useTransitLinesData(transitContext?.transitNetwork);

  // Use prop lines if provided, otherwise use context network lines
  const lines = propLines ?? networkLines;

  const handleLineClick = useCallback(
    (line: TransitLine) => {
      onLineClick?.(line);
      // TODO: Highlight line on map (CITY-195)
      console.log("Transit line clicked:", line.name, line.id);
    },
    [onLineClick]
  );

  return (
    <div className="relative w-full h-full">
      {/* Map content (with transit emphasis) */}
      <div className="absolute inset-0 transit-view-overlay">
        {children}
      </div>

      {/* Transit lines panel (right) */}
      <div className="absolute top-4 right-4">
        <TransitLinesPanel
          lines={lines}
          onLineClick={handleLineClick}
          isLoading={transitContext?.isLoading ?? false}
        />
      </div>

      {/* Note: No build tools visible in Transit View */}
      {/* Note: No timelapse controls visible */}
    </div>
  );
}
