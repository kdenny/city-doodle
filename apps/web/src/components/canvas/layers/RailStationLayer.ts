/**
 * Rail station layer renderer for rail stations and visible track lines.
 *
 * Renders:
 * - Rail station markers with distinctive train icon
 * - Visible track lines between connected stations (dark gray/brown parallel lines)
 * - Preview for station placement
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { Point } from "./types";

/**
 * A rail station for rendering.
 */
export interface RailStationData {
  id: string;
  name: string;
  position: Point;
  isTerminus: boolean;
  lineColor?: string; // Color of the line this station belongs to
  isHub?: boolean; // Station serves 2+ lines (transfer/hub station)
}

/**
 * A track segment connecting two rail stations.
 */
export interface TrackSegmentData {
  id: string;
  fromStation: Point;
  toStation: Point;
  lineColor: string;
  geometry?: Point[]; // Intermediate points for curved tracks
  isUnderground: boolean;
}

/**
 * Preview data for showing rail station placement preview.
 */
export interface RailStationPreviewData {
  position: Point;
  isValid: boolean; // Whether the position is valid (inside a district)
}

// Rail station styling
const STATION_COLOR = 0x5c4033; // Dark brown
const STATION_BG_COLOR = 0xfff8e1; // Cream
const STATION_INVALID_COLOR = 0xff4444; // Red for invalid placement
const STATION_RADIUS = 12;
const HUB_STATION_RADIUS = 16; // Larger radius for hub/transfer stations
const STATION_ICON = "\u{1F682}"; // Train emoji

// Track styling
const TRACK_WIDTH = 4;
const TRACK_GAP = 6; // Gap between parallel rails
const TRACK_COLOR = 0x5c4033; // Dark brown
const TIE_SPACING = 12; // Spacing between railroad ties
const TIE_WIDTH = 8;
const TIE_HEIGHT = 2;
const TRACK_UNDERGROUND_ALPHA = 0.3;

// Highlight styling (CITY-195)
const HIGHLIGHT_ALPHA = 1.0;
const DIM_ALPHA = 0.25;

export class RailStationLayer {
  private container: Container;
  private tracksContainer: Container;
  private stationsContainer: Container;
  private previewContainer: Container;
  private stationGraphics: Map<string, Container> = new Map();
  private trackGraphics: Map<string, Graphics> = new Map();
  private previewGraphics: Graphics | null = null;
  private previewText: Text | null = null;
  private currentStations: RailStationData[] = [];
  private highlightedStationIds: Set<string> = new Set();
  private highlightedSegmentIds: Set<string> = new Set();

  constructor() {
    this.container = new Container();
    this.container.label = "rail-stations";

    // Tracks are drawn below stations
    this.tracksContainer = new Container();
    this.tracksContainer.label = "rail-tracks";
    this.container.addChild(this.tracksContainer);

    // Stations on top of tracks
    this.stationsContainer = new Container();
    this.stationsContainer.label = "rail-station-markers";
    this.container.addChild(this.stationsContainer);

    // Preview on top
    this.previewContainer = new Container();
    this.previewContainer.label = "rail-station-preview";
    this.container.addChild(this.previewContainer);
  }

  getContainer(): Container {
    return this.container;
  }

