import { ReactNode, useCallback, useEffect } from "react";
import { Toolbar, useToolbar, Tool } from "./Toolbar";
import { LayersPanel, useLayers, LayerVisibility } from "./LayersPanel";
import { PopulationPanel } from "./PopulationPanel";
import { CityNeedsPanel, CityNeeds } from "./CityNeedsPanel";
import { ScaleBar } from "./ScaleBar";
import { InspectorPanel, type SelectedFeature } from "./InspectorPanel";
import { useSelectionContextOptional } from "./SelectionContext";
import { useZoomOptional } from "../shell/ZoomContext";
import { useDrawingOptional } from "../canvas/DrawingContext";

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
  selectedFeature: selectedFeatureProp,
  onToolChange,
  onLayerToggle,
  onCityNeedsClick,
  onFeatureUpdate: onFeatureUpdateProp,
  onFeatureDelete: onFeatureDeleteProp,
  onSelectionClear: onSelectionClearProp,
}: BuildViewProps) {
  const { activeTool, setActiveTool } = useToolbar();
  const { layers, toggleLayer } = useLayers();

  // Get zoom from context for scale bar
  const zoomContext = useZoomOptional();

  // Get selection from context if available, otherwise use props
  const selectionContext = useSelectionContextOptional();
  const selectedFeature = selectedFeatureProp ?? selectionContext?.selection ?? null;
  const onFeatureUpdate = onFeatureUpdateProp ?? selectionContext?.updateSelection;
  const onSelectionClear = onSelectionClearProp ?? selectionContext?.clearSelection;

  // Get drawing context for polygon drawing mode
  const drawingContext = useDrawingOptional();

  // Start/stop drawing mode when tool changes
  useEffect(() => {
    if (!drawingContext) return;

    if (activeTool === "draw") {
      // Start drawing neighborhood when draw tool is selected
      drawingContext.startDrawing("neighborhood");
    } else {
      // Cancel drawing when switching away from draw tool
      if (drawingContext.state.isDrawing) {
        drawingContext.cancelDrawing();
      }
    }
  }, [activeTool, drawingContext]);

  // Switch back to pan tool when drawing is completed
  useEffect(() => {
    if (!drawingContext) return;

    // If we were drawing and now we're not (polygon completed), switch to pan
    if (activeTool === "draw" && !drawingContext.state.isDrawing && drawingContext.state.mode === null) {
      setActiveTool("pan");
    }
  }, [activeTool, drawingContext?.state.isDrawing, drawingContext?.state.mode, setActiveTool]);

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
        <ScaleBar zoom={zoomContext?.zoom} />
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
          selection={selectedFeature}
          onUpdate={onFeatureUpdate}
          onDelete={onFeatureDeleteProp}
          onClose={onSelectionClear}
        />
      </div>
    </div>
  );
}
