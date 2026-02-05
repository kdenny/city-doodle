/**
 * Layer visibility toggle controls.
 */

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
  districts: "Districts",
  roads: "Roads",
  pois: "POIs",
  bridges: "Bridges",
  grid: "Grid",
  labels: "Labels",
  subwayTunnels: "Subway Lines",
};

export function LayerControls({ visibility, onChange }: LayerControlsProps) {
  const toggleLayer = (layer: keyof LayerVisibility) => {
    onChange({
      ...visibility,
      [layer]: !visibility[layer],
    });
  };

  return (
    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Layers</h3>
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
