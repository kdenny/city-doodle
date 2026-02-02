/**
 * Terrain layer renderer using PixiJS Graphics.
 */

import { Container, Graphics } from "pixi.js";
import type {
  TerrainData,
  LayerVisibility,
  WaterFeature,
  CoastlineFeature,
  RiverFeature,
  ContourLine,
} from "./types";

// Color palette for terrain features
const COLORS = {
  ocean: 0x89cff0, // Light blue
  lake: 0xa7d8de, // Slightly different blue for lakes
  coastline: 0x4a90a4, // Darker blue for coastlines
  river: 0x6bb3c9, // Medium blue for rivers
  contour: 0xc9b896, // Tan/brown for contour lines
};

export class TerrainLayer {
  private container: Container;
  private waterGraphics: Graphics;
  private coastlineGraphics: Graphics;
  private riverGraphics: Graphics;
  private contourGraphics: Graphics;
  private terrainData: TerrainData | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = "terrain";

    // Create graphics objects for each layer (order matters for z-index)
    this.waterGraphics = new Graphics();
    this.waterGraphics.label = "water";
    this.container.addChild(this.waterGraphics);

    this.contourGraphics = new Graphics();
    this.contourGraphics.label = "contours";
    this.container.addChild(this.contourGraphics);

    this.riverGraphics = new Graphics();
    this.riverGraphics.label = "rivers";
    this.container.addChild(this.riverGraphics);

    this.coastlineGraphics = new Graphics();
    this.coastlineGraphics.label = "coastlines";
    this.container.addChild(this.coastlineGraphics);
  }

  getContainer(): Container {
    return this.container;
  }

  setData(data: TerrainData): void {
    this.terrainData = data;
    this.render();
  }

  setVisibility(visibility: LayerVisibility): void {
    this.waterGraphics.visible = visibility.water;
    this.coastlineGraphics.visible = visibility.coastlines;
    this.riverGraphics.visible = visibility.rivers;
    this.contourGraphics.visible = visibility.contours;
  }

  private render(): void {
    if (!this.terrainData) return;

    this.renderWater(this.terrainData.water);
    this.renderCoastlines(this.terrainData.coastlines);
    this.renderRivers(this.terrainData.rivers);
    this.renderContours(this.terrainData.contours);
  }

  private renderWater(features: WaterFeature[]): void {
    this.waterGraphics.clear();

    for (const feature of features) {
      const color = feature.type === "ocean" ? COLORS.ocean : COLORS.lake;
      const points = feature.polygon.points;

      if (points.length < 3) continue;

      this.waterGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.waterGraphics.lineTo(points[i].x, points[i].y);
      }
      this.waterGraphics.closePath();
      this.waterGraphics.fill({ color, alpha: 0.7 });
    }
  }

  private renderCoastlines(features: CoastlineFeature[]): void {
    this.coastlineGraphics.clear();

    for (const feature of features) {
      const points = feature.line.points;
      if (points.length < 2) continue;

      this.coastlineGraphics.setStrokeStyle({
        width: feature.line.width || 2,
        color: COLORS.coastline,
        cap: "round",
        join: "round",
      });

      this.coastlineGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.coastlineGraphics.lineTo(points[i].x, points[i].y);
      }
      this.coastlineGraphics.stroke();
    }
  }

  private renderRivers(features: RiverFeature[]): void {
    this.riverGraphics.clear();

    for (const feature of features) {
      const points = feature.line.points;
      if (points.length < 2) continue;

      this.riverGraphics.setStrokeStyle({
        width: feature.width,
        color: COLORS.river,
        cap: "round",
        join: "round",
      });

      this.riverGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.riverGraphics.lineTo(points[i].x, points[i].y);
      }
      this.riverGraphics.stroke();
    }
  }

  private renderContours(features: ContourLine[]): void {
    this.contourGraphics.clear();

    for (const feature of features) {
      const points = feature.line.points;
      if (points.length < 2) continue;

      // Vary line weight based on elevation (major contours thicker)
      const isMajor = feature.elevation % 50 === 0;
      const width = isMajor ? 1.5 : 0.5;
      const alpha = isMajor ? 0.6 : 0.3;

      this.contourGraphics.setStrokeStyle({
        width,
        color: COLORS.contour,
        alpha,
      });

      this.contourGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.contourGraphics.lineTo(points[i].x, points[i].y);
      }
      this.contourGraphics.stroke();
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
