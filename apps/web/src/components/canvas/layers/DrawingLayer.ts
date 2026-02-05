/**
 * Drawing layer for rendering in-progress polygon drawing.
 *
 * Shows:
 * - Placed vertices as dots
 * - Lines connecting vertices
 * - Preview line from last vertex to cursor
 * - Preview of closing line to first vertex
 */

import { Container, Graphics } from "pixi.js";
import type { Point } from "./types";

const VERTEX_COLOR = 0x4a90d9; // Blue
const VERTEX_RADIUS = 6;
const LINE_COLOR = 0x4a90d9;
const LINE_WIDTH = 2;
const PREVIEW_ALPHA = 0.5;
const CLOSE_DISTANCE = 20; // Distance to snap to first vertex to close

interface DrawingState {
  vertices: Point[];
  previewPoint: Point | null;
  isDrawing: boolean;
}

export class DrawingLayer {
  private container: Container;
  private graphics: Graphics;
  private state: DrawingState = {
    vertices: [],
    previewPoint: null,
    isDrawing: false,
  };

  constructor() {
    this.container = new Container();
    this.container.label = "drawing";

    this.graphics = new Graphics();
    this.graphics.label = "drawing-graphics";
    this.container.addChild(this.graphics);
  }

  getContainer(): Container {
    return this.container;
  }

  setState(state: DrawingState): void {
    this.state = state;
    this.render();
  }

  /**
   * Check if a point is close enough to the first vertex to close the polygon.
   */
  isNearFirstVertex(point: Point): boolean {
    if (this.state.vertices.length < 3) return false;
    const first = this.state.vertices[0];
    const dx = point.x - first.x;
    const dy = point.y - first.y;
    return Math.sqrt(dx * dx + dy * dy) <= CLOSE_DISTANCE;
  }

  private render(): void {
    this.graphics.clear();

    const { vertices, previewPoint, isDrawing } = this.state;
    if (!isDrawing || vertices.length === 0) return;

    // Draw lines between vertices
    if (vertices.length >= 2) {
      this.graphics.setStrokeStyle({
        width: LINE_WIDTH,
        color: LINE_COLOR,
      });

      this.graphics.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) {
        this.graphics.lineTo(vertices[i].x, vertices[i].y);
      }
      this.graphics.stroke();
    }

    // Draw preview line from last vertex to cursor
    if (previewPoint && vertices.length >= 1) {
      const lastVertex = vertices[vertices.length - 1];

      this.graphics.setStrokeStyle({
        width: LINE_WIDTH,
        color: LINE_COLOR,
        alpha: PREVIEW_ALPHA,
      });

      this.graphics.moveTo(lastVertex.x, lastVertex.y);
      this.graphics.lineTo(previewPoint.x, previewPoint.y);
      this.graphics.stroke();

      // If near first vertex and can close, show closing preview
      if (this.isNearFirstVertex(previewPoint) && vertices.length >= 3) {
        this.graphics.setStrokeStyle({
          width: LINE_WIDTH,
          color: LINE_COLOR,
          alpha: PREVIEW_ALPHA * 0.5,
        });

        // Dashed line to show closing
        this.drawDashedLine(previewPoint, vertices[0]);
      }
    }

    // Draw vertices as dots
    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      const isFirst = i === 0;
      const radius = isFirst && vertices.length >= 3 ? VERTEX_RADIUS * 1.5 : VERTEX_RADIUS;

      // White outline
      this.graphics.setStrokeStyle({ width: 2, color: 0xffffff });
      this.graphics.circle(vertex.x, vertex.y, radius);
      this.graphics.fill({ color: VERTEX_COLOR });
      this.graphics.stroke();

      // Highlight first vertex when we have enough to close
      if (isFirst && vertices.length >= 3) {
        this.graphics.setStrokeStyle({ width: 1, color: VERTEX_COLOR, alpha: 0.5 });
        this.graphics.circle(vertex.x, vertex.y, CLOSE_DISTANCE);
        this.graphics.stroke();
      }
    }
  }

  private drawDashedLine(start: Point, end: Point): void {
    const dashLength = 8;
    const gapLength = 4;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    if (segmentLength === 0) return;

    const unitX = dx / segmentLength;
    const unitY = dy / segmentLength;

    let currentLength = 0;
    let drawing = true;

    while (currentLength < segmentLength) {
      const stepLength = drawing ? dashLength : gapLength;
      const nextLength = Math.min(currentLength + stepLength, segmentLength);

      if (drawing) {
        const startX = start.x + unitX * currentLength;
        const startY = start.y + unitY * currentLength;
        const endX = start.x + unitX * nextLength;
        const endY = start.y + unitY * nextLength;

        this.graphics.moveTo(startX, startY);
        this.graphics.lineTo(endX, endY);
        this.graphics.stroke();
      }

      currentLength = nextLength;
      drawing = !drawing;
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
