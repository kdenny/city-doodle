import { useState } from "react";

export interface LayerVisibility {
  transit: boolean;
  parks: boolean;
  density: boolean;
}

interface LayersPanelProps {
  layers: LayerVisibility;
  onLayerToggle: (layer: keyof LayerVisibility) => void;
}

const layerConfig: { id: keyof LayerVisibility; label: string; color: string }[] = [
  { id: "transit", label: "Transit", color: "bg-blue-500" },
  { id: "parks", label: "Parks", color: "bg-green-500" },
  { id: "density", label: "Density", color: "bg-orange-500" },
];

export function LayersPanel({ layers, onLayerToggle }: LayersPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-3 min-w-[140px]">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Layers</h3>
      <div className="flex flex-col gap-2">
        {layerConfig.map(({ id, label, color }) => (
          <label
            key={id}
            className="flex items-center gap-2 cursor-pointer text-sm"
          >
            <input
              type="checkbox"
              checked={layers[id]}
              onChange={() => onLayerToggle(id)}
              className="sr-only"
            />
            <span
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                layers[id]
                  ? `${color} border-transparent`
                  : "border-gray-300 bg-white"
              }`}
            >
              {layers[id] && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            <span className="text-gray-700">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function useLayers() {
  const [layers, setLayers] = useState<LayerVisibility>({
    transit: true,
    parks: true,
    density: false,
  });

  const toggleLayer = (layer: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  return { layers, toggleLayer };
}
