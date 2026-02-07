/**
 * Airport geometry generator for creating airports with internal features and road connections.
 *
 * Airports are large infrastructure districts with:
 * - Roughly rectangular/trapezoidal polygon shapes (inspired by real airports)
 * - Internal runways (long straight roads)
 * - Taxiways connecting runways to terminal areas
 * - Access roads from nearby arterials/highways
 *
 * Real airport shapes: LAX, Dulles, Newark — generally convex polygons
 * that are wider than tall, with 1-3 parallel runways.
 */

import type { Point, Road, RoadClass } from "./types";
import { generateId } from "../../../utils/idGenerator";

/**
 * Result of generating airport features for a district.
 */
export interface AirportDistrictFeatures {
  /** Internal roads: runways and taxiways */
  runways: Road[];
  /** Access roads connecting to existing street network */
  accessRoads: Road[];
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

  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }

  pick<T>(items: T[]): T {
    return items[this.intRange(0, items.length)];
  }
}

/**
 * Calculate distance between two points.
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the nearest point on a line segment to a given point.
 */
function nearestPointOnSegment(point: Point, segStart: Point, segEnd: Point): Point {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return segStart;

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };
}

/** Airport size in world units (~3km x 2km, comparable to a mid-size real airport) */
const AIRPORT_RADIUS_WORLD_UNITS = 15;

/**
 * Generate internal runways for the airport.
 *
 * Real airports typically have 1-3 parallel runways oriented in the
 * prevailing wind direction. Runways are rendered as wide "highway" class
 * roads to distinguish them from regular streets.
 */
function generateRunways(
  polygon: Point[],
  centerX: number,
  centerY: number,
  districtId: string,
  rng: SeededRandom
): Road[] {
  const roads: Road[] = [];

  // Calculate polygon bounds to size runways appropriately
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  // Runway orientation angle (slight rotation from horizontal)
  const runwayAngle = rng.range(-0.15, 0.15); // ±8.5 degrees

  // Number of runways (1-3, larger airports get more)
  const numRunways = rng.intRange(1, 4);

  // Runway length is 70-85% of the longer dimension
  const runwayLength = Math.max(width, height) * rng.range(0.70, 0.85);

  // Spacing between parallel runways
  const runwaySpacing = Math.min(width, height) * 0.25;

  for (let i = 0; i < numRunways; i++) {
    // Offset from center for parallel runways
    const offset = (i - (numRunways - 1) / 2) * runwaySpacing;

    // Runway start and end points
    const perpX = -Math.sin(runwayAngle);
    const perpY = Math.cos(runwayAngle);
    const alongX = Math.cos(runwayAngle);
    const alongY = Math.sin(runwayAngle);

    const start: Point = {
      x: centerX - alongX * runwayLength / 2 + perpX * offset,
      y: centerY - alongY * runwayLength / 2 + perpY * offset,
    };
    const end: Point = {
      x: centerX + alongX * runwayLength / 2 + perpX * offset,
      y: centerY + alongY * runwayLength / 2 + perpY * offset,
    };

    // Generate runway designation (based on heading)
    const headingDeg = Math.round(((runwayAngle * 180 / Math.PI) + 90 + 360) % 360 / 10);
    const designation = headingDeg === 0 ? 36 : headingDeg;
    const runwayName = numRunways > 1
      ? `Runway ${designation}${["L", "C", "R"][i] ?? ""}/${(designation + 18) % 36 || 36}${["R", "C", "L"][i] ?? ""}`
      : `Runway ${designation}/${(designation + 18) % 36 || 36}`;

    roads.push({
      id: generateId(`${districtId}-runway-${i}`),
      roadClass: "highway", // Rendered as wide road
      line: { points: [start, end] },
      name: runwayName,
      districtId,
    });

    // Generate taxiways connecting runway to terminal area (center)
    const numTaxiways = rng.intRange(2, 4);
    for (let j = 0; j < numTaxiways; j++) {
      const t = (j + 1) / (numTaxiways + 1);
      const taxiwayStart: Point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
      // Taxiway leads toward center
      const taxiwayEnd: Point = {
        x: taxiwayStart.x + (centerX - taxiwayStart.x) * 0.4,
        y: taxiwayStart.y + (centerY - taxiwayStart.y) * 0.4,
      };

      roads.push({
        id: generateId(`${districtId}-taxiway-${i}-${j}`),
        roadClass: "collector", // Taxiways are medium-width
        line: { points: [taxiwayStart, taxiwayEnd] },
        name: `Taxiway ${String.fromCharCode(65 + i * numTaxiways + j)}`, // A, B, C...
        districtId,
      });
    }
  }

  return roads;
}

