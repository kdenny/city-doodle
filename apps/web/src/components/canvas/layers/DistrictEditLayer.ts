/**
 * District vertex edit layer (CITY-561).
 *
 * Renders draggable vertex handles on a selected district polygon,
 * midpoint insertion handles on edges, and a ghost polygon preview
 * during drag operations. Similar pattern to RoadEndpointLayer.ts.
 */

import { Container, Graphics } from "pixi.js";
import type { District, Point } from "./types";

// Vertex handle styling
const VERTEX_HANDLE_RADIUS = 6;
const VERTEX_HANDLE_HIT_RADIUS = 10;
const VERTEX_HANDLE_COLOR = 0x2196f3; // Blue
const VERTEX_HANDLE_HOVER_COLOR = 0x64b5f6; // Lighter blue
const VERTEX_HANDLE_STROKE_COLOR = 0xffffff;
const VERTEX_HANDLE_STROKE_WIDTH = 2;

// Midpoint insertion handle styling
const MIDPOINT_HANDLE_RADIUS = 4;
const MIDPOINT_HANDLE_HIT_RADIUS = 8;
const MIDPOINT_HANDLE_COLOR = 0x4caf50; // Green

// Ghost polygon styling (shown during drag)
const GHOST_POLYGON_COLOR = 0x2196f3;
const GHOST_POLYGON_ALPHA = 0.3;

/**
 * Result of a vertex handle hit test.
 */
export interface VertexHitResult {
  /** The district that was hit */
  district: District;
  /** Index of the vertex in the polygon */
  vertexIndex: number;
  /** Position of the vertex */
  position: Point;
}

/**
 * Result of a midpoint handle hit test.
 * When a midpoint handle is clicked, a new vertex should be inserted.
 */
export interface MidpointHitResult {
  /** The district that was hit */
  district: District;
  /** Index of the segment (midpoint is between points[segmentIndex] and points[segmentIndex+1]) */
  segmentIndex: number;
  /** Position of the midpoint */
  position: Point;
}

/**
 * State for district vertex drag preview.
 */
export interface DistrictVertexDragPreview {
  /** ID of the district being dragged */
  districtId: string;
  /** Index of the vertex being dragged */
  vertexIndex: number;
  /** Current drag position */
  currentPosition: Point;
}

export class DistrictEditLayer {
  private container: Container;
  private handlesGraphics: Graphics;
  private ghostPolygonGraphics: Graphics;

  private selectedDistrict: District | null = null;
  private hoveredVertexIndex: number | null = null;
  private hoveredMidpointIndex: number | null = null;
  private dragPreview: DistrictVertexDragPreview | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = "district-edit";

    // Ghost polygon layer (below handles)
    this.ghostPolygonGraphics = new Graphics();
    this.ghostPolygonGraphics.label = "ghost-polygon";
    this.container.addChild(this.ghostPolygonGraphics);

