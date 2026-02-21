/**
 * Terrain layer renderer using PixiJS Graphics.
 */

import { Container, Graphics } from "pixi.js";
import type {
  TerrainData,
  LayerVisibility,
  WaterFeature,
  LakeType,
  BeachFeature,
  CoastlineFeature,
  RiverFeature,
  ContourLine,
  BarrierIslandFeature,
  TidalFlatFeature,
  DuneRidgeFeature,
  InletFeature,
} from "./types";

// Color palette for terrain features
const COLORS = {
  ocean: 0x89cff0, // Light blue
  lake: 0xa7d8de, // Default lake blue (slightly different from ocean)
  coastline: 0x4a90a4, // Darker blue for coastlines
  river: 0x6bb3c9, // Medium blue for rivers
  contour: 0xc9b896, // Tan/brown for contour lines
  // Beach colors vary by type
  beach: {
    ocean: 0xf5e6c8, // Sandy tan for ocean beaches
    bay: 0xf2e0bf, // Slightly warmer for bay beaches
    lake: 0xe8dcc0, // Muted tan for lake beaches
    river: 0xddd5b8, // Grayish tan for river beaches
  },
  // Coastal sub-feature colors (CITY-589)
  barrierIsland: 0xd4c5a0, // Sandy/tan fill
  tidalFlat: 0xa8b8c0,     // Muted blue-grey
  duneRidge: 0xc9a86c,     // Tan/brown line
  inlet: 0x89cff0,         // Water-colored (same as ocean)
  // Lake type colors - subtle variations in blue to show lake character
  lakeType: {
    glacial: 0xa7d8de,   // Cool blue-gray (ice-fed, cold water)
    crater: 0x4a90d9,    // Deep vibrant blue (clear volcanic water)
    oxbow: 0x8fc9a8,     // Murky green-blue (still water, organic matter)
    reservoir: 0x7ec8e3, // Standard lake blue (managed water)
    rift: 0x5a9bd4,      // Deep blue (very deep water)
    pond: 0xb8dfe6,      // Light blue-green (shallow, possibly algae)
    kettle: 0x9dd5e0,    // Clear light blue (glacial origin, clean)
  } as Record<LakeType, number>,
};

export class TerrainLayer {
  private container: Container;
  private waterGraphics: Graphics;
  private beachGraphics: Graphics;
  private barrierIslandGraphics: Graphics;
  private tidalFlatGraphics: Graphics;
  private inletGraphics: Graphics;
  private coastlineGraphics: Graphics;
  private riverGraphics: Graphics;
  private contourGraphics: Graphics;
  private duneRidgeGraphics: Graphics;
  private terrainData: TerrainData | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = "terrain";

    // Create graphics objects for each layer (order matters for z-index)
    this.waterGraphics = new Graphics();
    this.waterGraphics.label = "water";
    this.container.addChild(this.waterGraphics);

    // Inlets render on top of water (water-colored polygons)
    this.inletGraphics = new Graphics();
    this.inletGraphics.label = "inlets";
    this.container.addChild(this.inletGraphics);

    // Tidal flats render on top of water, below beaches
    this.tidalFlatGraphics = new Graphics();
    this.tidalFlatGraphics.label = "tidalFlats";
    this.container.addChild(this.tidalFlatGraphics);

    // Beaches render on top of water, below coastlines
    this.beachGraphics = new Graphics();
    this.beachGraphics.label = "beaches";
    this.container.addChild(this.beachGraphics);

    // Barrier islands render in the same pass as beaches (sandy polygons)
    this.barrierIslandGraphics = new Graphics();
    this.barrierIslandGraphics.label = "barrierIslands";
    this.container.addChild(this.barrierIslandGraphics);

    this.contourGraphics = new Graphics();
    this.contourGraphics.label = "contours";
    this.container.addChild(this.contourGraphics);

