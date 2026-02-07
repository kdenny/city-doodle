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
  Neighborhood,
  CityLimits,
  Road,
  POI,
  Bridge,
  Interchange,
  LayerVisibility,
  DistrictType,
  RoadClass,
  POIType,
  Point,
  WaterCrossingType,
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

// Road styling by class (Google Maps inspired)
interface RoadStyle {
  width: number;
  color: number;
  casingWidth: number; // Additional width for outline (0 = no casing)
  casingColor: number;
  dashed: boolean;
  /** Minimum zoom level to show this road class (0 = always show) */
  minZoom: number;
}

const ROAD_STYLES: Record<RoadClass, RoadStyle> = {
  highway: {
    width: 8,
    color: 0xf9dc5c, // Yellow
    casingWidth: 2,
    casingColor: 0x000000, // Black outline
    dashed: false,
    minZoom: 0, // Always visible
  },
  arterial: {
    width: 6,
    color: 0xffffff, // White
    casingWidth: 1,
    casingColor: 0x888888, // Gray outline
    dashed: false,
    minZoom: 0, // Always visible
  },
  collector: {
    width: 4,
    color: 0xffffff, // White
    casingWidth: 0.5,
    casingColor: 0xaaaaaa, // Light gray outline
    dashed: false,
    minZoom: 0.5, // Only at medium+ zoom
  },
  local: {
    width: 2,
    color: 0xffffff, // White
    casingWidth: 0,
    casingColor: 0x000000,
    dashed: false,
    minZoom: 0.8, // Only at high zoom
  },
  trail: {
    width: 2,
    color: 0xa8d5a2, // Light green
    casingWidth: 0,
    casingColor: 0x000000,
    dashed: true,
    minZoom: 0.6, // Medium+ zoom
  },
};

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

// Bridge styling by water type
interface BridgeStyle {
  color: number;
  railingColor: number;
  alpha: number;
}

const BRIDGE_STYLES: Record<WaterCrossingType, BridgeStyle> = {
  river: {
    color: 0xd4c4a8, // Sandy/concrete color
    railingColor: 0x8b7355, // Brown railing
    alpha: 1.0,
  },
  lake: {
    color: 0xc8b896, // Slightly darker
    railingColor: 0x7a6548,
    alpha: 1.0,
  },
  ocean: {
    color: 0xb8a888, // Darker concrete for major bridges
    railingColor: 0x6b5b4a,
    alpha: 1.0,
  },
  bay: {
    color: 0xc0b090, // Medium tone
    railingColor: 0x706048,
    alpha: 1.0,
  },
};

// Hit test radius for POIs (in world coordinates)
const POI_HIT_RADIUS = 12;

// Hit test distance for roads (in world coordinates)
const ROAD_HIT_DISTANCE = 8;

/**
 * Grid-based spatial index for O(1) average-case road hit testing.
 * Divides world space into fixed-size cells and maps each cell to the
 * roads whose bounding boxes intersect it. Query returns only roads
 * in cells near the test point, avoiding a full linear scan.
 */
class RoadSpatialIndex {
  private cellSize: number;
  private cells = new Map<string, Road[]>();

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  /** Rebuild the index from a new set of roads. */
  rebuild(roads: Road[]): void {
    this.cells.clear();
    for (const road of roads) {
      const points = road.line.points;
      if (points.length < 2) continue;

      // Compute bounding box of all road segments
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      // Insert road reference into every cell its bounding box touches
      const startCx = Math.floor(minX / this.cellSize);
      const endCx = Math.floor(maxX / this.cellSize);
      const startCy = Math.floor(minY / this.cellSize);
      const endCy = Math.floor(maxY / this.cellSize);

      for (let cx = startCx; cx <= endCx; cx++) {
        for (let cy = startCy; cy <= endCy; cy++) {
          const key = `${cx},${cy}`;
          let bucket = this.cells.get(key);
          if (!bucket) {
            bucket = [];
            this.cells.set(key, bucket);
          }
          bucket.push(road);
        }
      }
    }
  }

  /** Return candidate roads near (x, y) within the given radius. */
  query(x: number, y: number, radius: number): Road[] {
    const startCx = Math.floor((x - radius) / this.cellSize);
    const endCx = Math.floor((x + radius) / this.cellSize);
    const startCy = Math.floor((y - radius) / this.cellSize);
    const endCy = Math.floor((y + radius) / this.cellSize);

    const seen = new Set<Road>();
    const results: Road[] = [];

    for (let cx = startCx; cx <= endCx; cx++) {
      for (let cy = startCy; cy <= endCy; cy++) {
        const bucket = this.cells.get(`${cx},${cy}`);
        if (!bucket) continue;
        for (const road of bucket) {
          if (!seen.has(road)) {
            seen.add(road);
            results.push(road);
          }
        }
      }
    }

    return results;
  }
}