    // Handles layer (on top)
    this.handlesGraphics = new Graphics();
    this.handlesGraphics.label = "handles";
    this.container.addChild(this.handlesGraphics);
  }

  getContainer(): Container {
    return this.container;
  }

  /**
   * Set the currently selected district (shows vertex handles).
   */
  setSelectedDistrict(district: District | null): void {
    this.selectedDistrict = district;
    this.hoveredVertexIndex = null;
    this.hoveredMidpointIndex = null;
    this.render();
  }

  /**
   * Set which vertex is being hovered (for visual feedback).
   */
  setHoveredVertex(index: number | null): void {
    if (this.hoveredVertexIndex !== index) {
      this.hoveredVertexIndex = index;
      this.render();
    }
  }

  /**
   * Set which midpoint is being hovered (for visual feedback).
   */
  setHoveredMidpoint(index: number | null): void {
    if (this.hoveredMidpointIndex !== index) {
      this.hoveredMidpointIndex = index;
      this.render();
    }
  }

  /**
   * Set the drag preview state (shows ghost polygon during drag).
   */
  setDragPreview(preview: DistrictVertexDragPreview | null): void {
    this.dragPreview = preview;
    this.render();
  }

  /**
   * Hit test for vertex handles on the selected district polygon.
   * Returns the vertex hit, or null if no vertex was hit.
   */
  hitTestVertex(worldX: number, worldY: number): VertexHitResult | null {
    if (!this.selectedDistrict) return null;

    const points = this.selectedDistrict.polygon.points;
    if (points.length < 3) return null;

    for (let i = 0; i < points.length; i++) {
      const dist = Math.sqrt(
        (worldX - points[i].x) ** 2 + (worldY - points[i].y) ** 2
      );
      if (dist <= VERTEX_HANDLE_HIT_RADIUS) {
        return {
          district: this.selectedDistrict,
          vertexIndex: i,
          position: points[i],
        };
      }
    }

    return null;
  }

  /**
   * Hit test for midpoint insertion handles on the selected district polygon.
   * Checks the midpoints between each pair of adjacent vertices (including the
   * closing edge from last vertex back to first).
   * Returns the midpoint hit, or null if no midpoint was hit.
   */
  hitTestMidpoint(worldX: number, worldY: number): MidpointHitResult | null {
    if (!this.selectedDistrict) return null;

    const points = this.selectedDistrict.polygon.points;
    if (points.length < 3) return null;

    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length;
      const mx = (points[i].x + points[next].x) / 2;
      const my = (points[i].y + points[next].y) / 2;
      const dist = Math.sqrt((worldX - mx) ** 2 + (worldY - my) ** 2);
      if (dist <= MIDPOINT_HANDLE_HIT_RADIUS) {
        return {
          district: this.selectedDistrict,
          segmentIndex: i,
          position: { x: mx, y: my },
        };
      }
    }

    return null;
  }

  /**
   * Check if a point is near any handle (for cursor changes).
   */
  isNearHandle(worldX: number, worldY: number): boolean {
    return (
      this.hitTestVertex(worldX, worldY) !== null ||
      this.hitTestMidpoint(worldX, worldY) !== null
    );
  }

  private render(): void {
    this.renderHandles();
    this.renderGhostPolygon();
  }

  private renderHandles(): void {
    this.handlesGraphics.clear();

    if (!this.selectedDistrict) return;

    const points = this.selectedDistrict.polygon.points;
    if (points.length < 3) return;

    // Render midpoint insertion handles first (lowest z)
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length;
      const mx = (points[i].x + points[next].x) / 2;
      const my = (points[i].y + points[next].y) / 2;
      this.renderMidpointHandle({ x: mx, y: my }, i);
    }

    // Render vertex handles on top
    for (let i = 0; i < points.length; i++) {
      this.renderVertexHandle(points[i], i);
    }
  }

  /**
   * Render a circle handle for a polygon vertex.
   */
  private renderVertexHandle(position: Point, index: number): void {
    const isDragging =
      this.dragPreview?.vertexIndex === index &&
      this.dragPreview?.districtId === this.selectedDistrict?.id;
    const isHovered = this.hoveredVertexIndex === index;

    let fillColor = VERTEX_HANDLE_COLOR;
    if (isDragging || isHovered) {
      fillColor = VERTEX_HANDLE_HOVER_COLOR;
    }

    // Draw handle circle with white stroke
    this.handlesGraphics.setStrokeStyle({
      width: VERTEX_HANDLE_STROKE_WIDTH,
      color: VERTEX_HANDLE_STROKE_COLOR,
    });

    this.handlesGraphics.circle(position.x, position.y, VERTEX_HANDLE_RADIUS);
    this.handlesGraphics.fill({ color: fillColor });
    this.handlesGraphics.stroke();
  }

  /**
   * Render a small "+" handle at a segment midpoint for vertex insertion.
   */
  private renderMidpointHandle(position: Point, segmentIndex: number): void {
    const isHovered = this.hoveredMidpointIndex === segmentIndex;
    const fillColor = isHovered ? MIDPOINT_HANDLE_COLOR : MIDPOINT_HANDLE_COLOR;
    const alpha = isHovered ? 1.0 : 0.6;
    const r = MIDPOINT_HANDLE_RADIUS;

    // Draw circle background
    this.handlesGraphics.setStrokeStyle({
      width: 1.5,
      color: VERTEX_HANDLE_STROKE_COLOR,
    });
    this.handlesGraphics.circle(position.x, position.y, r);
    this.handlesGraphics.fill({ color: fillColor, alpha });
    this.handlesGraphics.stroke();

    // Draw "+" icon
    const crossSize = r * 0.6;
    this.handlesGraphics.setStrokeStyle({
      width: 1.5,
      color: VERTEX_HANDLE_STROKE_COLOR,
    });
    this.handlesGraphics.moveTo(position.x - crossSize, position.y);
    this.handlesGraphics.lineTo(position.x + crossSize, position.y);
    this.handlesGraphics.stroke();
    this.handlesGraphics.moveTo(position.x, position.y - crossSize);
    this.handlesGraphics.lineTo(position.x, position.y + crossSize);
    this.handlesGraphics.stroke();
  }

  private renderGhostPolygon(): void {
    this.ghostPolygonGraphics.clear();

    if (!this.dragPreview || !this.selectedDistrict) return;
    if (this.dragPreview.districtId !== this.selectedDistrict.id) return;

    const points = this.selectedDistrict.polygon.points;
    if (points.length < 3) return;

    // Create modified points array with dragged vertex
    const modifiedPoints = [...points];
    modifiedPoints[this.dragPreview.vertexIndex] =
      this.dragPreview.currentPosition;

    // Draw ghost polygon outline and semi-transparent fill
    this.ghostPolygonGraphics.setStrokeStyle({
      width: 2,
      color: GHOST_POLYGON_COLOR,
      alpha: 0.6,
    });

    this.ghostPolygonGraphics.moveTo(modifiedPoints[0].x, modifiedPoints[0].y);
    for (let i = 1; i < modifiedPoints.length; i++) {
      this.ghostPolygonGraphics.lineTo(
        modifiedPoints[i].x,
        modifiedPoints[i].y
      );
    }
    this.ghostPolygonGraphics.closePath();
    this.ghostPolygonGraphics.fill({
      color: GHOST_POLYGON_COLOR,
      alpha: GHOST_POLYGON_ALPHA,
    });
    this.ghostPolygonGraphics.stroke();
  }

  /**
   * Get the currently selected district.
   */
  getSelectedDistrict(): District | null {
    return this.selectedDistrict;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
