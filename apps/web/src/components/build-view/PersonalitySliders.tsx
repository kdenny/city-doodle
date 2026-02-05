/**
 * Personality sliders for configuring district characteristics.
 *
 * Each slider controls a 0.0-1.0 value that affects how the district
 * generates and evolves during city growth simulation.
 */

import { useCallback } from "react";
import type { DistrictPersonality } from "../canvas/layers/types";

/**
 * Slider configuration for display
 */
interface SliderConfig {
  key: keyof DistrictPersonality;
  leftLabel: string;
  rightLabel: string;
  description: string;
}

const SLIDER_CONFIGS: SliderConfig[] = [
  {
    key: "grid_organic",
    leftLabel: "Grid",
    rightLabel: "Organic",
    description: "Street pattern style",
  },
  {
    key: "sprawl_compact",
    leftLabel: "Sprawl",
    rightLabel: "Compact",
    description: "Block size and density",
  },
  {
    key: "historic_modern",
    leftLabel: "Historic",
    rightLabel: "Modern",
    description: "Redevelopment tendency",
  },
  {
    key: "transit_car",
    leftLabel: "Transit",
    rightLabel: "Car",
    description: "Road width and transit access",
  },
];

interface PersonalitySlidersProps {
  /** Current personality values */
  values: DistrictPersonality;
  /** Callback when any value changes */
  onChange: (values: DistrictPersonality) => void;
  /** Optional: compact mode for smaller display */
  compact?: boolean;
  /** Optional: disable all sliders */
  disabled?: boolean;
}

interface SingleSliderProps {
  config: SliderConfig;
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
  disabled?: boolean;
}

function SingleSlider({
  config,
  value,
  onChange,
  compact = false,
  disabled = false,
}: SingleSliderProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange]
  );

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      <div className="flex justify-between items-center">
        <span
          className={`font-medium ${
            compact ? "text-xs text-gray-500" : "text-xs text-gray-600"
          }`}
        >
          {config.leftLabel}
        </span>
        <span
          className={`font-medium ${
            compact ? "text-xs text-gray-500" : "text-xs text-gray-600"
          }`}
        >
          {config.rightLabel}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={`
          w-full cursor-pointer
          accent-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${compact ? "h-1" : "h-2"}
        `}
        aria-label={`${config.leftLabel} to ${config.rightLabel}: ${config.description}`}
        data-testid={`slider-${config.key}`}
      />
      {!compact && (
        <p className="text-xs text-gray-400 text-center">{config.description}</p>
      )}
    </div>
  );
}

export function PersonalitySliders({
  values,
  onChange,
  compact = false,
  disabled = false,
}: PersonalitySlidersProps) {
  const handleSliderChange = useCallback(
    (key: keyof DistrictPersonality, value: number) => {
      onChange({
        ...values,
        [key]: value,
      });
    },
    [values, onChange]
  );

  return (
    <div
      className={compact ? "space-y-2" : "space-y-3"}
      data-testid="personality-sliders"
    >
      {SLIDER_CONFIGS.map((config) => (
        <SingleSlider
          key={config.key}
          config={config}
          value={values[config.key]}
          onChange={(value) => handleSliderChange(config.key, value)}
          compact={compact}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/**
 * A collapsible version of personality sliders for the inspector panel
 */
interface CollapsiblePersonalitySlidersProps extends PersonalitySlidersProps {
  /** Initial expanded state */
  defaultExpanded?: boolean;
}

export function CollapsiblePersonalitySliders({
  values,
  onChange,
  compact = false,
  disabled = false,
  defaultExpanded = false,
}: CollapsiblePersonalitySlidersProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className="border-t border-gray-200 pt-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={isExpanded}
      >
        <span className="text-xs font-medium text-gray-600">
          Personality Settings
        </span>
        <span className="text-gray-400 text-sm">{isExpanded ? "-" : "+"}</span>
      </button>
      {isExpanded && (
        <div className="mt-2">
          <PersonalitySliders
            values={values}
            onChange={onChange}
            compact={compact}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

// Need React for useState in CollapsiblePersonalitySliders
import React from "react";
