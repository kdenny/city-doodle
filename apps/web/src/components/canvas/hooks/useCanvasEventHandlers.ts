/**
 * Hook encapsulating all pointer, keyboard, and context-menu event handlers
 * for the MapCanvas component.
 *
 * Handles: seed placement, feature selection, polygon/road drawing,
 * endpoint dragging, station dragging, transit line drawing, hover tooltips,
 * and right-click context menus.
 *
 * Extracted from MapCanvas to reduce the component's line count (CITY-231).
 */

import { useEffect, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
import type { Viewport } from "pixi-viewport";
import type {
  RailStationLayer,
  SubwayStationLayer,
  RoadEndpointLayer,
  FeaturesLayer,
  DrawingLayer,
  SeedsLayer,
  HitTestResult,
  RailStationData,
  District,
  Road,
  POI,
  Neighborhood,
  CityLimits,
} from "../layers";
import type { SelectedFeature } from "../../build-view/SelectionContext";
import type { SnapEngine } from "../snap";

/** Shape of the mutable ref that holds latest context values (updated every render). */
export interface EventStateRef {
  placementContext: {
    isPlacing: boolean;
    previewPosition: { x: number; y: number } | null;
    selectedSeed: { id: string; category: string; icon: string } | null;
    dragSize: number | null;
    dragOrigin?: { x: number; y: number } | null;
    isDraggingSize?: boolean;
    setPreviewPosition: (pos: { x: number; y: number }) => void;
    confirmPlacement: (pos: { x: number; y: number }, size?: number) => void;
    startDragSize: (pos: { x: number; y: number }) => void;
    updateDragSize: (size: number) => void;
    cancelDragSize: () => void;
  } | null;
  drawingContext: {
    state: {
      isDrawing: boolean;
      isFreehandActive: boolean;
      mode?: string | null;
      inputMode?: string;
      previewPoint?: { x: number; y: number } | null;
      vertices?: Array<{ x: number; y: number }>;
    };
    addVertex?: (pos: { x: number; y: number }) => void;
    canComplete?: () => boolean;
    completeDrawing?: () => void;
    cancelDrawing?: () => void;
    startFreehand?: (pos: { x: number; y: number }) => void;
    addFreehandPoint?: (pos: { x: number; y: number }) => void;
    endFreehand?: () => void;
    setPreviewPoint?: (pos: { x: number; y: number }) => void;
  } | null;
  endpointDragContext: {
    isDragging: boolean;
    dragState?: {
      roadId: string;
      endpointIndex: number;
      currentPosition: { x: number; y: number };
      isSnapped: boolean;
    } | null;
    startDrag?: (roadId: string, endpointIndex: number, position: { x: number; y: number }) => void;
    updateDrag?: (
      position: { x: number; y: number },
      snapInfo: { isSnapped: boolean; snapTargetId?: string; snapDescription?: string }
    ) => void;
    completeDrag?: () => { roadId: string; endpointIndex: number; newPosition: { x: number; y: number } } | null;
    cancelDrag?: () => void;
  } | null;
  transitLineDrawingContext: {
    state: {
      isDrawing: boolean;
      lineProperties?: { type?: string; color?: string } | null;
    };
    setPreviewPosition?: (pos: { x: number; y: number }) => void;
    setHoveredStation?: (station: RailStationData | null) => void;
    selectStation?: (station: RailStationData) => void;
    cancelDrawing?: () => void;
    completeDrawing?: () => void;
    undoLastConnection?: () => void;
  } | null;
  transitContext: {
    transitNetwork?: {
      lines: Array<{
        name: string;
        color: string;
        segments: Array<{ from_station_id: string; to_station_id: string }>;
      }>;
    } | null;
    getLinesForStation?: (stationId: string) => { id: string; name: string; color: string; lineType: string }[];
    placeRailStation: (
      pos: { x: number; y: number },
      opts?: { skipAutoConnect?: boolean }
    ) => Promise<{ id: string; name: string; position_x: number; position_y: number } | null>;
    placeSubwayStation: (
      pos: { x: number; y: number },
      opts?: { skipAutoConnect?: boolean }
    ) => Promise<{ id: string; name: string; position_x: number; position_y: number } | null>;
    moveStation: (id: string, type: "rail" | "subway", pos: { x: number; y: number }) => void;
  } | null;
  featuresContext: {
    features: {
      roads: Array<{ id: string; line: { points: Array<{ x: number; y: number }> } }>;
    };
    updateRoad: (id: string, updates: { line: { points: Array<{ x: number; y: number }> } }) => void;
  } | null;
  onFeatureSelect: ((feature: SelectedFeature | null) => void) | undefined;
  isEditingAllowed: boolean;
  viewMode: string;
  setHoveredStationTooltip: Dispatch<SetStateAction<StationTooltip | null>>;
  setHoveredPoiTooltip: Dispatch<SetStateAction<PoiTooltip | null>>;
  snapEngine: SnapEngine | null;
}

interface StationTooltip {
  name: string;
  stationType: "rail" | "subway";
  lines: { name: string; color: string }[];
  screenX: number;
  screenY: number;
}

interface PoiTooltip {
  name: string;
  poiType: string;
  screenX: number;
  screenY: number;
}

interface StationContextMenuState {
  x: number;
  y: number;
  stationId: string;
  stationName: string;
  stationType: "rail" | "subway";
}

interface UseCanvasEventHandlersParams {
  isReady: boolean;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  viewportRef: MutableRefObject<Viewport | null>;
  eventStateRef: MutableRefObject<EventStateRef>;
  // Layer refs needed for hit testing
  roadEndpointLayerRef: MutableRefObject<RoadEndpointLayer | null>;
  railStationLayerRef: MutableRefObject<RailStationLayer | null>;
  subwayStationLayerRef: MutableRefObject<SubwayStationLayer | null>;
  featuresLayerRef: MutableRefObject<FeaturesLayer | null>;
  drawingLayerRef: MutableRefObject<DrawingLayer | null>;
  seedsLayerRef: MutableRefObject<SeedsLayer | null>;
  // State setters for context menu
  setStationContextMenu: Dispatch<SetStateAction<StationContextMenuState | null>>;
}

/**
 * Registers all pointer, keyboard, and right-click event handlers for the
 * canvas viewport. Uses `eventStateRef` to read latest context values so
 * handlers are registered only once (keyed on `isReady`).
 */
export function useCanvasEventHandlers({
  isReady,
  containerRef,
  viewportRef,
  eventStateRef,
  roadEndpointLayerRef,
  railStationLayerRef,
  subwayStationLayerRef,
  featuresLayerRef,
  drawingLayerRef,
  seedsLayerRef,
  setStationContextMenu,
}: UseCanvasEventHandlersParams) {
  // Main pointer + keyboard event handler
  useEffect(() => {
    if (!isReady || !viewportRef.current) return;

    const viewport = viewportRef.current;

    // Track if we're dragging to avoid triggering click after drag
    let isDragging = false;
    let dragStartPos = { x: 0, y: 0 };
    const DRAG_THRESHOLD = 5;

    // CITY-302: Station drag state
    let stationDrag: {
      stationId: string;
      stationType: "rail" | "subway";
      originalPosition: { x: number; y: number };
    } | null = null;

    // Track Shift key state for freehand drawing toggle (via global keyboard events)
    let isShiftHeld = false;

    const handleShiftKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        isShiftHeld = true;
      }
    };

    const handleShiftKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        isShiftHeld = false;
      }
    };

    window.addEventListener("keydown", handleShiftKeyDown);
    window.addEventListener("keyup", handleShiftKeyUp);

    const handlePointerDown = (event: { global: { x: number; y: number } }) => {
      const s = eventStateRef.current;
      dragStartPos = { x: event.global.x, y: event.global.y };
      isDragging = false;

      // Block mutating interactions when not in edit mode
      if (!s.isEditingAllowed) return;

      const isDrawing = s.drawingContext?.state.isDrawing ?? false;
      const inputMode = s.drawingContext?.state.inputMode ?? "click";
      const startFreehand = s.drawingContext?.startFreehand;

      // Handle freehand drawing start (Shift + drag or freehand mode)
      if (isDrawing && startFreehand && (inputMode === "freehand" || isShiftHeld)) {
        const worldPos = viewport.toWorld(event.global.x, event.global.y);
        viewport.plugins.pause("drag");
        startFreehand({ x: worldPos.x, y: worldPos.y });
        return;
      }

      // Check for endpoint hit (CITY-147)
      const startEndpointDrag = s.endpointDragContext?.startDrag;
      if (roadEndpointLayerRef.current && startEndpointDrag) {
        const worldPos = viewport.toWorld(event.global.x, event.global.y);
        const endpointHit = roadEndpointLayerRef.current.hitTest(worldPos.x, worldPos.y);
        if (endpointHit) {
          viewport.plugins.pause("drag");
          startEndpointDrag(
            endpointHit.road.id,
            endpointHit.endpointIndex,
            endpointHit.position
          );
          return;
        }
      }

      // CITY-333: Start drag-to-size for district placement
      const pc = s.placementContext;
      if (pc?.isPlacing && pc.selectedSeed?.category === "district") {
        const worldPos = viewport.toWorld(event.global.x, event.global.y);
        viewport.plugins.pause("drag");
        pc.startDragSize({ x: worldPos.x, y: worldPos.y });
        return;
      }

      // CITY-302: Start station drag (only when no other tool/mode is active)
      const isLineDrawingActive = s.transitLineDrawingContext?.state.isDrawing ?? false;
      const isPlacingActive = s.placementContext?.isPlacing ?? false;
      if (!isDrawing && !isLineDrawingActive && !isPlacingActive) {
        const worldPos = viewport.toWorld(event.global.x, event.global.y);
        if (railStationLayerRef.current) {
          const railHit = railStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
          if (railHit) {
            viewport.plugins.pause("drag");
            stationDrag = {
              stationId: railHit.id,
              stationType: "rail",
              originalPosition: { x: railHit.position.x, y: railHit.position.y },
            };
            return;
          }
        }
        if (subwayStationLayerRef.current) {
          const subwayHit = subwayStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
          if (subwayHit) {
            viewport.plugins.pause("drag");
            stationDrag = {
              stationId: subwayHit.id,
              stationType: "subway",
              originalPosition: { x: subwayHit.position.x, y: subwayHit.position.y },
            };
            return;
          }
        }
      }
    };

    const handlePointerMove = (event: { global: { x: number; y: number } }) => {
      const s = eventStateRef.current;
      const dx = event.global.x - dragStartPos.x;
      const dy = event.global.y - dragStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        isDragging = true;
      }

      const worldPos = viewport.toWorld(event.global.x, event.global.y);

      const isEndpointDragging = s.endpointDragContext?.isDragging ?? false;
      const updateEndpointDrag = s.endpointDragContext?.updateDrag;

      // Handle endpoint dragging (CITY-147)
      if (isEndpointDragging && updateEndpointDrag && s.snapEngine) {
        const snapResult = s.snapEngine.findSnapPoint(worldPos.x, worldPos.y);

        if (snapResult.snapPoint) {
          updateEndpointDrag(
            { x: snapResult.snapPoint.x, y: snapResult.snapPoint.y },
            {
              isSnapped: true,
              snapTargetId: snapResult.snapPoint.geometryId,
              snapDescription: `Snapped to ${snapResult.snapPoint.geometryType}`,
            }
          );
        } else {
          updateEndpointDrag(
            { x: worldPos.x, y: worldPos.y },
            { isSnapped: false }
          );
        }
        return;
      }

      // CITY-302: Handle station drag movement
      if (stationDrag) {
        const sdx = worldPos.x - stationDrag.originalPosition.x;
        const sdy = worldPos.y - stationDrag.originalPosition.y;
        if (stationDrag.stationType === "rail" && railStationLayerRef.current) {
          railStationLayerRef.current.setStationOffset(stationDrag.stationId, sdx, sdy);
        } else if (stationDrag.stationType === "subway" && subwayStationLayerRef.current) {
          subwayStationLayerRef.current.setStationOffset(stationDrag.stationId, sdx, sdy);
        }
        return;
      }

      // Update hover state on endpoint layer (CITY-147)
      if (roadEndpointLayerRef.current && !isEndpointDragging) {
        const endpointHit = roadEndpointLayerRef.current.hitTest(worldPos.x, worldPos.y);
        if (endpointHit) {
          roadEndpointLayerRef.current.setHoveredEndpoint(endpointHit.endpointIndex);
        } else {
          roadEndpointLayerRef.current.setHoveredEndpoint(null);
        }
      }

      const pc = s.placementContext;
      const isPlacing = pc?.isPlacing ?? false;

      // CITY-333: Update drag size during district drag-to-size
      if (pc?.isDraggingSize && pc.dragOrigin) {
        const dx = worldPos.x - pc.dragOrigin.x;
        const dy = worldPos.y - pc.dragOrigin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const size = Math.max(30, Math.min(300, distance));
        pc.updateDragSize(size);
        return;
      }

      // Update preview position if placing seeds
      if (isPlacing && pc?.setPreviewPosition) {
        pc.setPreviewPosition({ x: worldPos.x, y: worldPos.y });
      }

      const isFreehandActive = s.drawingContext?.state.isFreehandActive ?? false;
      const addFreehandPoint = s.drawingContext?.addFreehandPoint;
      const isDrawing = s.drawingContext?.state.isDrawing ?? false;
      const setDrawingPreviewPoint = s.drawingContext?.setPreviewPoint;

      // Handle freehand drawing - add points while dragging
      if (isFreehandActive && addFreehandPoint) {
        addFreehandPoint({ x: worldPos.x, y: worldPos.y });
        return;
      }

      // Update preview point if drawing (click mode only)
      if (isDrawing && !isFreehandActive && setDrawingPreviewPoint) {
        setDrawingPreviewPoint({ x: worldPos.x, y: worldPos.y });
      }

      const isLineDrawing = s.transitLineDrawingContext?.state.isDrawing ?? false;

      // Update preview for transit line drawing
      // CITY-373: Check both rail and subway stations for hover
      if (isLineDrawing) {
        s.transitLineDrawingContext?.setPreviewPosition?.({ x: worldPos.x, y: worldPos.y });

        let hoveredStation: RailStationData | null = null;

        if (railStationLayerRef.current) {
          hoveredStation = railStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
        }

        if (!hoveredStation && subwayStationLayerRef.current) {
          const subwayHit = subwayStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
          if (subwayHit) {
            hoveredStation = {
              id: subwayHit.id,
              name: subwayHit.name,
              position: subwayHit.position,
              isTerminus: subwayHit.isTerminus,
              isHub: subwayHit.isHub,
            };
          }
        }

        s.transitLineDrawingContext?.setHoveredStation?.(hoveredStation);
      }

      // CITY-376: Station hover tooltip (transit view, non-drawing mode)
      if (s.viewMode === "transit" && !isLineDrawing) {
        let tooltipStation: { id: string; name: string; stationType: "rail" | "subway" } | null = null;

        if (railStationLayerRef.current) {
          const railHit = railStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
          if (railHit) {
            tooltipStation = { id: railHit.id, name: railHit.name, stationType: "rail" };
          }
        }
        if (!tooltipStation && subwayStationLayerRef.current) {
          const subwayHit = subwayStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
          if (subwayHit) {
            tooltipStation = { id: subwayHit.id, name: subwayHit.name, stationType: "subway" };
          }
        }

        if (tooltipStation) {
          const stationLines = (s.transitContext?.getLinesForStation?.(tooltipStation.id) ?? [])
            .map(l => ({ name: l.name, color: l.color }));
          const container = containerRef.current;
          const maxX = (container?.clientWidth ?? 800) - 200;
          const maxY = (container?.clientHeight ?? 600) - 60;
          s.setHoveredStationTooltip({
            name: tooltipStation.name,
            stationType: tooltipStation.stationType,
            lines: stationLines,
            screenX: Math.min(event.global.x + 12, maxX),
            screenY: Math.max(Math.min(event.global.y - 8, maxY), 4),
          });
        } else {
          s.setHoveredStationTooltip(null);
        }
      } else if (s.viewMode !== "transit") {
        s.setHoveredStationTooltip(null);
      }

      // CITY-405: POI hover tooltip (all view modes)
      if (featuresLayerRef.current) {
        const hitResult = featuresLayerRef.current.hitTest(worldPos.x, worldPos.y);
        if (hitResult && hitResult.type === "poi") {
          const poi = hitResult.feature as { name: string; type: string };
          const container = containerRef.current;
          const maxX = (container?.clientWidth ?? 800) - 200;
          const maxY = (container?.clientHeight ?? 600) - 60;
          s.setHoveredPoiTooltip({
            name: poi.name,
            poiType: poi.type,
            screenX: Math.min(event.global.x + 12, maxX),
            screenY: Math.max(Math.min(event.global.y - 8, maxY), 4),
          });
        } else {
          s.setHoveredPoiTooltip(null);
        }
      }
    };

    const handlePointerUp = async (event: { global: { x: number; y: number } }) => {
      const s = eventStateRef.current;
      const isFreehandActive = s.drawingContext?.state.isFreehandActive ?? false;
      const endFreehand = s.drawingContext?.endFreehand;
      const isEndpointDragging = s.endpointDragContext?.isDragging ?? false;
      const completeEndpointDrag = s.endpointDragContext?.completeDrag;

      // Handle freehand drawing completion (only if editing)
      if (s.isEditingAllowed && isFreehandActive && endFreehand) {
        endFreehand();
        viewport.plugins.resume("drag");
        return;
      }

      // Handle endpoint drag completion (CITY-147, only if editing)
      if (s.isEditingAllowed && isEndpointDragging && completeEndpointDrag && s.featuresContext) {
        const dragResult = completeEndpointDrag();
        if (dragResult) {
          const road = s.featuresContext.features.roads.find(
            (r) => r.id === dragResult.roadId
          );
          if (road) {
            const newPoints = [...road.line.points];
            newPoints[dragResult.endpointIndex] = dragResult.newPosition;
            s.featuresContext.updateRoad(dragResult.roadId, {
              line: { points: newPoints },
            });
          }
        }
        viewport.plugins.resume("drag");
        return;
      }

      // CITY-302: Handle station drag completion
      if (stationDrag && s.transitContext) {
        const worldPos = viewport.toWorld(event.global.x, event.global.y);
        if (stationDrag.stationType === "rail" && railStationLayerRef.current) {
          railStationLayerRef.current.setStationOffset(stationDrag.stationId, 0, 0);
        } else if (stationDrag.stationType === "subway" && subwayStationLayerRef.current) {
          subwayStationLayerRef.current.setStationOffset(stationDrag.stationId, 0, 0);
        }
        viewport.plugins.resume("drag");
        if (isDragging) {
          s.transitContext.moveStation(stationDrag.stationId, stationDrag.stationType, {
            x: worldPos.x, y: worldPos.y,
          });
        }
        const wasDragging = isDragging;
        stationDrag = null;
        if (wasDragging) return;
      }

      // CITY-364: Handle drag-to-size completion
      const pc = s.placementContext;
      if (s.isEditingAllowed && pc?.isDraggingSize && pc.dragOrigin && pc?.confirmPlacement) {
        viewport.plugins.resume("drag");
        const size = pc.dragSize;
        if (size && size >= 30) {
          pc.confirmPlacement(pc.dragOrigin, size);
        } else {
          pc.cancelDragSize();
          pc.confirmPlacement(pc.dragOrigin);
        }
        return;
      }

      // Don't trigger placement if we were dragging
      if (isDragging) return;

      const worldPos = viewport.toWorld(event.global.x, event.global.y);

      const isDrawing = s.drawingContext?.state.isDrawing ?? false;
      const addVertex = s.drawingContext?.addVertex;
      const canComplete = s.drawingContext?.canComplete;
      const completeDrawing = s.drawingContext?.completeDrawing;

      // Handle drawing mode (only if editing)
      if (s.isEditingAllowed && isDrawing && addVertex) {
        const drawingMode = s.drawingContext?.state.mode;
        if (drawingMode !== "road" && drawingMode !== "split" &&
            canComplete && canComplete() && drawingLayerRef.current?.isNearFirstVertex(worldPos)) {
          completeDrawing?.();
          return;
        }
        addVertex({ x: worldPos.x, y: worldPos.y });
        return;
      }

      const isLineDrawing = s.transitLineDrawingContext?.state.isDrawing ?? false;
      const selectStation = s.transitLineDrawingContext?.selectStation;

      // Handle transit line drawing mode (only if editing)
      if (s.isEditingAllowed && isLineDrawing && selectStation) {
        let clickedStation: RailStationData | null = null;

        if (railStationLayerRef.current) {
          clickedStation = railStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
        }

        if (!clickedStation && subwayStationLayerRef.current) {
          const subwayHit = subwayStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
          if (subwayHit) {
            clickedStation = {
              id: subwayHit.id,
              name: subwayHit.name,
              position: subwayHit.position,
              isTerminus: subwayHit.isTerminus,
              isHub: subwayHit.isHub,
            };
          }
        }

        if (clickedStation) {
          selectStation(clickedStation);
          return;
        }

        // CITY-394: Auto-create station when clicking empty space during line drawing
        const lineType = s.transitLineDrawingContext?.state.lineProperties?.type;
        if (s.transitContext && lineType) {
          const createStation = lineType === "subway"
            ? s.transitContext.placeSubwayStation
            : s.transitContext.placeRailStation;

          const newStation = await createStation(
            { x: worldPos.x, y: worldPos.y },
            { skipAutoConnect: true }
          );

          if (newStation) {
            selectStation({
              id: newStation.id,
              name: newStation.name,
              position: { x: newStation.position_x, y: newStation.position_y },
              isTerminus: false,
              isHub: false,
            });
          } else {
            seedsLayerRef.current?.showPlacementError({ x: worldPos.x, y: worldPos.y });
          }
        }
        return;
      }

      const isPlacing = pc?.isPlacing ?? false;
      const confirmPlacement = pc?.confirmPlacement;

      // Handle seed placement mode (only if editing)
      if (s.isEditingAllowed && isPlacing && confirmPlacement) {
        confirmPlacement({ x: worldPos.x, y: worldPos.y });
        return;
      }

      // Handle feature selection (default mode - always allowed)
      s.setHoveredStationTooltip(null);
      if (s.onFeatureSelect) {
        if (railStationLayerRef.current) {
          const railHit = railStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
          if (railHit) {
            s.onFeatureSelect({
              type: "rail_station",
              id: railHit.id,
              name: railHit.name,
              isTerminus: railHit.isTerminus,
              lineColor: railHit.lineColor,
            });
            return;
          }
        }

        if (subwayStationLayerRef.current) {
          const subwayHit = subwayStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
          if (subwayHit) {
            s.onFeatureSelect({
              type: "subway_station",
              id: subwayHit.id,
              name: subwayHit.name,
              isTerminus: subwayHit.isTerminus,
            });
            return;
          }
        }

        if (featuresLayerRef.current) {
          const hitResult = featuresLayerRef.current.hitTest(worldPos.x, worldPos.y);
          if (hitResult) {
            const selectedFeature = hitTestResultToSelectedFeature(hitResult);
            s.onFeatureSelect(selectedFeature);
            return;
          }
        }

        s.onFeatureSelect(null);
      }
    };

    // Keyboard handlers for drawing and endpoint drag cancellation
    const handleKeyDown = (event: KeyboardEvent) => {
      const s = eventStateRef.current;
      const isEndpointDragging = s.endpointDragContext?.isDragging ?? false;
      const isDrawing = s.drawingContext?.state.isDrawing ?? false;
      const isLineDrawing = s.transitLineDrawingContext?.state.isDrawing ?? false;

      // CITY-302: Cancel station drag
      if (stationDrag && event.key === "Escape") {
        event.preventDefault();
        if (stationDrag.stationType === "rail" && railStationLayerRef.current) {
          railStationLayerRef.current.setStationOffset(stationDrag.stationId, 0, 0);
        } else if (stationDrag.stationType === "subway" && subwayStationLayerRef.current) {
          subwayStationLayerRef.current.setStationOffset(stationDrag.stationId, 0, 0);
        }
        stationDrag = null;
        viewport.plugins.resume("drag");
        return;
      }

      // Handle endpoint drag cancellation (CITY-147)
      if (isEndpointDragging && event.key === "Escape") {
        event.preventDefault();
        s.endpointDragContext?.cancelDrag?.();
        viewport.plugins.resume("drag");
        return;
      }

      // Handle polygon drawing mode
      if (isDrawing) {
        if (event.key === "Escape") {
          event.preventDefault();
          s.drawingContext?.cancelDrawing?.();
        } else if (event.key === "Enter" && s.drawingContext?.canComplete && s.drawingContext.canComplete()) {
          event.preventDefault();
          s.drawingContext?.completeDrawing?.();
        }
        return;
      }

      // Handle transit line drawing mode
      if (isLineDrawing) {
        if (event.key === "Escape") {
          event.preventDefault();
          s.transitLineDrawingContext?.cancelDrawing?.();
        } else if (event.key === "Enter") {
          event.preventDefault();
          s.transitLineDrawingContext?.completeDrawing?.();
        } else if (event.key === "z" && (event.ctrlKey || event.metaKey)) {
          const tag = (document.activeElement as HTMLElement)?.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          event.preventDefault();
          s.transitLineDrawingContext?.undoLastConnection?.();
        }
        return;
      }
    };

    viewport.on("pointerdown", handlePointerDown);
    viewport.on("pointermove", handlePointerMove);
    viewport.on("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      viewport.off("pointerdown", handlePointerDown);
      viewport.off("pointermove", handlePointerMove);
      viewport.off("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", handleShiftKeyDown);
      window.removeEventListener("keyup", handleShiftKeyUp);
    };
  }, [isReady]);

  // CITY-528: Right-click context menu for stations
  useEffect(() => {
    const container = containerRef.current;
    if (!isReady || !container || !viewportRef.current) return;

    const handleContextMenu = (e: MouseEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = container.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = viewport.toWorld(screenX, screenY);

      if (railStationLayerRef.current) {
        const railHit = railStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
        if (railHit) {
          e.preventDefault();
          setStationContextMenu({
            x: e.clientX,
            y: e.clientY,
            stationId: railHit.id,
            stationName: railHit.name,
            stationType: "rail",
          });
          return;
        }
      }

      if (subwayStationLayerRef.current) {
        const subwayHit = subwayStationLayerRef.current.hitTest(worldPos.x, worldPos.y);
        if (subwayHit) {
          e.preventDefault();
          setStationContextMenu({
            x: e.clientX,
            y: e.clientY,
            stationId: subwayHit.id,
            stationName: subwayHit.name,
            stationType: "subway",
          });
          return;
        }
      }
    };

    container.addEventListener("contextmenu", handleContextMenu);
    return () => {
      container.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isReady]);
}

