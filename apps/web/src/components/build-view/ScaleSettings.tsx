/**
 * Scale settings panel for configuring block and district sizes.
 *
 * Provides presets for common city types and custom slider controls.
 */

import { useState, useCallback, useMemo } from "react";
import { CITY_SCALE_PRESETS, type CityScalePreset } from "../../api/types";

export interface ScaleSettingsValues {
  block_size_meters: number;
  district_size_meters: number;
}

interface ScaleSettingsProps {
  values: ScaleSettingsValues;
  onChange: (values: ScaleSettingsValues) => void;
  disabled?: boolean;
}

const BLOCK_SIZE_MIN = 50;
const BLOCK_SIZE_MAX = 300;
const DISTRICT_SIZE_MIN = 1000;
const DISTRICT_SIZE_MAX = 6000;

export function ScaleSettings({
  values,
  onChange,
  disabled = false,
}: ScaleSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleBlockSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newBlockSize = parseInt(e.target.value, 10);
      onChange({
        ...values,
        block_size_meters: newBlockSize,
      });
    },
    [values, onChange]
  );

  const handleDistrictSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDistrictSize = parseInt(e.target.value, 10);
      onChange({
        ...values,
        district_size_meters: newDistrictSize,
      });
    },
    [values, onChange]
  );

  const handlePresetClick = useCallback(
    (preset: CityScalePreset) => {
      onChange({
        block_size_meters: preset.block_size_meters,
        district_size_meters: preset.district_size_meters,
      });
    },
    [onChange]
  );

  // Determine which preset (if any) matches current values
  const activePreset = useMemo(() => {
    for (const [key, preset] of Object.entries(CITY_SCALE_PRESETS)) {
      if (
        preset.block_size_meters === values.block_size_meters &&
        preset.district_size_meters === values.district_size_meters
      ) {
        return key;
      }
    }
    return null;
  }, [values]);

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 w-64">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
        disabled={disabled}
      >
        <h3 className="text-sm font-semibold text-gray-700">City Scale</h3>
        <span className="text-gray-400 text-xs">
          {isExpanded ? "[-]" : "[+]"}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {/* Presets */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Presets</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(CITY_SCALE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePresetClick(preset)}
                  disabled={disabled}
                  title={preset.description}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    activePreset === key
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Block Size Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">
                Block Size
              </label>
              <span className="text-xs text-gray-500">
                {values.block_size_meters}m
              </span>
            </div>
            <input
              type="range"
              min={BLOCK_SIZE_MIN}
              max={BLOCK_SIZE_MAX}
              step={10}
              value={values.block_size_meters}
              onChange={handleBlockSizeChange}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>Dense</span>
              <span>Sprawling</span>
            </div>
          </div>

          {/* District Size Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">
                District Size
              </label>
              <span className="text-xs text-gray-500">
                {values.district_size_meters}m
              </span>
            </div>
            <input
              type="range"
              min={DISTRICT_SIZE_MIN}
              max={DISTRICT_SIZE_MAX}
              step={200}
              value={values.district_size_meters}
              onChange={handleDistrictSizeChange}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>Compact</span>
              <span>Large</span>
            </div>
          </div>

          {/* Info text */}
          <p className="text-xs text-gray-400 italic">
            Scale affects new districts. Existing districts are not modified.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Hook for managing scale settings state.
 */
export function useScaleSettings(initialValues?: Partial<ScaleSettingsValues>) {
  const [values, setValues] = useState<ScaleSettingsValues>({
    block_size_meters: initialValues?.block_size_meters ?? 100,
    district_size_meters: initialValues?.district_size_meters ?? 3200,
  });

  const updateValues = useCallback((newValues: ScaleSettingsValues) => {
    setValues(newValues);
  }, []);

  return {
    values,
    updateValues,
  };
}
