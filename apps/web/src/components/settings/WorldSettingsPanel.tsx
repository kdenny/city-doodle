/**
 * Panel for viewing and editing world settings.
 *
 * This panel displays the current world name and personality sliders,
 * allowing users to modify settings and save changes.
 */

import { useState, useEffect, useCallback } from "react";
import { World, WorldSettings, useUpdateWorld } from "../../api";
import { PersonalitySliders } from "./PersonalitySliders";

interface WorldSettingsPanelProps {
  /** The world to display and edit */
  world: World;
  /** Callback when the panel is closed */
  onClose: () => void;
  /** Optional callback when settings are saved */
  onSaved?: (world: World) => void;
}

export function WorldSettingsPanel({
  world,
  onClose,
  onSaved,
}: WorldSettingsPanelProps) {
  const [name, setName] = useState(world.name);
  const [settings, setSettings] = useState<WorldSettings>(world.settings);
  const [error, setError] = useState<string | null>(null);

  const updateWorld = useUpdateWorld();

  // Reset state when world changes
  useEffect(() => {
    setName(world.name);
    setSettings(world.settings);
    setError(null);
  }, [world]);

  const hasChanges =
    name !== world.name ||
    settings.grid_organic !== world.settings.grid_organic ||
    settings.sprawl_compact !== world.settings.sprawl_compact ||
    settings.historic_modern !== world.settings.historic_modern ||
    settings.transit_car !== world.settings.transit_car;

  const handleSave = useCallback(async () => {
    setError(null);

    if (!name.trim()) {
      setError("World name is required");
      return;
    }

    try {
      const updatedWorld = await updateWorld.mutateAsync({
        worldId: world.id,
        data: {
          name: name.trim(),
          settings,
        },
      });
      onSaved?.(updatedWorld);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    }
  }, [name, settings, world.id, updateWorld, onSaved, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              World Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* World Name */}
          <div className="mb-6">
            <label
              htmlFor="worldName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              World Name
            </label>
            <input
              id="worldName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={updateWorld.isPending}
            />
          </div>

          {/* Seed (read-only) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seed
            </label>
            <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
              {world.seed}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Seed cannot be changed after creation
            </p>
          </div>

          {/* Personality Sliders */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <PersonalitySliders
              settings={settings}
              onChange={setSettings}
              disabled={updateWorld.isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateWorld.isPending || !hasChanges}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateWorld.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
