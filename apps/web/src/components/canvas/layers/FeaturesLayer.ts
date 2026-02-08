/**
 * Features layer renderer for districts, roads, and POIs.
 *
 * ## Road Rendering Pipeline (CITY-377 documentation)
 *
 * Roads are drawn in the `renderRoads()` method using a two-pass approach:
 *   Pass 1 — Casings (outlines): drawn first so fills cover their centers
 *   Pass 2 — Fills (road surface): drawn on top
 *
 * Road widths are scaled by `zoomScale = clamp(currentZoom, 0.5, 1.5) * districtScale`,
 * where `districtScale` is the average district diagonal / 200, clamped to [0.5, 3].
 * This keeps road widths proportional to the district size.
 *
 * Minimum width enforcement (CITY-377): Roads never render below MIN_ROAD_WIDTH (0.8)
 * for fills or MIN_CASING_WIDTH (1.5) for casings, preventing sub-pixel invisibility
 * at low zoom or with small districts.
 *
 * ### Road style hierarchy (drawn bottom-to-top):
 *   trail → local → collector → arterial → highway
 *
 * Each class has: fill width, fill color, casing width, casing color, minZoom.
 * LOCAL and COLLECTOR streets have white fills with gray casings (Google Maps style).
 * Without casings, white roads on the light canvas/district fills are invisible.
 *
 * ### Container z-order (bottom-to-top):
 *   neighborhoods → cityLimits → districts → roads → roadHighlight → bridges →
 *   interchanges → pois
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
  LayerVisibility,
  DistrictType,
  RoadClass,
  POIType,
  Point,
  WaterCrossingType,
  Interchange,
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

// Road styling by class (Google Maps inspired).
//
// IMPORTANT (CITY-377, CITY-417): Road fills use gray tones (not white) so they
// contrast against the light canvas (#f5f5f5) and semi-transparent district fills.
// Casings (casingWidth > 0) provide additional outline contrast for all non-trail classes.
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
    color: 0xaaaaaa, // Medium gray — visible on all district fills
    casingWidth: 1,
    casingColor: 0x666666, // Dark gray outline
    dashed: false,
    minZoom: 0, // Always visible
  },
  collector: {
    width: 4,
    color: 0xbbbbbb, // Light-medium gray
    casingWidth: 1.5,
    casingColor: 0x777777, // Gray outline
    dashed: false,
    minZoom: 0.15, // Visible at most zoom levels
  },
  local: {
    width: 2,
    color: 0xcccccc, // Light gray — subtle but visible on district fills
    casingWidth: 1,
    casingColor: 0x888888, // Gray outline
    dashed: false,
    minZoom: 0.3, // Visible when not extremely zoomed out
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

// Minimum zoom level to show each POI type (mirroring ROAD_STYLES.minZoom pattern)
const POI_MIN_ZOOM: Record<POIType, number> = {
  hospital: 0.15,    // Important landmarks, visible at most zoom levels
  university: 0.15,
  transit: 0.15,
  civic: 0.2,
  school: 0.3,       // Medium importance, like local roads
  shopping: 0.3,
  park: 0.3,
  industrial: 0.3,
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
 * Grid-based spatial index for O(1) road proximity lookups.
 *
 * Divides the world into square cells (default 50 world-units) and maps each
 * cell to the roads whose segments pass through it. A buffer equal to
 * {@link ROAD_HIT_DISTANCE} is added so that hit-testing catches roads just
 * outside a cell boundary. Rebuild via {@link build} whenever the road set changes.
 *
 * Complexity: O(R * S) to build (R roads, S segments per road); O(1) per query.
 */
class RoadSpatialIndex {
  private cellSize: number;
  private grid: Map<string, Road[]> = new Map();

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  /**
   * Rebuild the index from scratch for the given road set.
   * @param roads - Full list of roads to index
   */
  build(roads: Road[]): void {
    this.grid.clear();
    const buffer = ROAD_HIT_DISTANCE;

    for (const road of roads) {
      const points = road.line.points;
      if (points.length < 2) continue;

      // For each segment, find all cells it could touch (with buffer)
      for (let i = 0; i < points.length - 1; i++) {
        const x1 = Math.min(points[i].x, points[i + 1].x) - buffer;
        const y1 = Math.min(points[i].y, points[i + 1].y) - buffer;
        const x2 = Math.max(points[i].x, points[i + 1].x) + buffer;
        const y2 = Math.max(points[i].y, points[i + 1].y) + buffer;

        const minCellX = Math.floor(x1 / this.cellSize);
        const minCellY = Math.floor(y1 / this.cellSize);
        const maxCellX = Math.floor(x2 / this.cellSize);
        const maxCellY = Math.floor(y2 / this.cellSize);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
          for (let cy = minCellY; cy <= maxCellY; cy++) {
            const key = `${cx},${cy}`;
            let bucket = this.grid.get(key);
            if (!bucket) {
              bucket = [];
              this.grid.set(key, bucket);
            }
            // Avoid duplicate road entries in the same cell
            if (bucket[bucket.length - 1] !== road) {
              bucket.push(road);
            }
          }
        }
      }
    }
  }

  /**
   * Return candidate roads that may be near the given world coordinate.
   * The caller must still do precise distance checks against each candidate.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @returns Roads in the same cell (may include false positives, never false negatives)
   */
  getCandidates(x: number, y: number): Road[] {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    return this.grid.get(key) || [];
  }
}

