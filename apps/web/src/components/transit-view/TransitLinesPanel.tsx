export interface TransitLine {
  id: string;
  name: string;
  color: string;
  stations: number;
  miles: number;
}

interface TransitLinesPanelProps {
  lines: TransitLine[];
  onLineClick?: (line: TransitLine) => void;
}

export function TransitLinesPanel({ lines, onLineClick }: TransitLinesPanelProps) {
  const totalStations = lines.reduce((sum, line) => sum + line.stations, 0);
  const totalMiles = lines.reduce((sum, line) => sum + line.miles, 0);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-64">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Transit Lines</h3>

      {/* Lines list */}
      <div className="space-y-2 mb-4">
        {lines.map((line) => (
          <button
            key={line.id}
            onClick={() => onLineClick?.(line)}
            className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors text-left"
          >
            <div
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: line.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {line.name}
              </div>
              <div className="text-xs text-gray-500">
                {line.stations} stations · {line.miles.toFixed(1)} mi
              </div>
            </div>
          </button>
        ))}
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
  { id: "red", name: "Red Line", color: "#DC2626", stations: 12, miles: 8.5 },
  { id: "blue", name: "Blue Line", color: "#2563EB", stations: 15, miles: 11.2 },
  { id: "green", name: "Green Line", color: "#16A34A", stations: 9, miles: 6.8 },
];
