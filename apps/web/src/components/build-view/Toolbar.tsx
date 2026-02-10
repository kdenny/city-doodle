import { useState } from "react";
import type { RoadClass } from "../canvas/layers/types";

export type Tool = "pan" | "draw" | "city-limits" | "split" | "draw-road";

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  disabled?: boolean;
  onGrow?: (timeStep: number) => void;
  growDisabled?: boolean;
  isGrowing?: boolean;
  selectedRoadClass?: RoadClass;
  onRoadClassChange?: (roadClass: RoadClass) => void;
  /** When false, the neighborhood draw tool is disabled (no cities exist yet) */
  citiesExist?: boolean;
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
    id: "draw",
    label: "Draw Neighborhood",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {/* Polygon boundary icon for neighborhood drawing */}
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v6l-4 7H9l-4-7v-6l7-4z" />
        <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="13" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="20" r="1" fill="currentColor" stroke="none" />
        <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
        <circle cx="5" cy="13" r="1" fill="currentColor" stroke="none" />
        <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
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
];

const ROAD_CLASSES: { value: RoadClass; label: string; color: string }[] = [
  { value: "highway", label: "Highway", color: "#f9dc5c" },
  { value: "arterial", label: "Arterial", color: "#ffffff" },
  { value: "collector", label: "Collector", color: "#ffffff" },
  { value: "local", label: "Local Street", color: "#ffffff" },
  { value: "trail", label: "Trail", color: "#a8d5a2" },
];

const TIME_STEPS = [
  { value: 1, label: "1 yr" },
  { value: 5, label: "5 yr" },
  { value: 10, label: "10 yr" },
];

export function Toolbar({ activeTool, onToolChange, disabled, onGrow, growDisabled, isGrowing, selectedRoadClass = "arterial", onRoadClassChange, citiesExist = true }: ToolbarProps) {
  const [showGrowPopover, setShowGrowPopover] = useState(false);
  const [showRoadClassPopover, setShowRoadClassPopover] = useState(false);

  const handleGrow = (timeStep: number) => {
    setShowGrowPopover(false);
    onGrow?.(timeStep);
  };

  const handleRoadClassSelect = (roadClass: RoadClass) => {
    setShowRoadClassPopover(false);
    onRoadClassChange?.(roadClass);
    onToolChange("draw-road");
  };

  const isGrowDisabled = disabled || growDisabled || isGrowing;
  const selectedRoadColor = ROAD_CLASSES.find((r) => r.value === selectedRoadClass)?.color ?? "#ffffff";

  return (
    <div className="flex flex-row gap-1 bg-white rounded-lg shadow-lg p-1">
      {tools.map(({ id, label, icon }) => {
        const isNeighborhoodGated = id === "draw" && !citiesExist;
        const isDisabled = (disabled && id !== "pan") || isNeighborhoodGated;
        const isRoadTool = id === "draw-road";
        return (
          <div key={id} className={isRoadTool ? "relative" : undefined}>
            <button
              onClick={() => {
                if (isDisabled) return;
                if (isRoadTool) {
                  setShowRoadClassPopover(!showRoadClassPopover);
                } else {
                  setShowRoadClassPopover(false);
                  onToolChange(id);
                }
              }}
              disabled={isDisabled}
              className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                isDisabled
                  ? "text-gray-300 cursor-not-allowed"
                  : activeTool === id
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
              }`}
              title={isNeighborhoodGated ? "Draw city limits first" : isDisabled ? "Enter edit mode to use this tool" : label}
              aria-label={label}
            >
              {icon}
              {isRoadTool && !isDisabled && (
                <span
                  className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-gray-400"
                  style={{ backgroundColor: selectedRoadColor }}
                />
              )}
            </button>

            {/* Road class popover */}
            {isRoadTool && showRoadClassPopover && !isDisabled && (
              <>
                <div className="fixed inset-0" onClick={() => setShowRoadClassPopover(false)} />
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 whitespace-nowrap">
                  <div className="text-xs text-gray-500 px-2 pb-1">Road class</div>
                  {ROAD_CLASSES.map(({ value, label: classLabel, color }) => (
                    <button
                      key={value}
                      onClick={() => handleRoadClassSelect(value)}
                      className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm rounded hover:bg-blue-50 ${
                        selectedRoadClass === value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-gray-400 flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      {classLabel}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 whitespace-nowrap">
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
