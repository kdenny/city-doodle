/**
 * Modal for creating a new world.
 *
 * Enhanced with geographic setting selector, city scale presets,
 * and personality sliders (CITY-323 + CITY-324).
 */

import { useState, useCallback, FormEvent } from "react";
import { useCreateWorld } from "../api";
import {
  GEOGRAPHIC_SETTINGS,
  CITY_SCALE_PRESETS,
  DEFAULT_WORLD_SETTINGS,
  type GeographicSetting,
  type WorldSettings,
} from "../api/types";
import { generateCityName, generateCityNameSuggestions } from "../utils";

interface CreateWorldModalProps {
  onClose: () => void;
  onCreated: (worldId: string) => void;
}

export function CreateWorldModal({ onClose, onCreated }: CreateWorldModalProps) {
  const [name, setName] = useState(() => generateCityName({ seed: Date.now() }));
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // World settings state
  const [geographicSetting, setGeographicSetting] = useState<GeographicSetting>(
    DEFAULT_WORLD_SETTINGS.geographic_setting
  );
  const [blockSize, setBlockSize] = useState(DEFAULT_WORLD_SETTINGS.block_size_meters);
  const [districtSize, setDistrictSize] = useState(DEFAULT_WORLD_SETTINGS.district_size_meters);
  const [gridOrganic, setGridOrganic] = useState(DEFAULT_WORLD_SETTINGS.grid_organic);
  const [sprawlCompact, setSprawlCompact] = useState(DEFAULT_WORLD_SETTINGS.sprawl_compact);
  const [transitCar, setTransitCar] = useState(DEFAULT_WORLD_SETTINGS.transit_car);

  const handleGenerateNew = useCallback(() => {
    const newSuggestions = generateCityNameSuggestions(5, Date.now());
    setSuggestions(newSuggestions);
    setShowSuggestions(true);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setName(suggestion);
    setShowSuggestions(false);
  }, []);

  const handlePresetClick = useCallback((key: string) => {
    const preset = CITY_SCALE_PRESETS[key];
    if (preset) {
      setBlockSize(preset.block_size_meters);
      setDistrictSize(preset.district_size_meters);
    }
  }, []);

  const createWorld = useCreateWorld();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a world name");
      return;
    }

    const settings: Partial<WorldSettings> = {
      geographic_setting: geographicSetting,
      block_size_meters: blockSize,
      district_size_meters: districtSize,
      grid_organic: gridOrganic,
      sprawl_compact: sprawlCompact,
      transit_car: transitCar,
    };

    try {
      const world = await createWorld.mutateAsync({
        name: name.trim(),
        seed: seed ? parseInt(seed, 10) : undefined,
        settings,
      });
      onCreated(world.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create world");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Find which preset (if any) matches current scale values
  const activePreset = Object.entries(CITY_SCALE_PRESETS).find(
    ([, p]) => p.block_size_meters === blockSize && p.district_size_meters === districtSize
  )?.[0] ?? null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Create New World
          </h2>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-3 bg-red-50 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* City Name */}
            <div className="mb-4">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                City Name
              </label>
              <div className="flex gap-2">
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Awesome City"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleGenerateNew}
                  className="px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  title="Generate new name suggestions"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                    onClick={() => setGeographicSetting(gs.value)}
                    title={gs.description}
                    className={`px-2 py-2 text-xs rounded-md border transition-colors ${
                      geographicSetting === gs.value
                        ? "bg-blue-50 border-blue-500 text-blue-700 font-medium"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {gs.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {GEOGRAPHIC_SETTINGS.find((gs) => gs.value === geographicSetting)?.description}
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
                  <span className="text-xs text-gray-500">{blockSize}m</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={300}
                  step={10}
                  value={blockSize}
                  onChange={(e) => setBlockSize(parseInt(e.target.value, 10))}
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
                  <span className="text-xs text-gray-500">{districtSize}m</span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={6000}
                  step={200}
                  value={districtSize}
                  onChange={(e) => setDistrictSize(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>Compact</span>
                  <span>Large</span>
                </div>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <span className="text-xs">{showAdvanced ? "▼" : "▶"}</span>
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 pl-2 border-l-2 border-gray-100">
                  {/* Personality Sliders */}
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
                      value={gridOrganic}
                      onChange={(e) => setGridOrganic(parseFloat(e.target.value))}
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
                      value={sprawlCompact}
                      onChange={(e) => setSprawlCompact(parseFloat(e.target.value))}
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
                      value={transitCar}
                      onChange={(e) => setTransitCar(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      aria-label="Transit to Car: Transportation style"
                    />
                    <p className="text-xs text-gray-400 text-center">Transportation</p>
                  </div>

                  {/* Seed */}
                  <div>
                    <label
                      htmlFor="seed"
                      className="block text-xs font-medium text-gray-600 mb-1"
                    >
                      Seed (optional)
                    </label>
                    <input
                      id="seed"
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      placeholder="Random if empty"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-0.5 text-xs text-gray-400">
                      Same seed + settings = identical terrain
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createWorld.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {createWorld.isPending ? "Creating..." : "Create World"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
