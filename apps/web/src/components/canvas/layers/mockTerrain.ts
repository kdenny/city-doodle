/**
 * Generate mock terrain data for demonstration.
 * In production, this would come from the API.
 */

import type { TerrainData, Point } from "./types";
import { generateLakeName, generateRiverName } from "../../../utils/nameGenerator";

// Simple seeded random number generator for determinism
function seededRandom(seed: number) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
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

/**
 * Terrain archetype — determines the fundamental layout of the map.
 * The seed selects which archetype is used so different seeds produce
 * structurally different terrain.
 */
type TerrainArchetype =
  | "west_coast"
  | "east_coast"
  | "south_coast"
  | "north_coast"
  | "island"
  | "peninsula";

function pickArchetype(seed: number): TerrainArchetype {
  const archetypes: TerrainArchetype[] = [
    "west_coast",
    "east_coast",
    "south_coast",
    "north_coast",
    "island",
    "peninsula",
  ];
  return archetypes[Math.abs(seed) % archetypes.length];
}

/**
 * Generate an ocean polygon for the given archetype.
 */
function generateOcean(
  archetype: TerrainArchetype,
  worldSize: number,
  random: () => number
): { polygon: { points: Point[] }; coastlineStart: Point; coastlineEnd: Point } | null {
  const jitter = () => (random() - 0.5) * worldSize * 0.04;
  const edgeJitter = () => random() * worldSize * 0.06;

  switch (archetype) {
    case "west_coast": {
      const depth = worldSize * (0.25 + random() * 0.1);
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: depth + edgeJitter(), y: 0 },
        { x: depth * 0.85 + jitter(), y: worldSize * 0.2 },
        { x: depth * 1.1 + jitter(), y: worldSize * 0.4 },
        { x: depth * 0.9 + jitter(), y: worldSize * 0.6 },
        { x: depth * 1.05 + jitter(), y: worldSize * 0.8 },
        { x: depth + edgeJitter(), y: worldSize },
        { x: 0, y: worldSize },
      ];
      return {
        polygon: { points },
        coastlineStart: { x: depth, y: 0 },
        coastlineEnd: { x: depth, y: worldSize },
      };
    }
    case "east_coast": {
      const depth = worldSize * (0.25 + random() * 0.1);
      const coastX = worldSize - depth;
      const points: Point[] = [
        { x: worldSize, y: 0 },
        { x: coastX - edgeJitter(), y: 0 },
        { x: coastX + jitter(), y: worldSize * 0.2 },
        { x: coastX - worldSize * 0.05 + jitter(), y: worldSize * 0.4 },
        { x: coastX + jitter(), y: worldSize * 0.6 },
        { x: coastX + worldSize * 0.03 + jitter(), y: worldSize * 0.8 },
        { x: coastX - edgeJitter(), y: worldSize },
        { x: worldSize, y: worldSize },
      ];
      return {
        polygon: { points },
        coastlineStart: { x: coastX, y: 0 },
        coastlineEnd: { x: coastX, y: worldSize },
      };
    }
    case "south_coast": {
      const depth = worldSize * (0.25 + random() * 0.1);
      const coastY = worldSize - depth;
      const points: Point[] = [
        { x: 0, y: worldSize },
        { x: 0, y: coastY - edgeJitter() },
        { x: worldSize * 0.2, y: coastY + jitter() },
        { x: worldSize * 0.4, y: coastY - worldSize * 0.04 + jitter() },
        { x: worldSize * 0.6, y: coastY + jitter() },
        { x: worldSize * 0.8, y: coastY + worldSize * 0.03 + jitter() },
        { x: worldSize, y: coastY - edgeJitter() },
        { x: worldSize, y: worldSize },
      ];
      return {
        polygon: { points },
        coastlineStart: { x: 0, y: coastY },
        coastlineEnd: { x: worldSize, y: coastY },
      };
    }
    case "north_coast": {
      const depth = worldSize * (0.25 + random() * 0.1);
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: depth + edgeJitter() },
        { x: worldSize * 0.2, y: depth + jitter() },
        { x: worldSize * 0.4, y: depth + worldSize * 0.04 + jitter() },
        { x: worldSize * 0.6, y: depth + jitter() },
        { x: worldSize * 0.8, y: depth - worldSize * 0.03 + jitter() },
        { x: worldSize, y: depth + edgeJitter() },
        { x: worldSize, y: 0 },
      ];
      return {
        polygon: { points },
        coastlineStart: { x: 0, y: depth },
        coastlineEnd: { x: worldSize, y: depth },
      };
    }
    case "island":
      // No ocean polygon — land fills the whole map
      return null;
    case "peninsula": {
      // Ocean wraps two sides (like a corner)
      const depthX = worldSize * (0.2 + random() * 0.1);
      const depthY = worldSize * (0.2 + random() * 0.1);
      // Pick which corner the ocean wraps around
      const corner = Math.floor(random() * 4);
      let points: Point[];
      let cStart: Point, cEnd: Point;
      switch (corner) {
        case 0: // top-left
          points = [
            { x: 0, y: 0 },
            { x: worldSize, y: 0 },
            { x: worldSize, y: depthY + edgeJitter() },
            { x: worldSize * 0.7 + jitter(), y: depthY + jitter() },
            { x: worldSize * 0.5 + jitter(), y: depthY * 1.2 + jitter() },
            { x: depthX * 1.1 + jitter(), y: depthY * 1.1 + jitter() },
            { x: depthX + jitter(), y: worldSize * 0.5 + jitter() },
            { x: depthX * 1.2 + jitter(), y: worldSize * 0.7 + jitter() },
            { x: depthX + edgeJitter(), y: worldSize },
            { x: 0, y: worldSize },
          ];
          cStart = { x: worldSize, y: depthY };
          cEnd = { x: depthX, y: worldSize };
          break;
        case 1: // top-right
          points = [
            { x: 0, y: 0 },
            { x: worldSize, y: 0 },
            { x: worldSize, y: worldSize },
            { x: worldSize - depthX - edgeJitter(), y: worldSize },
            { x: worldSize - depthX + jitter(), y: worldSize * 0.7 + jitter() },
            { x: worldSize - depthX * 1.1 + jitter(), y: worldSize * 0.5 + jitter() },
            { x: worldSize - depthX * 1.2 + jitter(), y: depthY * 1.1 + jitter() },
            { x: worldSize * 0.5 + jitter(), y: depthY + jitter() },
            { x: worldSize * 0.3 + jitter(), y: depthY * 1.1 + jitter() },
            { x: 0, y: depthY + edgeJitter() },
          ];
          cStart = { x: 0, y: depthY };
          cEnd = { x: worldSize - depthX, y: worldSize };
          break;
        case 2: // bottom-left
          points = [
            { x: 0, y: 0 },
            { x: depthX + edgeJitter(), y: 0 },
            { x: depthX + jitter(), y: worldSize * 0.3 + jitter() },
            { x: depthX * 1.1 + jitter(), y: worldSize * 0.5 + jitter() },
            { x: depthX * 1.2 + jitter(), y: worldSize - depthY * 1.1 + jitter() },
            { x: worldSize * 0.5 + jitter(), y: worldSize - depthY + jitter() },
            { x: worldSize * 0.7 + jitter(), y: worldSize - depthY * 1.1 + jitter() },
            { x: worldSize, y: worldSize - depthY - edgeJitter() },
            { x: worldSize, y: worldSize },
            { x: 0, y: worldSize },
          ];
          cStart = { x: depthX, y: 0 };
          cEnd = { x: worldSize, y: worldSize - depthY };
          break;
        default: // bottom-right
          points = [
            { x: worldSize, y: 0 },
            { x: worldSize, y: worldSize },
            { x: 0, y: worldSize },
            { x: 0, y: worldSize - depthY - edgeJitter() },
            { x: worldSize * 0.3 + jitter(), y: worldSize - depthY + jitter() },
            { x: worldSize * 0.5 + jitter(), y: worldSize - depthY * 1.2 + jitter() },
            { x: worldSize - depthX * 1.1 + jitter(), y: worldSize - depthY * 1.1 + jitter() },
            { x: worldSize - depthX + jitter(), y: worldSize * 0.5 + jitter() },
            { x: worldSize - depthX * 1.1 + jitter(), y: worldSize * 0.3 + jitter() },
            { x: worldSize - depthX - edgeJitter(), y: 0 },
          ];
          cStart = { x: worldSize - depthX, y: 0 };
          cEnd = { x: 0, y: worldSize - depthY };
          break;
      }
      return {
        polygon: { points },
        coastlineStart: cStart,
        coastlineEnd: cEnd,
      };
    }
  }
}

