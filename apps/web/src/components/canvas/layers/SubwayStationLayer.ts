/**
 * Subway Station Layer - renders subway stations on the map.
 *
 * Unlike rail stations, subway lines are underground and NOT visible on the map surface.
 * Only the station markers are displayed by default, with a distinctive metro/underground style icon.
 *
 * In "transit view" mode, subway tunnels can be shown as dashed lines to indicate
 * underground connectivity.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { TransitStation } from "../../../api/types";
import type { Point } from "./types";

// Subway station styling
const SUBWAY_STATION_COLOR = 0x0066cc; // Blue for subway
const SUBWAY_STATION_BG_COLOR = 0xe6f2ff; // Light blue background
const SUBWAY_STATION_INVALID_COLOR = 0xff4444; // Red for invalid placement
const SUBWAY_STATION_TOO_CLOSE_COLOR = 0xff8c00; // Orange for too-close warning (CITY-432)
const SUBWAY_STATION_RADIUS = 12;
const HUB_SUBWAY_STATION_RADIUS = 16; // Larger for hub/transfer stations
const SUBWAY_STATION_INNER_RADIUS = 8;
const HUB_SUBWAY_STATION_INNER_RADIUS = 11; // Larger inner for hub

// Subway tunnel styling (dashed lines for transit view)
const TUNNEL_WIDTH = 4;
const TUNNEL_DASH_LENGTH = 10;
const TUNNEL_GAP_LENGTH = 6;
const TUNNEL_ALPHA = 0.6;

// Highlight styling (CITY-195)
const HIGHLIGHT_ALPHA = 1.0;
const DIM_ALPHA = 0.25;

/**
 * Data structure for a subway station to render.
 */
export interface SubwayStationData {
  id: string;
  name: string;
  position: { x: number; y: number };
  isTerminus: boolean;
  isHub?: boolean; // Station serves 2+ lines (transfer/hub station)
}

/**
 * Preview data for showing subway station placement preview.
 */
export interface SubwayStationPreviewData {
  position: { x: number; y: number };
  isValid: boolean; // Whether the position is valid (inside a district)
  isTooClose?: boolean; // Whether the position is too close to an existing station (CITY-432)
}

/**
 * Subway tunnel segment for rendering (dashed lines in transit view).
 */
export interface SubwayTunnelData {
  id: string;
  fromStation: Point;
  toStation: Point;
  lineColor: string;
  geometry?: Point[];
}

/**
 * Convert API TransitStation to SubwayStationData for rendering.
 */
export function toSubwayStationData(station: TransitStation): SubwayStationData {
  return {
    id: station.id,
    name: station.name,
    position: { x: station.position_x, y: station.position_y },
    isTerminus: station.is_terminus,
  };
}

/**
 * Layer for rendering subway stations with metro-style icons.
 * Tunnels are underground and NOT rendered by default.
 * In transit view mode, tunnels can be shown as dashed lines.
 */
export class SubwayStationLayer {
  private container: Container;
  private tunnelsContainer: Container;
  private stationsContainer: Container;
  private previewContainer: Container;
  private stationGraphics: Map<string, Container> = new Map();
  private tunnelGraphics: Map<string, Graphics> = new Map();
  private previewGraphics: Graphics | null = null;
  private previewText: Text | null = null;
  private previewLabel: Text | null = null;
  private tunnelsVisible: boolean = false;
  private labelsVisible: boolean = true;
  private currentStations: SubwayStationData[] = [];
  private highlightedStationIds: Set<string> = new Set();
  private highlightedSegmentIds: Set<string> = new Set();

  constructor() {
    this.container = new Container();
    this.container.label = "subway-stations";

    // Container for tunnel lines (below stations, hidden by default)
    this.tunnelsContainer = new Container();
    this.tunnelsContainer.label = "subway-tunnels";
    this.tunnelsContainer.visible = false; // Hidden by default (underground)
    this.container.addChild(this.tunnelsContainer);

    // Container for station markers
    this.stationsContainer = new Container();
    this.stationsContainer.label = "subway-station-markers";
    this.container.addChild(this.stationsContainer);

    // Preview container on top
    this.previewContainer = new Container();
    this.previewContainer.label = "subway-station-preview";
    this.container.addChild(this.previewContainer);
  }

