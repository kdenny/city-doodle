/**
 * Layer for rendering transit line drawing preview.
 *
 * Shows:
 * - Highlight on hovered stations (valid connection targets)
 * - Preview line from last station to mouse position
 * - Connected stations highlight (already part of the line)
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { Point } from "./types";

/**
 * State for the transit line drawing layer.
 */
export interface TransitLineDrawingState {
  /** Whether we're in drawing mode */
  isDrawing: boolean;
  /** The current first station (start of next segment) */
  firstStation: { id: string; position: Point } | null;
  /** Stations already connected */
  connectedStations: { id: string; position: Point }[];
  /** Current mouse position for preview line */
  previewPosition: Point | null;
  /** Station being hovered */
  hoveredStation: { id: string; position: Point } | null;
  /** Line color for preview */
  lineColor: string;
}

// Styling constants
const PREVIEW_LINE_WIDTH = 4;
const PREVIEW_LINE_ALPHA = 0.6;
const HOVER_RING_RADIUS = 18;
const HOVER_RING_WIDTH = 3;
const CONNECTED_RING_RADIUS = 16;
const CONNECTED_RING_WIDTH = 2;
const FIRST_STATION_PULSE_RADIUS = 20;

export class TransitLineDrawingLayer {
  private container: Container;
  private previewLineGraphics: Graphics;
  private hoverHighlightGraphics: Graphics;
  private connectedHighlightGraphics: Graphics;
  private firstStationGraphics: Graphics;
  private instructionText: Text | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = "transit-line-drawing";

    // Connected station highlights (bottom)
    this.connectedHighlightGraphics = new Graphics();
    this.connectedHighlightGraphics.label = "connected-highlights";
    this.container.addChild(this.connectedHighlightGraphics);

    // Preview line
    this.previewLineGraphics = new Graphics();
    this.previewLineGraphics.label = "preview-line";
    this.container.addChild(this.previewLineGraphics);

    // First station highlight (pulsing indicator)
    this.firstStationGraphics = new Graphics();
    this.firstStationGraphics.label = "first-station";
    this.container.addChild(this.firstStationGraphics);

