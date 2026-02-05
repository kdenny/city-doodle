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

  // Generate ocean on the left side
  const oceanPolygon = {
    points: [
      { x: 0, y: 0 },
      { x: worldSize * 0.3 + random() * 50, y: 0 },
      { x: worldSize * 0.25 + random() * 40, y: worldSize * 0.3 },
      { x: worldSize * 0.35 + random() * 30, y: worldSize * 0.5 },
      { x: worldSize * 0.28 + random() * 40, y: worldSize * 0.7 },
      { x: worldSize * 0.32 + random() * 50, y: worldSize },
      { x: 0, y: worldSize },
    ],
  };

  // Generate a lake in the upper right
  const lakeCenter = { x: worldSize * 0.7, y: worldSize * 0.25 };
  const lakeRadius = worldSize * 0.08;
  const lakePoints: Point[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = lakeRadius * (0.8 + random() * 0.4);
    lakePoints.push({
      x: lakeCenter.x + Math.cos(angle) * r,
      y: lakeCenter.y + Math.sin(angle) * r,
    });
  }

  // Generate coastline along the ocean edge
  const coastlinePoints = generateSmoothLine(
    { x: worldSize * 0.3, y: 0 },
    { x: worldSize * 0.32, y: worldSize },
    20,
    15,
    random
  );

  // Generate a river from the lake to the ocean
  const riverPoints = generateSmoothLine(
    { x: lakeCenter.x - lakeRadius, y: lakeCenter.y + lakeRadius * 0.5 },
    { x: worldSize * 0.3, y: worldSize * 0.6 },
    15,
    20,
    random
  );

  // Generate contour lines
  const contours = [];
  for (let elevation = 10; elevation <= 100; elevation += 10) {
    // Create wavy horizontal contour lines
    const baseY = worldSize * (1 - elevation / 120);
    const contourPoints = generateSmoothLine(
      { x: worldSize * 0.35, y: baseY - 20 },
      { x: worldSize, y: baseY + 20 },
      10,
      25,
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