    // Dune ridges render on top of contours (tan/brown lines)
    this.duneRidgeGraphics = new Graphics();
    this.duneRidgeGraphics.label = "duneRidges";
    this.container.addChild(this.duneRidgeGraphics);

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
    this.beachGraphics.visible = visibility.beaches;
    this.coastlineGraphics.visible = visibility.coastlines;
    this.riverGraphics.visible = visibility.rivers;
    this.contourGraphics.visible = visibility.contours;
    this.barrierIslandGraphics.visible = visibility.barrierIslands;
    this.tidalFlatGraphics.visible = visibility.tidalFlats;
    this.duneRidgeGraphics.visible = visibility.duneRidges;
    this.inletGraphics.visible = visibility.inlets;
  }

  private render(): void {
    if (!this.terrainData) return;

    this.renderWater(this.terrainData.water);
    this.renderInlets(this.terrainData.inlets || []);
    this.renderTidalFlats(this.terrainData.tidalFlats || []);
    this.renderBeaches(this.terrainData.beaches || []);
    this.renderBarrierIslands(this.terrainData.barrierIslands || []);
    this.renderCoastlines(this.terrainData.coastlines);
    this.renderRivers(this.terrainData.rivers);
    this.renderContours(this.terrainData.contours);
    this.renderDuneRidges(this.terrainData.duneRidges || []);
  }

  private renderWater(features: WaterFeature[]): void {
    this.waterGraphics.clear();

    for (const feature of features) {
      // Determine color based on water type and lake type
      let color: number;
      if (feature.type === "ocean") {
        color = COLORS.ocean;
      } else if (feature.lakeType && COLORS.lakeType[feature.lakeType]) {
        // Use lake type specific color
        color = COLORS.lakeType[feature.lakeType];
      } else {
        // Default lake color
        color = COLORS.lake;
      }

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

  private renderBeaches(features: BeachFeature[]): void {
    this.beachGraphics.clear();

    for (const feature of features) {
      const points = feature.polygon.points;
      if (points.length < 3) continue;

      // Select color based on beach type
      const beachType = feature.beachType || "ocean";
      const color = COLORS.beach[beachType] || COLORS.beach.ocean;

      this.beachGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.beachGraphics.lineTo(points[i].x, points[i].y);
      }
      this.beachGraphics.closePath();
      this.beachGraphics.fill({ color, alpha: 0.85 });
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

  private renderBarrierIslands(features: BarrierIslandFeature[]): void {
    this.barrierIslandGraphics.clear();

    for (const feature of features) {
      const points = feature.polygon.points;
      if (points.length < 3) continue;

      this.barrierIslandGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.barrierIslandGraphics.lineTo(points[i].x, points[i].y);
      }
      this.barrierIslandGraphics.closePath();
      this.barrierIslandGraphics.fill({ color: COLORS.barrierIsland, alpha: 0.85 });
    }
  }

  private renderTidalFlats(features: TidalFlatFeature[]): void {
    this.tidalFlatGraphics.clear();

    for (const feature of features) {
      const points = feature.polygon.points;
      if (points.length < 3) continue;

      this.tidalFlatGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.tidalFlatGraphics.lineTo(points[i].x, points[i].y);
      }
      this.tidalFlatGraphics.closePath();
      this.tidalFlatGraphics.fill({ color: COLORS.tidalFlat, alpha: 0.5 });
    }
  }

  private renderDuneRidges(features: DuneRidgeFeature[]): void {
    this.duneRidgeGraphics.clear();

    for (const feature of features) {
      const points = feature.line.points;
      if (points.length < 2) continue;

      this.duneRidgeGraphics.setStrokeStyle({
        width: 2,
        color: COLORS.duneRidge,
        cap: "round",
        join: "round",
      });

      this.duneRidgeGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.duneRidgeGraphics.lineTo(points[i].x, points[i].y);
      }
      this.duneRidgeGraphics.stroke();
    }
  }

  private renderInlets(features: InletFeature[]): void {
    this.inletGraphics.clear();

    for (const feature of features) {
      const points = feature.polygon.points;
      if (points.length < 3) continue;

      this.inletGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.inletGraphics.lineTo(points[i].x, points[i].y);
      }
      this.inletGraphics.closePath();
      this.inletGraphics.fill({ color: COLORS.inlet, alpha: 0.7 });
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
