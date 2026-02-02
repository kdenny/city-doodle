export interface TimelineScrubberProps {
  startDate: Date;
  endDate: Date;
  currentPosition: number; // 0-100
  onPositionChange: (position: number) => void;
  yearMarkers: number[];
}

function formatDate(date: Date): string {
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  return `${month} ${year}`;
}

export function TimelineScrubber({
  startDate,
  endDate,
  currentPosition,
  onPositionChange,
  yearMarkers,
}: TimelineScrubberProps) {
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const position = ((e.clientX - rect.left) / rect.width) * 100;
    onPositionChange(Math.max(0, Math.min(100, position)));
  };

  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    handleTrackClick(e);
  };

  return (
    <div className="w-full px-4">
      {/* Date range labels */}
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>{formatDate(startDate)}</span>
        <span>{formatDate(endDate)}</span>
      </div>

      {/* Progress track */}
      <div
        className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
        onClick={handleTrackClick}
        onMouseMove={handleDrag}
      >
        {/* Filled portion */}
        <div
          className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
          style={{ width: `${currentPosition}%` }}
        />

        {/* Draggable handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow cursor-grab"
          style={{ left: `calc(${currentPosition}% - 8px)` }}
          aria-label="Timeline scrubber"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={currentPosition}
        />
      </div>

      {/* Year markers */}
      <div className="relative h-4 mt-1">
        {yearMarkers.map((year, index) => {
          const position = (index / (yearMarkers.length - 1)) * 100;
          return (
            <span
              key={year}
              className="absolute text-xs text-gray-400 -translate-x-1/2"
              style={{ left: `${position}%` }}
            >
              {year}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const defaultYearMarkers = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
