import { ReactNode, useState } from "react";
import { DateDisplay } from "./DateDisplay";
import { ChangesPanel, YearChange, defaultChanges } from "./ChangesPanel";
import { TimelineScrubber, defaultYearMarkers } from "./TimelineScrubber";
import { PlaybackControls, PlaybackSpeed } from "./PlaybackControls";

export interface TimelapseViewProps {
  children: ReactNode;
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
  startDate = defaultStartDate,
  endDate = defaultEndDate,
  currentDate = defaultCurrentDate,
  currentYear = 4,
  totalYears = 7,
  changes = defaultChanges,
  yearMarkers = defaultYearMarkers,
  onDateChange,
}: TimelapseViewProps) {
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

      {/* Changes panel (right) */}
      <div className="absolute top-4 right-4">
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
