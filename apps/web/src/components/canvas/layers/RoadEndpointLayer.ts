/**
 * Road endpoint handles layer (CITY-147).
 *
 * Renders draggable handles at road endpoints when a road is selected.
 * Handles hit testing for endpoint clicks to initiate drag operations.
 */

import { Container, Graphics } from "pixi.js";
import type { Road, Point } from "./types";

// Endpoint handle styling
const HANDLE_RADIUS = 8;
const HANDLE_HIT_RADIUS = 12; // Larger for easier clicking
const HANDLE_COLOR = 0x2196f3; // Blue
const HANDLE_HOVER_COLOR = 0x64b5f6; // Lighter blue
const HANDLE_ACTIVE_COLOR = 0x1565c0; // Darker blue when dragging
const HANDLE_STROKE_COLOR = 0xffffff;
const HANDLE_STROKE_WIDTH = 2;

// Ghost line styling (shown during drag)
const GHOST_LINE_COLOR = 0x2196f3;
const GHOST_LINE_WIDTH = 3;
const GHOST_LINE_ALPHA = 0.6;

// Snap indicator styling
const SNAP_INDICATOR_RADIUS = 12;
const SNAP_INDICATOR_COLOR = 0x4caf50; // Green
const SNAP_INDICATOR_PULSE_MIN = 0.5;
const SNAP_INDICATOR_PULSE_MAX = 1.0;

/**
 * Result of an endpoint hit test.
 */
export interface EndpointHitResult {
  /** The road that was hit */
  road: Road;
  /** Index of the endpoint (0 for start, length-1 for end) */
  endpointIndex: number;
  /** Position of the endpoint */
  position: Point;
}

/**
 * State for endpoint drag preview.
 */
export interface EndpointDragPreview {
  /** ID of the road being dragged */
  roadId: string;
  /** Index of the endpoint being dragged */
  endpointIndex: number;
  /** Current drag position */
  currentPosition: Point;
  /** Whether snapped to a target */
  isSnapped: boolean;
}

export class RoadEndpointLayer {
  private container: Container;
  private handlesGraphics: Graphics;
  private ghostLineGraphics: Graphics;
  private snapIndicatorGraphics: Graphics;

  private selectedRoad: Road | null = null;
  private hoveredEndpoint: number | null = null;
  private dragPreview: EndpointDragPreview | null = null;
  private allRoads: Road[] = [];

  // Animation state
  private snapPulsePhase: number = 0;

  constructor() {
    this.container = new Container();
    this.container.label = "road-endpoints";

    // Ghost line layer (below handles)
    this.ghostLineGraphics = new Graphics();
    this.ghostLineGraphics.label = "ghost-line";
    this.container.addChild(this.ghostLineGraphics);

    // Snap indicator layer
    this.snapIndicatorGraphics = new Graphics();
    this.snapIndicatorGraphics.label = "snap-indicator";
    this.container.addChild(this.snapIndicatorGraphics);

    // Handles layer (on top)
    this.handlesGraphics = new Graphics();
    this.handlesGraphics.label = "handles";
    this.container.addChild(this.handlesGraphics);
  }

  getContainer(): Container {
    return this.container;
  }

  /**
   * Set all roads (needed for reference during drag operations).
   */
  setRoads(roads: Road[]): void {
    this.allRoads = roads;
  }

  /**
   * Set the currently selected road (shows endpoint handles).
   */
  setSelectedRoad(road: Road | null): void {
    this.selectedRoad = road;
    this.hoveredEndpoint = null;
    this.render();
  }

  /**
   * Set which endpoint is being hovered (for visual feedback).
   */
  setHoveredEndpoint(index: number | null): void {
    if (this.hoveredEndpoint !== index) {
      this.hoveredEndpoint = index;
      this.render();
    }
  }

  /**
   * Set the drag preview state (shows ghost line during drag).
   */
  setDragPreview(preview: EndpointDragPreview | null): void {
    this.dragPreview = preview;
    this.render();
  }

  /**
   * Update the snap indicator animation.
   * Call this each frame when snapped.
   */
  updateAnimation(deltaTime: number): void {
    if (this.dragPreview?.isSnapped) {
      this.snapPulsePhase += deltaTime * 0.005; // Pulse speed
      this.renderSnapIndicator();
    }
  }

  /**
   * Hit test for endpoint handles.
   * Returns the endpoint hit, or null if no endpoint was hit.
   */
  hitTest(worldX: number, worldY: number): EndpointHitResult | null {
    if (!this.selectedRoad) return null;

    const points = this.selectedRoad.line.points;
    if (points.length < 2) return null;

    // Check start endpoint
    const startDist = Math.sqrt(
      (worldX - points[0].x) ** 2 + (worldY - points[0].y) ** 2
    );
    if (startDist <= HANDLE_HIT_RADIUS) {
      return {
        road: this.selectedRoad,
        endpointIndex: 0,
        position: points[0],
      };
    }

    // Check end endpoint
    const endIndex = points.length - 1;
    const endDist = Math.sqrt(
      (worldX - points[endIndex].x) ** 2 + (worldY - points[endIndex].y) ** 2
    );
    if (endDist <= HANDLE_HIT_RADIUS) {
      return {
        road: this.selectedRoad,
        endpointIndex: endIndex,
        position: points[endIndex],
      };
    }

    return null;
  }

