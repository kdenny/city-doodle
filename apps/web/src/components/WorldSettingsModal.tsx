/**
 * Modal for editing world settings after creation.
 */

import { useState, useCallback } from "react";
import { useUpdateWorld } from "../api";
import type { World } from "../api/types";
import { WorldSettingsPanel, type WorldSettingsValues } from "./WorldSettingsPanel";

interface WorldSettingsModalProps {
  world: World;
  onClose: () => void;
}

export function WorldSettingsModal({ world, onClose }: WorldSettingsModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [values, setValues] = useState<WorldSettingsValues>({
    geographic_setting: world.settings.geographic_setting,
    block_size_meters: world.settings.block_size_meters,
    district_size_meters: world.settings.district_size_meters,
    grid_organic: world.settings.grid_organic,
    sprawl_compact: world.settings.sprawl_compact,
    transit_car: world.settings.transit_car,
  });

  const updateWorld = useUpdateWorld();

  const handleSave = useCallback(async () => {
    setError(null);
    try {
      await updateWorld.mutateAsync({
        worldId: world.id,
        data: { settings: values },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
    }
  }, [updateWorld, world.id, values, onClose]);

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
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            World Settings
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <WorldSettingsPanel
            values={values}
            onChange={setValues}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
          />

          <div className="flex gap-3 justify-end mt-4">
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
              disabled={updateWorld.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {updateWorld.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
