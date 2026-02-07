/**
 * Dialog for editing transit line properties (name, color, type).
 *
 * Shown when the user starts drawing a new transit line to set its properties.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { TransitLineProperties } from "../canvas/TransitLineDrawingContext";
import type { LineType } from "../../api/types";

// CITY-362: Validate hex color format (#RRGGBB)
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

// Predefined color palette for transit lines
const LINE_COLORS = [
  { name: "Red", value: "#B22222" },
  { name: "Green", value: "#2E8B57" },
  { name: "Blue", value: "#4169E1" },
  { name: "Gold", value: "#DAA520" },
  { name: "Brown", value: "#8B4513" },
  { name: "Purple", value: "#663399" },
  { name: "Orange", value: "#FF6600" },
  { name: "Teal", value: "#008080" },
];

const LINE_TYPES: { label: string; value: LineType }[] = [
  { label: "Rail (Heavy Rail)", value: "rail" },
  { label: "Subway (Underground)", value: "subway" },
];

interface TransitLinePropertiesDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Initial properties to populate the form */
  initialProperties?: TransitLineProperties;
  /** Callback when properties are confirmed */
  onConfirm: (properties: TransitLineProperties) => void;
  /** Callback when dialog is cancelled */
  onCancel: () => void;
}

export function TransitLinePropertiesDialog({
  isOpen,
  initialProperties,
  onConfirm,
  onCancel,
}: TransitLinePropertiesDialogProps) {
  const [name, setName] = useState(initialProperties?.name || "New Line");
  const [color, setColor] = useState(initialProperties?.color || LINE_COLORS[0].value);
  const [lineType, setLineType] = useState<LineType>(initialProperties?.type || "rail");
  const [customColor, setCustomColor] = useState("");
  const [colorError, setColorError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen && initialProperties) {
      setName(initialProperties.name);
      setColor(initialProperties.color);
      setLineType(initialProperties.type);

      // Check if color is custom (not in palette)
      const isCustomColor = !LINE_COLORS.some((c) => c.value === initialProperties.color);
      if (isCustomColor) {
        setCustomColor(initialProperties.color);
      } else {
        setCustomColor("");
      }
    }
  }, [isOpen, initialProperties]);

  // Focus name input when dialog opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    // CITY-362: Validate hex color before confirming
    const finalColor = customColor || color;
    if (!isValidHexColor(finalColor)) {
      setColorError("Invalid color format. Use #RRGGBB (e.g. #FF6600).");
      return;
    }
    setColorError("");
    onConfirm({
      name: name.trim() || "Unnamed Line",
      color: finalColor,
      type: lineType,
    });
  }, [name, color, customColor, lineType, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [handleConfirm, onCancel]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw]"
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Transit Line Properties
        </h2>

        {/* Name input */}
        <div className="mb-4">
          <label
            htmlFor="line-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Line Name
          </label>
          <input
            ref={nameInputRef}
            id="line-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter line name"
          />
        </div>

        {/* Line type selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Line Type
          </label>
          <div className="space-y-2">
            {LINE_TYPES.map((type) => (
              <label
                key={type.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="line-type"
                  value={type.value}
                  checked={lineType === type.value}
                  onChange={() => setLineType(type.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-900">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Line Color
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {LINE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setColor(c.value);
                  setCustomColor("");
                  setColorError("");
                }}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  color === c.value && !customColor
                    ? "border-gray-900 scale-110"
                    : "border-transparent hover:border-gray-400"
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
                aria-label={`Select ${c.name} color`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="custom-color" className="text-sm text-gray-600">
              Custom:
            </label>
            <input
              id="custom-color"
              type="color"
              value={customColor || color}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setColorError("");
              }}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300"
            />
            {customColor && (
              <span className="text-sm text-gray-500">{customColor}</span>
            )}
          </div>
          {colorError && (
            <p className="text-xs text-red-600 mt-1">{colorError}</p>
          )}
        </div>

        {/* Preview */}
        <div className="mb-6 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">Preview:</div>
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0"
              style={{ backgroundColor: customColor || color }}
            />
            <div>
              <div className="font-medium text-gray-900">
                {name.trim() || "Unnamed Line"}
              </div>
              <div className="text-xs text-gray-500">
                {lineType === "subway" ? "Subway" : "Rail"}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Start Drawing
          </button>
        </div>
      </div>
    </div>
  );
}