/**
 * Generate access roads connecting the airport to nearby existing roads.
 *
 * Airports typically have 1-2 main access roads from highways/arterials,
 * not perimeter roads like parks.
 */
function generateAirportAccessRoads(
  polygon: Point[],
  existingRoads: Road[],
  districtId: string
): Road[] {
  const roads: Road[] = [];

  // Extract road segments for nearest-road search
  const segments: Array<{ id: string; start: Point; end: Point; roadClass: RoadClass }> = [];
  for (const road of existingRoads) {
    const points = road.line.points;
    for (let i = 0; i < points.length - 1; i++) {
      segments.push({
        id: road.id,
        start: points[i],
        end: points[i + 1],
        roadClass: road.roadClass,
      });
    }
  }

  if (segments.length === 0) return roads;

  // Find 1-2 connection points, preferring arterials/highways
  const candidates: Array<{
    edgePoint: Point;
    roadPoint: Point;
    distance: number;
    isArterial: boolean;
    perimeterIndex: number;
  }> = [];

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    // Sample midpoint of this edge
    const edgePoint: Point = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };

    for (const seg of segments) {
      const roadPoint = nearestPointOnSegment(edgePoint, seg.start, seg.end);
      const dist = distance(edgePoint, roadPoint);

      if (dist <= 80) { // Larger search radius for airports
        candidates.push({
          edgePoint,
          roadPoint,
          distance: dist,
          isArterial: seg.roadClass === "arterial" || seg.roadClass === "highway",
          perimeterIndex: i,
        });
      }
    }
  }

  // Prefer arterial/highway connections, then by distance
  candidates.sort((a, b) => {
    if (a.isArterial !== b.isArterial) return a.isArterial ? -1 : 1;
    return a.distance - b.distance;
  });

  const maxConnections = 2;
  const selected: typeof candidates = [];

  for (const candidate of candidates) {
    if (selected.length >= maxConnections) break;

    // Ensure connections are spread apart
    const tooClose = selected.some(
      (sc) => Math.abs(sc.perimeterIndex - candidate.perimeterIndex) <= 2
    );
    if (tooClose && selected.length > 0) continue;

    selected.push(candidate);
  }

  for (let i = 0; i < selected.length; i++) {
    const conn = selected[i];
    roads.push({
      id: generateId(`${districtId}-airport-access-${i}`),
      roadClass: "arterial", // Airport access roads are major roads
      line: { points: [conn.edgePoint, conn.roadPoint] },
      name: i === 0 ? "Airport Access Road" : "Airport Service Road",
      districtId,
    });
  }

  return roads;
}

/**
 * Generate all airport features for an existing airport district.
 *
 * Called after districtGenerator creates the airport polygon. Generates
 * internal features (runways, taxiways) and access roads.
 *
 * @param districtPolygon - The airport district's polygon points
 * @param districtId - The airport district's ID
 * @param existingRoads - Existing road network for access road connections
 * @param seed - Optional seed for deterministic generation
 * @returns Airport features (runways, taxiways, access roads)
 */
export function generateAirportFeaturesForDistrict(
  districtPolygon: Point[],
  districtId: string,
  existingRoads: Road[],
  seed?: number
): AirportDistrictFeatures {
  // Derive seed from polygon centroid
  const centroid = {
    x: districtPolygon.reduce((sum, p) => sum + p.x, 0) / districtPolygon.length,
    y: districtPolygon.reduce((sum, p) => sum + p.y, 0) / districtPolygon.length,
  };
  const effectiveSeed = seed ?? Math.floor(centroid.x * 1000 + centroid.y * 7919);
  const rng = new SeededRandom(effectiveSeed);

  // Generate runways and taxiways
  const runways = generateRunways(
    districtPolygon,
    centroid.x,
    centroid.y,
    districtId,
    rng
  );

  // Generate access roads to the street network
  const accessRoads = generateAirportAccessRoads(
    districtPolygon,
    existingRoads,
    districtId
  );

  return { runways, accessRoads };
}

/** Airport size in world units for external callers */
export const AIRPORT_SIZE_WORLD_UNITS = AIRPORT_RADIUS_WORLD_UNITS * 2;
