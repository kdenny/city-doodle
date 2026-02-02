interface ScaleBarProps {
  maxMiles?: number;
}

export function ScaleBar({ maxMiles = 15 }: ScaleBarProps) {
  const markers = [0, 5, 10, 15].filter((m) => m <= maxMiles);

  return (
    <div className="flex items-end gap-0 text-xs text-gray-600">
      {markers.map((miles, i) => (
        <div key={miles} className="flex flex-col items-center">
          <span className="mb-1">{miles}mi</span>
          <div
            className={`h-2 border-l border-gray-400 ${
              i < markers.length - 1 ? "w-16" : ""
            }`}
          />
        </div>
      ))}
      <div className="flex-1 h-0.5 bg-gray-400 self-end mb-1" />
    </div>
  );
}
