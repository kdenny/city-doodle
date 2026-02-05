import { ReactNode, useCallback, useState } from "react";
import { ViewModeProvider, useViewMode, ViewMode } from "./ViewModeContext";
import { ZoomProvider, useZoom } from "./ZoomContext";
import { Header } from "./Header";
import { ZoomControls } from "./ZoomControls";
import { HelpButton } from "./HelpButton";
import {
  PlacementPalette,
  PlacementProvider,
  PlacedSeedsProvider,
  usePlacedSeeds,
  type SeedType,
} from "../palette";
import type { DistrictPersonality, Point } from "../canvas/layers/types";
import { MapCanvasProvider, FeaturesProvider, useFeatures, TerrainProvider, TransitProvider, useTransitOptional, useTransit, TransitLineDrawingProvider } from "../canvas";
import type { TransitLineProperties } from "../canvas";
import type { RailStationData } from "../canvas/layers";
import { DrawingProvider, type DrawingMode } from "../canvas/DrawingContext";
import { generateNeighborhoodName } from "../../utils/nameGenerator";
import { ExportView } from "../export-view";
import { TimelapseView } from "../timelapse-view";
import { DensityView } from "../density-view";
import { TransitView } from "../transit-view";
import {
  BuildView,
  SelectionProvider,
  type SelectedFeature,
} from "../build-view";

