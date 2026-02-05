/**
 * Subway Station Layer - renders subway stations on the map.
 *
 * Unlike rail stations, subway lines are underground and NOT visible on the map.
 * Only the station markers are displayed, with a distinctive metro/underground style icon.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { TransitStation } from "../../../api/types";

// Subway station styling
const SUBWAY_STATION_COLOR = 0x0066cc; // Blue for subway
const SUBWAY_STATION_BG_COLOR = 0xe6f2ff; // Light blue background
const SUBWAY_STATION_INVALID_COLOR = 0xff4444; // Red for invalid placement
const SUBWAY_STATION_RADIUS = 12;
const SUBWAY_STATION_INNER_RADIUS = 8;

/**
 * Data structure for a subway station to render.
 */
export interface SubwayStationData {
  id: string;
  name: string;
  position: { x: number; y: number };
  isTerminus: boolean;
}

/**
 * Preview data for showing subway station placement preview.
 */
export interface SubwayStationPreviewData {
  position: { x: number; y: number };
  isValid: boolean; // Whether the position is valid (inside a district)
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
 * Lines are underground and NOT rendered.
 */
export class SubwayStationLayer {
  private container: Container;
  private stationsContainer: Container;
  private previewContainer: Container;
  private stationGraphics: Map<string, Container> = new Map();
  private previewGraphics: Graphics | null = null;
  private previewText: Text | null = null;
  private previewLabel: Text | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = "subway-stations";

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

  private createStationGraphics(station: SubwayStationData): void {
    const { id, name, position, isTerminus } = station;

    // Create container for this station
    const stationContainer = new Container();
    stationContainer.label = `subway-station-${id}`;

    // Draw the metro-style station marker
    // Outer ring (colored)
    const outer = new Graphics();
    outer.circle(position.x, position.y, SUBWAY_STATION_RADIUS);
    outer.fill({ color: SUBWAY_STATION_COLOR });
    stationContainer.addChild(outer);

    // Inner circle (white or light background)
    const inner = new Graphics();
    inner.circle(position.x, position.y, SUBWAY_STATION_INNER_RADIUS);
    inner.fill({ color: SUBWAY_STATION_BG_COLOR });
    stationContainer.addChild(inner);

    // Metro "M" icon in center (classic subway symbol)
    const iconStyle = new TextStyle({
      fontSize: 10,
      fontWeight: "bold",
      fill: SUBWAY_STATION_COLOR,
    });
    const iconText = new Text({ text: "M", style: iconStyle });
    iconText.anchor.set(0.5, 0.5);
    iconText.position.set(position.x, position.y);
    stationContainer.addChild(iconText);

    // Add terminus indicator if applicable
    if (isTerminus) {
      const terminusRing = new Graphics();
      terminusRing.setStrokeStyle({ width: 2, color: SUBWAY_STATION_COLOR });
      terminusRing.circle(position.x, position.y, SUBWAY_STATION_RADIUS + 3);
      terminusRing.stroke();
      stationContainer.addChild(terminusRing);
    }

    // Add station name label below
    const labelStyle = new TextStyle({
      fontSize: 9,
      fill: 0x333333,
      fontWeight: "500",
    });
    const labelText = new Text({ text: name, style: labelStyle });
    labelText.anchor.set(0.5, 0);
    labelText.position.set(position.x, position.y + SUBWAY_STATION_RADIUS + 4);
    stationContainer.addChild(labelText);

    this.stationsContainer.addChild(stationContainer);
    this.stationGraphics.set(id, stationContainer);
  }

  private updateStationGraphics(station: SubwayStationData): void {
    // For now, just recreate the graphics
    const existing = this.stationGraphics.get(station.id);
    if (existing) {
      this.stationsContainer.removeChild(existing);
      existing.destroy({ children: true });
      this.stationGraphics.delete(station.id);
    }
    this.createStationGraphics(station);
  }

  /**
   * Set or clear the preview for subway station placement.
   */
  setPreview(preview: SubwayStationPreviewData | null): void {
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
    if (this.previewLabel) {
      this.previewContainer.removeChild(this.previewLabel);
      this.previewLabel.destroy();
      this.previewLabel = null;
    }

    if (!preview) return;

    const { position, isValid } = preview;
    const color = isValid ? SUBWAY_STATION_COLOR : SUBWAY_STATION_INVALID_COLOR;
    const bgColor = isValid ? SUBWAY_STATION_BG_COLOR : 0xffcccc;

    // Create preview graphics
    this.previewGraphics = new Graphics();

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

    this.previewContainer.addChild(this.previewGraphics);

    // Add metro icon text
    const style = new TextStyle({
      fontSize: 10,
      fontWeight: "bold",
      fill: color,
    });
    this.previewText = new Text({ text: "M", style });
    this.previewText.anchor.set(0.5, 0.5);
    this.previewText.position.set(position.x, position.y);
    this.previewText.alpha = 0.8;
    this.previewContainer.addChild(this.previewText);

    // If not valid, add a warning message
    if (!isValid) {
      this.previewLabel = new Text({
        text: "Must be in district",
        style: new TextStyle({
          fontSize: 10,
          fill: SUBWAY_STATION_INVALID_COLOR,
          fontWeight: "bold",
        }),
      });
      this.previewLabel.anchor.set(0.5, 0);
      this.previewLabel.position.set(position.x, position.y + SUBWAY_STATION_RADIUS + 8);
      this.previewContainer.addChild(this.previewLabel);
    }
  }

  /**
   * Set visibility of the subway station layer.
   */
  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  /**
   * Clear all stations.
   */
  clear(): void {
    for (const [id, graphics] of this.stationGraphics.entries()) {
      this.stationsContainer.removeChild(graphics);
      graphics.destroy({ children: true });
    }
    this.stationGraphics.clear();
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.stationGraphics.clear();
  }
}
