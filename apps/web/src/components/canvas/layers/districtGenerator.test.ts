import { describe, it, expect } from "vitest";
import {
  generateDistrictGeometry,
  wouldOverlap,
  seedIdToDistrictType,
  type DistrictGenerationConfig,
} from "./districtGenerator";
import type { District } from "./types";

describe("generateDistrictGeometry", () => {
  it("generates a district with polygon and roads", () => {
    const position = { x: 100, y: 100 };
    const result = generateDistrictGeometry(position, "residential");

    expect(result.district).toBeDefined();
    expect(result.district.id).toContain("district");
    expect(result.district.type).toBe("residential");
    expect(result.district.name).toBeDefined();
    expect(result.district.polygon.points.length).toBeGreaterThanOrEqual(3);
    expect(result.roads).toBeDefined();
    expect(result.roads.length).toBeGreaterThan(0);
  });

  it("generates deterministic results for the same position", () => {
    const position = { x: 200, y: 300 };
    const result1 = generateDistrictGeometry(position, "residential");
    const result2 = generateDistrictGeometry(position, "residential");

    // Same district type
    expect(result1.district.type).toBe(result2.district.type);

    // Same polygon points count
    expect(result1.district.polygon.points.length).toBe(
      result2.district.polygon.points.length
    );

    // Same general location for polygon points
    const points1 = result1.district.polygon.points;
    const points2 = result2.district.polygon.points;
    for (let i = 0; i < points1.length; i++) {
      expect(points1[i].x).toBeCloseTo(points2[i].x, 5);
      expect(points1[i].y).toBeCloseTo(points2[i].y, 5);
    }
  });

  it("generates different results for different positions", () => {
    const result1 = generateDistrictGeometry({ x: 100, y: 100 }, "residential");
    const result2 = generateDistrictGeometry({ x: 500, y: 500 }, "residential");

    // Different polygon center positions
    const center1 = getPolygonCenter(result1.district.polygon.points);
    const center2 = getPolygonCenter(result2.district.polygon.points);

    expect(Math.abs(center1.x - center2.x)).toBeGreaterThan(100);
    expect(Math.abs(center1.y - center2.y)).toBeGreaterThan(100);
  });

  it("generates downtown districts with rectangular shape", () => {
    const result = generateDistrictGeometry({ x: 300, y: 300 }, "downtown");

    expect(result.district.type).toBe("downtown");
    // Downtown should have more points (rounded rectangle)
    expect(result.district.polygon.points.length).toBeGreaterThan(8);
  });

  it("generates park districts without roads", () => {
    const result = generateDistrictGeometry({ x: 200, y: 200 }, "park");

    expect(result.district.type).toBe("park");
    expect(result.roads.length).toBe(0);
  });

  it("generates airport districts without roads", () => {
    const result = generateDistrictGeometry({ x: 400, y: 400 }, "airport");

    expect(result.district.type).toBe("airport");
    expect(result.roads.length).toBe(0);
  });

  it("respects custom configuration", () => {
    const config: DistrictGenerationConfig = {
      size: 200,
      minSize: 180,
      maxSize: 220,
      streetSpacing: 50,
    };

    const result = generateDistrictGeometry({ x: 300, y: 300 }, "residential", config);

    // District should be larger
    const bounds = getPolygonBounds(result.district.polygon.points);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Size should be roughly 180-220
    expect(Math.min(width, height)).toBeGreaterThan(150);
    expect(Math.max(width, height)).toBeLessThan(280);
  });

  it("generates roads with local road class by default", () => {
    const result = generateDistrictGeometry({ x: 150, y: 150 }, "residential");

    for (const road of result.roads) {
      expect(road.roadClass).toBe("local");
    }
  });

  it("generates roads that are within or near district bounds", () => {
    const result = generateDistrictGeometry({ x: 250, y: 250 }, "commercial");

    const districtBounds = getPolygonBounds(result.district.polygon.points);
    const padding = 20; // Allow some tolerance

    for (const road of result.roads) {
      for (const point of road.line.points) {
        expect(point.x).toBeGreaterThanOrEqual(districtBounds.minX - padding);
        expect(point.x).toBeLessThanOrEqual(districtBounds.maxX + padding);
        expect(point.y).toBeGreaterThanOrEqual(districtBounds.minY - padding);
        expect(point.y).toBeLessThanOrEqual(districtBounds.maxY + padding);
      }
    }
  });

  it("generates district polygon centered around the position", () => {
    const position = { x: 500, y: 400 };
    const result = generateDistrictGeometry(position, "industrial");

    const center = getPolygonCenter(result.district.polygon.points);

    // Center should be close to the requested position
    expect(Math.abs(center.x - position.x)).toBeLessThan(50);
    expect(Math.abs(center.y - position.y)).toBeLessThan(50);
  });

  it("generates isHistoric as false by default", () => {
    const result = generateDistrictGeometry({ x: 100, y: 100 }, "residential");
    expect(result.district.isHistoric).toBe(false);
  });
});

