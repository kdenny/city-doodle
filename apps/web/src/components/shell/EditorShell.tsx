import { ReactNode, useCallback, useState } from "react";
import { useToastOptional } from "../../contexts";
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
import { splitPolygonWithLine, findDistrictAtPoint } from "../canvas/layers/polygonUtils";
import { generateNeighborhoodName, generateCityName } from "../../utils/nameGenerator";
import { generateId } from "../../utils/idGenerator";
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
  const toast = useToastOptional();

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
          toast?.addToast(result.error || "Failed to place district", "warning");
          return;
        }
        if (result.wasClipped) {
          toast?.addToast("District was clipped to avoid water overlap", "info");
        }
        // Don't add a seed marker for districts - the geometry is enough
      } else if (seed.id === "rail_station" && transitContext) {
        // For rail station seeds, use the transit context to place them
        // This handles validation (must be in district) and auto-connection
        const station = await transitContext.placeRailStation(position);
        if (!station) {
          toast?.addToast("Rail station must be placed inside a district", "warning");
          return;
        }
        // Don't add a seed marker for rail stations - the transit layer renders them
      } else if (seed.id === "subway" && transitContext) {
        // For subway station seeds, use the transit context to place them
        // This handles validation (must be in district) and auto-connection
        const station = await transitContext.placeSubwayStation(position);
        if (!station) {
          toast?.addToast("Subway station must be placed inside a district", "warning");
          return;
        }
        // Don't add a seed marker for subway stations - the subway station layer renders them
      } else {
        // For other POI and transit seeds, add them as seed markers
        addSeed(seed, position);
      }
    },
    [addSeed, addDistrict, transitContext, toast]
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
          gridAngle: feature.gridAngle,
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
 * Handles polygon completion to create neighborhoods, city limits, and split districts.
 */
function DrawingWithFeatures({ children }: { children: ReactNode }) {
  const { addNeighborhood, setCityLimits, features, removeDistrict, addDistrictWithGeometry, addRoads } = useFeatures();
  const toast = useToastOptional();

  const handlePolygonComplete = useCallback(
    (points: Point[], mode: DrawingMode) => {
      if (mode === "neighborhood") {
        // Create a new neighborhood from the drawn polygon
        const neighborhood = {
          id: generateId("neighborhood"),
          name: generateNeighborhoodName(),
          polygon: { points },
          accentColor: "#4a90d9", // Default blue color
        };
        addNeighborhood(neighborhood);
      } else if (mode === "cityLimits") {
        // Only one city limits per world - check if one already exists
        if (features.cityLimits) {
          toast?.addToast("City limits already exists. Remove existing limits first.", "warning");
          return;
        }

        // Create the city limits boundary
        const cityLimits = {
          id: generateId("city-limits"),
          boundary: { points },
          name: generateCityName(),
          established: new Date().getFullYear(),
        };
        setCityLimits(cityLimits);
      } else if (mode === "split") {
        // Split mode: points is a line (2 points) that divides a district
        if (points.length < 2) {
          toast?.addToast("Draw a line to split a district", "warning");
          return;
        }

        const lineStart = points[0];
        const lineEnd = points[1];

        // Find which district the line crosses (check midpoint)
        const midpoint = {
          x: (lineStart.x + lineEnd.x) / 2,
          y: (lineStart.y + lineEnd.y) / 2,
        };

        const districtsForSearch = features.districts.map((d) => ({
          id: d.id,
          polygon: d.polygon,
        }));

        const targetDistrictId = findDistrictAtPoint(midpoint, districtsForSearch);

        if (!targetDistrictId) {
          toast?.addToast("Line must cross a district to split it", "warning");
          return;
        }

        const targetDistrict = features.districts.find((d) => d.id === targetDistrictId);
        if (!targetDistrict) {
          toast?.addToast("District not found", "error");
          return;
        }

        // Attempt to split the district polygon
        const splitResult = splitPolygonWithLine(
          targetDistrict.polygon.points,
          lineStart,
          lineEnd
        );

        if (!splitResult.success || !splitResult.polygons) {
          toast?.addToast(splitResult.error || "Failed to split district", "warning");
          return;
        }

        const [polygon1Points, polygon2Points] = splitResult.polygons;

        // Create two new districts from the split
        const baseProps = {
          type: targetDistrict.type,
          name: targetDistrict.name,
          isHistoric: targetDistrict.isHistoric,
          personality: targetDistrict.personality,
          gridAngle: targetDistrict.gridAngle,
        };

        const newDistrict1 = {
          ...baseProps,
          id: generateId("district"),
          name: `${targetDistrict.name} (North)`,
          polygon: { points: polygon1Points },
          center: {
            x: polygon1Points.reduce((sum, p) => sum + p.x, 0) / polygon1Points.length,
            y: polygon1Points.reduce((sum, p) => sum + p.y, 0) / polygon1Points.length,
          },
        };

        const newDistrict2 = {
          ...baseProps,
          id: generateId("district"),
          name: `${targetDistrict.name} (South)`,
          polygon: { points: polygon2Points },
          center: {
            x: polygon2Points.reduce((sum, p) => sum + p.x, 0) / polygon2Points.length,
            y: polygon2Points.reduce((sum, p) => sum + p.y, 0) / polygon2Points.length,
          },
        };

        // Remove the original district and add the two new ones
        removeDistrict(targetDistrictId);
        addDistrictWithGeometry(newDistrict1);
        addDistrictWithGeometry(newDistrict2);

        toast?.addToast(`Split "${targetDistrict.name}" into two districts`, "info");
      }
    },
    [addNeighborhood, setCityLimits, features.cityLimits, features.districts, toast, removeDistrict, addDistrictWithGeometry, addRoads]
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
    // TODO: Open help modal (CITY-210)
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
