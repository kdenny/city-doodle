/**
 * Reusable world settings panel used in both CreateWorldModal and WorldSettingsModal.
 */

import { useCallback } from "react";
import {
  GEOGRAPHIC_SETTINGS,
  CITY_SCALE_PRESETS,
  type GeographicSetting,
} from "../api/types";

export interface WorldSettingsValues {
  geographic_setting: GeographicSetting;
  block_size_meters: number;
  district_size_meters: number;
  grid_organic: number;
  sprawl_compact: number;
  transit_car: number;
}

interface WorldSettingsPanelProps {
  values: WorldSettingsValues;
  onChange: (values: WorldSettingsValues) => void;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
}

export function WorldSettingsPanel({
  values,
  onChange,
  showAdvanced = false,
  onToggleAdvanced,
}: WorldSettingsPanelProps) {
  const update = useCallback(
    (partial: Partial<WorldSettingsValues>) => {
      onChange({ ...values, ...partial });
    },
    [values, onChange]
  );

  const handlePresetClick = useCallback(
    (key: string) => {
      const preset = CITY_SCALE_PRESETS[key];
      if (preset) {
        update({
          block_size_meters: preset.block_size_meters,
          district_size_meters: preset.district_size_meters,
        });
      }
    },
    [update]
  );

  const activePreset =
    Object.entries(CITY_SCALE_PRESETS).find(
      ([, p]) =>
        p.block_size_meters === values.block_size_meters &&
        p.district_size_meters === values.district_size_meters
    )?.[0] ?? null;

  return (
    <>
      {/* Geographic Setting */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Geography
        </label>
        <div className="grid grid-cols-4 gap-2">
          {GEOGRAPHIC_SETTINGS.map((gs) => (
            <button
              key={gs.value}
              type="button"
              onClick={() => update({ geographic_setting: gs.value })}
              title={gs.description}
              className={`px-2 py-2 text-xs rounded-md border transition-colors ${
                values.geographic_setting === gs.value
                  ? "bg-blue-50 border-blue-500 text-blue-700 font-medium"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {gs.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {GEOGRAPHIC_SETTINGS.find((gs) => gs.value === values.geographic_setting)?.description}
        </p>
      </div>

      {/* City Scale Presets */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          City Scale
        </label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(CITY_SCALE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePresetClick(key)}
              title={preset.description}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                activePreset === key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Block / District Size Sliders */}
      <div className="mb-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600">Block Size</label>
            <span className="text-xs text-gray-500">{values.block_size_meters}m</span>
          </div>
          <input
            type="range"
            min={50}
            max={300}
            step={10}
            value={values.block_size_meters}
            onChange={(e) => update({ block_size_meters: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>Dense</span>
            <span>Sprawling</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600">District Size</label>
            <span className="text-xs text-gray-500">{values.district_size_meters}m</span>
          </div>
          <input
            type="range"
            min={1000}
            max={6000}
            step={200}
            value={values.district_size_meters}
            onChange={(e) => update({ district_size_meters: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>Compact</span>
            <span>Large</span>
          </div>
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      {onToggleAdvanced && (
        <div className="mb-4">
          <button
            type="button"
            onClick={onToggleAdvanced}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <span className="text-xs">{showAdvanced ? "\u25BC" : "\u25B6"}</span>
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 pl-2 border-l-2 border-gray-100">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-500">Grid</span>
                  <span className="text-xs font-medium text-gray-500">Organic</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={values.grid_organic}
                  onChange={(e) => update({ grid_organic: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  aria-label="Grid to Organic: Street pattern style"
                />
                <p className="text-xs text-gray-400 text-center">Street pattern</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-500">Sprawl</span>
                  <span className="text-xs font-medium text-gray-500">Compact</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={values.sprawl_compact}
                  onChange={(e) => update({ sprawl_compact: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  aria-label="Sprawl to Compact: Density style"
                />
                <p className="text-xs text-gray-400 text-center">Density</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-500">Transit</span>
                  <span className="text-xs font-medium text-gray-500">Car</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={values.transit_car}
                  onChange={(e) => update({ transit_car: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  aria-label="Transit to Car: Transportation style"
                />
                <p className="text-xs text-gray-400 text-center">Transportation</p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
