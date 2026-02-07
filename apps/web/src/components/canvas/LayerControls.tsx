/**
 * Layer visibility toggle controls.
 * Collapsible panel that can be toggled open/closed.
 */

import { useState } from "react";
import type { LayerVisibility } from "./layers";

interface LayerControlsProps {
  visibility: LayerVisibility;
  onChange: (visibility: LayerVisibility) => void;
}

const LAYER_LABELS: Record<keyof LayerVisibility, string> = {
  water: "Water",
  beaches: "Beaches",
  coastlines: "Coastlines",
  rivers: "Rivers",
  contours: "Contours",
  neighborhoods: "Neighborhoods",
  cityLimits: "City Limits",
  districts: "Districts",
  roads: "Roads",
  pois: "POIs",
  bridges: "Bridges",
  grid: "Grid",
  labels: "Labels",
  subwayTunnels: "Subway Lines",
};

export function LayerControls({ visibility, onChange }: LayerControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleLayer = (layer: keyof LayerVisibility) => {
    onChange({
      ...visibility,
      [layer]: !visibility[layer],
    });
  };

  // Collapsed state: small icon button
  if (!isExpanded) {
    return (
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-2 hover:bg-white transition-colors"
          title="Show layers"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </button>
      </div>
    );
  }

  // Expanded state: full panel
  return (
    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Layers</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Hide layers"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-1">
        {(Object.keys(visibility) as Array<keyof LayerVisibility>).map(
          (layer) => (
            <label
              key={layer}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
            >
              <input
                type="checkbox"
                checked={visibility[layer]}
                onChange={() => toggleLayer(layer)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                {LAYER_LABELS[layer]}
              </span>
            </label>
          )
        )}
      </div>
    </div>
  );
}