    // Hover highlight (top)
    this.hoverHighlightGraphics = new Graphics();
    this.hoverHighlightGraphics.label = "hover-highlight";
    this.container.addChild(this.hoverHighlightGraphics);
  }

  getContainer(): Container {
    return this.container;
  }

  /**
   * Update the drawing state and re-render.
   */
  setState(state: TransitLineDrawingState): void {
    this.clearGraphics();

    if (!state.isDrawing) {
      this.hideInstructions();
      return;
    }

    const color = parseInt(state.lineColor.replace("#", ""), 16);

    // Draw connected station highlights
    this.drawConnectedHighlights(state.connectedStations, color);

    // Draw first station indicator
    if (state.firstStation) {
      this.drawFirstStationIndicator(state.firstStation.position, color);
    }

    // Draw preview line from first station to mouse
    if (state.firstStation && state.previewPosition) {
      this.drawPreviewLine(
        state.firstStation.position,
        state.previewPosition,
        color
      );
    }

    // Draw hover highlight
    if (state.hoveredStation && state.firstStation) {
      // Don't highlight the first station as hover target
      if (state.hoveredStation.id !== state.firstStation.id) {
        this.drawHoverHighlight(state.hoveredStation.position, color);
      }
    }

    // Update instructions
    this.updateInstructions(state);
  }

  private clearGraphics(): void {
    this.previewLineGraphics.clear();
    this.hoverHighlightGraphics.clear();
    this.connectedHighlightGraphics.clear();
    this.firstStationGraphics.clear();
  }

  private drawConnectedHighlights(
    stations: { id: string; position: Point }[],
    color: number
  ): void {
    for (const station of stations) {
      // Draw a ring around connected stations
      this.connectedHighlightGraphics.setStrokeStyle({
        width: CONNECTED_RING_WIDTH,
        color,
        alpha: 0.4,
      });
      this.connectedHighlightGraphics.circle(
        station.position.x,
        station.position.y,
        CONNECTED_RING_RADIUS
      );
      this.connectedHighlightGraphics.stroke();
    }
  }

  private drawFirstStationIndicator(position: Point, color: number): void {
    // Draw a pulsing ring to indicate the start of the next segment
    this.firstStationGraphics.setStrokeStyle({
      width: 2,
      color,
      alpha: 0.8,
    });
    this.firstStationGraphics.circle(
      position.x,
      position.y,
      FIRST_STATION_PULSE_RADIUS
    );
    this.firstStationGraphics.stroke();

    // Inner filled circle
    this.firstStationGraphics.circle(position.x, position.y, 4);
    this.firstStationGraphics.fill({ color, alpha: 0.9 });
  }

  private drawPreviewLine(from: Point, to: Point, color: number): void {
    // Draw dashed line from first station to mouse position
    this.previewLineGraphics.setStrokeStyle({
      width: PREVIEW_LINE_WIDTH,
      color,
      alpha: PREVIEW_LINE_ALPHA,
    });

    // Draw as dashed line using segments
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const dashLength = 10;
    const gapLength = 8;
    const unitX = dx / length;
    const unitY = dy / length;

    let distance = 0;
    let drawing = true;

    this.previewLineGraphics.moveTo(from.x, from.y);

    while (distance < length) {
      const segmentLength = drawing ? dashLength : gapLength;
      const nextDistance = Math.min(distance + segmentLength, length);
      const x = from.x + unitX * nextDistance;
      const y = from.y + unitY * nextDistance;

      if (drawing) {
        this.previewLineGraphics.lineTo(x, y);
      } else {
        this.previewLineGraphics.moveTo(x, y);
      }

      distance = nextDistance;
      drawing = !drawing;
    }

    this.previewLineGraphics.stroke();
  }

  private drawHoverHighlight(position: Point, color: number): void {
    // Draw a bright ring around the hovered station
    this.hoverHighlightGraphics.setStrokeStyle({
      width: HOVER_RING_WIDTH,
      color,
      alpha: 0.9,
    });
    this.hoverHighlightGraphics.circle(
      position.x,
      position.y,
      HOVER_RING_RADIUS
    );
    this.hoverHighlightGraphics.stroke();

    // Add a subtle glow effect
    this.hoverHighlightGraphics.circle(
      position.x,
      position.y,
      HOVER_RING_RADIUS + 4
    );
    this.hoverHighlightGraphics.fill({ color, alpha: 0.15 });
  }

  private updateInstructions(state: TransitLineDrawingState): void {
    const text = this.getInstructionText(state);

    if (text) {
      if (!this.instructionText) {
        this.instructionText = new Text({
          text,
          style: new TextStyle({
            fontSize: 12,
            fill: 0x333333,
            fontWeight: "bold",
            dropShadow: {
              alpha: 0.3,
              blur: 4,
              color: 0xffffff,
              distance: 0,
            },
          }),
        });
        this.instructionText.anchor.set(0.5, 0);
        this.container.addChild(this.instructionText);
      } else {
        this.instructionText.text = text;
      }

      // Position above the first station or at a default position
      if (state.firstStation) {
        this.instructionText.position.set(
          state.firstStation.position.x,
          state.firstStation.position.y - 40
        );
      }
      this.instructionText.visible = true;
    } else {
      this.hideInstructions();
    }
  }

  private getInstructionText(state: TransitLineDrawingState): string | null {
    if (!state.firstStation) {
      return "Click a station to start the line";
    }
    if (state.connectedStations.length < 2) {
      return "Click another station to connect";
    }
    return "Click to extend, ESC to finish";
  }

  private hideInstructions(): void {
    if (this.instructionText) {
      this.instructionText.visible = false;
    }
  }

  /**
   * Find the nearest station to a point within a threshold distance.
   * Returns null if no station is close enough.
   */
  findNearestStation(
    position: Point,
    stations: { id: string; position: Point }[],
    threshold: number = 30
  ): { id: string; position: Point } | null {
    let nearest: { id: string; position: Point } | null = null;
    let nearestDist = threshold;

    for (const station of stations) {
      const dx = position.x - station.position.x;
      const dy = position.y - station.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = station;
      }
    }

    return nearest;
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  destroy(): void {
    this.clearGraphics();
    if (this.instructionText) {
      this.instructionText.destroy();
      this.instructionText = null;
    }
    this.container.destroy({ children: true });
  }
}
