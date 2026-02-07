/**
 * CITY-375: Inspector panel for editing transit station properties.
 * Supports renaming and random name generation.
 * Appears when a station is selected in the transit view.
 */

import { useState, useCallback, useEffect } from "react";

/** Random creative station name components */
const NAME_PREFIXES = [
  "Grand", "Central", "Union", "Metro", "Civic", "Harbor",
  "Market", "Park", "River", "Lake", "Pine", "Oak",
  "Elm", "Maple", "Cedar", "Broad", "High", "Main",
  "King", "Queen", "Crown", "Liberty", "Victory", "Summit",
];

const NAME_SUFFIXES = [
  "Square", "Center", "Plaza", "Crossing", "Junction", "Point",
  "Heights", "Hill", "Park", "Gardens", "Landing", "Terrace",
  "Commons", "Green", "Row", "Court", "Gate", "Bridge",
];

function generateRandomName(): string {
  const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}

export interface StationInspectorData {
  id: string;
  name: string;
  stationType: "rail" | "subway";
  isTerminus: boolean;
  /** Lines this station serves */
  lines: { id: string; name: string; color: string }[];
}

interface TransitStationInspectorProps {
  station: StationInspectorData;
  /** Callback when the station name is saved */
  onRename: (stationId: string, newName: string) => Promise<boolean>;
  /** Callback when the station is deleted */
  onDelete?: (stationId: string) => Promise<void>;
  /** Callback to close the inspector */
  onClose: () => void;
  /** Whether an update is in progress */
  isUpdating?: boolean;
}

export function TransitStationInspector({
  station,
  onRename,
  onDelete,
  onClose,
  isUpdating = false,
}: TransitStationInspectorProps) {
  const [name, setName] = useState(station.name);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when station changes
  useEffect(() => {
    setName(station.name);
    setHasChanges(false);
  }, [station.id, station.name]);

  // Track changes
  useEffect(() => {
    setHasChanges(name !== station.name);
  }, [name, station.name]);

  const handleSave = useCallback(async () => {
    if (name.trim() && name !== station.name) {
      const success = await onRename(station.id, name.trim());
      if (success) {
        setHasChanges(false);
      }
    }
  }, [name, station.id, station.name, onRename]);

  const handleCancel = useCallback(() => {
    setName(station.name);
    setHasChanges(false);
  }, [station.name]);

  const handleRandomize = useCallback(() => {
    const randomName = generateRandomName();
    setName(randomName);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && hasChanges && !isUpdating) {
        handleSave();
      }
    },
    [hasChanges, isUpdating, handleSave]
  );

  const stationTypeIcon = station.stationType === "subway" ? "\u{1F687}" : "\u{1F682}";
  const stationTypeLabel = station.stationType === "subway" ? "Subway Station" : "Rail Station";

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Station Details</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Station type (read-only) */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">Type</label>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>{stationTypeIcon}</span>
          <span>{stationTypeLabel}</span>
          {station.isTerminus && (
            <span className="text-xs text-gray-400 ml-1">(Terminus)</span>
          )}
        </div>
      </div>

      {/* Name input with randomize button */}
      <div className="mb-4">
        <label htmlFor="station-name" className="block text-xs text-gray-500 mb-1">
          Name
        </label>
        <div className="flex gap-2">
          <input
            id="station-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter station name"
          />
          <button
            onClick={handleRandomize}
            className="px-2 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            title="Generate random name"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Lines served */}
      {station.lines.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">Lines Served</label>
          <div className="space-y-1">
            {station.lines.map((line) => (
              <div key={line.id} className="flex items-center gap-2 text-sm text-gray-700">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: line.color }}
                />
                <span>{line.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          disabled={!hasChanges || isUpdating}
          className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isUpdating || !name.trim()}
          className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUpdating ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(station.id)}
          disabled={isUpdating}
          className="w-full mt-2 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Delete Station
        </button>
      )}
    </div>
  );
}