/**
 * Grid-based spatial index for O(1) POI proximity lookups.
 *
 * Each POI is inserted into every cell that its hit-circle
 * ({@link POI_HIT_RADIUS}) overlaps. Rebuild via {@link build} whenever the
 * POI set changes.
 *
 * Complexity: O(P) to build; O(1) per query.
 */
class POISpatialIndex {
  private cellSize: number;
  private grid: Map<string, POI[]> = new Map();

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  /**
   * Rebuild the index from scratch for the given POI set.
   * @param pois - Full list of POIs to index
   */
  build(pois: POI[]): void {
    this.grid.clear();
    const buffer = POI_HIT_RADIUS;

    for (const poi of pois) {
      const x = poi.position.x;
      const y = poi.position.y;

      const minCellX = Math.floor((x - buffer) / this.cellSize);
      const minCellY = Math.floor((y - buffer) / this.cellSize);
      const maxCellX = Math.floor((x + buffer) / this.cellSize);
      const maxCellY = Math.floor((y + buffer) / this.cellSize);

      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cy = minCellY; cy <= maxCellY; cy++) {
          const key = `${cx},${cy}`;
          let bucket = this.grid.get(key);
          if (!bucket) {
            bucket = [];
            this.grid.set(key, bucket);
          }
          bucket.push(poi);
        }
      }
    }
  }

  /**
   * Return candidate POIs that may be near the given world coordinate.
   * The caller must still do precise distance checks against each candidate.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @returns POIs in the same cell (may include false positives, never false negatives)
   */
  getCandidates(x: number, y: number): POI[] {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    return this.grid.get(key) || [];
  }
}

/**
 * Grid-based spatial index for O(1) district candidate lookups.
 *
 * Each district is inserted into every cell that its axis-aligned bounding box
 * overlaps. A query returns only districts whose bounding box covers the
 * queried cell, drastically reducing the number of expensive point-in-polygon
 * tests. Rebuild via {@link build} whenever the district set changes.
 *
 * Complexity: O(D) to build (proportional to total bounding-box area); O(1) per query.
 */