describe("wouldOverlap", () => {
  it("returns false when no existing districts", () => {
    const newPolygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    expect(wouldOverlap(newPolygon, [])).toBe(false);
  });

  it("returns true when polygons overlap", () => {
    const existing: District[] = [
      {
        id: "existing-1",
        type: "residential",
        name: "Existing",
        polygon: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
        },
      },
    ];

    const newPolygon = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 150 },
      { x: 50, y: 150 },
    ];

    expect(wouldOverlap(newPolygon, existing)).toBe(true);
  });

  it("returns false when polygons do not overlap", () => {
    const existing: District[] = [
      {
        id: "existing-1",
        type: "residential",
        name: "Existing",
        polygon: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
        },
      },
    ];

    const newPolygon = [
      { x: 200, y: 200 },
      { x: 300, y: 200 },
      { x: 300, y: 300 },
      { x: 200, y: 300 },
    ];

    expect(wouldOverlap(newPolygon, existing)).toBe(false);
  });

  it("returns true when new polygon is completely inside existing", () => {
    const existing: District[] = [
      {
        id: "existing-1",
        type: "residential",
        name: "Existing",
        polygon: {
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
            { x: 200, y: 200 },
            { x: 0, y: 200 },
          ],
        },
      },
    ];

    const newPolygon = [
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
      { x: 50, y: 100 },
    ];

    expect(wouldOverlap(newPolygon, existing)).toBe(true);
  });

  it("returns true when existing polygon is inside new polygon", () => {
    const existing: District[] = [
      {
        id: "existing-1",
        type: "residential",
        name: "Existing",
        polygon: {
          points: [
            { x: 50, y: 50 },
            { x: 100, y: 50 },
            { x: 100, y: 100 },
            { x: 50, y: 100 },
          ],
        },
      },
    ];

    const newPolygon = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 0, y: 200 },
    ];

    expect(wouldOverlap(newPolygon, existing)).toBe(true);
  });
});

describe("seedIdToDistrictType", () => {
  it("maps residential to residential", () => {
    expect(seedIdToDistrictType("residential")).toBe("residential");
  });

  it("maps downtown to downtown", () => {
    expect(seedIdToDistrictType("downtown")).toBe("downtown");
  });

  it("maps shopping to commercial", () => {
    expect(seedIdToDistrictType("shopping")).toBe("commercial");
  });

  it("maps industrial to industrial", () => {
    expect(seedIdToDistrictType("industrial")).toBe("industrial");
  });

  it("maps park to park", () => {
    expect(seedIdToDistrictType("park")).toBe("park");
  });

  it("maps unknown seed to residential as default", () => {
    expect(seedIdToDistrictType("unknown")).toBe("residential");
  });
});

// Helper functions for tests
function getPolygonCenter(points: { x: number; y: number }[]): { x: number; y: number } {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

function getPolygonBounds(points: { x: number; y: number }[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, maxX, minY, maxY };
}
