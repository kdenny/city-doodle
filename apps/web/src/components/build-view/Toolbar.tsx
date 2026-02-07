import { useState } from "react";

export type Tool = "pan" | "draw" | "city-limits" | "split" | "build" | "draw-road" | "draw-highway" | "transit-line";

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  disabled?: boolean;
  onGrow?: (timeStep: number) => void;
  growDisabled?: boolean;
  isGrowing?: boolean;
}

const tools: { id: Tool; label: string; icon: JSX.Element }[] = [
  {
    id: "pan",
    label: "Pan",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
      </svg>
    ),
  },
  {
    id: "draw",
    label: "Draw Neighborhood",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {/* Pencil/pen icon for drawing */}
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    id: "city-limits",
    label: "Draw City Limits",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {/* Map/boundary icon for city limits */}
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    id: "split",
    label: "Split District",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {/* Scissors icon for splitting */}
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
      </svg>
    ),
  },
  {
    id: "draw-road",
    label: "Draw Road",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {/* Road/path icon */}
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l3-8 3 8M9 20H5l1-4m7 4h4l-1-4M6 16l2-8m8 8l-2-8M8 8l1-4h6l1 4" />
      </svg>
    ),
  },
  {
    id: "draw-highway",
    label: "Draw Highway",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {/* Highway icon - wide road with lane markings */}
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4v16M18 4v16M12 4v3m0 3v3m0 3v4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4h16M4 20h16" />
      </svg>
    ),
  },
  {
    id: "build",
    label: "Build",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: "transit-line",
    label: "Draw Transit Line",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {/* Train/rail icon with connected dots representing a line */}
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17h6M7 17H5a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
  },
];

const TIME_STEPS = [
  { value: 1, label: "1 yr" },
  { value: 5, label: "5 yr" },
  { value: 10, label: "10 yr" },
];

export function Toolbar({ activeTool, onToolChange, disabled, onGrow, growDisabled, isGrowing }: ToolbarProps) {
  const [showGrowPopover, setShowGrowPopover] = useState(false);

  const handleGrow = (timeStep: number) => {
    setShowGrowPopover(false);
    onGrow?.(timeStep);
  };

  const isGrowDisabled = disabled || growDisabled || isGrowing;

  return (
    <div className="flex flex-row gap-1 bg-white rounded-lg shadow-lg p-1">
      {tools.map(({ id, label, icon }) => {
        const isDisabled = disabled && id !== "pan";
        return (
          <button
            key={id}
            onClick={() => !isDisabled && onToolChange(id)}
            disabled={isDisabled}
            className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
              isDisabled
                ? "text-gray-300 cursor-not-allowed"
                : activeTool === id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
            }`}
            title={isDisabled ? "Enter edit mode to use this tool" : label}
            aria-label={label}
          >
            {icon}
          </button>
        );
      })}

      {/* Divider */}
      <div className="border-l border-gray-200 mx-0.5 self-stretch" />

      {/* Grow button */}
      <div className="relative">
        <button
          onClick={() => !isGrowDisabled && setShowGrowPopover(!showGrowPopover)}
          disabled={isGrowDisabled}
          className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
            isGrowDisabled
              ? "text-gray-300 cursor-not-allowed"
              : isGrowing
                ? "bg-green-100 text-green-600"
                : "text-green-600 hover:bg-green-50"
          }`}
          title={isGrowing ? "Growing city..." : isGrowDisabled ? "Enter edit mode to grow city" : "Grow City"}
          aria-label="Grow City"
        >
          {isGrowing ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {/* Sprout/plant icon */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V13m0 0c0-3 2.5-5 5-5-1 3-2.5 5-5 5zm0 0c0-3-2.5-5-5-5 1 3 2.5 5 5 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22v-3" />
            </svg>
          )}
        </button>

        {/* Time step popover */}
        {showGrowPopover && (
          <>
            <div className="fixed inset-0" onClick={() => setShowGrowPopover(false)} />
            <div className="absolute bottom-12 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 whitespace-nowrap">
              <div className="text-xs text-gray-500 px-2 pb-1">Grow by</div>
              {TIME_STEPS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleGrow(value)}
                  className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-green-50 text-gray-700 hover:text-green-700"
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function useToolbar() {
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  return { activeTool, setActiveTool };
}
