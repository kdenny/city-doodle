/**
 * Generate mock terrain data for demonstration.
 * In production, this would come from the API.
 *
 * CITY-325: Improved RNG (xorshift128), 11 archetypes
 * CITY-322: Fractal coastlines with bays and inlets
 * CITY-321: River valley, bay harbor, lakefront, inland, delta settings
 * CITY-326: River and bay water features
 */

import type { TerrainData, Point } from "./types";
import type { GeographicSetting } from "../../../api/types";
import { generateLakeName, generateRiverName } from "../../../utils/nameGenerator";

// ---------------------------------------------------------------------------
// xorshift128 PRNG — period 2^128−1, much better than the old LCG
// ---------------------------------------------------------------------------
function seededRandom(seed: number) {
  let s0 = (seed >>> 0) | 1;
  let s1 = ((seed * 1103515245 + 12345) >>> 0) | 1;
  let s2 = ((seed * 214013 + 2531011) >>> 0) | 1;
  let s3 = ((seed * 48271) >>> 0) | 1;
  return function () {
    const t = s0 ^ (s0 << 11);
    s0 = s1;
    s1 = s2;
    s2 = s3;
    s3 = (s3 ^ (s3 >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return s3 / 4294967296;
  };
}

function generateSmoothLine(
  start: Point,
  end: Point,
  segments: number,
  jitter: number,
  random: () => number
): Point[] {
  const points: Point[] = [start];
  const dx = (end.x - start.x) / segments;
  const dy = (end.y - start.y) / segments;

  for (let i = 1; i < segments; i++) {
    points.push({
      x: start.x + dx * i + (random() - 0.5) * jitter,
      y: start.y + dy * i + (random() - 0.5) * jitter,
    });
  }

  points.push(end);
  return points;
}

// ---------------------------------------------------------------------------
// Fractal coastline — recursive midpoint displacement for realistic edges
// ---------------------------------------------------------------------------
function fractalCoast(
  points: Point[],
  depth: number,
  roughness: number,
  random: () => number,
  seawardBias: number = 0
): Point[] {
  if (depth <= 0 || points.length < 2) return points;
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) { result.push(a); continue; }
    // Displace perpendicular to the segment
    const nx = -dy / len;
    const ny = dx / len;
    // Bias displacement toward the ocean side (negative = seaward)
    // seawardBias shifts the center: 0 = symmetric, positive = more seaward
    const displacement = (random() - 0.5 - seawardBias * 0.2) * roughness * len;
    result.push(a);
    result.push({ x: mx + nx * displacement, y: my + ny * displacement });
  }
  result.push(points[points.length - 1]);
  return fractalCoast(result, depth - 1, roughness * 0.65, random, seawardBias);
}

// ---------------------------------------------------------------------------
// Nearest point on polyline — for snapping rivers to coastline (CITY-576)
// ---------------------------------------------------------------------------
function nearestPointOnPolyline(
  point: Point,
  polylinePoints: Point[]
): Point {
  if (polylinePoints.length === 0) return point; // Return the input point as fallback

  let bestPoint: Point = polylinePoints[0];
  let bestDist = Infinity;

  for (let i = 0; i < polylinePoints.length - 1; i++) {
    const a = polylinePoints[i];
    const b = polylinePoints[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const segLenSq = abx * abx + aby * aby;

    let closest: Point;
    if (segLenSq < 1e-10) {
      // Degenerate segment — just use the endpoint
      closest = a;
    } else {
      // Project point onto the line defined by (a, b), clamped to [0, 1]
      const t = Math.max(0, Math.min(1,
        ((point.x - a.x) * abx + (point.y - a.y) * aby) / segLenSq
      ));
      closest = { x: a.x + t * abx, y: a.y + t * aby };
    }

    const dx = point.x - closest.x;
    const dy = point.y - closest.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = closest;
    }
  }

  return bestPoint;
}

// ---------------------------------------------------------------------------
// Terrain archetypes — expanded set
// ---------------------------------------------------------------------------
type TerrainArchetype =
  | "west_coast"
  | "east_coast"
  | "south_coast"
  | "north_coast"
  | "island"
  | "peninsula"
  | "bay_harbor"
  | "river_valley"
  | "lakefront"
  | "inland"
  | "delta";

function pickArchetype(
  seed: number,
  geographicSetting?: GeographicSetting
): TerrainArchetype {
  if (geographicSetting) {
    // Map geographic settings to archetypes
    switch (geographicSetting) {
      case "coastal": {
        // Pick a random coast direction based on seed
        const coastTypes: TerrainArchetype[] = [
          "west_coast",
          "east_coast",
          "south_coast",
          "north_coast",
        ];
        return coastTypes[Math.abs(seed) % coastTypes.length];
      }
      case "bay_harbor":
        return "bay_harbor";
      case "river_valley":
        return "river_valley";
      case "lakefront":
        return "lakefront";
      case "inland":
        return "inland";
      case "island":
        return "island";
      case "peninsula":
        return "peninsula";
      case "delta":
        return "delta";
    }
  }
  // Fallback: pick from all archetypes including new ones
  const archetypes: TerrainArchetype[] = [
    "west_coast",
    "east_coast",
    "south_coast",
    "north_coast",
    "island",
    "peninsula",
    "bay_harbor",
    "river_valley",
    "lakefront",
    "inland",
    "delta",
  ];
  return archetypes[Math.abs(seed) % archetypes.length];
}

