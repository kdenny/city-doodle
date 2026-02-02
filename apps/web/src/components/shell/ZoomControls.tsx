interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  minZoom?: number;
  maxZoom?: number;
}

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  minZoom = 0.25,
  maxZoom = 4,
}: ZoomControlsProps) {
  const zoomPercent = Math.round(zoom * 100);
  const canZoomIn = zoom < maxZoom;
  const canZoomOut = zoom > minZoom;

  return (
    <div className="flex flex-col items-center gap-1 bg-white rounded-lg shadow-lg p-1">
      <button
        onClick={onZoomIn}
        disabled={!canZoomIn}
        className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Zoom in"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v12m6-6H6"
          />
        </svg>
      </button>

      <span className="text-xs text-gray-600 font-medium w-10 text-center">
        {zoomPercent}%
      </span>

      <button
        onClick={onZoomOut}
        disabled={!canZoomOut}
        className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Zoom out"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18 12H6"
          />
        </svg>
      </button>
    </div>
  );
}
