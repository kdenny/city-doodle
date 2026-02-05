/**
 * Personality sliders component for configuring world settings.
 *
 * Four sliders that control the character of the generated city:
 * - Grid/Organic: Street layout style
 * - Sprawl/Compact: Density distribution
 * - Historic/Modern: Architectural character
 * - Transit/Car: Transportation focus
 */

import { WorldSettings } from "../../api/types";

export interface SliderConfig {
  key: keyof WorldSettings;
  leftLabel: string;
  rightLabel: string;
  tooltip: string;
}

export const SLIDER_CONFIGS: SliderConfig[] = [
  {
    key: "grid_organic",
    leftLabel: "Grid",
    rightLabel: "Organic",
    tooltip:
      "Controls street layout: Grid creates orderly blocks with perpendicular streets. Organic creates winding, natural street patterns that follow terrain.",
  },
  {
    key: "sprawl_compact",
    leftLabel: "Sprawl",
    rightLabel: "Compact",
    tooltip:
      "Controls density distribution: Sprawl creates spread-out suburbs with single-family homes. Compact creates dense urban cores with mixed-use development.",
  },
  {
    key: "historic_modern",
    leftLabel: "Historic",
    rightLabel: "Modern",
    tooltip:
      "Controls architectural character: Historic preserves older buildings and limits redevelopment. Modern allows contemporary architecture and urban renewal.",
  },
  {
    key: "transit_car",
    leftLabel: "Transit",
    rightLabel: "Car",
    tooltip:
      "Controls transportation focus: Transit prioritizes public transit, walkability, and bike infrastructure. Car creates wider roads and more parking.",
  },
];

interface PersonalitySlidersProps {
  /** Current settings values */
  settings: WorldSettings;
  /** Callback when a slider value changes */
  onChange: (settings: WorldSettings) => void;
  /** Whether the sliders are disabled */
  disabled?: boolean;
  /** Optional class name for styling */
  className?: string;
}

export function PersonalitySliders({
  settings,
  onChange,
  disabled = false,
  className = "",
}: PersonalitySlidersProps) {
  const handleSliderChange = (key: keyof WorldSettings, value: number) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        City Personality
      </h3>
      {SLIDER_CONFIGS.map((config) => (
        <PersonalitySlider
          key={config.key}
          config={config}
          value={settings[config.key]}
          onChange={(value) => handleSliderChange(config.key, value)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

interface PersonalitySliderProps {
  config: SliderConfig;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function PersonalitySlider({
  config,
  value,
  onChange,
  disabled = false,
}: PersonalitySliderProps) {
  const percentage = Math.round(value * 100);

  return (
    <div className="group" title={config.tooltip}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">{config.leftLabel}</span>
        <span className="text-xs font-medium text-gray-700">{percentage}%</span>
        <span className="text-xs text-gray-500">{config.rightLabel}</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={percentage}
        onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
        disabled={disabled}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 accent-blue-600"
        aria-label={`${config.leftLabel} to ${config.rightLabel}`}
      />
      <p className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {config.tooltip}
      </p>
    </div>
  );
}

/** Default settings with all sliders at 50% */
export const DEFAULT_WORLD_SETTINGS: WorldSettings = {
  grid_organic: 0.5,
  sprawl_compact: 0.5,
  historic_modern: 0.5,
  transit_car: 0.5,
};
