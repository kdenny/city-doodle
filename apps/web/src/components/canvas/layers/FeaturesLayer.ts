/**
 * Features layer renderer for districts, roads, and POIs.
 *
 * Renders:
 * - District polygons with type-based colors
 * - Historic district indicators (hatched pattern)
 * - Road network with class-based styling
 * - POI markers with type-based icons
 */

import { Container, Graphics } from "pixi.js";
import type {
  FeaturesData,
  District,
  Road,
  POI,
  LayerVisibility,
  DistrictType,
  RoadClass,
  POIType,
  Point,
} from "./types";

// District colors by type
const DISTRICT_COLORS: Record<DistrictType, number> = {
  residential: 0xfff3cd, // Light yellow
  downtown: 0xd4a5a5, // Dusty rose
  commercial: 0xaed9e0, // Light teal
  industrial: 0xc9c9c9, // Gray
  hospital: 0xffcccb, // Light red
  university: 0xd4c4fb, // Light purple
  k12: 0xb5ead7, // Mint green
  park: 0x90ee90, // Light green
  airport: 0xe0e0e0, // Light gray
};

// Road styling by class
const ROAD_STYLES: Record<RoadClass, { width: number; color: number }> = {
  highway: { width: 6, color: 0xf5a623 },
  arterial: { width: 4, color: 0xffffff },
  collector: { width: 3, color: 0xffffff },
  local: { width: 2, color: 0xeeeeee },
  trail: { width: 1, color: 0xb8860b },
};

// Road outline (casing) colors
const ROAD_CASING_COLOR = 0x666666;

// POI colors by type
const POI_COLORS: Record<POIType, number> = {
  hospital: 0xff4444,
  school: 0xffaa00,
  university: 0x9966ff,
  park: 0x44aa44,
  transit: 0x0066cc,
  shopping: 0xff66aa,
  civic: 0x666666,
  industrial: 0x888888,
};

export class FeaturesLayer {
  private container: Container;
  private districtsGraphics: Graphics;
  private roadsGraphics: Graphics;
  private poisGraphics: Graphics;
  private data: FeaturesData | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = "features";

    // Create graphics objects for each sub-layer (order matters for z-index)
    // Districts at the bottom
    this.districtsGraphics = new Graphics();
    this.districtsGraphics.label = "districts";
    this.container.addChild(this.districtsGraphics);

    // Roads above districts
    this.roadsGraphics = new Graphics();
    this.roadsGraphics.label = "roads";
    this.container.addChild(this.roadsGraphics);

