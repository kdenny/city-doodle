export interface TransitLine {
  id: string;
  name: string;
  color: string;
  stations: number;
  miles: number;
  lineType: "subway" | "rail";
}

interface TransitLinesPanelProps {
  lines: TransitLine[];
  onLineClick?: (line: TransitLine) => void;
  isLoading?: boolean;
  /** ID of the currently highlighted line */
  highlightedLineId?: string | null;
}

/**
 * Get icon for line type.
 */
function getLineTypeIcon(lineType: "subway" | "rail"): string {
  return lineType === "subway" ? "🚇" : "🚂";
}

export function TransitLinesPanel({ lines, onLineClick, isLoading, highlightedLineId }: TransitLinesPanelProps) {
  const totalStations = lines.reduce((sum, line) => sum + line.stations, 0);
  const totalMiles = lines.reduce((sum, line) => sum + line.miles, 0);

  // Empty state
  if (!isLoading && lines.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4 w-64">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Transit Lines</h3>
        <div className="py-8 text-center">
          <div className="text-3xl mb-2">🚇</div>
          <p className="text-sm text-gray-500">No transit lines yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Place subway or rail stations to create lines
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4 w-64">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Transit Lines</h3>
        <div className="py-8 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Loading transit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-64">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Transit Lines</h3>

      {/* Lines list */}
      <div className="space-y-2 mb-4">
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
                <div className={`text-sm font-medium truncate flex items-center gap-1 ${
                  isHighlighted ? "text-blue-900" : "text-gray-900"
                }`}>
                  <span className="text-xs" title={line.lineType === "subway" ? "Subway" : "Rail"}>
                    {getLineTypeIcon(line.lineType)}
                  </span>
                  {line.name}
                </div>
                <div className={`text-xs ${isHighlighted ? "text-blue-600" : "text-gray-500"}`}>
                  {line.stations} stations · {line.miles.toFixed(1)} mi
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Totals */}
      <div className="border-t pt-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Stations</span>
          <span className="font-medium text-gray-900">{totalStations}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Miles of Track</span>
          <span className="font-medium text-gray-900">{totalMiles.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

export const defaultTransitLines: TransitLine[] = [
  { id: "red", name: "Red Line", color: "#DC2626", stations: 12, miles: 8.5, lineType: "subway" },
  { id: "blue", name: "Blue Line", color: "#2563EB", stations: 15, miles: 11.2, lineType: "subway" },
  { id: "green", name: "Green Line", color: "#16A34A", stations: 9, miles: 6.8, lineType: "rail" },
];
