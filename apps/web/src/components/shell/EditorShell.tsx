import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToastOptional } from "../../contexts";
import { useWorld, useDeleteTransitLineSegment, useWorldCities, useCreateCity } from "../../api";
import type { City, CityClassification } from "../../api/types";
import { WorldSettingsModal } from "../WorldSettingsModal";
import { ViewModeProvider, useViewMode, ViewMode } from "./ViewModeContext";
import { ZoomProvider, useZoom } from "./ZoomContext";
import { Header } from "./Header";
import { ZoomControls } from "./ZoomControls";
import { HelpButton } from "./HelpButton";
import { HelpModal } from "./HelpModal";
import {
  PlacementPalette,
  PlacementProvider,
  PlacedSeedsProvider,
  usePlacedSeeds,
  type SeedType,
  PARK_SIZE_CONFIG,
} from "../palette";
import { getParkSizeFromSeedId } from "../canvas/layers/parkGenerator";
import { AIRPORT_SIZE_WORLD_UNITS } from "../canvas/layers/airportGenerator";
import type { DistrictPersonality, Point } from "../canvas/layers/types";
import { MapCanvasProvider, FeaturesProvider, useFeatures, useFeaturesDispatch, TerrainProvider, TransitProvider, useTransitOptional, useTransit, TransitLineDrawingProvider, useTransitLineDrawingOptional } from "../canvas";
import { useEndpointDragOptional } from "../canvas/EndpointDragContext";
import { useDrawingOptional } from "../canvas/DrawingContext";
import { usePlacementOptional } from "../palette/PlacementContext";
import { useSelectionContextOptional } from "../build-view/SelectionContext";
import { EditLockProvider, useEditLockOptional } from "./EditLockContext";
import type { TransitLineProperties } from "../canvas";
import type { RailStationData } from "../canvas/layers";
import { DrawingProvider, type DrawingMode, type SplitTarget } from "../canvas/DrawingContext";
import { splitPolygonByLine, validateSplitLine, polygonCentroid } from "../canvas/utils/polygonSplit";
import {
  findDistrictsCrossedByArterial,
  validateDiagonalForDistrict,
  splitGridStreetsAtArterial,
} from "../canvas/layers/diagonalArterialValidator";
import { detectInterchanges } from "../canvas/layers/interchangeDetection";
import { generateNeighborhoodName, generateCityName } from "../../utils/nameGenerator";
import { generateId } from "../../utils/idGenerator";
import polygonClipping from "polygon-clipping";
import { CityCreateDialog } from "../build-view/CityCreateDialog";
import { ExportView } from "../export-view";
import { TimelapseView } from "../timelapse-view";
import { DensityView } from "../density-view";
import { TransitView } from "../transit-view";
import {
  BuildView,
  SelectionProvider,
  type SelectedFeature,
} from "../build-view";
import { StationDeleteWarningModal } from "../build-view/StationDeleteWarningModal";