    // POIs on top
    this.poisGraphics = new Graphics();
    this.poisGraphics.label = "pois";
    this.container.addChild(this.poisGraphics);
  }

  getContainer(): Container {
    return this.container;
  }

  setData(data: FeaturesData): void {
    this.data = data;
    this.render();
  }

  setVisibility(visibility: LayerVisibility): void {
    this.districtsGraphics.visible = visibility.districts;
    this.roadsGraphics.visible = visibility.roads;
    this.poisGraphics.visible = visibility.pois;
  }

  private render(): void {
    if (!this.data) return;

    this.renderDistricts(this.data.districts);
    this.renderRoads(this.data.roads);
    this.renderPOIs(this.data.pois);
  }

  private renderDistricts(districts: District[]): void {
    if (this.districtsGraphics.clear) {
      this.districtsGraphics.clear();
    }

    for (const district of districts) {
      const color = DISTRICT_COLORS[district.type] ?? 0xcccccc;
      const points = district.polygon.points;

      if (points.length < 3) continue;

      // Draw district polygon fill
      this.districtsGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.districtsGraphics.lineTo(points[i].x, points[i].y);
      }
      this.districtsGraphics.closePath();
      this.districtsGraphics.fill({ color, alpha: 0.6 });

      // Draw outline
      this.districtsGraphics.setStrokeStyle({
        width: 1,
        color: 0x666666,
        alpha: 0.5,
      });
      this.districtsGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.districtsGraphics.lineTo(points[i].x, points[i].y);
      }
      this.districtsGraphics.closePath();
      this.districtsGraphics.stroke();

      // Draw historic district hatching
      if (district.isHistoric) {
        this.renderHistoricHatching(district.polygon.points);
      }
    }
  }

  private renderHistoricHatching(points: Point[]): void {
    // Find bounding box
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    // Draw diagonal hatching lines
    this.districtsGraphics.setStrokeStyle({
      width: 1,
      color: 0x8b4513, // Brown for historic
      alpha: 0.3,
    });

    const spacing = 10;
    for (let i = minX - (maxY - minY); i < maxX; i += spacing) {
      this.districtsGraphics.moveTo(i, minY);
      this.districtsGraphics.lineTo(i + (maxY - minY), maxY);
    }
    this.districtsGraphics.stroke();
  }

  private renderRoads(roads: Road[]): void {
    if (this.roadsGraphics.clear) {
      this.roadsGraphics.clear();
    }

    // Sort roads by class (draw highways last so they're on top)
    const classOrder: RoadClass[] = [
      "trail",
      "local",
      "collector",
      "arterial",
      "highway",
    ];
    const sortedRoads = [...roads].sort(
      (a, b) => classOrder.indexOf(a.roadClass) - classOrder.indexOf(b.roadClass)
    );

    // Draw road casings first (outlines)
    for (const road of sortedRoads) {
      const style = ROAD_STYLES[road.roadClass];
      const points = road.line.points;

      if (points.length < 2) continue;

      // Draw casing (darker outline)
      this.roadsGraphics.setStrokeStyle({
        width: style.width + 2,
        color: ROAD_CASING_COLOR,
        cap: "round",
        join: "round",
      });

      this.roadsGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.roadsGraphics.lineTo(points[i].x, points[i].y);
      }
      this.roadsGraphics.stroke();
    }

    // Draw road fills
    for (const road of sortedRoads) {
      const style = ROAD_STYLES[road.roadClass];
      const points = road.line.points;

      if (points.length < 2) continue;

      // Draw road fill
      this.roadsGraphics.setStrokeStyle({
        width: style.width,
        color: style.color,
        cap: "round",
        join: "round",
      });

      this.roadsGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.roadsGraphics.lineTo(points[i].x, points[i].y);
      }
      this.roadsGraphics.stroke();
    }
  }

  private renderPOIs(pois: POI[]): void {
    if (this.poisGraphics.clear) {
      this.poisGraphics.clear();
    }

    for (const poi of pois) {
      const color = POI_COLORS[poi.type] ?? 0x666666;
      const { x, y } = poi.position;
      const radius = 6;

      // Draw POI marker (circle with outline)
      this.poisGraphics.setStrokeStyle({ width: 2, color: 0xffffff });
      this.poisGraphics.circle(x, y, radius);
      this.poisGraphics.fill({ color });
      this.poisGraphics.stroke();

      // Draw inner dot for emphasis
      this.poisGraphics.circle(x, y, 2);
      this.poisGraphics.fill({ color: 0xffffff });
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

/**
 * Generate mock features data for testing.
 */
export function generateMockFeatures(
  worldSize: number,
  seed: number
): FeaturesData {
  const rng = new SeededRandom(seed);

  // Generate districts
  const districts: District[] = [];
  const districtTypes: DistrictType[] = [
    "residential",
    "downtown",
    "commercial",
    "industrial",
    "park",
    "university",
  ];
  const districtNames = [
    "Riverside",
    "Downtown",
    "Harbor District",
    "Industrial Park",
    "Central Park",
    "University Quarter",
  ];

  for (let i = 0; i < 6; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cellSize = worldSize / 3;
    const centerX = (col + 0.5) * cellSize;
    const centerY = (row + 0.5) * cellSize;
    const size = cellSize * 0.7;

    // Generate irregular polygon
    const points: Point[] = [];
    const numPoints = 6 + Math.floor(rng.next() * 4);
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2;
      const r = size * (0.4 + rng.next() * 0.2);
      points.push({
        x: centerX + Math.cos(angle) * r,
        y: centerY + Math.sin(angle) * r,
      });
    }

    districts.push({
      id: `district-${i}`,
      type: districtTypes[i],
      name: districtNames[i],
      polygon: { points },
      isHistoric: i === 0, // First district is historic
    });
  }

  // Generate roads
  const roads: Road[] = [];

  // Main highway (horizontal)
  roads.push({
    id: "highway-1",
    name: "Highway 101",
    roadClass: "highway",
    line: {
      points: [
        { x: 0, y: worldSize * 0.4 },
        { x: worldSize * 0.3, y: worldSize * 0.35 },
        { x: worldSize * 0.7, y: worldSize * 0.45 },
        { x: worldSize, y: worldSize * 0.4 },
      ],
    },
  });

  // Arterial roads
  roads.push({
    id: "arterial-1",
    name: "Main Street",
    roadClass: "arterial",
    line: {
      points: [
        { x: worldSize * 0.5, y: 0 },
        { x: worldSize * 0.5, y: worldSize },
      ],
    },
  });

  roads.push({
    id: "arterial-2",
    name: "Oak Avenue",
    roadClass: "arterial",
    line: {
      points: [
        { x: 0, y: worldSize * 0.6 },
        { x: worldSize, y: worldSize * 0.6 },
      ],
    },
  });

  // Collector roads
  for (let i = 0; i < 4; i++) {
    const y = worldSize * (0.2 + i * 0.2);
    roads.push({
      id: `collector-${i}`,
      roadClass: "collector",
      line: {
        points: [
          { x: worldSize * 0.1, y: y + rng.range(-10, 10) },
          { x: worldSize * 0.9, y: y + rng.range(-10, 10) },
        ],
      },
    });
  }

  // Local roads (grid pattern with some variation)
  for (let i = 0; i < 6; i++) {
    const x = worldSize * (0.15 + i * 0.14);
    roads.push({
      id: `local-v-${i}`,
      roadClass: "local",
      line: {
        points: [
          { x: x + rng.range(-5, 5), y: worldSize * 0.1 },
          { x: x + rng.range(-5, 5), y: worldSize * 0.9 },
        ],
      },
    });
  }

  // Trail
  roads.push({
    id: "trail-1",
    name: "River Trail",
    roadClass: "trail",
    line: {
      points: [
        { x: worldSize * 0.1, y: worldSize * 0.8 },
        { x: worldSize * 0.2, y: worldSize * 0.75 },
        { x: worldSize * 0.4, y: worldSize * 0.85 },
        { x: worldSize * 0.6, y: worldSize * 0.8 },
        { x: worldSize * 0.9, y: worldSize * 0.9 },
      ],
    },
  });

  // Generate POIs
  const pois: POI[] = [
    {
      id: "poi-hospital",
      name: "City Hospital",
      type: "hospital",
      position: { x: worldSize * 0.3, y: worldSize * 0.3 },
    },
    {
      id: "poi-school-1",
      name: "Lincoln Elementary",
      type: "school",
      position: { x: worldSize * 0.2, y: worldSize * 0.5 },
    },
    {
      id: "poi-school-2",
      name: "Washington High",
      type: "school",
      position: { x: worldSize * 0.7, y: worldSize * 0.6 },
    },
    {
      id: "poi-university",
      name: "State University",
      type: "university",
      position: { x: worldSize * 0.8, y: worldSize * 0.2 },
    },
    {
      id: "poi-park",
      name: "Central Park",
      type: "park",
      position: { x: worldSize * 0.5, y: worldSize * 0.5 },
    },
    {
      id: "poi-transit-1",
      name: "Central Station",
      type: "transit",
      position: { x: worldSize * 0.5, y: worldSize * 0.4 },
    },
    {
      id: "poi-transit-2",
      name: "Harbor Station",
      type: "transit",
      position: { x: worldSize * 0.15, y: worldSize * 0.4 },
    },
    {
      id: "poi-shopping",
      name: "Downtown Mall",
      type: "shopping",
      position: { x: worldSize * 0.45, y: worldSize * 0.35 },
    },
    {
      id: "poi-civic",
      name: "City Hall",
      type: "civic",
      position: { x: worldSize * 0.5, y: worldSize * 0.3 },
    },
    {
      id: "poi-industrial",
      name: "Power Plant",
      type: "industrial",
      position: { x: worldSize * 0.85, y: worldSize * 0.7 },
    },
  ];

  return { districts, roads, pois };
}

/**
 * Seeded random number generator for deterministic results.
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}
