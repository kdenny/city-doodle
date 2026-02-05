/**
 * Slider validation rules and constraints for personality sliders.
 *
 * Rules:
 * 1. Historic + Sprawl Forbidden: Pre-1940 era cannot have high sprawl (threshold 0.3)
 * 2. Historic Supersedes Transit: If Historic flag, Transit↔Car slider disabled
 * 3. Transit Slider Requires Transit: Grey out if no transit stations in world
 * 4. Historic Flag Requirements: Only available for pre-1940 eras
 */

import type { DistrictPersonality } from "../canvas/layers/types";
import { HISTORIC_THRESHOLD_YEAR } from "./EraSelector";

/**
 * Maximum sprawl value allowed for historic districts (pre-1940).
 * Higher sprawl values (toward 0 = more sprawl) are not allowed.
 * Value of 0.3 means compact = 0.3, so sprawl side limited.
 */
export const HISTORIC_SPRAWL_MIN = 0.3;

/**
 * Validation context passed to determine slider states.
 */
export interface SliderValidationContext {
  /** Current personality values */
  personality: DistrictPersonality;
  /** Whether the district is marked as historic */
  isHistoric: boolean;
  /** Whether the world has any transit stations */
  hasTransitStations: boolean;
}

/**
 * State of a single slider based on validation rules.
 */
export interface SliderState {
  /** Whether the slider should be disabled (greyed out) */
  disabled: boolean;
  /** Minimum valid value for this slider */
  min: number;
  /** Maximum valid value for this slider */
  max: number;
  /** Reason for constraint, shown in tooltip */
  constraintReason?: string;
}

/**
 * Full validation result for all sliders.
 */
export interface SliderValidationResult {
  grid_organic: SliderState;
  sprawl_compact: SliderState;
  transit_car: SliderState;
}

/**
 * Default unconstrained slider state.
 */
const DEFAULT_SLIDER_STATE: SliderState = {
  disabled: false,
  min: 0,
  max: 1,
};

/**
 * Check if an era year qualifies as historic (pre-1940).
 */
export function isHistoricEra(eraYear: number): boolean {
  return eraYear < HISTORIC_THRESHOLD_YEAR;
}

/**
 * Validate slider values and return their states.
 */
export function validateSliders(context: SliderValidationContext): SliderValidationResult {
  const { personality, isHistoric, hasTransitStations } = context;
  const eraYear = personality.era_year;

  // Grid/Organic slider - no special constraints
  const gridOrganicState: SliderState = { ...DEFAULT_SLIDER_STATE };

  // Sprawl/Compact slider - constrained for pre-1940 eras
  let sprawlCompactState: SliderState = { ...DEFAULT_SLIDER_STATE };
  if (isHistoricEra(eraYear)) {
    sprawlCompactState = {
      disabled: false,
      min: HISTORIC_SPRAWL_MIN,
      max: 1,
      constraintReason: `Historic districts (pre-${HISTORIC_THRESHOLD_YEAR}) cannot have high sprawl. Minimum density required.`,
    };
  }

  // Transit/Car slider - disabled for historic districts or if no transit stations
  let transitCarState: SliderState = { ...DEFAULT_SLIDER_STATE };
  if (isHistoric) {
    transitCarState = {
      disabled: true,
      min: 0,
      max: 1,
      constraintReason: "Transit slider is locked for Historic Districts. Historic areas maintain their original transportation infrastructure.",
    };
  } else if (!hasTransitStations) {
    transitCarState = {
      disabled: true,
      min: 0,
      max: 1,
      constraintReason: "No transit stations in this world. Add transit stations to enable this slider.",
    };
  }

  return {
    grid_organic: gridOrganicState,
    sprawl_compact: sprawlCompactState,
    transit_car: transitCarState,
  };
}

/**
 * Snap a slider value to its valid range.
 */
export function snapToValidRange(value: number, state: SliderState): number {
  return Math.max(state.min, Math.min(state.max, value));
}

/**
 * Check if a value is within the valid range for a slider.
 */
export function isValueValid(value: number, state: SliderState): boolean {
  return value >= state.min && value <= state.max;
}

/**
 * Apply validation constraints to personality values,
 * snapping any out-of-range values to valid ranges.
 */
export function applyConstraints(
  personality: DistrictPersonality,
  validation: SliderValidationResult
): DistrictPersonality {
  return {
    ...personality,
    grid_organic: snapToValidRange(personality.grid_organic, validation.grid_organic),
    sprawl_compact: snapToValidRange(personality.sprawl_compact, validation.sprawl_compact),
    transit_car: snapToValidRange(personality.transit_car, validation.transit_car),
  };
}

/**
 * Get validation warnings for current personality values.
 * Returns messages for values that are out of range.
 */
export function getValidationWarnings(
  personality: DistrictPersonality,
  validation: SliderValidationResult
): string[] {
  const warnings: string[] = [];

  if (!isValueValid(personality.sprawl_compact, validation.sprawl_compact)) {
    warnings.push(
      `Sprawl setting (${personality.sprawl_compact.toFixed(2)}) is below minimum (${validation.sprawl_compact.min}) for historic eras.`
    );
  }

  return warnings;
}