// ---------------------------------------------------------------------------
// Bay polygon generation for bay_harbor archetype
// ---------------------------------------------------------------------------
function generateBayPolygon(
  worldSize: number,
  random: () => number
): { polygon: { points: Point[] }; coastlineStart: Point; coastlineEnd: Point } {
  // Bay opens from one side with a parabolic indentation
  const side = Math.floor(random() * 4); // 0=left, 1=right, 2=top, 3=bottom
  const bayDepth = worldSize * (0.2 + random() * 0.15);
  const bayWidth = worldSize * (0.3 + random() * 0.2);
  const bayCenter = worldSize * (0.35 + random() * 0.3);

  // Build ocean polygon with bay indentation
  let points: Point[];
  let cStart: Point, cEnd: Point;

  switch (side) {
    case 0: { // Bay opens from left
      const baseDepth = worldSize * (0.2 + random() * 0.1);
      const bayTop = bayCenter - bayWidth / 2;
      const bayBottom = bayCenter + bayWidth / 2;
      points = [
        { x: 0, y: 0 },
        { x: baseDepth, y: 0 },
        { x: baseDepth + (random() - 0.5) * worldSize * 0.03, y: bayTop },
        { x: baseDepth + bayDepth + (random() - 0.5) * worldSize * 0.02, y: bayTop + bayWidth * 0.25 },
        { x: baseDepth + bayDepth * 1.1 + (random() - 0.5) * worldSize * 0.02, y: bayCenter },
        { x: baseDepth + bayDepth + (random() - 0.5) * worldSize * 0.02, y: bayBottom - bayWidth * 0.25 },
        { x: baseDepth + (random() - 0.5) * worldSize * 0.03, y: bayBottom },
        { x: baseDepth, y: worldSize },
        { x: 0, y: worldSize },
      ];
      cStart = { x: baseDepth, y: 0 };
      cEnd = { x: baseDepth, y: worldSize };
      break;
    }
    case 1: { // Bay opens from right
      const baseDepth = worldSize * (0.2 + random() * 0.1);
      const coastX = worldSize - baseDepth;
      const bayTop = bayCenter - bayWidth / 2;
      const bayBottom = bayCenter + bayWidth / 2;
      points = [
        { x: worldSize, y: 0 },
        { x: coastX, y: 0 },
        { x: coastX - (random() - 0.5) * worldSize * 0.03, y: bayTop },
        { x: coastX - bayDepth - (random() - 0.5) * worldSize * 0.02, y: bayTop + bayWidth * 0.25 },
        { x: coastX - bayDepth * 1.1 - (random() - 0.5) * worldSize * 0.02, y: bayCenter },
        { x: coastX - bayDepth - (random() - 0.5) * worldSize * 0.02, y: bayBottom - bayWidth * 0.25 },
        { x: coastX - (random() - 0.5) * worldSize * 0.03, y: bayBottom },
        { x: coastX, y: worldSize },
        { x: worldSize, y: worldSize },
      ];
      cStart = { x: coastX, y: 0 };
      cEnd = { x: coastX, y: worldSize };
      break;
    }
    case 2: { // Bay opens from top
      const baseDepth = worldSize * (0.2 + random() * 0.1);
      const bayLeft = bayCenter - bayWidth / 2;
      const bayRight = bayCenter + bayWidth / 2;
      points = [
        { x: 0, y: 0 },
        { x: 0, y: baseDepth },
        { x: bayLeft, y: baseDepth + (random() - 0.5) * worldSize * 0.03 },
        { x: bayLeft + bayWidth * 0.25, y: baseDepth + bayDepth + (random() - 0.5) * worldSize * 0.02 },
        { x: bayCenter, y: baseDepth + bayDepth * 1.1 + (random() - 0.5) * worldSize * 0.02 },
        { x: bayRight - bayWidth * 0.25, y: baseDepth + bayDepth + (random() - 0.5) * worldSize * 0.02 },
        { x: bayRight, y: baseDepth + (random() - 0.5) * worldSize * 0.03 },
        { x: worldSize, y: baseDepth },
        { x: worldSize, y: 0 },
      ];
      cStart = { x: 0, y: baseDepth };
      cEnd = { x: worldSize, y: baseDepth };
      break;
    }
    default: { // Bay opens from bottom
      const baseDepth = worldSize * (0.2 + random() * 0.1);
      const coastY = worldSize - baseDepth;
      const bayLeft = bayCenter - bayWidth / 2;
      const bayRight = bayCenter + bayWidth / 2;
      points = [
        { x: 0, y: worldSize },
        { x: 0, y: coastY },
        { x: bayLeft, y: coastY - (random() - 0.5) * worldSize * 0.03 },
        { x: bayLeft + bayWidth * 0.25, y: coastY - bayDepth - (random() - 0.5) * worldSize * 0.02 },
        { x: bayCenter, y: coastY - bayDepth * 1.1 - (random() - 0.5) * worldSize * 0.02 },
        { x: bayRight - bayWidth * 0.25, y: coastY - bayDepth - (random() - 0.5) * worldSize * 0.02 },
        { x: bayRight, y: coastY - (random() - 0.5) * worldSize * 0.03 },
        { x: worldSize, y: coastY },
        { x: worldSize, y: worldSize },
      ];
      cStart = { x: 0, y: coastY };
      cEnd = { x: worldSize, y: coastY };
      break;
    }
  }

  // Apply fractal detail to the ocean polygon (skip first and last which are corners)
  const fractalPoints = fractalCoast(points, 3, 0.15, random);

  return {
    polygon: { points: fractalPoints },
    coastlineStart: cStart,
    coastlineEnd: cEnd,
  };
}