/**
 * Generate lake(s) placed within the landmass.
 * The seed controls how many lakes (0-3) and where they go.
 */
function generateLakes(
  archetype: TerrainArchetype,
  worldSize: number,
  seed: number,
  random: () => number
): { points: Point[]; center: Point; radius: number }[] {
  // Determine lake count from seed
  const countSeed = Math.abs(seed * 7 + 31);
  const lakeCount = archetype === "island" ? 1 + (countSeed % 2) : countSeed % 4; // 0-3

  const lakes: { points: Point[]; center: Point; radius: number }[] = [];

  // Define safe zone — avoid placing lakes in the ocean region
  // Use the center of the landmass biased by archetype
  const landCenters: Record<TerrainArchetype, { cx: number; cy: number }> = {
    west_coast: { cx: 0.65, cy: 0.5 },
    east_coast: { cx: 0.35, cy: 0.5 },
    south_coast: { cx: 0.5, cy: 0.35 },
    north_coast: { cx: 0.5, cy: 0.65 },
    island: { cx: 0.5, cy: 0.5 },
    peninsula: { cx: 0.5, cy: 0.5 },
  };

  const { cx, cy } = landCenters[archetype];

  for (let i = 0; i < lakeCount; i++) {
    // Spread lakes around the land center using seed-derived offsets
    const angle = (random() * Math.PI * 2);
    const dist = worldSize * (0.05 + random() * 0.2);
    const lakeCenter = {
      x: worldSize * cx + Math.cos(angle) * dist,
      y: worldSize * cy + Math.sin(angle) * dist,
    };

    // Clamp to stay well within bounds
    lakeCenter.x = Math.max(worldSize * 0.15, Math.min(worldSize * 0.85, lakeCenter.x));
    lakeCenter.y = Math.max(worldSize * 0.15, Math.min(worldSize * 0.85, lakeCenter.y));

    const lakeRadius = worldSize * (0.04 + random() * 0.06);
    const numPoints = 10 + Math.floor(random() * 6);
    const lakePoints: Point[] = [];

    for (let j = 0; j < numPoints; j++) {
      const a = (j / numPoints) * Math.PI * 2;
      const r = lakeRadius * (0.7 + random() * 0.5);
      lakePoints.push({
        x: lakeCenter.x + Math.cos(a) * r,
        y: lakeCenter.y + Math.sin(a) * r,
      });
    }

    lakes.push({ points: lakePoints, center: lakeCenter, radius: lakeRadius });
  }

  return lakes;
}