  /**
   * Set the rail stations to render.
   */
  setStations(stations: RailStationData[]): void {
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
   * Set the track segments to render.
   */
  setTracks(tracks: TrackSegmentData[]): void {
    // Track which tracks we've seen
    const seenIds = new Set<string>();

    for (const track of tracks) {
      seenIds.add(track.id);

      // Update existing or create new
      if (this.trackGraphics.has(track.id)) {
        this.updateTrackGraphics(track);
      } else {
        this.createTrackGraphics(track);
      }
    }

    // Remove tracks that are no longer present
    for (const [id, graphics] of this.trackGraphics.entries()) {
      if (!seenIds.has(id)) {
        this.tracksContainer.removeChild(graphics);
        graphics.destroy();
        this.trackGraphics.delete(id);
      }
    }

    // Apply current highlight state
    this.applyHighlight();
  }

  /**
   * Set or clear the preview for rail station placement.
   */
  setPreview(preview: RailStationPreviewData | null): void {
    // Clear existing preview
    if (this.previewGraphics) {
      this.previewContainer.removeChild(this.previewGraphics);
      this.previewGraphics.destroy();
      this.previewGraphics = null;
    }
    if (this.previewText) {
      this.previewContainer.removeChild(this.previewText);
      this.previewText.destroy();
      this.previewText = null;
    }

    if (!preview) return;

    const { position, isValid } = preview;
    const color = isValid ? STATION_COLOR : STATION_INVALID_COLOR;
    const bgColor = isValid ? STATION_BG_COLOR : 0xffcccc;

    // Create preview graphics
    this.previewGraphics = new Graphics();

    // Draw station marker background (semi-transparent)
    this.previewGraphics.circle(position.x, position.y, STATION_RADIUS + 2);
    this.previewGraphics.fill({ color: bgColor, alpha: 0.5 });

    // Draw station marker border
    this.previewGraphics.setStrokeStyle({ width: 2, color, alpha: 0.7 });
    this.previewGraphics.circle(position.x, position.y, STATION_RADIUS);
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

    this.previewContainer.addChild(this.previewGraphics);

    // Add icon text
    const style = new TextStyle({
      fontSize: 14,
      fill: color,
    });
    this.previewText = new Text({ text: STATION_ICON, style });
    this.previewText.anchor.set(0.5, 0.5);
    this.previewText.position.set(position.x, position.y);
    this.previewText.alpha = 0.8;
    this.previewContainer.addChild(this.previewText);

    // If not valid, add an "X" indicator
    if (!isValid) {
      const invalidIndicator = new Text({
        text: "Must be in district",
        style: new TextStyle({
          fontSize: 10,
          fill: STATION_INVALID_COLOR,
          fontWeight: "bold",
        }),
      });
      invalidIndicator.anchor.set(0.5, 0);
      invalidIndicator.position.set(position.x, position.y + STATION_RADIUS + 8);
      this.previewContainer.addChild(invalidIndicator);
    }
  }

  private createStationGraphics(station: RailStationData): void {
    const { id, name, position, isTerminus, lineColor, isHub } = station;
    const color = lineColor ? parseInt(lineColor.replace("#", ""), 16) : STATION_COLOR;
    const radius = isHub ? HUB_STATION_RADIUS : STATION_RADIUS;

    // Create container for this station
    const stationContainer = new Container();
    stationContainer.label = `rail-station-${id}`;

    // Draw station marker background
    const bg = new Graphics();
    bg.circle(position.x, position.y, radius);
    bg.fill({ color: STATION_BG_COLOR, alpha: 0.95 });
    stationContainer.addChild(bg);

    // Draw station marker border
    const border = new Graphics();
    border.setStrokeStyle({ width: isHub ? 3 : isTerminus ? 3 : 2, color });
    border.circle(position.x, position.y, radius);
    border.stroke();

    // Hub stations get a double-ring indicator
    if (isHub) {
      border.setStrokeStyle({ width: 2, color });
      border.circle(position.x, position.y, radius + 4);
      border.stroke();
    } else if (isTerminus) {
      // Add terminus indicator (double circle) for non-hub terminus stations
      border.setStrokeStyle({ width: 1, color, alpha: 0.6 });
      border.circle(position.x, position.y, radius + 4);
      border.stroke();
    }
    stationContainer.addChild(border);

    // Add train icon (larger for hub stations)
    const iconStyle = new TextStyle({
      fontSize: isHub ? 14 : 12,
      fill: color,
    });
    const iconText = new Text({ text: STATION_ICON, style: iconStyle });
    iconText.anchor.set(0.5, 0.5);
    iconText.position.set(position.x, position.y);
    stationContainer.addChild(iconText);

    // Add name label below
    const labelStyle = new TextStyle({
      fontSize: isHub ? 11 : 10,
      fill: 0x333333,
      fontWeight: isHub ? "bold" : "500",
    });
    const labelText = new Text({ text: name, style: labelStyle });
    labelText.anchor.set(0.5, 0);
    labelText.position.set(position.x, position.y + radius + 4);
    stationContainer.addChild(labelText);

    this.stationsContainer.addChild(stationContainer);
    this.stationGraphics.set(id, stationContainer);
  }

  private updateStationGraphics(station: RailStationData): void {
    // For now, just recreate the graphics
    const existing = this.stationGraphics.get(station.id);
    if (existing) {
      this.stationsContainer.removeChild(existing);
      existing.destroy({ children: true });
      this.stationGraphics.delete(station.id);
    }
    this.createStationGraphics(station);
  }

  private createTrackGraphics(track: TrackSegmentData): void {
    const { id, fromStation, toStation, lineColor, geometry, isUnderground } = track;
    const color = lineColor ? parseInt(lineColor.replace("#", ""), 16) : TRACK_COLOR;
    const alpha = isUnderground ? TRACK_UNDERGROUND_ALPHA : 1;

    const graphics = new Graphics();

    // Build list of points (from -> intermediate -> to)
    const points: Point[] = [fromStation, ...(geometry || []), toStation];

    // Draw railroad ties (perpendicular sleepers)
    this.drawRailroadTies(graphics, points, color, alpha);

    // Draw parallel rail lines
    this.drawParallelRails(graphics, points, color, alpha);

    this.tracksContainer.addChild(graphics);
    this.trackGraphics.set(id, graphics);
  }

  private drawRailroadTies(
    graphics: Graphics,
    points: Point[],
    color: number,
    alpha: number
  ): void {
    graphics.setStrokeStyle({ width: TIE_HEIGHT, color, alpha: alpha * 0.8 });

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      if (segmentLength === 0) continue;

      const unitX = dx / segmentLength;
      const unitY = dy / segmentLength;
      // Perpendicular direction
      const perpX = -unitY;
      const perpY = unitX;

      // Draw ties along the segment
      let dist = 0;
      while (dist < segmentLength) {
        const x = start.x + unitX * dist;
        const y = start.y + unitY * dist;

        // Draw tie perpendicular to track
        const halfTie = TIE_WIDTH / 2 + TRACK_GAP / 2;
        graphics.moveTo(x - perpX * halfTie, y - perpY * halfTie);
        graphics.lineTo(x + perpX * halfTie, y + perpY * halfTie);
        graphics.stroke();

        dist += TIE_SPACING;
      }
    }
  }