// ---------------------------------------------------------------------------
// Ocean generation
// ---------------------------------------------------------------------------
function generateOcean(
  archetype: TerrainArchetype,
  worldSize: number,
  random: () => number
): { polygon: { points: Point[] }; coastlineStart: Point; coastlineEnd: Point; peninsulaDirection?: number } | null {
  const jitter = () => (random() - 0.5) * worldSize * 0.08;
  const edgeJitter = () => random() * worldSize * 0.08;

  switch (archetype) {
    case "west_coast": {
      const depth = worldSize * (0.25 + random() * 0.1);
      // Pick 1-2 bay positions for natural indentation
      const bayPos1 = 0.2 + random() * 0.3; // 20-50% along coast
      const bayPos2 = 0.6 + random() * 0.3; // 60-90% along coast
      const bayDepth1 = depth * (0.15 + random() * 0.1);
      const bayDepth2 = depth * (0.1 + random() * 0.08);
      const rawPoints: Point[] = [
        { x: 0, y: 0 },
        { x: depth + edgeJitter(), y: 0 },
        { x: depth * 0.85 + jitter(), y: worldSize * 0.07 },
        { x: depth * 1.15 + jitter(), y: worldSize * 0.14 },
        { x: depth * 0.75 + jitter(), y: worldSize * bayPos1 - worldSize * 0.03 },
        { x: depth + bayDepth1 + jitter(), y: worldSize * bayPos1 },
        { x: depth * 0.8 + jitter(), y: worldSize * bayPos1 + worldSize * 0.03 },
        { x: depth * 1.2 + jitter(), y: worldSize * 0.38 },
        { x: depth * 0.7 + jitter(), y: worldSize * 0.46 },
        { x: depth * 1.1 + jitter(), y: worldSize * 0.54 },
        { x: depth * 0.75 + jitter(), y: worldSize * bayPos2 - worldSize * 0.03 },
        { x: depth + bayDepth2 + jitter(), y: worldSize * bayPos2 },
        { x: depth * 0.85 + jitter(), y: worldSize * bayPos2 + worldSize * 0.03 },
        { x: depth * 1.15 + jitter(), y: worldSize * 0.85 },
        { x: depth * 0.9 + jitter(), y: worldSize * 0.93 },
        { x: depth + edgeJitter(), y: worldSize },
        { x: 0, y: worldSize },
      ];
      const points = fractalCoast(rawPoints, 3, 0.20, random, 1);
      // Clamp coastline points so water doesn't bleed inland past depth
      const maxCoastX = depth * 1.15;
      for (const p of points) {
        if (p.x > 0 && p.y > 0 && p.y < worldSize) {
          p.x = Math.min(p.x, maxCoastX);
        }
      }
      return {
        polygon: { points },
        coastlineStart: { x: depth, y: 0 },
        coastlineEnd: { x: depth, y: worldSize },
      };
    }
    case "east_coast": {
      const depth = worldSize * (0.25 + random() * 0.1);
      const coastX = worldSize - depth;
      const bayPos1 = 0.15 + random() * 0.25;
      const bayPos2 = 0.55 + random() * 0.3;
      const bayDepth1 = depth * (0.12 + random() * 0.1);
      const bayDepth2 = depth * (0.15 + random() * 0.1);
      const rawPoints: Point[] = [
        { x: worldSize, y: 0 },
        { x: coastX - edgeJitter(), y: 0 },
        { x: coastX + jitter(), y: worldSize * 0.07 },
        { x: coastX * 0.98 + jitter(), y: worldSize * bayPos1 - worldSize * 0.03 },
        { x: coastX - bayDepth1 + jitter(), y: worldSize * bayPos1 },
        { x: coastX * 1.02 + jitter(), y: worldSize * bayPos1 + worldSize * 0.04 },
        { x: coastX - worldSize * 0.04 + jitter(), y: worldSize * 0.32 },
        { x: coastX + worldSize * 0.03 + jitter(), y: worldSize * 0.40 },
        { x: coastX - worldSize * 0.02 + jitter(), y: worldSize * 0.48 },
        { x: coastX * 1.01 + jitter(), y: worldSize * bayPos2 - worldSize * 0.03 },
        { x: coastX - bayDepth2 + jitter(), y: worldSize * bayPos2 },
        { x: coastX * 0.99 + jitter(), y: worldSize * bayPos2 + worldSize * 0.04 },
        { x: coastX + worldSize * 0.02 + jitter(), y: worldSize * 0.78 },
        { x: coastX - worldSize * 0.03 + jitter(), y: worldSize * 0.86 },
        { x: coastX + jitter(), y: worldSize * 0.93 },
        { x: coastX - edgeJitter(), y: worldSize },
        { x: worldSize, y: worldSize },
      ];
      const points = fractalCoast(rawPoints, 3, 0.20, random, 1);
      // Clamp coastline points so water doesn't bleed inland past coastX
      const minCoastX = coastX - depth * 0.15;
      for (const p of points) {
        if (p.x < worldSize && p.y > 0 && p.y < worldSize) {
          p.x = Math.max(p.x, minCoastX);
        }
      }
      return {
        polygon: { points },
        coastlineStart: { x: coastX, y: 0 },
        coastlineEnd: { x: coastX, y: worldSize },
      };
    }
    case "south_coast": {
      const depth = worldSize * (0.25 + random() * 0.1);
      const coastY = worldSize - depth;
      const bayPos1 = 0.15 + random() * 0.25;
      const bayPos2 = 0.55 + random() * 0.3;
      const bayDepth1 = depth * (0.15 + random() * 0.1);
      const bayDepth2 = depth * (0.12 + random() * 0.08);
      const rawPoints: Point[] = [
        { x: 0, y: worldSize },
        { x: 0, y: coastY - edgeJitter() },
        { x: worldSize * 0.07, y: coastY + jitter() },
        { x: worldSize * bayPos1 - worldSize * 0.03, y: coastY * 1.02 + jitter() },
        { x: worldSize * bayPos1, y: coastY + bayDepth1 + jitter() },
        { x: worldSize * bayPos1 + worldSize * 0.04, y: coastY * 0.98 + jitter() },
        { x: worldSize * 0.32, y: coastY - worldSize * 0.04 + jitter() },
        { x: worldSize * 0.40, y: coastY + worldSize * 0.02 + jitter() },
        { x: worldSize * 0.48, y: coastY - worldSize * 0.03 + jitter() },
        { x: worldSize * bayPos2 - worldSize * 0.03, y: coastY * 1.01 + jitter() },
        { x: worldSize * bayPos2, y: coastY + bayDepth2 + jitter() },
        { x: worldSize * bayPos2 + worldSize * 0.04, y: coastY * 0.99 + jitter() },
        { x: worldSize * 0.78, y: coastY + worldSize * 0.03 + jitter() },
        { x: worldSize * 0.86, y: coastY - worldSize * 0.02 + jitter() },
        { x: worldSize * 0.93, y: coastY + jitter() },
        { x: worldSize, y: coastY - edgeJitter() },
        { x: worldSize, y: worldSize },
      ];
      const points = fractalCoast(rawPoints, 3, 0.20, random, 1);
      // Clamp coastline points so water doesn't bleed inland (upward) past coastY
      const minCoastY = coastY - depth * 0.15;
      for (const p of points) {
        if (p.y < worldSize && p.x > 0 && p.x < worldSize) {
          p.y = Math.max(p.y, minCoastY);
        }
      }
      return {
        polygon: { points },
        coastlineStart: { x: 0, y: coastY },
        coastlineEnd: { x: worldSize, y: coastY },
      };
    }
    case "north_coast": {
      const depth = worldSize * (0.25 + random() * 0.1);
      const bayPos1 = 0.2 + random() * 0.2;
      const bayPos2 = 0.6 + random() * 0.25;
      const bayDepth1 = depth * (0.14 + random() * 0.1);
      const bayDepth2 = depth * (0.12 + random() * 0.1);
      const rawPoints: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: depth + edgeJitter() },
        { x: worldSize * 0.07, y: depth + jitter() },
        { x: worldSize * bayPos1 - worldSize * 0.03, y: depth * 0.85 + jitter() },
        { x: worldSize * bayPos1, y: depth - bayDepth1 + jitter() },
        { x: worldSize * bayPos1 + worldSize * 0.04, y: depth * 0.9 + jitter() },
        { x: worldSize * 0.35, y: depth + worldSize * 0.04 + jitter() },
        { x: worldSize * 0.42, y: depth - worldSize * 0.02 + jitter() },
        { x: worldSize * 0.50, y: depth + worldSize * 0.03 + jitter() },
        { x: worldSize * bayPos2 - worldSize * 0.03, y: depth * 1.05 + jitter() },
        { x: worldSize * bayPos2, y: depth - bayDepth2 + jitter() },
        { x: worldSize * bayPos2 + worldSize * 0.03, y: depth * 0.95 + jitter() },
        { x: worldSize * 0.78, y: depth - worldSize * 0.03 + jitter() },
        { x: worldSize * 0.86, y: depth + worldSize * 0.02 + jitter() },
        { x: worldSize * 0.93, y: depth + jitter() },
        { x: worldSize, y: depth + edgeJitter() },
        { x: worldSize, y: 0 },
      ];
      const points = fractalCoast(rawPoints, 3, 0.20, random, 1);
      // Clamp coastline points so water doesn't bleed inland (downward) past depth
      const maxCoastY = depth * 1.15;
      for (const p of points) {
        if (p.y > 0 && p.x > 0 && p.x < worldSize) {
          p.y = Math.min(p.y, maxCoastY);
        }
      }
      return {
        polygon: { points },
        coastlineStart: { x: 0, y: depth },
        coastlineEnd: { x: worldSize, y: depth },
      };
    }
    case "bay_harbor":
      return generateBayPolygon(worldSize, random);
    case "delta": {
      // Irregular marshy coastline at bottom with channels
      const depth = worldSize * (0.3 + random() * 0.1);
      const coastY = worldSize - depth;
      const rawPoints: Point[] = [
        { x: 0, y: worldSize },
        { x: 0, y: coastY + edgeJitter() },
        { x: worldSize * 0.15, y: coastY + jitter() * 2 },
        { x: worldSize * 0.3, y: coastY - worldSize * 0.06 + jitter() },
        { x: worldSize * 0.45, y: coastY + worldSize * 0.04 + jitter() },
        { x: worldSize * 0.6, y: coastY - worldSize * 0.03 + jitter() },
        { x: worldSize * 0.75, y: coastY + worldSize * 0.05 + jitter() },
        { x: worldSize * 0.9, y: coastY + jitter() * 2 },
        { x: worldSize, y: coastY + edgeJitter() },
        { x: worldSize, y: worldSize },
      ];
      // Higher roughness for delta = more irregular marshy edge
      const points = fractalCoast(rawPoints, 4, 0.2, random);
      return {
        polygon: { points },
        coastlineStart: { x: 0, y: coastY },
        coastlineEnd: { x: worldSize, y: coastY },
      };
    }
    case "island":
    case "river_valley":
    case "lakefront":
    case "inland":
      // No ocean polygon for these archetypes
      return null;
    case "peninsula": {
      // CITY-577: Peninsula as an elongated finger of land extending from one edge.
      // The ocean polygon wraps around the map edges and traces both sides of the
      // peninsula, leaving a narrow tapered strip of land.
      const edge = Math.floor(random() * 4); // 0=bottom, 1=top, 2=left, 3=right
      const penLength = worldSize * (0.55 + random() * 0.2); // 55-75% of world
      const baseHalfW = worldSize * (0.17 + random() * 0.08); // base half-width
      const tipHalfW = worldSize * (0.03 + random() * 0.04); // tip half-width
      const basePos = worldSize * (0.4 + random() * 0.2); // center along base edge
      // Slight lateral drift at tip for natural asymmetry
      const tipDrift = (random() - 0.5) * tipHalfW * 0.8;

      let rawPoints: Point[];
      let cStart: Point, cEnd: Point;

      switch (edge) {
        case 0: { // extends upward from bottom edge
          const bL = basePos - baseHalfW;
          const bR = basePos + baseHalfW;
          const tipY = worldSize - penLength;
          const tipCx = basePos + tipDrift;
          const midY = worldSize - penLength * 0.5;
          const midHalfW = (baseHalfW + tipHalfW) * 0.55;
          rawPoints = [
            { x: worldSize, y: worldSize },
            { x: worldSize, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: worldSize },
            // Left coast (going up from base, narrowing)
            { x: bL, y: worldSize },
            { x: bL + jitter(), y: midY + jitter() },
            { x: tipCx - midHalfW + jitter(), y: tipY + penLength * 0.2 + jitter() },
            { x: tipCx - tipHalfW + jitter(), y: tipY + penLength * 0.08 + jitter() },
            // Tip
            { x: tipCx + jitter(), y: tipY + jitter() },
            // Right coast (going back down, widening)
            { x: tipCx + tipHalfW + jitter(), y: tipY + penLength * 0.08 + jitter() },
            { x: tipCx + midHalfW + jitter(), y: tipY + penLength * 0.2 + jitter() },
            { x: bR + jitter(), y: midY + jitter() },
            { x: bR, y: worldSize },
          ];
          cStart = { x: bL, y: worldSize };
          cEnd = { x: bR, y: worldSize };
          break;
        }
        case 1: { // extends downward from top edge
          const bL = basePos - baseHalfW;
          const bR = basePos + baseHalfW;
          const tipY = penLength;
          const tipCx = basePos + tipDrift;
          const midY = penLength * 0.5;
          const midHalfW = (baseHalfW + tipHalfW) * 0.55;
          rawPoints = [
            { x: 0, y: 0 },
            { x: 0, y: worldSize },
            { x: worldSize, y: worldSize },
            { x: worldSize, y: 0 },
            // Right coast (going down from base, narrowing)
            { x: bR, y: 0 },
            { x: bR + jitter(), y: midY + jitter() },
            { x: tipCx + midHalfW + jitter(), y: tipY - penLength * 0.2 + jitter() },
            { x: tipCx + tipHalfW + jitter(), y: tipY - penLength * 0.08 + jitter() },
            // Tip
            { x: tipCx + jitter(), y: tipY + jitter() },
            // Left coast (going back up, widening)
            { x: tipCx - tipHalfW + jitter(), y: tipY - penLength * 0.08 + jitter() },
            { x: tipCx - midHalfW + jitter(), y: tipY - penLength * 0.2 + jitter() },
            { x: bL + jitter(), y: midY + jitter() },
            { x: bL, y: 0 },
          ];
          cStart = { x: bR, y: 0 };
          cEnd = { x: bL, y: 0 };
          break;
        }
        case 2: { // extends rightward from left edge
          const bT = basePos - baseHalfW;
          const bB = basePos + baseHalfW;
          const tipX = penLength;
          const tipCy = basePos + tipDrift;
          const midX = penLength * 0.5;
          const midHalfW = (baseHalfW + tipHalfW) * 0.55;
          rawPoints = [
            { x: 0, y: 0 },
            { x: worldSize, y: 0 },
            { x: worldSize, y: worldSize },
            { x: 0, y: worldSize },
            // Bottom coast (going right from base, narrowing)
            { x: 0, y: bB },
            { x: midX + jitter(), y: bB + jitter() },
            { x: tipX - penLength * 0.2 + jitter(), y: tipCy + midHalfW + jitter() },
            { x: tipX - penLength * 0.08 + jitter(), y: tipCy + tipHalfW + jitter() },
            // Tip
            { x: tipX + jitter(), y: tipCy + jitter() },
            // Top coast (going back left, widening)
            { x: tipX - penLength * 0.08 + jitter(), y: tipCy - tipHalfW + jitter() },
            { x: tipX - penLength * 0.2 + jitter(), y: tipCy - midHalfW + jitter() },
            { x: midX + jitter(), y: bT + jitter() },
            { x: 0, y: bT },
          ];
          cStart = { x: 0, y: bB };
          cEnd = { x: 0, y: bT };
          break;
        }
        default: { // extends leftward from right edge
          const bT = basePos - baseHalfW;
          const bB = basePos + baseHalfW;
          const tipX = worldSize - penLength;
          const tipCy = basePos + tipDrift;
          const midX = worldSize - penLength * 0.5;
          const midHalfW = (baseHalfW + tipHalfW) * 0.55;
          rawPoints = [
            { x: worldSize, y: worldSize },
            { x: 0, y: worldSize },
            { x: 0, y: 0 },
            { x: worldSize, y: 0 },
            // Top coast (going left from base, narrowing)
            { x: worldSize, y: bT },
            { x: midX + jitter(), y: bT + jitter() },
            { x: tipX + penLength * 0.2 + jitter(), y: tipCy - midHalfW + jitter() },
            { x: tipX + penLength * 0.08 + jitter(), y: tipCy - tipHalfW + jitter() },
            // Tip
            { x: tipX + jitter(), y: tipCy + jitter() },
            // Bottom coast (going back right, widening)
            { x: tipX + penLength * 0.08 + jitter(), y: tipCy + tipHalfW + jitter() },
            { x: tipX + penLength * 0.2 + jitter(), y: tipCy + midHalfW + jitter() },
            { x: midX + jitter(), y: bB + jitter() },
            { x: worldSize, y: bB },
          ];
          cStart = { x: worldSize, y: bT };
          cEnd = { x: worldSize, y: bB };
          break;
        }
      }
      const points = fractalCoast(rawPoints, 3, 0.12, random);
      return {
        polygon: { points },
        coastlineStart: cStart,
        coastlineEnd: cEnd,
        peninsulaDirection: edge, // CITY-580: 0=up, 1=down, 2=right, 3=left
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Lakes
// ---------------------------------------------------------------------------
function generateLakes(
  archetype: TerrainArchetype,
  worldSize: number,
  seed: number,
  random: () => number
): { points: Point[]; center: Point; radius: number }[] {
  const countSeed = Math.abs(seed * 7 + 31);

  let lakeCount: number;
  switch (archetype) {
    case "lakefront":
      lakeCount = 1; // One large prominent lake
      break;
    case "island":
      lakeCount = 1 + (countSeed % 2);
      break;
    case "inland":
      lakeCount = 1 + (countSeed % 3); // 1-3 lakes for inland
      break;
    case "river_valley":
      lakeCount = countSeed % 2; // 0-1 lakes
      break;
    case "peninsula":
      // CITY-578: Lakes appear ~10% of the time (1 in 10 seeds), max 2
      lakeCount = countSeed % 10 === 0 ? 1 + (countSeed % 2) : 0;
      break;
    default:
      lakeCount = countSeed % 4; // 0-3
      break;
  }

  const lakes: { points: Point[]; center: Point; radius: number }[] = [];

  const landCenters: Record<TerrainArchetype, { cx: number; cy: number }> = {
    west_coast: { cx: 0.65, cy: 0.5 },
    east_coast: { cx: 0.35, cy: 0.5 },
    south_coast: { cx: 0.5, cy: 0.35 },
    north_coast: { cx: 0.5, cy: 0.65 },
    island: { cx: 0.5, cy: 0.5 },
    peninsula: { cx: 0.5, cy: 0.5 },
    bay_harbor: { cx: 0.6, cy: 0.5 },
    river_valley: { cx: 0.5, cy: 0.5 },
    lakefront: { cx: 0.5, cy: 0.5 },
    inland: { cx: 0.5, cy: 0.5 },
    delta: { cx: 0.5, cy: 0.35 },
  };

  const { cx, cy } = landCenters[archetype];

  for (let i = 0; i < lakeCount; i++) {
    const angle = random() * Math.PI * 2;
    // CITY-578: Peninsula lakes placed closer to center (smaller spread)
    const maxDist = archetype === "peninsula" ? 0.1 : 0.2;
    const dist = worldSize * (0.05 + random() * maxDist);
    const lakeCenter = {
      x: worldSize * cx + Math.cos(angle) * dist,
      y: worldSize * cy + Math.sin(angle) * dist,
    };

    // CITY-578: Tighter bounds for peninsula to keep lakes well inland
    const minBound = archetype === "peninsula" ? 0.25 : 0.15;
    const maxBound = archetype === "peninsula" ? 0.75 : 0.85;
    lakeCenter.x = Math.max(worldSize * minBound, Math.min(worldSize * maxBound, lakeCenter.x));
    lakeCenter.y = Math.max(worldSize * minBound, Math.min(worldSize * maxBound, lakeCenter.y));

    // Lakefront gets a larger lake, peninsula gets smaller lakes
    let baseRadius: number;
    if (archetype === "lakefront") {
      baseRadius = worldSize * (0.08 + random() * 0.06);
    } else if (archetype === "peninsula") {
      baseRadius = worldSize * (0.02 + random() * 0.03);
    } else {
      baseRadius = worldSize * (0.04 + random() * 0.06);
    }

    const numPoints = 10 + Math.floor(random() * 6);
    const lakePoints: Point[] = [];

    for (let j = 0; j < numPoints; j++) {
      const a = (j / numPoints) * Math.PI * 2;
      const r = baseRadius * (0.7 + random() * 0.5);
      lakePoints.push({
        x: lakeCenter.x + Math.cos(a) * r,
        y: lakeCenter.y + Math.sin(a) * r,
      });
    }

    lakes.push({ points: lakePoints, center: lakeCenter, radius: baseRadius });
  }

  return lakes;
}

// ---------------------------------------------------------------------------
// Rivers
// ---------------------------------------------------------------------------
function generateRiver(
  source: Point,
  archetype: TerrainArchetype,
  worldSize: number,
  random: () => number,
  coastlinePoints?: Point[],
  peninsulaDirection?: number
): Point[] {
  let target: Point = { x: worldSize * 0.5, y: worldSize * 0.5 };

  // CITY-576: If we have coastline geometry, snap the river target to the
  // nearest coastline point instead of using hardcoded positions.
  // However, if the snapped target is too close to the source (< worldSize * 0.1),
  // fall back to the archetype-based target to avoid zero-length or backward rivers.
  let useArchetypeFallback = false;
  if (coastlinePoints && coastlinePoints.length >= 2) {
    const snappedTarget = nearestPointOnPolyline(source, coastlinePoints);
    const dx = snappedTarget.x - source.x;
    const dy = snappedTarget.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < worldSize * 0.1) {
      useArchetypeFallback = true;
    } else {
      target = snappedTarget;
    }
  } else {
    useArchetypeFallback = true;
  }

  if (useArchetypeFallback) {
    // Fallback for archetypes without an ocean/coastline, or when snap target is too close
    switch (archetype) {
      case "west_coast":
        target = { x: worldSize * 0.3, y: source.y + (random() - 0.5) * worldSize * 0.3 };
        break;
      case "east_coast":
        target = { x: worldSize * 0.7, y: source.y + (random() - 0.5) * worldSize * 0.3 };
        break;
      case "south_coast":
      case "delta":
        target = { x: source.x + (random() - 0.5) * worldSize * 0.3, y: worldSize * 0.7 };
        break;
      case "north_coast":
        target = { x: source.x + (random() - 0.5) * worldSize * 0.3, y: worldSize * 0.3 };
        break;
      case "island":
        target = { x: random() < 0.5 ? 0 : worldSize, y: source.y + (random() - 0.5) * worldSize * 0.4 };
        break;
      case "peninsula":
        // CITY-580: Constrain fallback target along the peninsula axis
        if (peninsulaDirection === 0) {
          // Extends upward — flow along Y axis toward top (tip)
          target = { x: source.x + (random() - 0.5) * worldSize * 0.08, y: worldSize * (0.1 + random() * 0.3) };
        } else if (peninsulaDirection === 1) {
          // Extends downward — flow along Y axis toward bottom (tip)
          target = { x: source.x + (random() - 0.5) * worldSize * 0.08, y: worldSize * (0.6 + random() * 0.3) };
        } else if (peninsulaDirection === 2) {
          // Extends rightward — flow along X axis toward right (tip)
          target = { x: worldSize * (0.6 + random() * 0.3), y: source.y + (random() - 0.5) * worldSize * 0.08 };
        } else {
          // Extends leftward — flow along X axis toward left (tip)
          target = { x: worldSize * (0.1 + random() * 0.3), y: source.y + (random() - 0.5) * worldSize * 0.08 };
        }
        break;
      case "bay_harbor":
        target = { x: worldSize * (0.2 + random() * 0.6), y: worldSize * (0.2 + random() * 0.6) };
        break;
      case "river_valley":
        target = { x: random() < 0.5 ? 0 : worldSize, y: source.y + (random() - 0.5) * worldSize * 0.3 };
        break;
      case "lakefront":
      case "inland":
        target = { x: random() < 0.5 ? 0 : worldSize, y: source.y + (random() - 0.5) * worldSize * 0.4 };
        break;
    }

    target.x = Math.max(0, Math.min(worldSize, target.x));
    target.y = Math.max(0, Math.min(worldSize, target.y));
  }

  const points = generateSmoothLine(source, target, 12 + Math.floor(random() * 8), worldSize * 0.025, random);

  // CITY-576: Snap the final point exactly onto the coastline so there is
  // no visible gap between the river endpoint and the coast.
  if (coastlinePoints && coastlinePoints.length >= 2) {
    const snapped = nearestPointOnPolyline(points[points.length - 1], coastlinePoints);
    points[points.length - 1] = snapped;
  }

  return points;
}

// ---------------------------------------------------------------------------
// Generate a major river for river_valley archetype
// ---------------------------------------------------------------------------
function generateMajorRiver(
  worldSize: number,
  random: () => number
): Point[] {
  // River flows from one side to the other with meanders
  const vertical = random() < 0.5;
  let start: Point, end: Point;
  if (vertical) {
    start = { x: worldSize * (0.3 + random() * 0.4), y: 0 };
    end = { x: worldSize * (0.3 + random() * 0.4), y: worldSize };
  } else {
    start = { x: 0, y: worldSize * (0.3 + random() * 0.4) };
    end = { x: worldSize, y: worldSize * (0.3 + random() * 0.4) };
  }
  return generateSmoothLine(start, end, 20, worldSize * 0.06, random);
}

// ---------------------------------------------------------------------------
// Delta channels
// ---------------------------------------------------------------------------
function generateDeltaChannels(
  worldSize: number,
  random: () => number
): { points: Point[]; name: string }[] {
  const channels: { points: Point[]; name: string }[] = [];
  const numChannels = 3 + Math.floor(random() * 3);
  const baseY = worldSize * (0.25 + random() * 0.1);

  // Main river comes from the top
  const mainX = worldSize * (0.35 + random() * 0.3);
  const forkY = worldSize * (0.4 + random() * 0.15);

  // Main stem
  const mainStem = generateSmoothLine(
    { x: mainX, y: 0 },
    { x: mainX + (random() - 0.5) * worldSize * 0.1, y: forkY },
    10,
    worldSize * 0.03,
    random
  );
  channels.push({ points: mainStem, name: "Main Channel" });

  // Distributary channels fan out from the fork point
  for (let i = 0; i < numChannels; i++) {
    const spreadX = worldSize * (0.15 + (i / numChannels) * 0.7);
    const channelEnd = { x: spreadX + (random() - 0.5) * worldSize * 0.08, y: worldSize - baseY };
    const forkPoint = mainStem[mainStem.length - 1];
    const channelPoints = generateSmoothLine(
      forkPoint,
      channelEnd,
      8 + Math.floor(random() * 4),
      worldSize * 0.025,
      random
    );
    channels.push({ points: channelPoints, name: `Channel ${i + 1}` });
  }

  return channels;
}

// ---------------------------------------------------------------------------
// Coastline, beach, and inland direction helpers
// ---------------------------------------------------------------------------
function generateCoastline(
  start: Point,
  end: Point,
  worldSize: number,
  random: () => number
): Point[] {
  return generateSmoothLine(start, end, 20, worldSize * 0.015, random);
}

function generateCoastBeach(
  coastlinePoints: Point[],
  beachWidth: number,
  inlandDirection: { dx: number; dy: number },
  random: () => number
): Point[] {
  const beachPoints: Point[] = [];
  for (const point of coastlinePoints) {
    beachPoints.push({ x: point.x, y: point.y });
  }
  for (let i = coastlinePoints.length - 1; i >= 0; i--) {
    const point = coastlinePoints[i];
    // Jitter only in the inland direction to prevent beach bleeding into water
    beachPoints.push({
      x: point.x + inlandDirection.dx * beachWidth + inlandDirection.dx * random() * beachWidth * 0.3,
      y: point.y + inlandDirection.dy * beachWidth + inlandDirection.dy * random() * beachWidth * 0.3,
    });
  }
  return beachPoints;
}

function generateLakeBeach(
  lakePoints: Point[],
  lakeCenter: Point,
  beachWidth: number
): Point[] {
  const beachPolygon: Point[] = [];
  for (const point of lakePoints) {
    beachPolygon.push({ x: point.x, y: point.y });
  }
  for (let i = lakePoints.length - 1; i >= 0; i--) {
    const point = lakePoints[i];
    const dx = point.x - lakeCenter.x;
    const dy = point.y - lakeCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = (dist + beachWidth) / dist;
    beachPolygon.push({
      x: lakeCenter.x + dx * scale,
      y: lakeCenter.y + dy * scale,
    });
  }
  return beachPolygon;
}

function getInlandDirection(archetype: TerrainArchetype): { dx: number; dy: number } {
  switch (archetype) {
    case "west_coast": return { dx: 1, dy: 0 };
    case "east_coast": return { dx: -1, dy: 0 };
    case "south_coast":
    case "delta": return { dx: 0, dy: -1 };
    case "north_coast": return { dx: 0, dy: 1 };
    case "bay_harbor": return { dx: 1, dy: 0 }; // Approximate
    case "peninsula": return { dx: 0.7, dy: 0.7 };
    default: return { dx: 1, dy: 0 };
  }
}

// ---------------------------------------------------------------------------
// Main terrain generation
// ---------------------------------------------------------------------------
export function generateMockTerrain(
  worldSize: number,
  seed: number = 12345,
  geographicSetting?: GeographicSetting
): TerrainData {
  const random = seededRandom(seed);

  // Step 1: Pick terrain archetype from seed and optional geographic setting
  const archetype = pickArchetype(seed, geographicSetting);

  // Step 2: Generate ocean (may be null for inland archetypes)
  const oceanResult = generateOcean(archetype, worldSize, random);

  // Step 3: Generate lakes
  const lakes = generateLakes(archetype, worldSize, seed, random);

  // Step 4: Generate coastline
  let coastlinePoints: Point[] = [];
  if (oceanResult) {
    coastlinePoints = generateCoastline(
      oceanResult.coastlineStart,
      oceanResult.coastlineEnd,
      worldSize,
      random
    );
  }

  // Step 5: Generate rivers
  const rivers: { points: Point[]; name: string }[] = [];

  // River valley gets a prominent major river
  if (archetype === "river_valley") {
    rivers.push({
      points: generateMajorRiver(worldSize, random),
      name: generateRiverName({ seed: seed + 3000 }),
    });
  }

  // Delta gets branching channels
  if (archetype === "delta") {
    const channels = generateDeltaChannels(worldSize, random);
    for (let i = 0; i < channels.length; i++) {
      rivers.push({
        points: channels[i].points,
        name: generateRiverName({ seed: seed + 4000 + i }),
      });
    }
  }

  // CITY-576: Use ocean polygon points as coastline geometry so rivers
  // can snap their endpoints to the actual coast.
  const oceanCoastPoints = oceanResult ? oceanResult.polygon.points : undefined;
  const peninsulaDir = oceanResult?.peninsulaDirection;

  // CITY-580: Peninsula rivers — only ~20% of the time, max 1, axis-constrained.
  // We consume the same random() calls even when skipping to preserve RNG sequence.
  if (archetype === "peninsula") {
    const penRiverRoll = random(); // always consume one roll for determinism
    if (penRiverRoll <= 0.20) {
      // Generate at most 1 river (lake-fed if lake exists, otherwise standalone)
      if (lakes.length > 0) {
        const lake = lakes[0]; // only use first lake
        const riverStart = {
          x: lake.center.x + (random() - 0.5) * lake.radius,
          y: lake.center.y + (random() - 0.5) * lake.radius,
        };
        // CITY-580: Constrain river start along peninsula axis toward base
        if (peninsulaDir === 0) {
          // Extends upward — base is at bottom, start near base
          riverStart.y = Math.max(riverStart.y, worldSize * 0.6);
        } else if (peninsulaDir === 1) {
          // Extends downward — base is at top, start near base
          riverStart.y = Math.min(riverStart.y, worldSize * 0.4);
        } else if (peninsulaDir === 2) {
          // Extends rightward — base is at left, start near base
          riverStart.x = Math.min(riverStart.x, worldSize * 0.4);
        } else {
          // Extends leftward — base is at right, start near base
          riverStart.x = Math.max(riverStart.x, worldSize * 0.6);
        }
        const riverPoints = generateRiver(riverStart, archetype, worldSize, random, oceanCoastPoints, peninsulaDir);
        rivers.push({
          points: riverPoints,
          name: generateRiverName({ seed: seed + 2000 }),
        });
      } else if (oceanResult) {
        // Standalone river — start near base, flow toward tip/coast
        let highlandStart: Point;
        if (peninsulaDir === 0) {
          // Extends upward — highland/base at bottom
          highlandStart = {
            x: worldSize * (0.4 + random() * 0.2),
            y: worldSize * (0.7 + random() * 0.15),
          };
        } else if (peninsulaDir === 1) {
          // Extends downward — highland/base at top
          highlandStart = {
            x: worldSize * (0.4 + random() * 0.2),
            y: worldSize * (0.15 + random() * 0.15),
          };
        } else if (peninsulaDir === 2) {
          // Extends rightward — highland/base at left
          highlandStart = {
            x: worldSize * (0.15 + random() * 0.15),
            y: worldSize * (0.4 + random() * 0.2),
          };
        } else {
          // Extends leftward — highland/base at right
          highlandStart = {
            x: worldSize * (0.7 + random() * 0.15),
            y: worldSize * (0.4 + random() * 0.2),
          };
        }
        const riverPoints = generateRiver(highlandStart, archetype, worldSize, random, oceanCoastPoints, peninsulaDir);
        rivers.push({
          points: riverPoints,
          name: generateRiverName({ seed: seed + 2000 }),
        });
      }
    } else {
      // CITY-580: No river for this peninsula — consume random() calls to keep
      // RNG sequence stable. We need to consume roughly the same number as a
      // river generation would. Lake-fed path: 2 (start) + generateRiver internals.
      // Standalone path: 2 (start) + generateRiver internals.
      // generateRiver consumes: 1 (fallback target random) + generateSmoothLine
      // (2 * segments calls) + 0-1 snap. Rather than trying to match exactly,
      // we accept that peninsula seeds will differ from non-peninsula anyway,
      // so no extra dummy calls needed — the roll itself is the gate.
    }
  } else {
    // Non-peninsula: existing river logic
    // Rivers from lakes
    for (let i = 0; i < lakes.length; i++) {
      const lake = lakes[i];
      const riverStart = {
        x: lake.center.x + (random() - 0.5) * lake.radius,
        y: lake.center.y + (random() - 0.5) * lake.radius,
      };
      const riverPoints = generateRiver(riverStart, archetype, worldSize, random, oceanCoastPoints);
      rivers.push({
        points: riverPoints,
        name: generateRiverName({ seed: seed + 2000 + i }),
      });
    }

    // Standalone river if no lakes but we have an ocean (and not already a river_valley/delta)
    if (lakes.length === 0 && oceanResult && archetype !== "river_valley" && archetype !== "delta") {
      const highlandStart = {
        x: worldSize * (0.4 + random() * 0.2),
        y: worldSize * (0.4 + random() * 0.2),
      };
      const riverPoints = generateRiver(highlandStart, archetype, worldSize, random, oceanCoastPoints);
      rivers.push({
        points: riverPoints,
        name: generateRiverName({ seed: seed + 2000 }),
      });
    }
  }

  // Step 6: Generate contour lines
  const contours = [];
  for (let elevation = 10; elevation <= 100; elevation += 10) {
    let contourStart: Point;
    let contourEnd: Point;

    switch (archetype) {
      case "west_coast":
        contourStart = {
          x: worldSize * (0.35 + elevation / 300) + (random() - 0.5) * worldSize * 0.05,
          y: (random() - 0.5) * worldSize * 0.1,
        };
        contourEnd = {
          x: worldSize * (0.35 + elevation / 300) + (random() - 0.5) * worldSize * 0.05,
          y: worldSize + (random() - 0.5) * worldSize * 0.1,
        };
        break;
      case "east_coast":
        contourStart = {
          x: worldSize * (0.65 - elevation / 300) + (random() - 0.5) * worldSize * 0.05,
          y: (random() - 0.5) * worldSize * 0.1,
        };
        contourEnd = {
          x: worldSize * (0.65 - elevation / 300) + (random() - 0.5) * worldSize * 0.05,
          y: worldSize + (random() - 0.5) * worldSize * 0.1,
        };
        break;
      case "south_coast":
      case "delta":
        contourStart = {
          x: (random() - 0.5) * worldSize * 0.1,
          y: worldSize * (0.65 - elevation / 300) + (random() - 0.5) * worldSize * 0.05,
        };
        contourEnd = {
          x: worldSize + (random() - 0.5) * worldSize * 0.1,
          y: worldSize * (0.65 - elevation / 300) + (random() - 0.5) * worldSize * 0.05,
        };
        break;
      case "north_coast":
        contourStart = {
          x: (random() - 0.5) * worldSize * 0.1,
          y: worldSize * (0.35 + elevation / 300) + (random() - 0.5) * worldSize * 0.05,
        };
        contourEnd = {
          x: worldSize + (random() - 0.5) * worldSize * 0.1,
          y: worldSize * (0.35 + elevation / 300) + (random() - 0.5) * worldSize * 0.05,
        };
        break;
      case "bay_harbor":
        // Similar to the coast side the bay opens from
        contourStart = {
          x: worldSize * (0.4 + elevation / 300) + (random() - 0.5) * worldSize * 0.05,
          y: (random() - 0.5) * worldSize * 0.1,
        };
        contourEnd = {
          x: worldSize * (0.4 + elevation / 300) + (random() - 0.5) * worldSize * 0.05,
          y: worldSize + (random() - 0.5) * worldSize * 0.1,
        };
        break;
      case "river_valley":
      case "inland":
      case "lakefront": {
        // Gentle rolling hills — radial contours from random highlands
        const angle = (elevation / 100) * Math.PI * 0.5 + random() * Math.PI;
        const radiusFactor = 0.3 + elevation / 200;
        contourStart = {
          x: worldSize * 0.5 + Math.cos(angle) * worldSize * radiusFactor * 0.4,
          y: worldSize * (0.2 + random() * 0.1),
        };
        contourEnd = {
          x: worldSize * 0.5 + Math.cos(angle + Math.PI) * worldSize * radiusFactor * 0.4,
          y: worldSize * (0.8 + random() * 0.1),
        };
        break;
      }
      default: {
        // Island / peninsula: concentric-ish contours from center
        const angle = (elevation / 100) * Math.PI * 0.3 + random() * 0.5;
        const radiusFactor = 1 - elevation / 150;
        contourStart = {
          x: worldSize * 0.5 + Math.cos(angle) * worldSize * radiusFactor * 0.4,
          y: worldSize * 0.1 + random() * worldSize * 0.2,
        };
        contourEnd = {
          x: worldSize * 0.5 + Math.cos(angle + Math.PI) * worldSize * radiusFactor * 0.4,
          y: worldSize * 0.8 + random() * worldSize * 0.15,
        };
        break;
      }
    }

    const contourPoints = generateSmoothLine(contourStart, contourEnd, 10, worldSize * 0.025, random);
    contours.push({
      id: `contour-${elevation}`,
      elevation,
      line: { points: contourPoints },
    });
  }

  // Step 7: Build water features
  const water = [];
  if (oceanResult) {
    water.push({ id: "ocean-1", type: "ocean" as const, polygon: oceanResult.polygon });
  }
  for (let i = 0; i < lakes.length; i++) {
    water.push({
      id: `lake-${i + 1}`,
      type: "lake" as const,
      polygon: { points: lakes[i].points },
      name: generateLakeName({ seed: seed + 1000 + i }),
    });
  }

  // Step 8: Build coastlines
  const coastlines = [];
  if (coastlinePoints.length > 0) {
    coastlines.push({ id: "coast-1", line: { points: coastlinePoints, width: 2 } });
  }

  // Step 9: Build rivers
  const riverFeatures = rivers.map((r, i) => ({
    id: `river-${i + 1}`,
    line: { points: r.points },
    width: 3,
    name: r.name,
  }));

  // Step 10: Build beaches
  const beaches = [];
  const beachWidth = worldSize * 0.02;
  const lakeBeachWidth = worldSize * 0.015;

  if (coastlinePoints.length > 0) {
    const inlandDir = getInlandDirection(archetype);
    const coastBeachPoints = generateCoastBeach(coastlinePoints, beachWidth, inlandDir, random);
    beaches.push({
      id: "beach-1",
      beachType: "ocean" as const,
      polygon: { points: coastBeachPoints },
      width: beachWidth,
    });
  }

  for (let i = 0; i < lakes.length; i++) {
    const lake = lakes[i];
    const lakeBeachPoints = generateLakeBeach(lake.points, lake.center, lakeBeachWidth);
    beaches.push({
      id: `beach-lake-${i + 1}`,
      beachType: "lake" as const,
      polygon: { points: lakeBeachPoints },
      width: lakeBeachWidth,
    });
  }

  return {
    water,
    coastlines,
    rivers: riverFeatures,
    contours,
    beaches,
    barrierIslands: [],
    tidalFlats: [],
    duneRidges: [],
    inlets: [],
  };
}
