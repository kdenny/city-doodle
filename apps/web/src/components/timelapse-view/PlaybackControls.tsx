export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: PlaybackSpeed;
  onPlayPause: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onStepBack: () => void;
  onStepForward: () => void;
}

const speeds: PlaybackSpeed[] = [0.5, 1, 2, 4];

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  );
}

export function PlaybackControls({
  isPlaying,
  speed,
  onPlayPause,
  onSpeedChange,
  onStepBack,
  onStepForward,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Step back */}
      <button
        onClick={onStepBack}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
        aria-label="Step back"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>

      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-md"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <PauseIcon className="w-6 h-6" />
        ) : (
          <PlayIcon className="w-6 h-6" />
        )}
      </button>

      {/* Step forward */}
      <button
        onClick={onStepForward}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
        aria-label="Step forward"
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>

      {/* Speed selector */}
      <div className="flex items-center gap-1 ml-4">
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-1 text-sm rounded ${
              speed === s
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            aria-label={`${s}x speed`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
