/**
 * Inspector panel for editing transit line properties (name, color).
 * Appears when a transit line is selected in the TransitLinesPanel.
 */

import { useState, useCallback, useEffect } from "react";

// Predefined color options for transit lines
const COLOR_OPTIONS = [
  { label: "Red", value: "#DC2626" },
  { label: "Blue", value: "#2563EB" },
  { label: "Green", value: "#16A34A" },
  { label: "Orange", value: "#EA580C" },
  { label: "Purple", value: "#7C3AED" },
  { label: "Yellow", value: "#CA8A04" },
  { label: "Brown", value: "#92400E" },
  { label: "Teal", value: "#0D9488" },
];

export interface SegmentDisplayData {
  id: string;
  fromStationName: string;
  toStationName: string;
  orderInLine: number;
}

interface TransitLineInspectorProps {
  /** The currently selected line */
  line: {
    id: string;
    name: string;
    color: string;
    lineType: "subway" | "rail";
    stations: number;
    miles: number;
    isCircular?: boolean;
  };
  /** Callback when the line is updated */
  onUpdate: (lineId: string, updates: { name?: string; color?: string }) => Promise<void>;
  /** Callback when the line is deleted */
  onDelete?: (lineId: string) => Promise<void>;
  /** CITY-363: Callback to extend the line from a terminus */
  onExtend?: (lineId: string) => void;
  /** Callback to close the inspector */
  onClose: () => void;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** Whether line extension is currently in progress */
  isExtending?: boolean;
  /** CITY-367: Segments for display with delete capability */
  segments?: SegmentDisplayData[];
  /** CITY-367: Callback to delete a segment */
  onDeleteSegment?: (segmentId: string) => void;
}

export function TransitLineInspector({
  line,
  onUpdate,
  onDelete,
  onExtend,
  onClose,
  isUpdating = false,
  isExtending = false,
  segments,
  onDeleteSegment,
}: TransitLineInspectorProps) {
  const [name, setName] = useState(line.name);
  const [color, setColor] = useState(line.color);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSegments, setShowSegments] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Reset state when line changes
  useEffect(() => {
    setName(line.name);
    setColor(line.color);
    setHasChanges(false);
  }, [line.id, line.name, line.color]);

  // Track changes
  useEffect(() => {
    const nameChanged = name !== line.name;
    const colorChanged = color !== line.color;
    setHasChanges(nameChanged || colorChanged);
  }, [name, color, line.name, line.color]);

  const handleSave = useCallback(async () => {
    const updates: { name?: string; color?: string } = {};
    if (name !== line.name) updates.name = name;
    if (color !== line.color) updates.color = color;

    if (Object.keys(updates).length > 0) {
      await onUpdate(line.id, updates);
    }
  }, [name, color, line.id, line.name, line.color, onUpdate]);

  const handleCancel = useCallback(() => {
    setName(line.name);
    setColor(line.color);
    setHasChanges(false);
  }, [line.name, line.color]);

  const lineTypeIcon = line.lineType === "subway" ? "🚇" : "🚂";
  const lineTypeLabel = line.lineType === "subway" ? "Subway Line" : "Rail Line";

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Edit Transit Line</h3>
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

      {/* Line type (read-only) */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">Type</label>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>{lineTypeIcon}</span>
          <span>{lineTypeLabel}</span>
        </div>
      </div>

      {/* Name input */}
      <div className="mb-4">
        <label htmlFor="line-name" className="block text-xs text-gray-500 mb-1">
          Name
        </label>
        <input
          id="line-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter line name"
        />
      </div>

      {/* Color picker */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-2">Color</label>
        <div className="grid grid-cols-4 gap-2">
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setColor(option.value)}
              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                color === option.value
                  ? "border-gray-800 scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: option.value }}
              title={option.label}
            />
          ))}
        </div>
        {/* Custom color input */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
            title="Custom color"
          />
          <span className="text-xs text-gray-500">{color}</span>
        </div>
      </div>

      {/* Stats (read-only) */}
      <div className="mb-4 py-2 border-t border-b border-gray-100">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{line.stations} stations</span>
          <span>{line.miles.toFixed(1)} miles</span>
        </div>
        {line.isCircular && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              ↻ Circular route
            </span>
          </div>
        )}
      </div>

      {/* CITY-367: Segments section */}
      {segments && segments.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowSegments(!showSegments)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showSegments ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Segments ({segments.length})
          </button>
          {showSegments && (
            <div className="mt-2 space-y-1">
              {[...segments].sort((a, b) => a.orderInLine - b.orderInLine).map((seg) => (
                <div
                  key={seg.id}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs bg-gray-50 rounded"
                >
                  <span className="truncate text-gray-700">
                    {seg.fromStationName} → {seg.toStationName}
                  </span>
                  {onDeleteSegment && (
                    confirmingDeleteId === seg.id ? (
                      <button
                        onClick={() => {
                          onDeleteSegment(seg.id);
                          setConfirmingDeleteId(null);
                        }}
                        onBlur={() => setConfirmingDeleteId(null)}
                        className="shrink-0 px-2 py-0.5 text-xs text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                      >
                        Confirm?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmingDeleteId(seg.id)}
                        className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete segment"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
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
          disabled={!hasChanges || isUpdating}
          className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUpdating ? "Saving..." : "Save"}
        </button>
      </div>

      {/* CITY-363: Extend line button (hidden for circular lines) */}
      {onExtend && line.stations >= 2 && !line.isCircular && (
        <button
          onClick={() => onExtend(line.id)}
          disabled={isUpdating || isExtending}
          className="w-full mt-2 px-3 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isExtending ? "Extending..." : "Extend Line"}
        </button>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(line.id)}
          disabled={isUpdating || isExtending}
          className="w-full mt-2 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Delete Line
        </button>
      )}
    </div>
  );
}
