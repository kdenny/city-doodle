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

export function generateMockTerrain(
  worldSize: number,
  seed: number = 12345
): TerrainData {
  const random = seededRandom(seed);

  // Seed-dependent ocean edge position: varies between 20-40% of worldSize
  const oceanBase = 0.2 + random() * 0.2; // 0.20 to 0.40
  // Seed-dependent variation for each vertex (up to ±8% of worldSize)
  const ov = () => (random() - 0.5) * worldSize * 0.16;

  // Generate ocean on the left side with seed-dependent shape
  const oceanPolygon = {
    points: [
      { x: 0, y: 0 },
      { x: worldSize * oceanBase + ov(), y: 0 },
      { x: worldSize * oceanBase + ov(), y: worldSize * 0.25 },
      { x: worldSize * oceanBase + ov(), y: worldSize * 0.5 },
      { x: worldSize * oceanBase + ov(), y: worldSize * 0.75 },
      { x: worldSize * oceanBase + ov(), y: worldSize },
      { x: 0, y: worldSize },
    ],
  };

  // Seed-dependent lake position: placed in the non-ocean portion of the map
  const lakeX = worldSize * (oceanBase + 0.15 + random() * 0.4); // well past ocean edge
  const lakeY = worldSize * (0.15 + random() * 0.7); // anywhere top to bottom
  const lakeCenter = { x: lakeX, y: lakeY };
  const lakeRadius = worldSize * (0.05 + random() * 0.06); // 5-11% of worldSize
  const lakePoints: Point[] = [];
  const lakeVertices = 10 + Math.floor(random() * 8); // 10-17 vertices
  for (let i = 0; i < lakeVertices; i++) {
    const angle = (i / lakeVertices) * Math.PI * 2;
    const r = lakeRadius * (0.7 + random() * 0.6);
    lakePoints.push({
      x: lakeCenter.x + Math.cos(angle) * r,
      y: lakeCenter.y + Math.sin(angle) * r,
    });
  }

  // Coastline start/end follow the ocean polygon edge (2nd and 2nd-to-last interior points)
  const coastStart = oceanPolygon.points[1];
  const coastEnd = oceanPolygon.points[oceanPolygon.points.length - 2];
  const coastlinePoints = generateSmoothLine(
    coastStart,
    coastEnd,
    20,
    worldSize * 0.01 + random() * worldSize * 0.02,
    random
  );

  // River flows from lake toward the ocean edge
  const riverEndX = worldSize * oceanBase + ov() * 0.5;
  const riverEndY = lakeY + (random() - 0.5) * worldSize * 0.3;
  const riverPoints = generateSmoothLine(
    { x: lakeCenter.x - lakeRadius * 0.8, y: lakeCenter.y + lakeRadius * 0.3 },
    { x: riverEndX, y: Math.max(0, Math.min(worldSize, riverEndY)) },
    15,
    worldSize * 0.015,
    random
  );

  // Contour lines with seed-dependent offsets
  const contours = [];
  const contourBaseOffset = random() * worldSize * 0.1;
  for (let elevation = 10; elevation <= 100; elevation += 10) {
    const baseY = worldSize * (1 - elevation / 120) + contourBaseOffset;
    const contourStartX = worldSize * (oceanBase + 0.05);
    const contourPoints = generateSmoothLine(
      { x: contourStartX, y: baseY - 20 + random() * 40 },
      { x: worldSize, y: baseY + random() * 40 - 20 },
      10,
      25 + random() * 15,
      random
    );

    contours.push({
      id: `contour-${elevation}`,
      elevation,
      line: { points: contourPoints },
    });
  }

  // Generate names for water features based on seed for determinism
  const lakeName = generateLakeName({ seed: seed + 1000 });
  const riverName = generateRiverName({ seed: seed + 2000 });

  // Generate beach polygons along coastline
  // Beach is a thin strip between the coastline and slightly inland
  const beachWidth = worldSize * 0.02; // ~2% of world width
  const beachPoints: Point[] = [];

  // Create beach polygon by offsetting coastline points
  for (const point of coastlinePoints) {
    beachPoints.push({ x: point.x, y: point.y });
  }
  // Add offset points going back the other way
  for (let i = coastlinePoints.length - 1; i >= 0; i--) {
    const point = coastlinePoints[i];
    beachPoints.push({
      x: point.x + beachWidth + (random() - 0.5) * beachWidth * 0.3,
      y: point.y,
    });
  }

  // Generate smaller beach around the lake
  const lakeBeachPoints: Point[] = [];
  const lakeBeachWidth = worldSize * 0.015;
  for (const point of lakePoints) {
    lakeBeachPoints.push({ x: point.x, y: point.y });
  }
  // Outer ring
  for (let i = lakePoints.length - 1; i >= 0; i--) {
    const point = lakePoints[i];
    const dx = point.x - lakeCenter.x;
    const dy = point.y - lakeCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = (dist + lakeBeachWidth) / dist;
    lakeBeachPoints.push({
      x: lakeCenter.x + dx * scale,
      y: lakeCenter.y + dy * scale,
    });
  }

  return {
    water: [
      { id: "ocean-1", type: "ocean", polygon: oceanPolygon },
      { id: "lake-1", type: "lake", polygon: { points: lakePoints }, name: lakeName },
    ],
    coastlines: [{ id: "coast-1", line: { points: coastlinePoints, width: 2 } }],
    rivers: [{ id: "river-1", line: { points: riverPoints }, width: 3, name: riverName }],
    contours,
    beaches: [
      { id: "beach-1", beachType: "ocean", polygon: { points: beachPoints }, width: beachWidth },
      { id: "beach-2", beachType: "lake", polygon: { points: lakeBeachPoints }, width: lakeBeachWidth },
    ],
  };
}