interface EditorShellProps {
  children: ReactNode;
  worldId?: string;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

// Helper to render the appropriate view wrapper based on viewMode
function ViewWrapper({
  viewMode,
  worldId,
  children,
}: {
  viewMode: ViewMode;
  worldId?: string;
  children: ReactNode;
}) {
  switch (viewMode) {
    case "export":
      return <ExportView>{children}</ExportView>;
    case "timelapse":
      return <TimelapseView worldId={worldId}>{children}</TimelapseView>;
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
  worldId,
  onHelp,
}: {
  children: ReactNode;
  worldId?: string;
  onHelp: () => void;
}) {
  const { viewMode } = useViewMode();
  const { zoom, zoomIn, zoomOut } = useZoom();
  const editLock = useEditLockOptional();
  const { data: world } = useWorld(worldId || "", { enabled: !!worldId });
  const [showSettings, setShowSettings] = useState(false);
  const isEditing = editLock?.isEditing ?? true;
  const showPalette = viewMode === "build" && isEditing;
  const showZoomControls = viewMode !== "export"; // Export view has its own controls

  // CITY-423/424/425/426/427: Clean up all editing states when view mode changes.
  // This prevents state leaks (active drawing, placement, drag, selection, highlighting)
  // from persisting into the wrong view mode.
  const placementCtx = usePlacementOptional();
  const drawingCtx = useDrawingOptional();
  const transitLineDrawingCtx = useTransitLineDrawingOptional();
  const endpointDragCtx = useEndpointDragOptional();
  const selectionCtx = useSelectionContextOptional();
  const transitCtx = useTransitOptional();

  const prevViewMode = useRef(viewMode);
  useEffect(() => {
    if (prevViewMode.current === viewMode) return;
    prevViewMode.current = viewMode;

    // Cancel any active drawing
    if (drawingCtx?.state.isDrawing) drawingCtx.cancelDrawing();
    // Cancel any active transit line drawing
    if (transitLineDrawingCtx?.state.isDrawing) transitLineDrawingCtx.cancelDrawing();
    // Cancel any active placement
    placementCtx?.cancelPlacing();
    // Cancel any active endpoint drag
    if (endpointDragCtx?.isDragging) endpointDragCtx.cancelDrag();
    // Clear feature selection
    selectionCtx?.clearSelection();
    // Clear transit line highlighting
    transitCtx?.setHighlightedLineId(null);
  }, [viewMode, drawingCtx, transitLineDrawingCtx, placementCtx, endpointDragCtx, selectionCtx, transitCtx]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100">
      <Header
        worldName={world?.name}
        onOpenSettings={world ? () => setShowSettings(true) : undefined}
      />

      {/* Main content area */}
      <main className="flex-1 relative overflow-hidden">
        {/* View-specific wrapper with canvas */}
        <ViewWrapper viewMode={viewMode} worldId={worldId}>{children}</ViewWrapper>

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
      {showSettings && world && (
        <WorldSettingsModal
          world={world}
          onClose={() => setShowSettings(false)}
        />
      )}
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
  const { addDistrict } = useFeaturesDispatch();
  const transitContext = useTransitOptional();
  const toast = useToastOptional();

  const handlePlaceSeed = useCallback(
    async (
      seed: SeedType,
      position: { x: number; y: number },
      personality?: DistrictPersonality,
      generationSeed?: number,
      fixedSize?: number
    ): Promise<boolean> => {
      if (seed.category === "district" || seed.category === "park" || seed.category === "airport") {
        // For district, park, and airport seeds, generate actual district geometry
        // Park seeds use park-specific sizing from PARK_SIZE_CONFIG
        // Airport seeds use airport-specific sizing
        let districtSize = fixedSize;
        if (seed.category === "park" && !fixedSize) {
          const parkSize = getParkSizeFromSeedId(seed.id);
          const sizeConfig = PARK_SIZE_CONFIG[parkSize];
          // Size is diameter (radius * 2) in world units
          districtSize = sizeConfig.radiusWorldUnits * 2;
        } else if (seed.category === "airport" && !fixedSize) {
          districtSize = AIRPORT_SIZE_WORLD_UNITS;
        }
        const result = addDistrict(position, seed.id, { personality, seed: generationSeed, size: districtSize });
        if (!result.generated) {
          // District overlapped, in water, or failed — return false to trigger visual error flash
          toast?.addToast(result.error || "Failed to place district", "warning");
          return false;
        }
        if (result.wasClipped) {
          toast?.addToast("District was clipped to avoid water overlap", "info");
        }
        // Don't add a seed marker for districts/parks/airports - the geometry is enough
      } else if (seed.id === "rail_station" && transitContext) {
        // For rail station seeds, use the transit context to place them
        // This handles validation (must be in district) and auto-connection
        const station = await transitContext.placeRailStation(position);
        if (!station) {
          toast?.addToast("Rail station must be placed inside a district", "warning");
          return false;
        }
        // Don't add a seed marker for rail stations - the transit layer renders them
      } else if (seed.id === "subway" && transitContext) {
        // For subway station seeds, use the transit context to place them
        // This handles validation (must be in district) and auto-connection
        const station = await transitContext.placeSubwayStation(position);
        if (!station) {
          toast?.addToast("Subway station must be placed inside a district", "warning");
          return false;
        }
        // Don't add a seed marker for subway stations - the subway station layer renders them
      } else {
        // For other POI and transit seeds, add them as seed markers
        addSeed(seed, position);
      }
      return true;
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
  const { updateDistrict, removeDistrict, updateRoad, removeRoad, updateNeighborhood, removeNeighborhood, updatePOI, removePOI } = useFeaturesDispatch();
  const transitContext = useTransitOptional();

  // CITY-528: Warning modal state for unsafe station deletion from inspector
  const [inspectorDeleteWarning, setInspectorDeleteWarning] = useState<{
    stationName: string;
    orphanedStations: string[];
    affectedLines: string[];
  } | null>(null);

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
          fillColor: feature.fillColor,
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
      } else if (feature.type === "poi") {
        updatePOI(feature.id, {
          name: feature.name,
          type: feature.poiType as "hospital" | "university" | "park" | "transit" | "shopping" | "civic" | "industrial",
        });
      } else if ((feature.type === "rail_station" || feature.type === "subway_station") && transitContext) {
        transitContext.renameStation(feature.id, feature.name);
      }
    },
    [updateDistrict, updateRoad, updateNeighborhood, updatePOI, transitContext]
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
        // CITY-528: Check deletion safety before removing
        const safety = transitContext.checkStationDeletionSafety(feature.id);
        if (!safety.safe) {
          setInspectorDeleteWarning({
            stationName: feature.name,
            orphanedStations: safety.wouldOrphanStations,
            affectedLines: safety.affectedLines,
          });
          return;
        }
        transitContext.removeRailStation(feature.id);
      } else if (feature.type === "subway_station" && transitContext) {
        // CITY-528: Check deletion safety before removing
        const safety = transitContext.checkStationDeletionSafety(feature.id);
        if (!safety.safe) {
          setInspectorDeleteWarning({
            stationName: feature.name,
            orphanedStations: safety.wouldOrphanStations,
            affectedLines: safety.affectedLines,
          });
          return;
        }
        transitContext.removeSubwayStation(feature.id);
      } else if (feature.type === "poi") {
        removePOI(feature.id);
      }
    },
    [removeDistrict, removeRoad, removeNeighborhood, transitContext, removePOI]
  );

  return (
    <SelectionProvider onUpdate={handleUpdate} onDelete={handleDelete}>
      {children}
      {/* CITY-528: Station deletion warning modal (triggered from inspector panel) */}
      {inspectorDeleteWarning && (
        <StationDeleteWarningModal
          stationName={inspectorDeleteWarning.stationName}
          orphanedStations={inspectorDeleteWarning.orphanedStations}
          affectedLines={inspectorDeleteWarning.affectedLines}
          onClose={() => setInspectorDeleteWarning(null)}
        />
      )}
    </SelectionProvider>
  );
}

