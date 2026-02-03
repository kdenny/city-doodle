import { ReactNode, useCallback } from "react";
import { Toolbar, useToolbar, Tool } from "./Toolbar";
import { LayersPanel, useLayers, LayerVisibility } from "./LayersPanel";
import { PopulationPanel } from "./PopulationPanel";
import { CityNeedsPanel, CityNeeds } from "./CityNeedsPanel";
import { ScaleBar } from "./ScaleBar";
import {
  InspectorPanel,
  useSelection,
  type SelectedFeature,
} from "./InspectorPanel";

interface BuildViewProps {
  children: ReactNode;
  population?: number;
  growthPercent?: number;
  cityNeeds?: CityNeeds;
  selectedFeature?: SelectedFeature;
  onToolChange?: (tool: Tool) => void;
  onLayerToggle?: (layer: keyof LayerVisibility, visible: boolean) => void;
  onCityNeedsClick?: () => void;
  onFeatureUpdate?: (feature: SelectedFeature) => void;
  onFeatureDelete?: (feature: SelectedFeature) => void;
  onSelectionClear?: () => void;
}

const defaultNeeds: CityNeeds = {
  housing: "medium",
  water: "low",
  power: "low",
  health: "medium",
};

export function BuildView({
  children,
  population = 125000,
  growthPercent = 2.3,
  cityNeeds = defaultNeeds,
  selectedFeature,
  onToolChange,
  onLayerToggle,
  onCityNeedsClick,
  onFeatureUpdate,
  onFeatureDelete,
  onSelectionClear,
}: BuildViewProps) {
  const { activeTool, setActiveTool } = useToolbar();
  const { layers, toggleLayer } = useLayers();

  const handleToolChange = useCallback(
    (tool: Tool) => {
      setActiveTool(tool);
      onToolChange?.(tool);
    },
    [setActiveTool, onToolChange]
  );

  const handleLayerToggle = useCallback(
    (layer: keyof LayerVisibility) => {
      toggleLayer(layer);
      onLayerToggle?.(layer, !layers[layer]);
    },
    [toggleLayer, onLayerToggle, layers]
  );

  const handleCityNeedsClick = useCallback(() => {
    onCityNeedsClick?.();
    // TODO: Open city needs modal
    console.log("City needs clicked");
  }, [onCityNeedsClick]);

  return (
    <div className="relative w-full h-full">
      {/* Map content */}
      {children}

      {/* Scale bar (top) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <ScaleBar />
      </div>

      {/* Toolbar (top-left) */}
      <div className="absolute top-4 left-4">
        <Toolbar activeTool={activeTool} onToolChange={handleToolChange} />
      </div>

      {/* Layers panel (bottom-left) */}
      <div className="absolute bottom-4 left-4">
        <LayersPanel layers={layers} onLayerToggle={handleLayerToggle} />
      </div>

      {/* Population panel (top-right) */}
      <div className="absolute top-4 right-4">
        <PopulationPanel population={population} growthPercent={growthPercent} />
      </div>

      {/* City needs panel (right, below population) */}
      <div className="absolute top-20 right-4">
        <CityNeedsPanel needs={cityNeeds} onClick={handleCityNeedsClick} />
      </div>

      {/* Inspector panel (right, below city needs) */}
      <div className="absolute top-48 right-4">
        <InspectorPanel
          selection={selectedFeature ?? null}
          onUpdate={onFeatureUpdate}
          onDelete={onFeatureDelete}
          onClose={onSelectionClear}
        />
      </div>
    </div>
  );
}