  getContainer(): Container {
    return this.container;
  }

  /**
   * Set the stations to render.
   */
  setStations(stations: SubwayStationData[]): void {
    // Store stations for hit testing
    this.currentStations = stations;

    // Track which stations we've seen
    const seenIds = new Set<string>();

    for (const station of stations) {
      seenIds.add(station.id);

      // Update existing or create new
      if (this.stationGraphics.has(station.id)) {
        this.updateStationGraphics(station);
      } else {
        this.createStationGraphics(station);
      }
    }

    // Remove stations that are no longer present
    for (const [id, graphics] of this.stationGraphics.entries()) {
      if (!seenIds.has(id)) {
        this.stationsContainer.removeChild(graphics);
        graphics.destroy({ children: true });
        this.stationGraphics.delete(id);
      }
    }
  }

  /**
   * Set the tunnel segments to render (shown as dashed lines in transit view).
   */
  setTunnels(tunnels: SubwayTunnelData[]): void {
    // Track which tunnels we've seen
    const seenIds = new Set<string>();

    for (const tunnel of tunnels) {
      seenIds.add(tunnel.id);

      // Update existing or create new
      if (this.tunnelGraphics.has(tunnel.id)) {
        this.updateTunnelGraphics(tunnel);
      } else {
        this.createTunnelGraphics(tunnel);
      }
    }

    // Remove tunnels that are no longer present
    for (const [id, graphics] of this.tunnelGraphics.entries()) {
      if (!seenIds.has(id)) {
        this.tunnelsContainer.removeChild(graphics);
        graphics.destroy();
        this.tunnelGraphics.delete(id);
      }
    }

    // Apply current highlight state
    this.applyHighlight();
  }

  /**
   * Toggle tunnel visibility (for transit view mode).
   * When true, tunnels are shown as dashed lines.
   */
  setTunnelsVisible(visible: boolean): void {
    this.tunnelsVisible = visible;
    this.tunnelsContainer.visible = visible;
  }