  /**
   * Check if a point is near any endpoint handle (for cursor changes).
   */
  isNearHandle(worldX: number, worldY: number): boolean {
    return this.hitTest(worldX, worldY) !== null;
  }

  private render(): void {
    this.renderHandles();
    this.renderGhostLine();
    this.renderSnapIndicator();
  }

  private renderHandles(): void {
    this.handlesGraphics.clear();

    if (!this.selectedRoad) return;

    const points = this.selectedRoad.line.points;
    if (points.length < 2) return;

    // Render start endpoint handle
    this.renderHandle(points[0], 0);

    // Render end endpoint handle
    this.renderHandle(points[points.length - 1], points.length - 1);
  }

  private renderHandle(position: Point, index: number): void {
    const isDragging =
      this.dragPreview?.endpointIndex === index &&
      this.dragPreview?.roadId === this.selectedRoad?.id;
    const isHovered = this.hoveredEndpoint === index;

    // Determine color based on state
    let fillColor = HANDLE_COLOR;
    if (isDragging) {
      fillColor = HANDLE_ACTIVE_COLOR;
    } else if (isHovered) {
      fillColor = HANDLE_HOVER_COLOR;
    }

    // Draw handle circle with crosshair
    this.handlesGraphics.setStrokeStyle({
      width: HANDLE_STROKE_WIDTH,
      color: HANDLE_STROKE_COLOR,
    });

    // Outer circle
    this.handlesGraphics.circle(position.x, position.y, HANDLE_RADIUS);
    this.handlesGraphics.fill({ color: fillColor });
    this.handlesGraphics.stroke();

    // Inner crosshair
    const crossSize = HANDLE_RADIUS * 0.5;
    this.handlesGraphics.setStrokeStyle({
      width: 1.5,
      color: HANDLE_STROKE_COLOR,
    });

    // Horizontal line
    this.handlesGraphics.moveTo(position.x - crossSize, position.y);
    this.handlesGraphics.lineTo(position.x + crossSize, position.y);
    this.handlesGraphics.stroke();

    // Vertical line
    this.handlesGraphics.moveTo(position.x, position.y - crossSize);
    this.handlesGraphics.lineTo(position.x, position.y + crossSize);
    this.handlesGraphics.stroke();
  }

  private renderGhostLine(): void {
    this.ghostLineGraphics.clear();

    if (!this.dragPreview || !this.selectedRoad) return;

    const road = this.allRoads.find((r) => r.id === this.dragPreview!.roadId);
    if (!road) return;

    const points = road.line.points;
    if (points.length < 2) return;

    // Create modified points array with dragged endpoint
    const modifiedPoints = [...points];
    modifiedPoints[this.dragPreview.endpointIndex] =
      this.dragPreview.currentPosition;

    // Draw dashed ghost line
    this.ghostLineGraphics.setStrokeStyle({
      width: GHOST_LINE_WIDTH,
      color: GHOST_LINE_COLOR,
      alpha: GHOST_LINE_ALPHA,
    });

    this.ghostLineGraphics.moveTo(modifiedPoints[0].x, modifiedPoints[0].y);
    for (let i = 1; i < modifiedPoints.length; i++) {
      this.ghostLineGraphics.lineTo(modifiedPoints[i].x, modifiedPoints[i].y);
    }
    this.ghostLineGraphics.stroke();
  }

  private renderSnapIndicator(): void {
    this.snapIndicatorGraphics.clear();

    if (!this.dragPreview?.isSnapped) return;

    const position = this.dragPreview.currentPosition;

    // Pulsing alpha
    const pulseT = (Math.sin(this.snapPulsePhase) + 1) / 2;
    const alpha =
      SNAP_INDICATOR_PULSE_MIN +
      (SNAP_INDICATOR_PULSE_MAX - SNAP_INDICATOR_PULSE_MIN) * pulseT;

    // Draw snap indicator ring
    this.snapIndicatorGraphics.setStrokeStyle({
      width: 3,
      color: SNAP_INDICATOR_COLOR,
      alpha,
    });

    this.snapIndicatorGraphics.circle(
      position.x,
      position.y,
      SNAP_INDICATOR_RADIUS
    );
    this.snapIndicatorGraphics.stroke();

    // Inner filled circle
    this.snapIndicatorGraphics.circle(
      position.x,
      position.y,
      SNAP_INDICATOR_RADIUS * 0.3
    );
    this.snapIndicatorGraphics.fill({ color: SNAP_INDICATOR_COLOR, alpha });
  }

  /**
   * Get the currently selected road.
   */
  getSelectedRoad(): Road | null {
    return this.selectedRoad;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