// Default neighborhood colors (used when no custom color is set)
const DEFAULT_NEIGHBORHOOD_COLOR = 0x4a90d9; // Blue

// City limits styling
const CITY_LIMITS_STYLE = {
  borderColor: 0x5a5a5a, // Dark gray/civic color
  borderWidth: 4, // Thicker than neighborhoods
  fillColor: 0x5a5a5a,
  fillAlpha: 0.05, // Very subtle tint inside
  dashLength: 16,
  gapLength: 8,
};

/**
 * Result of a hit test on the features layer.
 */
export interface HitTestResult {
  type: "district" | "road" | "poi" | "neighborhood" | "cityLimits";
  feature: District | Road | POI | Neighborhood | CityLimits;
}

export class FeaturesLayer {
  private container: Container;
  private neighborhoodsGraphics: Graphics;
  private cityLimitsGraphics: Graphics;
  private districtsGraphics: Graphics;
  private roadsGraphics: Graphics;
  private roadHighlightGraphics: Graphics;
  private bridgesGraphics: Graphics;
  private interchangesGraphics: Graphics;
  private poisGraphics: Graphics;
  private data: FeaturesData | null = null;
  private currentZoom: number = 1;
  /** Scale factor derived from average district size. Roads widen for larger districts. */
  private districtScale: number = 1;
  /** ID of the currently selected road (null = no selection) */
  private selectedRoadId: string | null = null;
  /** Spatial index for efficient road hit testing (rebuilt on data change) */
  private roadIndex = new RoadSpatialIndex();
  /** Current viewport bounds in world coordinates (null = not set, render all) */
  private viewportBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = "features";

    // Create graphics objects for each sub-layer (order matters for z-index)
    // Neighborhoods at the very bottom (larger boundary areas)
    this.neighborhoodsGraphics = new Graphics();
    this.neighborhoodsGraphics.label = "neighborhoods";
    this.container.addChild(this.neighborhoodsGraphics);

    // City limits above neighborhoods (municipal boundary)
    this.cityLimitsGraphics = new Graphics();
    this.cityLimitsGraphics.label = "cityLimits";
    this.container.addChild(this.cityLimitsGraphics);

    // Districts above city limits
    this.districtsGraphics = new Graphics();
    this.districtsGraphics.label = "districts";
    this.container.addChild(this.districtsGraphics);

    // Roads above districts
    this.roadsGraphics = new Graphics();
    this.roadsGraphics.label = "roads";
    this.container.addChild(this.roadsGraphics);

    // Road selection highlight (above roads, below bridges)
    this.roadHighlightGraphics = new Graphics();
    this.roadHighlightGraphics.label = "roadHighlight";
    this.container.addChild(this.roadHighlightGraphics);

    // Bridges render on top of roads (they're elevated)
    this.bridgesGraphics = new Graphics();
    this.bridgesGraphics.label = "bridges";
    this.container.addChild(this.bridgesGraphics);