  /**
   * Toggle station name label visibility (CITY-534).
   * When false, station markers remain but name labels are hidden.
   */
  setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
    for (const [, container] of this.stationGraphics) {
      for (const child of container.children) {
        if (child.label === "station-label") {
          child.visible = visible;
        }
      }
    }
  }

  /**
   * Get current tunnel visibility state.
   */
  getTunnelsVisible(): boolean {
    return this.tunnelsVisible;
  }

  private createTunnelGraphics(tunnel: SubwayTunnelData): void {
    const { id, fromStation, toStation, lineColor, geometry } = tunnel;
    const color = lineColor ? parseInt(lineColor.replace("#", ""), 16) : SUBWAY_STATION_COLOR;

    const graphics = new Graphics();

    // Build list of points (from -> intermediate -> to)
    const points: Point[] = [fromStation, ...(geometry || []), toStation];

    // Draw dashed line for tunnel
    this.drawDashedLine(graphics, points, color);

    this.tunnelsContainer.addChild(graphics);
    this.tunnelGraphics.set(id, graphics);
  }

  private updateTunnelGraphics(tunnel: SubwayTunnelData): void {
    // CITY-506: Reuse existing Graphics object instead of destroy+recreate
    const existing = this.tunnelGraphics.get(tunnel.id);
    if (existing) {
      existing.clear();
      const { fromStation, toStation, lineColor, geometry } = tunnel;
      const color = lineColor ? parseInt(lineColor.replace("#", ""), 16) : SUBWAY_STATION_COLOR;
      const points: Point[] = [fromStation, ...(geometry || []), toStation];
      this.drawDashedLine(existing, points, color);
    } else {
      this.createTunnelGraphics(tunnel);
    }
  }

  /**
   * Draw a dashed line through the given points.
   */
  private drawDashedLine(graphics: Graphics, points: Point[], color: number): void {
    if (points.length < 2) return;

    graphics.setStrokeStyle({
      width: TUNNEL_WIDTH,
      color,
      alpha: TUNNEL_ALPHA,
      cap: "round"
    });

    // CITY-507: Batch all dash segments into a single path, then stroke once.
    // Each moveTo/lineTo pair adds a disconnected sub-path; PixiJS v8 renders
    // them all in one GPU draw call when stroke() is called once at the end.
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      if (segmentLength === 0) continue;

      const unitX = dx / segmentLength;
      const unitY = dy / segmentLength;

      // Draw dashes along the segment
      let dist = 0;
      let drawing = true;
      while (dist < segmentLength) {
        const dashLength = drawing ? TUNNEL_DASH_LENGTH : TUNNEL_GAP_LENGTH;
        const remainingLength = segmentLength - dist;
        const actualLength = Math.min(dashLength, remainingLength);

        if (drawing) {
          const x1 = start.x + unitX * dist;
          const y1 = start.y + unitY * dist;
          const x2 = start.x + unitX * (dist + actualLength);
          const y2 = start.y + unitY * (dist + actualLength);
          graphics.moveTo(x1, y1);
          graphics.lineTo(x2, y2);
        }

        dist += actualLength;
        drawing = !drawing;
      }
    }

    graphics.stroke();
  }

  private createStationGraphics(station: SubwayStationData): void {
    const stationContainer = new Container();
    stationContainer.label = `subway-station-${station.id}`;
    this.populateStationContainer(stationContainer, station);
    this.stationsContainer.addChild(stationContainer);
    this.stationGraphics.set(station.id, stationContainer);
  }

  private populateStationContainer(container: Container, station: SubwayStationData): void {
    const { name, position, isTerminus, isHub } = station;
    const radius = isHub ? HUB_SUBWAY_STATION_RADIUS : SUBWAY_STATION_RADIUS;
    const innerRadius = isHub ? HUB_SUBWAY_STATION_INNER_RADIUS : SUBWAY_STATION_INNER_RADIUS;

    // Draw the metro-style station marker
    // Outer ring (colored)
    const outer = new Graphics();
    outer.circle(position.x, position.y, radius);
    outer.fill({ color: SUBWAY_STATION_COLOR });
    container.addChild(outer);

    // Inner circle (white or light background)
    const inner = new Graphics();
    inner.circle(position.x, position.y, innerRadius);
    inner.fill({ color: SUBWAY_STATION_BG_COLOR });
    container.addChild(inner);

    // Metro "M" icon in center (classic subway symbol)
    const iconStyle = new TextStyle({
      fontSize: isHub ? 12 : 10,
      fontWeight: "bold",
      fill: SUBWAY_STATION_COLOR,
    });
    const iconText = new Text({ text: "M", style: iconStyle });
    iconText.anchor.set(0.5, 0.5);
    iconText.position.set(position.x, position.y);
    container.addChild(iconText);

    // Hub stations get a double-ring indicator
    if (isHub) {
      const hubRing = new Graphics();
      hubRing.setStrokeStyle({ width: 2, color: SUBWAY_STATION_COLOR });
      hubRing.circle(position.x, position.y, radius + 4);
      hubRing.stroke();
      container.addChild(hubRing);
    } else if (isTerminus) {
      // Add terminus indicator for non-hub terminus stations
      const terminusRing = new Graphics();
      terminusRing.setStrokeStyle({ width: 2, color: SUBWAY_STATION_COLOR });
      terminusRing.circle(position.x, position.y, radius + 3);
      terminusRing.stroke();
      container.addChild(terminusRing);
    }

    // Add station name label below
    const labelStyle = new TextStyle({
      fontSize: isHub ? 10 : 9,
      fill: 0x333333,
      fontWeight: isHub ? "bold" : "500",
    });
    const labelText = new Text({ text: name, style: labelStyle });
    labelText.label = "station-label";
    labelText.anchor.set(0.5, 0);
    labelText.position.set(position.x, position.y + radius + 4);
    labelText.visible = this.labelsVisible;
    container.addChild(labelText);
  }

  private updateStationGraphics(station: SubwayStationData): void {
    // CITY-506: Reuse Container, destroy children and re-populate
    const existing = this.stationGraphics.get(station.id);
    if (existing) {
      existing.removeChildren().forEach((c) => c.destroy());
      this.populateStationContainer(existing, station);
    } else {
      this.createStationGraphics(station);
    }
  }

  /**
   * Set or clear the preview for subway station placement.
   */
  setPreview(preview: SubwayStationPreviewData | null): void {
    // CITY-506: Reuse Graphics/Text objects instead of destroy+recreate
    if (!preview) {
      if (this.previewGraphics) this.previewGraphics.visible = false;
      if (this.previewText) this.previewText.visible = false;
      if (this.previewLabel) this.previewLabel.visible = false;
      return;
    }

    const { position, isValid, isTooClose } = preview;
    const color = isValid ? SUBWAY_STATION_COLOR : SUBWAY_STATION_INVALID_COLOR;
    const bgColor = isValid ? SUBWAY_STATION_BG_COLOR : 0xffcccc;

    // Create or reuse preview graphics
    if (!this.previewGraphics) {
      this.previewGraphics = new Graphics();
      this.previewContainer.addChild(this.previewGraphics);
    }
    this.previewGraphics.clear();
    this.previewGraphics.visible = true;

    // CITY-432: Draw too-close warning ring behind the station preview
    if (isTooClose && isValid) {
      this.previewGraphics.setStrokeStyle({ width: 2.5, color: SUBWAY_STATION_TOO_CLOSE_COLOR, alpha: 0.7 });
      this.previewGraphics.circle(position.x, position.y, SUBWAY_STATION_RADIUS + 8);
      this.previewGraphics.stroke();
    }

    // Draw station marker background (semi-transparent)
    this.previewGraphics.circle(position.x, position.y, SUBWAY_STATION_RADIUS + 2);
    this.previewGraphics.fill({ color: bgColor, alpha: 0.5 });

    // Draw station marker border
    this.previewGraphics.setStrokeStyle({ width: 2, color, alpha: 0.7 });
    this.previewGraphics.circle(position.x, position.y, SUBWAY_STATION_RADIUS);
    this.previewGraphics.stroke();

    // Draw crosshair at center
    const crossSize = 6;
    this.previewGraphics.setStrokeStyle({ width: 1, color, alpha: 0.8 });
    this.previewGraphics.moveTo(position.x - crossSize, position.y);
    this.previewGraphics.lineTo(position.x + crossSize, position.y);
    this.previewGraphics.stroke();
    this.previewGraphics.moveTo(position.x, position.y - crossSize);
    this.previewGraphics.lineTo(position.x, position.y + crossSize);
    this.previewGraphics.stroke();

    // Create or reuse icon text
    if (!this.previewText) {
      const style = new TextStyle({ fontSize: 10, fontWeight: "bold", fill: color });
      this.previewText = new Text({ text: "M", style });
      this.previewText.anchor.set(0.5, 0.5);
      this.previewContainer.addChild(this.previewText);
    }
    this.previewText.visible = true;
    this.previewText.style.fill = color;
    this.previewText.position.set(position.x, position.y);
    this.previewText.alpha = 0.8;

    // Handle label (warning/indicator text)
    if (!isValid) {
      if (!this.previewLabel) {
        this.previewLabel = new Text({
          text: "Must be in district",
          style: new TextStyle({ fontSize: 10, fill: SUBWAY_STATION_INVALID_COLOR, fontWeight: "bold" }),
        });
        this.previewLabel.anchor.set(0.5, 0);
        this.previewContainer.addChild(this.previewLabel);
      }
      this.previewLabel.visible = true;
      this.previewLabel.text = "Must be in district";
      this.previewLabel.style.fill = SUBWAY_STATION_INVALID_COLOR;
      this.previewLabel.position.set(position.x, position.y + SUBWAY_STATION_RADIUS + 8);
    } else if (isTooClose) {
      if (!this.previewLabel) {
        this.previewLabel = new Text({
          text: "Too close to station",
          style: new TextStyle({ fontSize: 10, fill: SUBWAY_STATION_TOO_CLOSE_COLOR, fontWeight: "bold" }),
        });
        this.previewLabel.anchor.set(0.5, 0);
        this.previewContainer.addChild(this.previewLabel);
      }
      this.previewLabel.visible = true;
      this.previewLabel.text = "Too close to station";
      this.previewLabel.style.fill = SUBWAY_STATION_TOO_CLOSE_COLOR;
      this.previewLabel.position.set(position.x, position.y + SUBWAY_STATION_RADIUS + 8);
    } else if (this.previewLabel) {
      this.previewLabel.visible = false;
    }
  }

  /**
   * Set visibility of the subway station layer.
   */
  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  setStationOffset(stationId: string, dx: number, dy: number): void {
    const container = this.stationGraphics.get(stationId);
    if (container) {
      container.position.set(dx, dy);
    }
  }

  /**
   * Hit test to check if a world position is within a station marker.
   * Returns the station data if hit, null otherwise.
   */
  hitTest(x: number, y: number): SubwayStationData | null {
    let closest: SubwayStationData | null = null;
    let closestDist = Infinity;
    for (const station of this.currentStations) {
      const dx = x - station.position.x;
      const dy = y - station.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = (station.isHub ? HUB_SUBWAY_STATION_RADIUS : SUBWAY_STATION_RADIUS) + 4;
      if (dist <= hitRadius && dist < closestDist) {
        closest = station;
        closestDist = dist;
      }
    }
    return closest;
  }

  /**
   * Set the highlighted stations and segments (CITY-195).
   * Pass empty arrays to clear highlighting.
   */
  setHighlight(stationIds: string[], segmentIds: string[]): void {
    this.highlightedStationIds = new Set(stationIds);
    this.highlightedSegmentIds = new Set(segmentIds);
    this.applyHighlight();
  }

  /**
   * Apply highlight styling to stations and tunnels.
   * Highlighted elements get full opacity; others are dimmed.
   */
  private applyHighlight(): void {
    const hasHighlight = this.highlightedStationIds.size > 0 || this.highlightedSegmentIds.size > 0;

    // Apply to stations
    for (const [id, graphics] of this.stationGraphics.entries()) {
      if (hasHighlight) {
        const isHighlighted = this.highlightedStationIds.has(id);
        graphics.alpha = isHighlighted ? HIGHLIGHT_ALPHA : DIM_ALPHA;
        // Scale up highlighted stations slightly
        graphics.scale.set(isHighlighted ? 1.2 : 1.0);
      } else {
        // No highlight - show all normally
        graphics.alpha = 1.0;
        graphics.scale.set(1.0);
      }
    }

    // Apply to tunnels
    for (const [id, graphics] of this.tunnelGraphics.entries()) {
      if (hasHighlight) {
        const isHighlighted = this.highlightedSegmentIds.has(id);
        graphics.alpha = isHighlighted ? TUNNEL_ALPHA : DIM_ALPHA * 0.5;
      } else {
        // No highlight - show all normally with tunnel alpha
        graphics.alpha = TUNNEL_ALPHA;
      }
    }
  }

  /**
   * Clear all stations and tunnels.
   */
  clear(): void {
    for (const [, graphics] of this.stationGraphics.entries()) {
      this.stationsContainer.removeChild(graphics);
      graphics.destroy({ children: true });
    }
    this.stationGraphics.clear();

    for (const [, graphics] of this.tunnelGraphics.entries()) {
      this.tunnelsContainer.removeChild(graphics);
      graphics.destroy();
    }
    this.tunnelGraphics.clear();
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.stationGraphics.clear();
    this.tunnelGraphics.clear();
    this.previewGraphics = null;
    this.previewText = null;
    this.previewLabel = null;
  }
}
