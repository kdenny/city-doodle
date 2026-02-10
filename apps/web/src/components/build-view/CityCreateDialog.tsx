/**
 * CITY-564: Dialog shown when a city-limits polygon is completed.
 * Prompts the user for a city name and classification (core/suburb/town)
 * before creating the city via the API.
 */

import { useState } from "react";
import type { CityClassification } from "../../api/types";

interface CityCreateDialogProps {
  /** Default city name (auto-generated) */
  defaultName: string;
  /** Number of existing core cities (max 3 allowed) */
  existingCoreCount: number;
  /** Called when user confirms — passes name and classification */
  onConfirm: (name: string, classification: CityClassification) => void;
  /** Called when user cancels — polygon is discarded */
  onCancel: () => void;
  /** Whether the create mutation is in progress */
  isCreating?: boolean;
}

const CLASSIFICATIONS: { value: CityClassification; label: string; description: string }[] = [
  { value: "core", label: "Core City", description: "Major urban center (max 3 per world)" },
  { value: "suburb", label: "Suburb", description: "Suburban area near a core city" },
  { value: "town", label: "Town", description: "Independent small town" },
];

export function CityCreateDialog({
  defaultName,
  existingCoreCount,
  onConfirm,
  onCancel,
  isCreating = false,
}: CityCreateDialogProps) {
  const [name, setName] = useState(defaultName);
  const [classification, setClassification] = useState<CityClassification>("core");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("City name is required");
      return;
    }
    if (classification === "core" && existingCoreCount >= 3) {
      setError("Maximum of 3 core cities per world");
      return;
    }
    setError(null);
    onConfirm(trimmedName, classification);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const coreDisabled = existingCoreCount >= 3;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onKeyDown={handleKeyDown}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Create City
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Define the name and type for this city boundary.
              </p>
            </div>
          </div>

          {/* City name input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter city name"
              autoFocus
            />
          </div>

          {/* Classification selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Classification
            </label>
            <div className="space-y-2">
              {CLASSIFICATIONS.map(({ value, label, description }) => {
                const isOptionDisabled = value === "core" && coreDisabled;
                return (
                  <label
                    key={value}
                    className={`flex items-start gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                      classification === value
                        ? "border-blue-500 bg-blue-50"
                        : isOptionDisabled
                          ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                          : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="classification"
                      value={value}
                      checked={classification === value}
                      onChange={() => {
                        if (!isOptionDisabled) {
                          setClassification(value);
                          if (error) setError(null);
                        }
                      }}
                      disabled={isOptionDisabled}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {label}
                      </span>
                      <p className="text-xs text-gray-500">{description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-md p-2">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isCreating}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isCreating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create City"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