/**
 * Inner component that connects DrawingProvider to FeaturesContext.
 * Handles polygon completion to create neighborhoods, city limits, and split districts.
 *
 * CITY-564: cityLimits mode now opens a CityCreateDialog instead of directly
 * creating a legacy city-limits polygon. The dialog collects name + classification,
 * then creates a City via the API. Boundary trimming auto-clips overlapping cities.
 */
function DrawingWithFeatures({ children, worldId }: { children: ReactNode; worldId?: string }) {
  const { addNeighborhood, removeNeighborhood, setCityLimits, features, removeDistrict, addDistrictWithGeometry, addRoads, removeRoad, addInterchanges } = useFeatures();
  const toast = useToastOptional();

  // CITY-564: City creation state
  const { data: cities = [] } = useWorldCities(worldId);
  const createCityMutation = useCreateCity();
  const [pendingCityPolygon, setPendingCityPolygon] = useState<Point[] | null>(null);
  const [isCreatingCity, setIsCreatingCity] = useState(false);

  const existingCoreCount = useMemo(
    () => cities.filter((c) => c.classification === "core").length,
    [cities]
  );

  /**
   * CITY-564: Trim a new city boundary against all existing city boundaries.
   * Uses polygon-clipping.difference to subtract existing boundaries from the new one.
   */
  const trimBoundary = useCallback(
    (newPoints: Point[], existingCities: City[]): Point[] | null => {
      if (existingCities.length === 0) return newPoints;

      const toRing = (pts: Point[]): [number, number][] =>
        pts.map((p) => [p.x, p.y]);

      let result: [number, number][][][] = [[toRing(newPoints)]];

      for (const city of existingCities) {
        // Extract points from city boundary (GeoJSON-style)
        const boundary = city.boundary as { points?: Array<{ x: number; y: number }>; type?: string; coordinates?: number[][][] };
        let existingPoints: Point[];
        if (boundary.points && Array.isArray(boundary.points)) {
          existingPoints = boundary.points.map((p) => ({ x: p.x, y: p.y }));
        } else if (boundary.type === "Polygon" && Array.isArray(boundary.coordinates)) {
          const coords = boundary.coordinates[0] as number[][];
          existingPoints = coords.map((c) => ({ x: c[0], y: c[1] }));
          // Remove closing point if present
          if (existingPoints.length > 1 &&
            existingPoints[0].x === existingPoints[existingPoints.length - 1].x &&
            existingPoints[0].y === existingPoints[existingPoints.length - 1].y) {
            existingPoints = existingPoints.slice(0, -1);
          }
        } else {
          continue;
        }

        if (existingPoints.length < 3) continue;

        const clipPoly: [number, number][][][] = [[toRing(existingPoints)]];
        result = polygonClipping.difference(result, clipPoly) as [number, number][][][];
        if (result.length === 0) return null;
      }

      // Pick the largest polygon if multiple result
      let bestPoly: [number, number][] = result[0][0];
      if (result.length > 1) {
        let bestArea = 0;
        for (const multiPoly of result) {
          const ring = multiPoly[0];
          let area = 0;
          for (let i = 0; i < ring.length; i++) {
            const j = (i + 1) % ring.length;
            area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
          }
          area = Math.abs(area) / 2;
          if (area > bestArea) {
            bestArea = area;
            bestPoly = ring;
          }
        }
      }

      // Convert back to Point[] and strip closing duplicate
      let trimmedPoints = bestPoly.map(([x, y]) => ({ x, y }));
      if (
        trimmedPoints.length > 1 &&
        trimmedPoints[0].x === trimmedPoints[trimmedPoints.length - 1].x &&
        trimmedPoints[0].y === trimmedPoints[trimmedPoints.length - 1].y
      ) {
        trimmedPoints = trimmedPoints.slice(0, -1);
      }

      return trimmedPoints.length >= 3 ? trimmedPoints : null;
    },
    []
  );

  /**
   * CITY-564: Handle city creation dialog confirmation.
   * Trims boundary, creates city via API, and auto-links districts by centroid.
   */
  const handleCityConfirm = useCallback(
    (name: string, classification: CityClassification) => {
      if (!pendingCityPolygon || !worldId) return;

      // Trim boundary against existing cities
      const trimmedPoints = trimBoundary(pendingCityPolygon, cities);
      if (!trimmedPoints) {
        toast?.addToast("New city boundary is entirely inside existing cities", "warning");
        setPendingCityPolygon(null);
        return;
      }

      setIsCreatingCity(true);

      // Convert points to boundary format (same as CityCreate expects)
      const boundaryPoints = trimmedPoints.map((p) => ({ x: p.x, y: p.y }));
      // Close the polygon for GeoJSON
      const coords = trimmedPoints.map((p) => [p.x, p.y]);
      if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords.push([coords[0][0], coords[0][1]]);
      }

      createCityMutation.mutate(
        {
          worldId,
          data: {
            name,
            classification,
            boundary: { type: "Polygon", coordinates: [coords] },
            established: new Date().getFullYear(),
          },
        },
        {
          onSuccess: () => {
            toast?.addToast(`Created ${classification} city "${name}"`, "info");
            setPendingCityPolygon(null);
            setIsCreatingCity(false);

            // Also create legacy city limits for backward compatibility with rendering
            const cityLimits = {
              id: generateId("city-limits"),
              boundary: { points: boundaryPoints },
              name,
              established: new Date().getFullYear(),
            };
            setCityLimits(cityLimits);
          },
          onError: (error) => {
            toast?.addToast(`Failed to create city: ${error.message}`, "error");
            setIsCreatingCity(false);
          },
        }
      );
    },
    [pendingCityPolygon, worldId, cities, trimBoundary, createCityMutation, toast, setCityLimits]
  );

  const handleCityCancel = useCallback(() => {
    setPendingCityPolygon(null);
  }, []);

  const handlePolygonComplete = useCallback(
    (points: Point[], mode: DrawingMode, drawingRoadClass?: import("../canvas/layers/types").RoadClass, splitTarget?: SplitTarget | null) => {
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
        // CITY-564: Show city creation dialog instead of directly creating city limits
        setPendingCityPolygon(points);
      } else if (mode === "road") {
        // Road mode: create a user-drawn road from the polyline points (CITY-253, CITY-413)
        if (points.length < 2) {
          toast?.addToast("Road needs at least 2 points", "warning");
          return;
        }

        // Read road class from drawing callback (CITY-413)
        const roadClass = drawingRoadClass ?? "arterial";

        const road = {
          id: generateId("road"),
          name: undefined,
          roadClass,
          line: { points },
        };
        addRoads([road]);

        if (roadClass === "highway") {
          // Detect interchanges where this highway crosses existing roads (CITY-150)
          const interchanges = detectInterchanges(road, features.roads);
          if (interchanges.length > 0) {
            addInterchanges(interchanges);
            toast?.addToast(
              `Highway created with ${interchanges.length} interchange${interchanges.length > 1 ? "s" : ""}`,
              "info"
            );
          } else {
            toast?.addToast("Highway created", "info");
          }
        } else if (roadClass === "arterial") {
          // CITY-159: Detect diagonal arterial crossings through districts
          const crossedDistricts = findDistrictsCrossedByArterial(points, features.districts);
          let adjustedCount = 0;
          const warnings: string[] = [];

          for (const district of crossedDistricts) {
            const validation = validateDiagonalForDistrict(points, district, features.roads);
            if (!validation.isDiagonal) continue;
            if (validation.warning) {
              warnings.push(validation.warning);
              continue;
            }

            // Split grid streets at the diagonal arterial
            const adjustment = splitGridStreetsAtArterial(district.id, features.roads, points);
            if (adjustment.removedRoadIds.length > 0) {
              for (const id of adjustment.removedRoadIds) {
                removeRoad(id);
              }
              addRoads(adjustment.newRoads);
              adjustedCount++;
            }
          }

          if (warnings.length > 0) {
            toast?.addToast(warnings[0], "warning");
          } else if (adjustedCount > 0) {
            toast?.addToast(
              `Road created — adjusted grid in ${adjustedCount} district${adjustedCount > 1 ? "s" : ""}`,
              "info"
            );
          } else {
            toast?.addToast("Road created", "info");
          }
        } else {
          // collector, local, trail — just create the road
          toast?.addToast("Road created", "info");
        }
      } else if (mode === "split") {
        // CITY-565: Split mode — split the pre-selected feature with the drawn line
        if (points.length < 2) {
          toast?.addToast("Draw a line to split a feature", "warning");
          return;
        }

        if (!splitTarget) {
          toast?.addToast("No feature selected to split", "warning");
          return;
        }

        if (splitTarget.type === "district") {
          // --- District split ---
          const targetDistrict = features.districts.find((d) => d.id === splitTarget.id);
          if (!targetDistrict) {
            toast?.addToast("District not found", "error");
            return;
          }

          if (!validateSplitLine(targetDistrict.polygon.points, points)) {
            toast?.addToast("Split line must cross the feature boundary on both sides", "warning");
            return;
          }

          const districtResult = splitPolygonByLine(targetDistrict.polygon.points, points);
          if (!districtResult) {
            toast?.addToast("Failed to split district — line may not fully cross the boundary", "warning");
            return;
          }

          const [dp1, dp2] = districtResult;

          // Both new districts inherit the original's properties
          const baseProps = {
            type: targetDistrict.type,
            isHistoric: targetDistrict.isHistoric,
            personality: targetDistrict.personality,
            gridAngle: targetDistrict.gridAngle,
            fillColor: targetDistrict.fillColor,
          };

          // Determine directional labels based on centroid positions
          const c1 = polygonCentroid(dp1);
          const c2 = polygonCentroid(dp2);
          const ddy = c2.y - c1.y;
          const ddx = c2.x - c1.x;
          let label1: string, label2: string;
          if (Math.abs(ddy) > Math.abs(ddx)) {
            label1 = ddy > 0 ? "South" : "North";
            label2 = ddy > 0 ? "North" : "South";
          } else {
            label1 = ddx > 0 ? "West" : "East";
            label2 = ddx > 0 ? "East" : "West";
          }

          const newDistrict1 = {
            ...baseProps,
            id: generateId("district"),
            name: `${targetDistrict.name} (${label1})`,
            polygon: { points: dp1 },
          };

          const newDistrict2 = {
            ...baseProps,
            id: generateId("district"),
            name: `${targetDistrict.name} (${label2})`,
            polygon: { points: dp2 },
          };

          removeDistrict(splitTarget.id);
          addDistrictWithGeometry(newDistrict1);
          addDistrictWithGeometry(newDistrict2);

          toast?.addToast(`Split "${targetDistrict.name}" into two districts`, "info");
        } else if (splitTarget.type === "neighborhood") {
          // --- Neighborhood split ---
          const targetNeighborhood = features.neighborhoods.find((n) => n.id === splitTarget.id);
          if (!targetNeighborhood) {
            toast?.addToast("Neighborhood not found", "error");
            return;
          }

          if (!validateSplitLine(targetNeighborhood.polygon.points, points)) {
            toast?.addToast("Split line must cross the feature boundary on both sides", "warning");
            return;
          }

          const neighborhoodResult = splitPolygonByLine(targetNeighborhood.polygon.points, points);
          if (!neighborhoodResult) {
            toast?.addToast("Failed to split neighborhood — line may not fully cross the boundary", "warning");
            return;
          }

          const [np1, np2] = neighborhoodResult;

          const neighborhood1 = {
            id: generateId("neighborhood"),
            name: targetNeighborhood.name,
            polygon: { points: np1 },
            accentColor: targetNeighborhood.accentColor,
            labelColor: targetNeighborhood.labelColor,
          };

          const neighborhood2 = {
            id: generateId("neighborhood"),
            name: generateNeighborhoodName(),
            polygon: { points: np2 },
            accentColor: targetNeighborhood.accentColor,
            labelColor: targetNeighborhood.labelColor,
          };

          removeNeighborhood(splitTarget.id);
          addNeighborhood(neighborhood1);
          addNeighborhood(neighborhood2);

          toast?.addToast(`Split "${targetNeighborhood.name}" into two neighborhoods`, "info");
        }
      }
    },
    [addNeighborhood, features.districts, features.neighborhoods, features.roads, toast, removeDistrict, addDistrictWithGeometry, addRoads, removeRoad, addInterchanges, removeNeighborhood]
  );

  return (
    <DrawingProvider onPolygonComplete={handlePolygonComplete}>
      {children}
      {/* CITY-564: City creation dialog shown when city-limits polygon is completed */}
      {pendingCityPolygon && (
        <CityCreateDialog
          defaultName={generateCityName()}
          existingCoreCount={existingCoreCount}
          onConfirm={handleCityConfirm}
          onCancel={handleCityCancel}
          isCreating={isCreatingCity}
        />
      )}
    </DrawingProvider>
  );
}