  private drawParallelRails(
    graphics: Graphics,
    points: Point[],
    color: number,
    alpha: number
  ): void {
    if (points.length < 2) return;

    // Calculate offset points for parallel rails
    const leftRail: Point[] = [];
    const rightRail: Point[] = [];

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      let perpX = 0;
      let perpY = 0;

      if (i === 0) {
        // First point: use direction to next point
        const next = points[i + 1];
        const dx = next.x - current.x;
        const dy = next.y - current.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          perpX = -dy / len;
          perpY = dx / len;
        }
      } else if (i === points.length - 1) {
        // Last point: use direction from previous point
        const prev = points[i - 1];
        const dx = current.x - prev.x;
        const dy = current.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          perpX = -dy / len;
          perpY = dx / len;
        }
      } else {
        // Middle point: average of both directions
        const prev = points[i - 1];
        const next = points[i + 1];
        const dx1 = current.x - prev.x;
        const dy1 = current.y - prev.y;
        const dx2 = next.x - current.x;
        const dy2 = next.y - current.y;
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (len1 > 0 && len2 > 0) {
          const perpX1 = -dy1 / len1;
          const perpY1 = dx1 / len1;
          const perpX2 = -dy2 / len2;
          const perpY2 = dx2 / len2;
          perpX = (perpX1 + perpX2) / 2;
          perpY = (perpY1 + perpY2) / 2;
          // Normalize
          const plen = Math.sqrt(perpX * perpX + perpY * perpY);
          if (plen > 0) {
            perpX /= plen;
            perpY /= plen;
          }
        }
      }

      const offset = TRACK_GAP / 2;
      leftRail.push({ x: current.x + perpX * offset, y: current.y + perpY * offset });
      rightRail.push({ x: current.x - perpX * offset, y: current.y - perpY * offset });
    }

    // Draw left rail
    graphics.setStrokeStyle({ width: TRACK_WIDTH, color, alpha, cap: "round", join: "round" });
    if (leftRail.length >= 2) {
      graphics.moveTo(leftRail[0].x, leftRail[0].y);
      for (let i = 1; i < leftRail.length; i++) {
        graphics.lineTo(leftRail[i].x, leftRail[i].y);
      }
      graphics.stroke();
    }

    // Draw right rail
    if (rightRail.length >= 2) {
      graphics.moveTo(rightRail[0].x, rightRail[0].y);
      for (let i = 1; i < rightRail.length; i++) {
        graphics.lineTo(rightRail[i].x, rightRail[i].y);
      }
      graphics.stroke();
    }
  }

  private updateTrackGraphics(track: TrackSegmentData): void {
    // For now, just recreate the graphics
    const existing = this.trackGraphics.get(track.id);
    if (existing) {
      this.tracksContainer.removeChild(existing);
      existing.destroy();
      this.trackGraphics.delete(track.id);
    }
    this.createTrackGraphics(track);
  }

  /**
   * Set visibility of the rail station layer.
   */
  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  /**
   * Hit test to check if a world position is within a station marker.
   * Returns the station data if hit, null otherwise.
   */
  hitTest(x: number, y: number): RailStationData | null {
    for (const station of this.currentStations) {
      const dx = x - station.position.x;
      const dy = y - station.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Use slightly larger hit radius for easier clicking
      const hitRadius = (station.isHub ? HUB_STATION_RADIUS : STATION_RADIUS) + 4;
      if (distance <= hitRadius) {
        return station;
      }
    }
    return null;
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
   * Apply highlight styling to stations and tracks.
   * Highlighted elements get full opacity; others are dimmed.
   */
  private applyHighlight(): void {
    const hasHighlight = this.highlightedStationIds.size > 0 || this.highlightedSegmentIds.size > 0;

    // Apply to stations
    for (const [id, graphics] of this.stationGraphics.entries()) {
      // Skip if graphics was destroyed
      if (!graphics.scale) continue;

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

    // Apply to tracks
    for (const [id, graphics] of this.trackGraphics.entries()) {
      if (hasHighlight) {
        const isHighlighted = this.highlightedSegmentIds.has(id);
        graphics.alpha = isHighlighted ? HIGHLIGHT_ALPHA : DIM_ALPHA;
      } else {
        // No highlight - show all normally
        graphics.alpha = 1.0;
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.stationGraphics.clear();
    this.trackGraphics.clear();
  }
}
