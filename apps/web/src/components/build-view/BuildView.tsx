import { ReactNode, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Toolbar, useToolbar, Tool } from "./Toolbar";
import { LayersPanel, useLayers, LayerVisibility } from "./LayersPanel";
import { PopulationPanel } from "./PopulationPanel";
import { CityNeedsPanel, CityNeeds } from "./CityNeedsPanel";
import { CityNeedsModal } from "./CityNeedsModal";
import { ScaleBar } from "./ScaleBar";
import { InspectorPanel, type SelectedFeature } from "./InspectorPanel";
import { TransitLinePropertiesDialog } from "./TransitLinePropertiesDialog";
import { useSelectionContextOptional } from "./SelectionContext";
import { useZoomOptional } from "../shell/ZoomContext";
import { useDrawingOptional } from "../canvas/DrawingContext";
import { useTransitLineDrawingOptional, usePopulationStats } from "../canvas";
import type { TransitLineProperties } from "../canvas";
import { useEditLockOptional } from "../shell/EditLockContext";
import { useCreateJob, useJobPolling, queryKeys } from "../../api/hooks";

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
  population: populationProp,
  growthPercent: growthPercentProp,
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

  // Get transit line drawing context
  const transitLineDrawingContext = useTransitLineDrawingOptional();

  // Get edit lock context for gating tools
  const editLock = useEditLockOptional();
  const isEditing = editLock?.isEditing ?? true; // default to true if no provider

  // City growth simulation
  const { worldId } = useParams<{ worldId: string }>();
  const queryClient = useQueryClient();
  const createJob = useCreateJob();
  const [growthJobId, setGrowthJobId] = useState<string | null>(null);
  const { status: growthStatus } = useJobPolling(growthJobId);

  // Refresh districts when growth job completes
  useEffect(() => {
    if (growthStatus === "completed" && worldId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.worldDistricts(worldId) });
      setGrowthJobId(null);
    } else if (growthStatus === "failed") {
      setGrowthJobId(null);
    }
  }, [growthStatus, worldId, queryClient]);

  const isGrowing = growthJobId !== null && growthStatus !== "completed" && growthStatus !== "failed";

  const handleGrow = useCallback(
    (timeStep: number) => {
      if (!worldId || isGrowing) return;
      createJob.mutate(
        { type: "city_growth", params: { world_id: worldId, time_step: timeStep } },
        { onSuccess: (job) => setGrowthJobId(job.id) }
      );
    },
    [worldId, isGrowing, createJob]
  );

  // Note: Transit context is used by TransitLineDrawingProvider in EditorShell
  // We don't need direct access here, but the hook call ensures the provider exists

  // State for showing transit line properties dialog
  const [showLinePropertiesDialog, setShowLinePropertiesDialog] = useState(false);

  // State for showing city needs modal
  const [showCityNeedsModal, setShowCityNeedsModal] = useState(false);

  // Start/stop drawing mode when tool changes
  useEffect(() => {
    if (!drawingContext) return;

    if (activeTool === "draw") {
      // Start drawing neighborhood when draw tool is selected
      drawingContext.startDrawing("neighborhood");
    } else if (activeTool === "city-limits") {
      // Start drawing city limits when city-limits tool is selected
      drawingContext.startDrawing("cityLimits");
    } else if (activeTool === "split") {
      // Start split mode when split tool is selected
      drawingContext.startDrawing("split");
    } else if (activeTool === "draw-road") {
      // Start road drawing mode (CITY-253)
      drawingContext.startDrawing("road");
    } else if (activeTool === "draw-highway") {
      drawingContext.startDrawing("highway");
    } else {
      // Cancel drawing when switching away from draw tools
      if (drawingContext.state.isDrawing) {
        drawingContext.cancelDrawing();
      }
    }
  }, [activeTool, drawingContext]);

  // Switch back to pan tool when drawing is completed
  useEffect(() => {
    if (!drawingContext) return;

    // If we were drawing and now we're not (polygon completed), switch to pan
    const isDrawingTool = activeTool === "draw" || activeTool === "city-limits" || activeTool === "split" || activeTool === "draw-road" || activeTool === "draw-highway";
    if (isDrawingTool && !drawingContext.state.isDrawing && drawingContext.state.mode === null) {
      setActiveTool("pan");
    }
  }, [activeTool, drawingContext?.state.isDrawing, drawingContext?.state.mode, setActiveTool]);

  // Handle transit-line tool - show properties dialog first
  useEffect(() => {
    if (!transitLineDrawingContext) return;

    if (activeTool === "transit-line") {
      // Show properties dialog when tool is selected
      if (!transitLineDrawingContext.state.isDrawing && !showLinePropertiesDialog) {
        setShowLinePropertiesDialog(true);
      }
    } else {
      // Cancel transit line drawing when switching away from transit-line tool
      if (transitLineDrawingContext.state.isDrawing) {
        transitLineDrawingContext.cancelDrawing();
      }
      // Also close the properties dialog if it's open (CITY-284)
      if (showLinePropertiesDialog) {
        setShowLinePropertiesDialog(false);
      }
    }
  }, [activeTool, transitLineDrawingContext, showLinePropertiesDialog]);

  // Switch back to pan tool when transit line drawing is completed
  useEffect(() => {
    if (!transitLineDrawingContext) return;

    // If we were drawing and now we're not, switch to pan
    if (activeTool === "transit-line" && !transitLineDrawingContext.state.isDrawing && !showLinePropertiesDialog) {
      setActiveTool("pan");
    }
  }, [activeTool, transitLineDrawingContext?.state.isDrawing, showLinePropertiesDialog, setActiveTool]);

  // Handle transit line properties confirmation
  const handleLinePropertiesConfirm = useCallback(
    (properties: TransitLineProperties) => {
      setShowLinePropertiesDialog(false);
      if (transitLineDrawingContext) {
        transitLineDrawingContext.setLineProperties(properties);
        transitLineDrawingContext.startDrawing();
      }
    },
    [transitLineDrawingContext]
  );

  // Handle transit line properties cancel
  const handleLinePropertiesCancel = useCallback(() => {
    setShowLinePropertiesDialog(false);
    setActiveTool("pan");
  }, [setActiveTool]);

  // Calculate population from placed districts, fallback to props
  const populationStats = usePopulationStats();
  const population = populationStats?.totalPopulation ?? populationProp ?? 0;
  const growthPercent = populationStats?.growthPercent ?? growthPercentProp ?? 0;

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
    setShowCityNeedsModal(true);
  }, [onCityNeedsClick]);

  const handleCloseCityNeedsModal = useCallback(() => {
    setShowCityNeedsModal(false);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Map content */}
      {children}

      {/* Scale bar (top) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <ScaleBar zoom={zoomContext?.zoom} />
      </div>

      {/* Toolbar (bottom-center) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <Toolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          disabled={!isEditing}
          onGrow={handleGrow}
          growDisabled={!worldId}
          isGrowing={isGrowing}
        />
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
          readOnly={!isEditing}
        />
      </div>

      {/* Drawing mode hint (above toolbar, when drawing) */}
      {drawingContext?.state.isDrawing && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-sm text-gray-700">
            {drawingContext.state.mode === "road" || drawingContext.state.mode === "highway" ? (
              <div className="flex items-center gap-3">
                <span>
                  {drawingContext.state.vertices.length === 0 ? (
                    <>Click to place the start of the {drawingContext.state.mode === "highway" ? "highway" : "road"}</>
                  ) : (
                    <>Click to add {drawingContext.state.mode === "highway" ? "highway" : "road"} points • Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Enter</kbd> to finish</>
                  )}
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Esc</kbd> to cancel
                </span>
              </div>
            ) : drawingContext.state.mode === "split" ? (
              <div className="flex items-center gap-3">
                <span>
                  {drawingContext.state.vertices.length === 0 ? (
                    <>Click to place the start of the split line</>
                  ) : (
                    <>Click to place the end of the split line • Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Enter</kbd> to confirm</>
                  )}
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Esc</kbd> to cancel
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span>
                  {drawingContext.state.isFreehandActive ? (
                    <>Drawing freehand... release to complete</>
                  ) : (
                    <>Click to place vertices • Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Enter</kbd> or click first vertex to complete</>
                  )}
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">
                  Hold <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Shift</kbd> + drag for freehand
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CITY-361: Transit line drawing hint (above toolbar, when drawing transit line) */}
      {transitLineDrawingContext?.state.isDrawing && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-sm text-gray-700">
            <div className="flex items-center gap-3">
              <span>
                {transitLineDrawingContext.state.connectedStations.length === 0 ? (
                  <>Click a station to start the line</>
                ) : (
                  <>Click another station to extend the line</>
                )}
              </span>
              {transitLineDrawingContext.state.connectedStations.length >= 2 && (
                <>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={() => transitLineDrawingContext.undoLastConnection()}
                    className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    title="Undo last connection (Ctrl+Z)"
                  >
                    Undo
                  </button>
                </>
              )}
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">
                Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Enter</kbd> to finish
                {" / "}
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Esc</kbd> to cancel
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Transit line properties dialog */}
      <TransitLinePropertiesDialog
        isOpen={showLinePropertiesDialog}
        initialProperties={transitLineDrawingContext?.state.lineProperties || undefined}
        onConfirm={handleLinePropertiesConfirm}
        onCancel={handleLinePropertiesCancel}
      />

      {/* City needs modal */}
      {showCityNeedsModal && (
        <CityNeedsModal needs={cityNeeds} onClose={handleCloseCityNeedsModal} />
      )}
    </div>
  );
}
