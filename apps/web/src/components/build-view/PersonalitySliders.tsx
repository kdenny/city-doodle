/**
 * Personality sliders for configuring district characteristics.
 *
 * Each slider controls a 0.0-1.0 value that affects how the district
 * generates and evolves during city growth simulation.
 * The era selector replaces the historic_modern slider with year-based selection.
 *
 * Validation Rules:
 * 1. Historic + Sprawl Forbidden: Pre-1940 era cannot have high sprawl (min 0.3)
 * 2. Historic Supersedes Transit: If Historic flag, Transit slider disabled
 * 3. Transit Slider Requires Transit: Grey out if no transit stations in world
 */

import React, { useCallback, useState, useMemo } from "react";
import type { DistrictPersonality } from "../canvas/layers/types";
import { EraSelector, DEFAULT_ERA_YEAR } from "./EraSelector";
import {
  validateSliders,
  snapToValidRange,
  type SliderState,
  type SliderValidationResult,
} from "./sliderValidation";

/**
 * Slider configuration for display (excludes era which has its own component)
 */
interface SliderConfig {
  key: "grid_organic" | "sprawl_compact" | "transit_car";
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
  /** Optional: whether the district is marked as historic */
  isHistoric?: boolean;
  /** Optional: whether the world has transit stations (defaults to true) */
  hasTransitStations?: boolean;
}

interface SingleSliderProps {
  config: SliderConfig;
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
  disabled?: boolean;
  /** Validation state for this slider */
  sliderState: SliderState;
}

function SingleSlider({
  config,
  value,
  onChange,
  compact = false,
  disabled = false,
  sliderState,
}: SingleSliderProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Combine external disabled state with validation disabled state
  const isDisabled = disabled || sliderState.disabled;
  const hasConstraint = sliderState.constraintReason !== undefined;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = parseFloat(e.target.value);
      // Snap to valid range if constrained
      const snappedValue = snapToValidRange(rawValue, sliderState);
      onChange(snappedValue);
    },
    [onChange, sliderState]
  );

  const handleMouseEnter = useCallback(() => {
    if (hasConstraint) {
      setShowTooltip(true);
    }
  }, [hasConstraint]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  return (
    <div
      className={`relative ${compact ? "space-y-0.5" : "space-y-1"}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex justify-between items-center">
        <span
          className={`font-medium ${
            compact ? "text-xs text-gray-500" : "text-xs text-gray-600"
          } ${isDisabled ? "opacity-50" : ""}`}
        >
          {config.leftLabel}
        </span>
        <span
          className={`font-medium ${
            compact ? "text-xs text-gray-500" : "text-xs text-gray-600"
          } ${isDisabled ? "opacity-50" : ""}`}
        >
          {config.rightLabel}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={sliderState.min}
          max={sliderState.max}
          step="0.05"
          value={value}
          onChange={handleChange}
          disabled={isDisabled}
          className={`
            w-full cursor-pointer
            accent-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${compact ? "h-1" : "h-2"}
          `}
          aria-label={`${config.leftLabel} to ${config.rightLabel}: ${config.description}`}
          data-testid={`slider-${config.key}`}
        />
        {/* Constraint indicator - show marker at min boundary if constrained */}
        {hasConstraint && sliderState.min > 0 && !isDisabled && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-amber-500"
            style={{ left: `${sliderState.min * 100}%` }}
            data-testid={`constraint-marker-${config.key}`}
          />
        )}
      </div>
      {!compact && (
        <p
          className={`text-xs text-gray-400 text-center ${
            isDisabled ? "opacity-50" : ""
          }`}
        >
          {config.description}
        </p>
      )}
      {/* Constraint tooltip */}
      {showTooltip && hasConstraint && (
        <div
          className="absolute left-0 bottom-full mb-1 bg-gray-800 text-white text-xs rounded px-2 py-1 w-48 z-10"
          data-testid={`constraint-tooltip-${config.key}`}
        >
          {sliderState.constraintReason}
        </div>
      )}
    </div>
  );
}

export function PersonalitySliders({
  values,
  onChange,
  compact = false,
  disabled = false,
  isHistoric = false,
  hasTransitStations = true,
}: PersonalitySlidersProps) {
  // Calculate validation state for all sliders
  const validation: SliderValidationResult = useMemo(
    () =>
      validateSliders({
        personality: values,
        isHistoric,
        hasTransitStations,
      }),
    [values, isHistoric, hasTransitStations]
  );

  const handleSliderChange = useCallback(
    (key: "grid_organic" | "sprawl_compact" | "transit_car", value: number) => {
      // Value is already snapped in SingleSlider, but we snap again for safety
      const snappedValue = snapToValidRange(value, validation[key]);
      onChange({
        ...values,
        [key]: snappedValue,
      });
    },
    [values, onChange, validation]
  );

  const handleEraChange = useCallback(
    (year: number) => {
      onChange({
        ...values,
        era_year: year,
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
          sliderState={validation[config.key]}
        />
      ))}
      {/* Era selector replaces the historic_modern slider */}
      <EraSelector
        value={values.era_year ?? DEFAULT_ERA_YEAR}
        onChange={handleEraChange}
        compact={compact}
        disabled={disabled}
      />
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
  isHistoric = false,
  hasTransitStations = true,
  defaultExpanded = false,
}: CollapsiblePersonalitySlidersProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

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
            isHistoric={isHistoric}
            hasTransitStations={hasTransitStations}
          />
        </div>
      )}
    </div>
  );
}
