import { ReactNode, useCallback } from "react";
import { TransitLinesPanel, TransitLine, defaultTransitLines } from "./TransitLinesPanel";

interface TransitViewProps {
  children: ReactNode;
  lines?: TransitLine[];
  onLineClick?: (line: TransitLine) => void;
}

export function TransitView({
  children,
  lines = defaultTransitLines,
  onLineClick,
}: TransitViewProps) {
  const handleLineClick = useCallback(
    (line: TransitLine) => {
      onLineClick?.(line);
      // TODO: Highlight line on map
      console.log("Transit line clicked:", line.name);
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
        <TransitLinesPanel lines={lines} onLineClick={handleLineClick} />
      </div>

      {/* Note: No build tools visible in Transit View */}
      {/* Note: No timelapse controls visible */}
    </div>
  );
}