interface EditorShellProps {
  children: ReactNode;
  worldId?: string;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

// Helper to render the appropriate view wrapper based on viewMode
function ViewWrapper({
  viewMode,
  children,
}: {
  viewMode: ViewMode;
  children: ReactNode;
}) {
  switch (viewMode) {
    case "export":
      return <ExportView>{children}</ExportView>;
    case "timelapse":
      return <TimelapseView>{children}</TimelapseView>;
    case "density":
      return <DensityView>{children}</DensityView>;
    case "transit":
      return <TransitView>{children}</TransitView>;
    case "build":
    default:
      return <BuildView>{children}</BuildView>;
  }
}

// Inner component that can access the ViewMode and Zoom contexts
function EditorShellContent({
  children,
  onHelp,
}: {
  children: ReactNode;
  onHelp: () => void;
}) {
  const { viewMode } = useViewMode();
  const { zoom, zoomIn, zoomOut } = useZoom();
  const showPalette = viewMode === "build";
  const showZoomControls = viewMode !== "export"; // Export view has its own controls

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100">
      <Header />

      {/* Main content area */}
      <main className="flex-1 relative overflow-hidden">
        {/* View-specific wrapper with canvas */}
        <ViewWrapper viewMode={viewMode}>{children}</ViewWrapper>

        {/* Left side: Placement palette (only in build mode) */}
        {showPalette && (
          <div className="absolute top-4 left-4 z-10">
            <PlacementPalette />
          </div>
        )}

        {/* Bottom-right controls (not shown in export view) */}
        {showZoomControls && (
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
            <HelpButton onClick={onHelp} />
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Inner component that connects PlacementProvider with PlacedSeedsProvider.
 * This component has access to usePlacedSeeds and provides the onPlaceSeed callback.
 *
 * For district seeds, it generates actual district geometry (polygon + street grid)
 * and adds them to FeaturesContext instead of just showing a seed marker.
 * For POI and transit seeds, it still adds them as seed markers.
 */
function PlacementWithSeeds({ children }: { children: ReactNode }) {
  const { addSeed } = usePlacedSeeds();
  const { addDistrict } = useFeatures();
  const transitContext = useTransitOptional();

  const handlePlaceSeed = useCallback(
    async (
      seed: SeedType,
      position: { x: number; y: number },
      personality?: DistrictPersonality,
      generationSeed?: number
    ) => {
      if (seed.category === "district") {
        // For district seeds, generate actual district geometry
        // Pass personality settings and generation seed to be stored on the district
        const result = addDistrict(position, seed.id, { personality, seed: generationSeed });
        if (!result.generated) {
          // District overlapped, in water, or failed
          console.warn("Failed to place district:", result.error);
          return;
        }
        if (result.wasClipped) {
          console.info("District was clipped to avoid water overlap");
        }
        // Don't add a seed marker for districts - the geometry is enough
      } else if (seed.id === "rail_station" && transitContext) {
        // For rail station seeds, use the transit context to place them
        // This handles validation (must be in district) and auto-connection
        const station = await transitContext.placeRailStation(position);
        if (!station) {
          console.warn("Failed to place rail station - must be inside a district");
          return;
        }
        // Don't add a seed marker for rail stations - the transit layer renders them
      } else if (seed.id === "subway" && transitContext) {
        // For subway station seeds, use the transit context to place them
        // This handles validation (must be in district) and auto-connection
        const station = await transitContext.placeSubwayStation(position);
        if (!station) {
          console.warn("Failed to place subway station - must be inside a district");
          return;
        }
        // Don't add a seed marker for subway stations - the subway station layer renders them
      } else {
        // For other POI and transit seeds, add them as seed markers
        addSeed(seed, position);
      }
    },
    [addSeed, addDistrict, transitContext]
  );

  return (
    <PlacementProvider onPlaceSeed={handlePlaceSeed}>
      {children}
    </PlacementProvider>
  );
}

/**
 * Inner component that connects SelectionProvider to FeaturesContext and TransitContext.
 * This allows the inspector panel to persist edits to the database.
 */
function SelectionWithFeatures({ children }: { children: ReactNode }) {
  const { updateDistrict, removeDistrict, updateRoad, removeRoad, updateNeighborhood, removeNeighborhood } = useFeatures();
  const transitContext = useTransitOptional();

  const handleUpdate = useCallback(
    (feature: SelectedFeature) => {
      if (!feature) return;

      if (feature.type === "district") {
        updateDistrict(feature.id, {
          name: feature.name,
          type: feature.districtType as "residential" | "downtown" | "commercial" | "industrial" | "hospital" | "university" | "k12" | "park" | "airport",
          isHistoric: feature.isHistoric,
          personality: feature.personality,
        });
      } else if (feature.type === "road") {
        updateRoad(feature.id, {
          name: feature.name,
          roadClass: feature.roadClass as "highway" | "arterial" | "collector" | "local" | "trail",
        });
      } else if (feature.type === "neighborhood") {
        updateNeighborhood(feature.id, {
          name: feature.name,
        });
      }
      // TODO: Add update handlers for POIs when those are persisted
    },
    [updateDistrict, updateRoad, updateNeighborhood]
  );

  const handleDelete = useCallback(
    (feature: SelectedFeature) => {
      if (!feature) return;

      if (feature.type === "district") {
        removeDistrict(feature.id);
      } else if (feature.type === "road") {
        removeRoad(feature.id);
      } else if (feature.type === "neighborhood") {
        removeNeighborhood(feature.id);
      } else if (feature.type === "rail_station" && transitContext) {
        transitContext.removeRailStation(feature.id);
      } else if (feature.type === "subway_station" && transitContext) {
        transitContext.removeSubwayStation(feature.id);
      }
      // TODO: Add delete handlers for POIs when those are persisted
    },
    [removeDistrict, removeRoad, removeNeighborhood, transitContext]
  );

  return (
    <SelectionProvider onUpdate={handleUpdate} onDelete={handleDelete}>
      {children}
    </SelectionProvider>
  );
}

/**
 * Inner component that connects DrawingProvider to FeaturesContext.
 * Handles polygon completion to create neighborhoods.
 */
function DrawingWithFeatures({ children }: { children: ReactNode }) {
  const { addNeighborhood } = useFeatures();

  const handlePolygonComplete = useCallback(
    (points: Point[], mode: DrawingMode) => {
      if (mode === "neighborhood") {
        // Create a new neighborhood from the drawn polygon
        const neighborhood = {
          id: `neighborhood-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: generateNeighborhoodName(),
          polygon: { points },
          accentColor: "#4a90d9", // Default blue color
        };
        addNeighborhood(neighborhood);
      }
      // TODO: Handle "split" mode when implemented
    },
    [addNeighborhood]
  );

  return (
    <DrawingProvider onPolygonComplete={handlePolygonComplete}>
      {children}
    </DrawingProvider>
  );
}

/**
 * Inner component that connects TransitLineDrawingProvider to TransitContext.
 * Handles segment creation when drawing transit lines.
 */
function TransitLineDrawingWithTransit({ children }: { children: ReactNode }) {
  const transitContext = useTransit();
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);

  const handleSegmentCreate = useCallback(
    async (
      fromStation: RailStationData,
      toStation: RailStationData,
      lineProperties: TransitLineProperties,
      lineId: string | null
    ) => {
      // If no line exists yet, create one
      let actualLineId = lineId || currentLineId;
      if (!actualLineId) {
        const newLine = await transitContext.createLine({
          name: lineProperties.name,
          color: lineProperties.color,
          type: lineProperties.type,
        });
        if (newLine) {
          actualLineId = newLine.id;
          setCurrentLineId(newLine.id);
        } else {
          console.error("Failed to create transit line");
          return;
        }
      }

      // Create the segment
      const isUnderground = lineProperties.type === "subway";
      await transitContext.createLineSegment(
        actualLineId,
        fromStation.id,
        toStation.id,
        isUnderground
      );
    },
    [transitContext, currentLineId]
  );

  const handleLineComplete = useCallback(() => {
    // Reset the current line ID when drawing is complete
    setCurrentLineId(null);
  }, []);

  return (
    <TransitLineDrawingProvider
      onSegmentCreate={handleSegmentCreate}
      onLineComplete={handleLineComplete}
      existingLineCount={transitContext.lineCount}
    >
      {children}
    </TransitLineDrawingProvider>
  );
}

export function EditorShell({
  children,
  worldId,
  initialZoom = 1,
  onZoomChange,
}: EditorShellProps) {
  const handleHelp = useCallback(() => {
    // TODO: Open help modal
    console.log("Help clicked");
  }, []);

  return (
    <ViewModeProvider>
      <ZoomProvider initialZoom={initialZoom} onZoomChange={onZoomChange}>
        <TerrainProvider>
          <FeaturesProvider worldId={worldId}>
            <TransitProvider worldId={worldId}>
              <TransitLineDrawingWithTransit>
                <PlacedSeedsProvider worldId={worldId}>
                  <PlacementWithSeeds>
                    <SelectionWithFeatures>
                      <DrawingWithFeatures>
                        <MapCanvasProvider>
                          <EditorShellContent onHelp={handleHelp}>
                            {children}
                          </EditorShellContent>
                        </MapCanvasProvider>
                      </DrawingWithFeatures>
                    </SelectionWithFeatures>
                  </PlacementWithSeeds>
                </PlacedSeedsProvider>
              </TransitLineDrawingWithTransit>
            </TransitProvider>
          </FeaturesProvider>
        </TerrainProvider>
      </ZoomProvider>
    </ViewModeProvider>
  );
}