/**
 * Convert a hit test result to a SelectedFeature for the inspector panel.
 * Moved here alongside the event handlers that use it.
 */
function hitTestResultToSelectedFeature(hitResult: HitTestResult): SelectedFeature {
  switch (hitResult.type) {
    case "district": {
      const district = hitResult.feature as District;
      return {
        type: "district",
        id: district.id,
        name: district.name,
        districtType: district.type,
        isHistoric: district.isHistoric ?? false,
        fillColor: district.fillColor,
      };
    }
    case "road": {
      const road = hitResult.feature as Road;
      return {
        type: "road",
        id: road.id,
        name: road.name,
        roadClass: road.roadClass,
      };
    }
    case "poi": {
      const poi = hitResult.feature as POI;
      return {
        type: "poi",
        id: poi.id,
        name: poi.name,
        poiType: poi.type,
      };
    }
    case "neighborhood": {
      const neighborhood = hitResult.feature as Neighborhood;
      return {
        type: "neighborhood",
        id: neighborhood.id,
        name: neighborhood.name,
      };
    }
    case "cityLimits": {
      const cityLimits = hitResult.feature as CityLimits;
      return {
        type: "cityLimits",
        id: cityLimits.id,
        name: cityLimits.name,
        established: cityLimits.established,
      };
    }
  }
}