/**
 * Inner component that connects TransitLineDrawingProvider to TransitContext.
 * Handles segment creation when drawing transit lines.
 */
function TransitLineDrawingWithTransit({ children }: { children: ReactNode }) {
  const transitContext = useTransit();
  const deleteSegment = useDeleteTransitLineSegment();

  const handleSegmentCreate = useCallback(
    async (
      fromStation: RailStationData,
      toStation: RailStationData,
      lineProperties: TransitLineProperties,
      lineId: string | null
    ): Promise<{ lineId: string; segmentId: string } | null> => {
      // If no line exists yet, create one
      let actualLineId = lineId;
      if (!actualLineId) {
        const newLine = await transitContext.createLine({
          name: lineProperties.name,
          color: lineProperties.color,
          type: lineProperties.type,
        });
        if (newLine) {
          actualLineId = newLine.id;
        } else {
          console.error("Failed to create transit line");
          return null;
        }
      }

      // Create the segment
      const isUnderground = lineProperties.type === "subway";
      const segmentId = await transitContext.createLineSegment(
        actualLineId,
        fromStation.id,
        toStation.id,
        isUnderground
      );

      if (!segmentId) return null;

      return { lineId: actualLineId, segmentId };
    },
    [transitContext]
  );

  // CITY-538: Delete a segment when the user undoes a connection during line drawing
  const handleSegmentUndo = useCallback(
    async (segmentId: string) => {
      const lineId = transitContext.transitNetwork?.lines.find((l) =>
        l.segments.some((s) => s.id === segmentId)
      )?.id;
      await deleteSegment.mutateAsync({
        segmentId,
        lineId: lineId ?? "",
        worldId: transitContext.transitNetwork?.stations[0]?.world_id,
      });
    },
    [transitContext.transitNetwork, deleteSegment]
  );

  const handleLineComplete = useCallback(() => {
    // Drawing context resets its own lineId on complete
  }, []);

  const existingLineNames = transitContext.transitNetwork?.lines.map((l) => l.name) ?? [];
  const existingLineColors = transitContext.transitNetwork?.lines.map((l) => l.color) ?? [];

  return (
    <TransitLineDrawingProvider
      onSegmentCreate={handleSegmentCreate}
      onSegmentUndo={handleSegmentUndo}
      onLineComplete={handleLineComplete}
      existingLineCount={transitContext.lineCount}
      existingLineNames={existingLineNames}
      existingLineColors={existingLineColors}
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
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleHelp = useCallback(() => {
    setShowHelpModal(true);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setShowHelpModal(false);
  }, []);

  return (
    <>
      <ViewModeProvider>
        <ZoomProvider initialZoom={initialZoom} onZoomChange={onZoomChange}>
          <TerrainProvider>
            <FeaturesProvider worldId={worldId}>
              <EditLockProvider worldId={worldId}>
                <TransitProvider worldId={worldId}>
                  <TransitLineDrawingWithTransit>
                    <PlacedSeedsProvider worldId={worldId}>
                      <PlacementWithSeeds>
                        <SelectionWithFeatures>
                          <DrawingWithFeatures worldId={worldId}>
                            <MapCanvasProvider>
                              <EditorShellContent worldId={worldId} onHelp={handleHelp}>
                                {children}
                              </EditorShellContent>
                            </MapCanvasProvider>
                          </DrawingWithFeatures>
                        </SelectionWithFeatures>
                      </PlacementWithSeeds>
                    </PlacedSeedsProvider>
                  </TransitLineDrawingWithTransit>
                </TransitProvider>
              </EditLockProvider>
            </FeaturesProvider>
          </TerrainProvider>
        </ZoomProvider>
      </ViewModeProvider>
      {showHelpModal && <HelpModal onClose={handleCloseHelp} />}
    </>
  );
}
