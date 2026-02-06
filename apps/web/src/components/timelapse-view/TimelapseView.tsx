import { ReactNode, useCallback, useState } from "react";
import { DateDisplay } from "./DateDisplay";
import { ChangesPanel, YearChange, defaultChanges } from "./ChangesPanel";
import { TimelineScrubber, defaultYearMarkers } from "./TimelineScrubber";
import { PlaybackControls, PlaybackSpeed } from "./PlaybackControls";
import { useGrowthSimulation } from "./useGrowthSimulation";

export interface TimelapseViewProps {
  children: ReactNode;
  /** World ID to trigger growth simulation */
  worldId?: string;
  startDate?: Date;
  endDate?: Date;
  currentDate?: Date;
  currentYear?: number;
  totalYears?: number;
  changes?: YearChange[];
  yearMarkers?: number[];
  onDateChange?: (date: Date) => void;
}

const defaultStartDate = new Date(2020, 0, 1);
const defaultEndDate = new Date(2026, 1, 1);
const defaultCurrentDate = new Date(2023, 7, 1);

export function TimelapseView({
  children,
  worldId,
  startDate = defaultStartDate,
  endDate = defaultEndDate,
  currentDate = defaultCurrentDate,
  currentYear = 4,
  totalYears = 7,
  changes: propChanges,
  yearMarkers = defaultYearMarkers,
  onDateChange,
}: TimelapseViewProps) {
  const YEAR_OPTIONS = [1, 5, 10] as const;
  const [selectedYears, setSelectedYears] = useState<number>(1);

  // Growth simulation (no longer auto-triggers)
  const growth = useGrowthSimulation(worldId);

  const handleSimulate = useCallback(() => {
    growth.simulate(selectedYears);
  }, [growth.simulate, selectedYears]);

  // Use growth results if available, otherwise fall back to prop changes or defaults
  const changes = growth.changes.length > 0
    ? growth.changes
    : (propChanges ?? defaultChanges);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  const totalTime = endDate.getTime() - startDate.getTime();
  const currentTime = currentDate.getTime() - startDate.getTime();
  const position = (currentTime / totalTime) * 100;

  const handlePositionChange = (newPosition: number) => {
    const newTime = startDate.getTime() + (newPosition / 100) * totalTime;
    onDateChange?.(new Date(newTime));
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStepBack = () => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(newDate.getFullYear() - 1);
    if (newDate >= startDate) {
      onDateChange?.(newDate);
    }
  };

  const handleStepForward = () => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(newDate.getFullYear() + 1);
    if (newDate <= endDate) {
      onDateChange?.(newDate);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Map content */}
      <div className="absolute inset-0 timelapse-view-overlay">
        {children}
      </div>

      {/* Date display (top-center) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg px-6 py-3">
        <DateDisplay
          date={currentDate}
          currentYear={currentYear}
          totalYears={totalYears}
        />
      </div>

      {/* Simulation controls + changes panel (right) */}
      <div className="absolute top-4 right-4">
        {/* Simulation length selector */}
        <div className="bg-white rounded-lg shadow-lg px-4 py-3 mb-2">
          <div className="text-xs font-medium text-gray-500 mb-2">Simulate Growth</div>
          <div className="flex items-center gap-2">
            {YEAR_OPTIONS.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYears(y)}
                className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                  selectedYears === y
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-300"
                }`}
              >
                {y}yr
              </button>
            ))}
            <button
              onClick={handleSimulate}
              disabled={growth.isSimulating || !worldId}
              className="ml-1 px-3 py-1 text-sm rounded-md bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {growth.isSimulating ? "Running..." : "Go"}
            </button>
          </div>
        </div>

        {growth.isSimulating && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-2 text-sm text-blue-700">
            Simulating {selectedYears} year{selectedYears > 1 ? "s" : ""} of growth...
          </div>
        )}
        {growth.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-2 text-sm text-red-700">
            {growth.error}
          </div>
        )}
        {!growth.isSimulating && (
          <button
            onClick={() => growth.simulate(1)}
            disabled={!worldId}
            className="w-full mb-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            Simulate 1 Year of Growth
          </button>
        )}
        <ChangesPanel changes={changes} />
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-white rounded-lg shadow-lg p-4">
          {/* Timeline scrubber */}
          <TimelineScrubber
            startDate={startDate}
            endDate={endDate}
            currentPosition={position}
            onPositionChange={handlePositionChange}
            yearMarkers={yearMarkers}
          />

          {/* Playback controls (centered) */}
          <div className="flex justify-center mt-4">
            <PlaybackControls
              isPlaying={isPlaying}
              speed={speed}
              onPlayPause={handlePlayPause}
              onSpeedChange={setSpeed}
              onStepBack={handleStepBack}
              onStepForward={handleStepForward}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