    // Interchanges render above bridges
    this.interchangesGraphics = new Graphics();
    this.interchangesGraphics.label = "interchanges";
    this.container.addChild(this.interchangesGraphics);

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
    this.districtScale = this.computeDistrictScale(data.districts);
    this.roadIndex.rebuild(data.roads);
    this.render();
  }

  setVisibility(visibility: LayerVisibility & { neighborhoods?: boolean; cityLimits?: boolean; bridges?: boolean }): void {
    this.neighborhoodsGraphics.visible = visibility.neighborhoods ?? true;
    this.cityLimitsGraphics.visible = visibility.cityLimits ?? true;
    this.districtsGraphics.visible = visibility.districts;
    this.roadsGraphics.visible = visibility.roads;
    this.roadHighlightGraphics.visible = visibility.roads;
    this.bridgesGraphics.visible = visibility.bridges ?? visibility.roads; // Default to road visibility
    this.poisGraphics.visible = visibility.pois;
  }

  /**
   * Set the current zoom level for zoom-based road visibility.
   * @param zoom - Zoom level (1 = default, <1 = zoomed out, >1 = zoomed in)
   */
  setZoom(zoom: number): void {
    if (this.currentZoom !== zoom) {
      this.currentZoom = zoom;
      // Re-render roads when zoom changes (for visibility filtering)
      if (this.data) {
        this.renderRoads(this.data.roads);
        this.renderRoadHighlight();
      }
    }
  }

  /**
   * Set the visible viewport bounds in world coordinates.
   * Roads outside these bounds are skipped during rendering for performance.
   *
   * @param bounds - Visible area, or null to render all roads
   */
  setViewportBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number } | null): void {
    this.viewportBounds = bounds;
    // Re-render roads with new viewport bounds
    if (this.data) {
      this.renderRoads(this.data.roads);
      this.renderBridges(this.data.bridges);
    }
  }

  /**
   * Set the selected road ID for visual highlighting.
   */
  setSelectedRoadId(roadId: string | null): void {
    if (this.selectedRoadId !== roadId) {
      this.selectedRoadId = roadId;
      this.renderRoadHighlight();
    }
  }

  /**
   * Compute a road width scale factor from the average district diameter.
   * The base road widths were designed for districts ~200px across.
   */
  private computeDistrictScale(districts: District[]): number {
    if (districts.length === 0) return 1;

    let totalDiameter = 0;
    for (const d of districts) {
      const pts = d.polygon.points;
      if (pts.length < 3) continue;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      totalDiameter += Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
    }

    const avgDiameter = totalDiameter / districts.length;
    const referenceDiameter = 200;
    // Clamp between 0.5x and 3x to avoid extreme values
    return Math.max(0.5, Math.min(3, avgDiameter / referenceDiameter));
  }

  private render(): void {
    if (!this.data) return;

    this.renderNeighborhoods(this.data.neighborhoods || []);
    this.renderCityLimits(this.data.cityLimits);
    this.renderDistricts(this.data.districts);
    this.renderRoads(this.data.roads);
    this.renderRoadHighlight();
    this.renderBridges(this.data.bridges || []);
    this.renderInterchanges(this.data.interchanges || []);
    this.renderPOIs(this.data.pois);
  }

  private renderNeighborhoods(neighborhoods: Neighborhood[]): void {
    if (this.neighborhoodsGraphics.clear) {
      this.neighborhoodsGraphics.clear();
    }

    for (const neighborhood of neighborhoods) {
      const points = neighborhood.polygon.points;
      if (points.length < 3) continue;

      // Parse accent color or use default
      let fillColor = DEFAULT_NEIGHBORHOOD_COLOR;
      if (neighborhood.accentColor) {
        const parsed = parseInt(neighborhood.accentColor.replace("#", ""), 16);
        if (!isNaN(parsed)) fillColor = parsed;
      }

      // Draw neighborhood polygon with dashed border
      this.neighborhoodsGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.neighborhoodsGraphics.lineTo(points[i].x, points[i].y);
      }
      this.neighborhoodsGraphics.closePath();
      this.neighborhoodsGraphics.fill({ color: fillColor, alpha: 0.15 });

      // Draw dashed border
      this.drawNeighborhoodBorder(points, fillColor);
    }
  }

  private drawNeighborhoodBorder(points: Point[], color: number): void {
    const dashLength = 12;
    const gapLength = 6;

    this.neighborhoodsGraphics.setStrokeStyle({
      width: 2,
      color,
      alpha: 0.6,
      cap: "round",
    });

    // Draw dashed border for each edge
    for (let i = 0; i < points.length; i++) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      if (segmentLength === 0) continue;

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

          this.neighborhoodsGraphics.moveTo(startX, startY);
          this.neighborhoodsGraphics.lineTo(endX, endY);
          this.neighborhoodsGraphics.stroke();
        }

        currentLength = nextLength;
        drawing = !drawing;
      }
    }
  }

  /**
   * Render the city limits boundary.
   * City limits uses a thicker dashed line with a distinct civic color.
   */
  private renderCityLimits(cityLimits: CityLimits | undefined): void {
    if (this.cityLimitsGraphics.clear) {
      this.cityLimitsGraphics.clear();
    }

    if (!cityLimits) return;

    const points = cityLimits.boundary.points;
    if (points.length < 3) return;

    // Draw very subtle fill inside city limits
    this.cityLimitsGraphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.cityLimitsGraphics.lineTo(points[i].x, points[i].y);
    }
    this.cityLimitsGraphics.closePath();
    this.cityLimitsGraphics.fill({
      color: CITY_LIMITS_STYLE.fillColor,
      alpha: CITY_LIMITS_STYLE.fillAlpha,
    });

    // Draw thicker dashed border
    this.drawCityLimitsBorder(points);
  }

  /**
   * Draw the city limits border with a distinct thicker dashed style.
   */
  private drawCityLimitsBorder(points: Point[]): void {
    const { borderColor, borderWidth, dashLength, gapLength } = CITY_LIMITS_STYLE;

    this.cityLimitsGraphics.setStrokeStyle({
      width: borderWidth,
      color: borderColor,
      alpha: 0.8,
      cap: "round",
    });

    // Draw dashed border for each edge
    for (let i = 0; i < points.length; i++) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      if (segmentLength === 0) continue;

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

          this.cityLimitsGraphics.moveTo(startX, startY);
          this.cityLimitsGraphics.lineTo(endX, endY);
          this.cityLimitsGraphics.stroke();
        }

        currentLength = nextLength;
        drawing = !drawing;
      }
    }
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

    // Filter roads by zoom level and viewport bounds
    const vp = this.viewportBounds;
    const visibleRoads = sortedRoads.filter((road) => {
      const style = ROAD_STYLES[road.roadClass];
      if (this.currentZoom < style.minZoom) return false;

      // Viewport culling: skip roads entirely outside visible area
      if (vp) {
        const pts = road.line.points;
        let allOutside = true;
        for (const p of pts) {
          if (p.x >= vp.minX && p.x <= vp.maxX && p.y >= vp.minY && p.y <= vp.maxY) {
            allOutside = false;
            break;
          }
        }
        if (allOutside) return false;
      }

      return true;
    });

    // Scale road widths with zoom (thinner when zoomed out) and district size
    const zoomScale = Math.max(0.5, Math.min(1.5, this.currentZoom)) * this.districtScale;

    // Draw road casings first (outlines) - only for roads that have casings
    for (const road of visibleRoads) {
      const style = ROAD_STYLES[road.roadClass];
      const points = road.line.points;

      if (points.length < 2) continue;
      if (style.casingWidth <= 0) continue;

      const scaledWidth = style.width * zoomScale;
      const casingWidth = scaledWidth + style.casingWidth * 2;

      // Draw casing (outline)
      this.roadsGraphics.setStrokeStyle({
        width: casingWidth,
        color: style.casingColor,
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
    for (const road of visibleRoads) {
      const style = ROAD_STYLES[road.roadClass];
      const points = road.line.points;

      if (points.length < 2) continue;

      const scaledWidth = style.width * zoomScale;

      if (style.dashed) {
        // Draw dashed line for trails
        this.drawDashedLine(points, scaledWidth, style.color);
      } else {
        // Draw solid road fill
        this.roadsGraphics.setStrokeStyle({
          width: scaledWidth,
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
  }

  /**
   * Render a highlight glow around the selected road.
   */
  private renderRoadHighlight(): void {
    if (this.roadHighlightGraphics.clear) {
      this.roadHighlightGraphics.clear();
    }

    if (!this.selectedRoadId || !this.data) return;

    const road = this.data.roads.find((r) => r.id === this.selectedRoadId);
    if (!road || road.line.points.length < 2) return;

    const style = ROAD_STYLES[road.roadClass];
    const zoomScale =
      Math.max(0.5, Math.min(1.5, this.currentZoom)) * this.districtScale;
    const scaledWidth = style.width * zoomScale;
    const points = road.line.points;

    // Outer glow (wide, semi-transparent cyan)
    this.roadHighlightGraphics.setStrokeStyle({
      width: scaledWidth + 10,
      color: 0x00bfff,
      alpha: 0.35,
      cap: "round",
      join: "round",
    });
    this.roadHighlightGraphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.roadHighlightGraphics.lineTo(points[i].x, points[i].y);
    }
    this.roadHighlightGraphics.stroke();

    // Inner highlight (bright cyan outline)
    this.roadHighlightGraphics.setStrokeStyle({
      width: scaledWidth + 4,
      color: 0x00bfff,
      alpha: 0.7,
      cap: "round",
      join: "round",
    });
    this.roadHighlightGraphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.roadHighlightGraphics.lineTo(points[i].x, points[i].y);
    }
    this.roadHighlightGraphics.stroke();
  }

  /**
   * Draw a dashed line between points.
   */
  private drawDashedLine(points: Point[], width: number, color: number): void {
    const dashLength = 8;
    const gapLength = 4;

    this.roadsGraphics.setStrokeStyle({
      width,
      color,
      cap: "round",
    });

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
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

          this.roadsGraphics.moveTo(startX, startY);
          this.roadsGraphics.lineTo(endX, endY);
          this.roadsGraphics.stroke();
        }

        currentLength = nextLength;
        drawing = !drawing;
      }
    }
  }

  /**
   * Render bridges where roads cross water features.
   * Bridges are drawn with a distinct style: wider road with railings.
   */
  private renderBridges(bridges: Bridge[]): void {
    if (this.bridgesGraphics.clear) {
      this.bridgesGraphics.clear();
    }

    if (bridges.length === 0) return;

    // Find parent road to get road class for proper width scaling
    const roadMap = new Map<string, Road>();
    if (this.data?.roads) {
      for (const road of this.data.roads) {
        roadMap.set(road.id, road);
      }
    }

    // Scale bridge widths with zoom and district size
    const zoomScale = Math.max(0.5, Math.min(1.5, this.currentZoom)) * this.districtScale;

    for (const bridge of bridges) {
      const style = BRIDGE_STYLES[bridge.waterType] || BRIDGE_STYLES.river;
      const parentRoad = roadMap.get(bridge.roadId);
      const roadStyle = parentRoad ? ROAD_STYLES[parentRoad.roadClass] : ROAD_STYLES.arterial;

      // Bridge is slightly wider than the road it carries
      const roadWidth = roadStyle.width * zoomScale;
      const bridgeWidth = roadWidth + 4;
      const railingWidth = 2;

      const { startPoint, endPoint } = bridge;

      // Draw bridge deck (main surface)
      this.bridgesGraphics.setStrokeStyle({
        width: bridgeWidth,
        color: style.color,
        alpha: style.alpha,
        cap: "butt",
        join: "miter",
      });
      this.bridgesGraphics.moveTo(startPoint.x, startPoint.y);
      this.bridgesGraphics.lineTo(endPoint.x, endPoint.y);
      this.bridgesGraphics.stroke();

      // Draw railings (parallel lines on sides)
      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;

      const perpX = (-dy / len) * (bridgeWidth / 2);
      const perpY = (dx / len) * (bridgeWidth / 2);

      this.bridgesGraphics.setStrokeStyle({
        width: railingWidth,
        color: style.railingColor,
        alpha: style.alpha,
        cap: "round",
      });

      // Left railing
      this.bridgesGraphics.moveTo(startPoint.x + perpX, startPoint.y + perpY);
      this.bridgesGraphics.lineTo(endPoint.x + perpX, endPoint.y + perpY);
      this.bridgesGraphics.stroke();

      // Right railing
      this.bridgesGraphics.moveTo(startPoint.x - perpX, startPoint.y - perpY);
      this.bridgesGraphics.lineTo(endPoint.x - perpX, endPoint.y - perpY);
      this.bridgesGraphics.stroke();

      // Draw small cross-supports for longer bridges
      if (bridge.length > 15) {
        const supportCount = Math.floor(bridge.length / 10);

        this.bridgesGraphics.setStrokeStyle({
          width: 1,
          color: style.railingColor,
          alpha: style.alpha * 0.8,
        });

        for (let i = 1; i <= supportCount; i++) {
          const t = i / (supportCount + 1);
          const cx = startPoint.x + dx * t;
          const cy = startPoint.y + dy * t;

          this.bridgesGraphics.moveTo(cx + perpX * 0.8, cy + perpY * 0.8);
          this.bridgesGraphics.lineTo(cx - perpX * 0.8, cy - perpY * 0.8);
          this.bridgesGraphics.stroke();
        }
      }
    }
  }

  /**
   * Render interchange markers at highway-road crossing points.
   * Drawn as green diamond markers at each interchange position.
   */
  private renderInterchanges(interchanges: Interchange[]): void {
    if (this.interchangesGraphics.clear) {
      this.interchangesGraphics.clear();
    }

    if (interchanges.length === 0) return;

    const markerSize = 8;
    const markerColor = 0x2ecc71; // Green

    for (const interchange of interchanges) {
      const { x, y } = interchange.position;

      // Draw diamond shape
      this.interchangesGraphics.moveTo(x, y - markerSize);
      this.interchangesGraphics.lineTo(x + markerSize, y);
      this.interchangesGraphics.lineTo(x, y + markerSize);
      this.interchangesGraphics.lineTo(x - markerSize, y);
      this.interchangesGraphics.closePath();
      this.interchangesGraphics.fill({ color: markerColor, alpha: 0.8 });

      // Draw outline
      this.interchangesGraphics.setStrokeStyle({ width: 2, color: 0xffffff });
      this.interchangesGraphics.moveTo(x, y - markerSize);
      this.interchangesGraphics.lineTo(x + markerSize, y);
      this.interchangesGraphics.lineTo(x, y + markerSize);
      this.interchangesGraphics.lineTo(x - markerSize, y);
      this.interchangesGraphics.closePath();
      this.interchangesGraphics.stroke();
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

  /**
   * Get the current features data.
   */
  getData(): FeaturesData | null {
    return this.data;
  }

  /**
   * Perform a hit test at the given world coordinates.
   * Returns the topmost feature at that point, or null if nothing is hit.
   * Priority: POIs > Roads > Districts > Neighborhoods (topmost layers first)
   */
  hitTest(worldX: number, worldY: number): HitTestResult | null {
    if (!this.data) return null;

    // Check POIs first (they're on top)
    if (this.poisGraphics.visible) {
      for (const poi of this.data.pois) {
        if (this.hitTestPOI(poi, worldX, worldY)) {
          return { type: "poi", feature: poi };
        }
      }
    }

    // Check roads next (spatial index narrows candidates from O(n) to O(k) where k << n)
    if (this.roadsGraphics.visible) {
      const candidateRoads = this.roadIndex.query(worldX, worldY, ROAD_HIT_DISTANCE);
      for (const road of candidateRoads) {
        if (this.hitTestRoad(road, worldX, worldY)) {
          return { type: "road", feature: road };
        }
      }
    }

    // Check districts
    if (this.districtsGraphics.visible) {
      for (const district of this.data.districts) {
        if (this.hitTestDistrict(district, worldX, worldY)) {
          return { type: "district", feature: district };
        }
      }
    }

    // Check city limits
    if (this.cityLimitsGraphics.visible && this.data.cityLimits) {
      if (this.hitTestCityLimits(this.data.cityLimits, worldX, worldY)) {
        return { type: "cityLimits", feature: this.data.cityLimits };
      }
    }

    // Check neighborhoods last (they're at the bottom)
    if (this.neighborhoodsGraphics.visible && this.data.neighborhoods) {
      for (const neighborhood of this.data.neighborhoods) {
        if (this.hitTestNeighborhood(neighborhood, worldX, worldY)) {
          return { type: "neighborhood", feature: neighborhood };
        }
      }
    }

    return null;
  }

  /**
   * Check if a point hits a POI.
   */
  private hitTestPOI(poi: POI, x: number, y: number): boolean {
    const dx = x - poi.position.x;
    const dy = y - poi.position.y;
    return Math.sqrt(dx * dx + dy * dy) <= POI_HIT_RADIUS;
  }

  /**
   * Check if a point hits a road.
   */
  private hitTestRoad(road: Road, x: number, y: number): boolean {
    const points = road.line.points;
    if (points.length < 2) return false;

    // Check distance to each line segment
    for (let i = 0; i < points.length - 1; i++) {
      const dist = pointToLineSegmentDistance(
        x, y,
        points[i].x, points[i].y,
        points[i + 1].x, points[i + 1].y
      );
      if (dist <= ROAD_HIT_DISTANCE) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a point hits a district (point-in-polygon test).
   */
  private hitTestDistrict(district: District, x: number, y: number): boolean {
    return pointInPolygon(x, y, district.polygon.points);
  }

  /**
   * Check if a point hits a neighborhood (point-in-polygon test).
   */
  private hitTestNeighborhood(neighborhood: Neighborhood, x: number, y: number): boolean {
    return pointInPolygon(x, y, neighborhood.polygon.points);
  }

  /**
   * Check if a point hits the city limits (point-in-polygon test).
   */
  private hitTestCityLimits(cityLimits: CityLimits, x: number, y: number): boolean {
    return pointInPolygon(x, y, cityLimits.boundary.points);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

/**
 * Calculate the distance from a point to a line segment.
 */
function pointToLineSegmentDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Line segment is a point
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  // Calculate projection parameter
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  // Find closest point on segment
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

/**
 * Check if a point is inside a polygon using ray casting algorithm.
 */
function pointInPolygon(x: number, y: number, points: Point[]): boolean {
  if (points.length < 3) return false;

  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
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

  return { districts, roads, pois, neighborhoods: [], bridges: [] };
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