/**
 * Generate a river flowing from a source (lake or highland) toward the coast or map edge.
 */
function generateRiver(
  source: Point,
  archetype: TerrainArchetype,
  worldSize: number,
  random: () => number
): Point[] {
  // Determine flow direction based on archetype (rivers flow toward ocean)
  let target: Point;
  switch (archetype) {
    case "west_coast":
      target = { x: worldSize * 0.3, y: source.y + (random() - 0.5) * worldSize * 0.3 };
      break;
    case "east_coast":
      target = { x: worldSize * 0.7, y: source.y + (random() - 0.5) * worldSize * 0.3 };
      break;
    case "south_coast":
      target = { x: source.x + (random() - 0.5) * worldSize * 0.3, y: worldSize * 0.7 };
      break;
    case "north_coast":
      target = { x: source.x + (random() - 0.5) * worldSize * 0.3, y: worldSize * 0.3 };
      break;
    case "island":
      // Flow to nearest edge
      target = { x: random() < 0.5 ? 0 : worldSize, y: source.y + (random() - 0.5) * worldSize * 0.4 };
      break;
    case "peninsula":
      // Flow toward the coast wrap
      target = { x: worldSize * (0.2 + random() * 0.6), y: worldSize * (0.2 + random() * 0.6) };
      break;
  }

  // Clamp target to map bounds
  target.x = Math.max(0, Math.min(worldSize, target.x));
  target.y = Math.max(0, Math.min(worldSize, target.y));

  return generateSmoothLine(source, target, 12 + Math.floor(random() * 8), worldSize * 0.025, random);
}

