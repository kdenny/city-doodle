interface ScaleBarProps {
  /** Maximum distance to show in miles (default: 15) */
  maxMiles?: number;
  /** Block size in meters for reference display */
  blockSizeMeters?: number;
  /** Whether to show metric units instead of imperial */
  useMetric?: boolean;
  /** Zoom level for scaling the bar (default: 1) */
  zoom?: number;
}

// Conversion constants
const METERS_PER_MILE = 1609.34;
const METERS_PER_KM = 1000;

export function ScaleBar({
  maxMiles = 15,
  blockSizeMeters,
  useMetric = false,
  zoom = 1,
}: ScaleBarProps) {
  // Adjust displayed distance based on zoom level
  const effectiveMaxMiles = maxMiles / zoom;

  if (useMetric) {
    // Metric display (kilometers)
    const maxKm = effectiveMaxMiles * METERS_PER_MILE / METERS_PER_KM;
    const kmMarkers = [0, 5, 10, 15, 20, 25].filter((km) => km <= maxKm);

    return (
      <div className="bg-white/90 backdrop-blur-sm rounded px-3 py-2 shadow-sm">
        <div className="flex items-end gap-0 text-xs text-gray-600">
          {kmMarkers.map((km, i) => (
            <div key={km} className="flex flex-col items-center">
              <span className="mb-1">{km}km</span>
              <div
                className={`h-2 border-l border-gray-400 ${
                  i < kmMarkers.length - 1 ? "w-12" : ""
                }`}
              />
            </div>
          ))}
          <div className="flex-1 h-0.5 bg-gray-400 self-end mb-1" />
        </div>
        {blockSizeMeters && (
          <div className="text-xs text-gray-500 mt-1 text-center">
            Block: {blockSizeMeters}m
          </div>
        )}
      </div>
    );
  }

  // Imperial display (miles)
  const mileMarkers = [0, 5, 10, 15].filter((m) => m <= effectiveMaxMiles);

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded px-3 py-2 shadow-sm">
      <div className="flex items-end gap-0 text-xs text-gray-600">
        {mileMarkers.map((miles, i) => (
          <div key={miles} className="flex flex-col items-center">
            <span className="mb-1">{miles}mi</span>
            <div
              className={`h-2 border-l border-gray-400 ${
                i < mileMarkers.length - 1 ? "w-16" : ""
              }`}
            />
          </div>
        ))}
        <div className="flex-1 h-0.5 bg-gray-400 self-end mb-1" />
      </div>
      {blockSizeMeters && (
        <div className="text-xs text-gray-500 mt-1 text-center">
          Block: {Math.round(blockSizeMeters * 3.281)}ft ({blockSizeMeters}m)
        </div>
      )}
    </div>
  );
}
