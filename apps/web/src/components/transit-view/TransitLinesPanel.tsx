export interface TransitLine {
  id: string;
  name: string;
  color: string;
  stations: number;
  miles: number;
  lineType: "subway" | "rail";
  isCircular?: boolean;
}

interface TransitLinesPanelProps {
  lines: TransitLine[];
  onLineClick?: (line: TransitLine) => void;
  isLoading?: boolean;
  highlightedLineId?: string | null;
  onSwitchToBuild?: () => void;
  onPlaceSubwayStation?: () => void;
  onPlaceRailStation?: () => void;
  onDrawNewLine?: () => void;
  placingStationType?: "subway" | "rail" | null;
  isDrawingLine?: boolean;
}

function getLineTypeIcon(lineType: "subway" | "rail"): string {
  return lineType === "subway" ? "🚇" : "🚂";
}

function StationPlacementButtons({
  onPlaceSubwayStation,
  onPlaceRailStation,
  onDrawNewLine,
  placingStationType,
  isDrawingLine,
}: {
  onPlaceSubwayStation?: () => void;
  onPlaceRailStation?: () => void;
  onDrawNewLine?: () => void;
  placingStationType?: "subway" | "rail" | null;
  isDrawingLine?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Add</p>
      <div className="flex gap-2">
        {onPlaceSubwayStation && (
          <button
            onClick={onPlaceSubwayStation}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
              placingStationType === "subway"
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <span>🚇</span>
            <span>Subway</span>
          </button>
        )}
        {onPlaceRailStation && (
          <button
            onClick={onPlaceRailStation}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
              placingStationType === "rail"
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <span>🚂</span>
            <span>Rail</span>
          </button>
        )}
      </div>
      {onDrawNewLine && (
        <button
          onClick={onDrawNewLine}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
            isDrawingLine
              ? "bg-blue-100 text-blue-700 border border-blue-300"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isDrawingLine ? "Drawing Line..." : "Draw New Line"}
        </button>
      )}
    </div>
  );
}

export function TransitLinesPanel({
  lines,
  onLineClick,
  isLoading,
  highlightedLineId,
  onSwitchToBuild: _onSwitchToBuild,
  onPlaceSubwayStation,
  onPlaceRailStation,
  onDrawNewLine,
  placingStationType,
  isDrawingLine,
}: TransitLinesPanelProps) {
  const totalStations = lines.reduce((sum, line) => sum + line.stations, 0);
  const totalMiles = lines.reduce((sum, line) => sum + line.miles, 0);

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Transit Lines</h3>
        <div className="py-8 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Loading transit data...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (lines.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Transit Lines</h3>
        <div className="py-6 text-center">
          <div className="text-3xl mb-2">🚇</div>
          <p className="text-sm text-gray-500">No transit lines yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Place stations, then draw lines to connect them
          </p>
        </div>
        <StationPlacementButtons
          onPlaceSubwayStation={onPlaceSubwayStation}
          onPlaceRailStation={onPlaceRailStation}
          onDrawNewLine={onDrawNewLine}
          placingStationType={placingStationType}
          isDrawingLine={isDrawingLine}
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header with summary stats */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Transit Lines</h3>
        <div className="flex gap-3 mt-1">
          <span className="text-xs text-gray-500">{lines.length} lines</span>
          <span className="text-xs text-gray-500">{totalStations} stations</span>
          <span className="text-xs text-gray-500">{totalMiles.toFixed(1)} mi</span>
        </div>
      </div>

      {/* Lines list */}
      <div className="space-y-1">
        {lines.map((line) => {
          const isHighlighted = highlightedLineId === line.id;
          return (
            <button
              key={line.id}
              onClick={() => onLineClick?.(line)}
              className={`w-full flex items-center gap-3 p-2 rounded transition-colors text-left ${
                isHighlighted
                  ? "bg-blue-50 ring-2 ring-blue-400"
                  : "hover:bg-gray-50"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full shrink-0 transition-transform ${
                  isHighlighted ? "scale-125" : ""
                }`}
                style={{ backgroundColor: line.color }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium truncate flex items-center gap-1 ${
                    isHighlighted ? "text-blue-900" : "text-gray-900"
                  }`}
                >
                  <span
                    className="text-xs"
                    title={line.lineType === "subway" ? "Subway" : "Rail"}
                  >
                    {getLineTypeIcon(line.lineType)}
                  </span>
                  {line.name}
                  {line.isCircular && (
                    <span className="text-xs text-gray-400" title="Circular route">↻</span>
                  )}
                </div>
                <div
                  className={`text-xs ${isHighlighted ? "text-blue-600" : "text-gray-500"}`}
                >
                  {line.stations} stations · {line.miles.toFixed(1)} mi
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Station placement and line drawing actions */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <StationPlacementButtons
          onPlaceSubwayStation={onPlaceSubwayStation}
          onPlaceRailStation={onPlaceRailStation}
          onDrawNewLine={onDrawNewLine}
          placingStationType={placingStationType}
          isDrawingLine={isDrawingLine}
        />
      </div>
    </div>
  );
}

export const defaultTransitLines: TransitLine[] = [
  { id: "red", name: "Red Line", color: "#DC2626", stations: 12, miles: 8.5, lineType: "subway" },
  { id: "blue", name: "Blue Line", color: "#2563EB", stations: 15, miles: 11.2, lineType: "subway" },
  { id: "green", name: "Green Line", color: "#16A34A", stations: 9, miles: 6.8, lineType: "rail" },
];
