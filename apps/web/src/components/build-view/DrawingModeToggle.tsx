/**
 * Toggle between click-to-place and freehand drawing modes.
 *
 * Appears when the draw tool is active.
 */

import type { DrawingInputMode } from "../canvas/DrawingContext";

interface DrawingModeToggleProps {
  mode: DrawingInputMode;
  onModeChange: (mode: DrawingInputMode) => void;
}

export function DrawingModeToggle({ mode, onModeChange }: DrawingModeToggleProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-2 flex gap-1">
      <button
        onClick={() => onModeChange("click")}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
          mode === "click"
            ? "bg-blue-600 text-white"
            : "text-gray-600 hover:bg-gray-100"
        }`}
        title="Click to place vertices"
      >
        {/* Vertex/point icon */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v2m0 10v2m-7-7h2m10 0h2" />
        </svg>
        Click
      </button>
      <button
        onClick={() => onModeChange("freehand")}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
          mode === "freehand"
            ? "bg-blue-600 text-white"
            : "text-gray-600 hover:bg-gray-100"
        }`}
        title="Hold and drag to draw freehand"
      >
        {/* Freehand/brush icon */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16c1.5-2 3-4 5-4s3.5 2 5 2 3.5-2 5-2 3.5 2 5 4" />
        </svg>
        Freehand
      </button>
    </div>
  );
}