/**
 * Generate coastline from a start/end pair with jitter.
 */
function generateCoastline(
  start: Point,
  end: Point,
  worldSize: number,
  random: () => number
): Point[] {
  return generateSmoothLine(start, end, 20, worldSize * 0.015, random);
}

/**
 * Generate a beach strip along a coastline.
 */
function generateCoastBeach(
  coastlinePoints: Point[],
  beachWidth: number,
  inlandDirection: { dx: number; dy: number },
  random: () => number
): Point[] {
  const beachPoints: Point[] = [];

  // Forward pass — coastline edge
  for (const point of coastlinePoints) {
    beachPoints.push({ x: point.x, y: point.y });
  }
  // Reverse pass — inland offset
  for (let i = coastlinePoints.length - 1; i >= 0; i--) {
    const point = coastlinePoints[i];
    beachPoints.push({
      x: point.x + inlandDirection.dx * beachWidth + (random() - 0.5) * beachWidth * 0.3,
      y: point.y + inlandDirection.dy * beachWidth + (random() - 0.5) * beachWidth * 0.3,
    });
  }

  return beachPoints;
}

/**
 * Generate a beach ring around a lake.
 */
function generateLakeBeach(
  lakePoints: Point[],
  lakeCenter: Point,
  beachWidth: number
): Point[] {
  const beachPolygon: Point[] = [];

  // Inner ring (lake shore)
  for (const point of lakePoints) {
    beachPolygon.push({ x: point.x, y: point.y });
  }
  // Outer ring
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

/**
 * Determine the "inland" direction for beach generation based on archetype.
 */
function getInlandDirection(archetype: TerrainArchetype): { dx: number; dy: number } {
  switch (archetype) {
    case "west_coast": return { dx: 1, dy: 0 };
    case "east_coast": return { dx: -1, dy: 0 };
    case "south_coast": return { dx: 0, dy: -1 };
    case "north_coast": return { dx: 0, dy: 1 };
    case "peninsula": return { dx: 0.7, dy: 0.7 }; // diagonal
    default: return { dx: 1, dy: 0 };
  }
}

export function generateMockTerrain(
  worldSize: number,
  seed: number = 12345
): TerrainData {
  const random = seededRandom(seed);

  // Step 1: Pick terrain archetype from seed
  const archetype = pickArchetype(seed);

  // Step 2: Generate ocean (may be null for island archetype)
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

  // Step 5: Generate rivers from lakes toward coast
  const rivers: { points: Point[]; name: string }[] = [];
  for (let i = 0; i < lakes.length; i++) {
    const lake = lakes[i];
    // River starts from the edge of the lake facing the ocean
    const riverStart = {
      x: lake.center.x + (random() - 0.5) * lake.radius,
      y: lake.center.y + (random() - 0.5) * lake.radius,
    };
    const riverPoints = generateRiver(riverStart, archetype, worldSize, random);
    rivers.push({
      points: riverPoints,
      name: generateRiverName({ seed: seed + 2000 + i }),
    });
  }

  // If no lakes but we have an ocean, generate a standalone river from highlands
  if (lakes.length === 0 && oceanResult) {
    const highlandStart = {
      x: worldSize * (0.4 + random() * 0.2),
      y: worldSize * (0.4 + random() * 0.2),
    };
    const riverPoints = generateRiver(highlandStart, archetype, worldSize, random);
    rivers.push({
      points: riverPoints,
      name: generateRiverName({ seed: seed + 2000 }),
    });
  }

  // Step 6: Generate contour lines based on terrain layout
  const contours = [];
  // Elevation increases away from coast
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
  };
}