class DistrictSpatialIndex {
  private cellSize: number;
  private grid: Map<string, District[]> = new Map();

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  /**
   * Rebuild the index from scratch for the given district set.
   * @param districts - Full list of districts to index
   */
  build(districts: District[]): void {
    this.grid.clear();

    for (const district of districts) {
      const points = district.polygon.points;
      if (points.length < 3) continue;

      // Compute axis-aligned bounding box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const minCellX = Math.floor(minX / this.cellSize);
      const minCellY = Math.floor(minY / this.cellSize);
      const maxCellX = Math.floor(maxX / this.cellSize);
      const maxCellY = Math.floor(maxY / this.cellSize);

      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cy = minCellY; cy <= maxCellY; cy++) {
          const key = `${cx},${cy}`;
          let bucket = this.grid.get(key);
          if (!bucket) {
            bucket = [];
            this.grid.set(key, bucket);
          }
          bucket.push(district);
        }
      }
    }
  }

  /**
   * Return candidate districts that may contain the given world coordinate.
   * The caller must still do precise point-in-polygon checks.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @returns Districts whose bounding box covers this cell
   */
  getCandidates(x: number, y: number): District[] {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    return this.grid.get(key) || [];
  }
}

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
  private _lastRoadLogTime: number = 0; // CITY-377 diagnostic throttle
  /** ID of the currently selected road (null = no selection) */
  private selectedRoadId: string | null = null;
  /** Spatial index for fast road hit testing */
  private roadIndex: RoadSpatialIndex = new RoadSpatialIndex();
  /** Spatial index for fast POI hit testing */
  private poiIndex: POISpatialIndex = new POISpatialIndex();
  /** Spatial index for fast district hit testing */
  private districtIndex: DistrictSpatialIndex = new DistrictSpatialIndex();

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

    // Interchanges on top of bridges
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
    this.roadIndex.build(data.roads);
    this.poiIndex.build(data.pois);
    this.districtIndex.build(data.districts);

    // CITY-377 diagnostic: log road stats on data load
    if (data.roads.length > 0) {
      const byClass: Record<string, number> = {};
      for (const r of data.roads) {
        byClass[r.roadClass] = (byClass[r.roadClass] || 0) + 1;
      }
      console.log(
        `[FeaturesLayer] setData: ${data.districts.length} districts, ${data.roads.length} roads (${JSON.stringify(byClass)}), districtScale=${this.districtScale.toFixed(3)}`
      );
    }

    this.render();
  }

  setVisibility(visibility: LayerVisibility & { neighborhoods?: boolean; cityLimits?: boolean; bridges?: boolean }): void {
    this.neighborhoodsGraphics.visible = visibility.neighborhoods ?? true;
    this.cityLimitsGraphics.visible = visibility.cityLimits ?? true;
    this.districtsGraphics.visible = visibility.districts;
    this.roadsGraphics.visible = visibility.roads;
    this.roadHighlightGraphics.visible = visibility.roads;
    this.bridgesGraphics.visible = visibility.bridges ?? visibility.roads; // Default to road visibility
    this.interchangesGraphics.visible = visibility.roads; // Show with roads
    this.poisGraphics.visible = visibility.pois;
  }

  /**
   * Set the current zoom level for zoom-based road visibility.
   * @param zoom - Zoom level (1 = default, <1 = zoomed out, >1 = zoomed in)
   */
  setZoom(zoom: number): void {
    if (this.currentZoom !== zoom) {
      this.currentZoom = zoom;
      // Re-render roads and POIs when zoom changes (for visibility filtering)
      if (this.data) {
        this.renderRoads(this.data.roads);
        this.renderRoadHighlight();
        this.renderPOIs(this.data.pois);
      }
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
   *
   * CITY-377: The reference diameter must match the actual world-unit coordinate
   * space districts use. Districts are typically ~30 world units across (diagonal).
   * A reference of 40 means roads render at full defined width for ~40-unit districts
   * and scale down slightly for smaller ones. The clamp [0.5, 3] prevents extremes.
   *
   * Previous value of 200 was designed for pixel-space distances, not world units,
   * which caused districtScale=0.5 for typical districts — halving all road widths
   * and making local/collector streets invisible.
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
    const referenceDiameter = 40;
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
      // CITY-408: Use custom fill color if set, otherwise use type default
      let color = DISTRICT_COLORS[district.type] ?? 0xcccccc;
      if (district.fillColor) {
        const parsed = parseInt(district.fillColor.replace("#", ""), 16);
        if (!isNaN(parsed)) color = parsed;
      }
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

      // CITY-378: Draw park ponds as water features
      if (district.ponds && district.ponds.length > 0) {
        for (const pond of district.ponds) {
          const pondPoints = pond.points;
          if (pondPoints.length < 3) continue;

          this.districtsGraphics.moveTo(pondPoints[0].x, pondPoints[0].y);
          for (let i = 1; i < pondPoints.length; i++) {
            this.districtsGraphics.lineTo(pondPoints[i].x, pondPoints[i].y);
          }
          this.districtsGraphics.closePath();
          this.districtsGraphics.fill({ color: 0x87ceeb, alpha: 0.7 }); // Light blue water

          // Pond outline
          this.districtsGraphics.setStrokeStyle({
            width: 0.5,
            color: 0x4a90d9,
            alpha: 0.6,
          });
          this.districtsGraphics.moveTo(pondPoints[0].x, pondPoints[0].y);
          for (let i = 1; i < pondPoints.length; i++) {
            this.districtsGraphics.lineTo(pondPoints[i].x, pondPoints[i].y);
          }
          this.districtsGraphics.closePath();
          this.districtsGraphics.stroke();
        }
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

    // Filter roads by zoom level (skip roads with unknown class to prevent crash)
    const visibleRoads = sortedRoads.filter((road) => {
      const style = ROAD_STYLES[road.roadClass];
      if (!style) return false;
      return this.currentZoom >= style.minZoom;
    });

    // CITY-377 diagnostic: log render stats (throttled to avoid console spam during zoom)
    const now = performance.now();
    if (!this._lastRoadLogTime || now - this._lastRoadLogTime > 2000) {
      this._lastRoadLogTime = now;
      const totalPts = visibleRoads.reduce((sum, r) => sum + r.line.points.length, 0);
      console.log(
        `[FeaturesLayer] renderRoads: ${roads.length} total, ${visibleRoads.length} visible at zoom=${this.currentZoom.toFixed(2)}, ${totalPts} points, districtScale=${this.districtScale.toFixed(3)}`
      );
    }
    const renderStart = performance.now();

    // Scale road widths with zoom (thinner when zoomed out) and district size
    const zoomScale = Math.max(0.5, Math.min(1.5, this.currentZoom)) * this.districtScale;

    // CITY-377: Enforce minimum widths so streets never become sub-pixel invisible
    const MIN_ROAD_WIDTH = 0.8;
    const MIN_CASING_WIDTH = 1.5;

    // Draw road casings first (outlines) - only for roads that have casings
    for (const road of visibleRoads) {
      const style = ROAD_STYLES[road.roadClass];
      const points = road.line.points;

      if (points.length < 2) continue;
      if (style.casingWidth <= 0) continue;

      const scaledWidth = Math.max(MIN_ROAD_WIDTH, style.width * zoomScale);
      const casingWidth = Math.max(MIN_CASING_WIDTH, scaledWidth + style.casingWidth * 2);

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

      const scaledWidth = Math.max(MIN_ROAD_WIDTH, style.width * zoomScale);

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

    // CITY-377 diagnostic: log render time
    const renderEnd = performance.now();
    if (now === this._lastRoadLogTime) {
      console.log(`[FeaturesLayer] renderRoads took ${(renderEnd - renderStart).toFixed(1)}ms`);
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

  private renderInterchanges(interchanges: Interchange[]): void {
    if (this.interchangesGraphics.clear) {
      this.interchangesGraphics.clear();
    }

    for (const ic of interchanges) {
      const { x, y } = ic.position;
      const size = 6;

      // Draw diamond marker
      this.interchangesGraphics.setStrokeStyle({ width: 2, color: 0x000000 });
      this.interchangesGraphics.moveTo(x, y - size);
      this.interchangesGraphics.lineTo(x + size, y);
      this.interchangesGraphics.lineTo(x, y + size);
      this.interchangesGraphics.lineTo(x - size, y);
      this.interchangesGraphics.lineTo(x, y - size);
      this.interchangesGraphics.fill({ color: 0x4caf50 });
      this.interchangesGraphics.stroke();

      // Cloverleaf gets an additional outer circle
      if (ic.type === "cloverleaf") {
        this.interchangesGraphics.setStrokeStyle({ width: 1, color: 0x2e7d32 });
        this.interchangesGraphics.circle(x, y, size * 1.5);
        this.interchangesGraphics.stroke();
      }
    }
  }

  private renderPOIs(pois: POI[]): void {
    if (this.poisGraphics.clear) {
      this.poisGraphics.clear();
    }

    // Scale marker size with zoom: smaller when zoomed out, larger when zoomed in
    const baseRadius = 6;
    const zoomScale = Math.max(0.5, Math.min(1.5, this.currentZoom));
    const radius = baseRadius * zoomScale;
    const innerRadius = 2 * zoomScale;
    const strokeWidth = 2 * zoomScale;

    for (const poi of pois) {
      // Filter by zoom level (same pattern as road minZoom)
      const minZoom = POI_MIN_ZOOM[poi.type] ?? 0.3;
      if (this.currentZoom < minZoom) continue;

      const color = POI_COLORS[poi.type] ?? 0x666666;
      const { x, y } = poi.position;

      // Draw POI marker (circle with outline)
      this.poisGraphics.setStrokeStyle({ width: strokeWidth, color: 0xffffff });
      this.poisGraphics.circle(x, y, radius);
      this.poisGraphics.fill({ color });
      this.poisGraphics.stroke();

      // Draw inner dot for emphasis
      this.poisGraphics.circle(x, y, innerRadius);
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

    // Check POIs first (they're on top, using spatial index for O(1) lookup)
    if (this.poisGraphics.visible) {
      const poiCandidates = this.poiIndex.getCandidates(worldX, worldY);
      for (const poi of poiCandidates) {
        if (this.hitTestPOI(poi, worldX, worldY)) {
          return { type: "poi", feature: poi };
        }
      }
    }

    // Check roads next (using spatial index for O(1) lookup)
    if (this.roadsGraphics.visible) {
      const roadCandidates = this.roadIndex.getCandidates(worldX, worldY);
      for (const road of roadCandidates) {
        if (this.hitTestRoad(road, worldX, worldY)) {
          return { type: "road", feature: road };
        }
      }
    }

    // Check districts (using spatial index for O(1) candidate lookup)
    if (this.districtsGraphics.visible) {
      const districtCandidates = this.districtIndex.getCandidates(worldX, worldY);
      for (const district of districtCandidates) {
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
