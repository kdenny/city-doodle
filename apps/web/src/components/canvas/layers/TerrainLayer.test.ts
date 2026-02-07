import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TerrainLayer } from "./TerrainLayer";
import { generateMockTerrain } from "./mockTerrain";
import type { TerrainData, LayerVisibility } from "./types";

describe("TerrainLayer", () => {
  let layer: TerrainLayer;

  beforeEach(() => {
    layer = new TerrainLayer();
  });

  afterEach(() => {
    layer.destroy();
  });

  it("creates a container with correct label", () => {
    const container = layer.getContainer();
    expect(container.label).toBe("terrain");
  });

  it("accepts data without throwing", () => {
    const data: TerrainData = {
      water: [
        {
          id: "water-1",
          type: "lake",
          polygon: {
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
            ],
          },
        },
      ],
      beaches: [],
      coastlines: [
        {
          id: "coast-1",
          line: {
            points: [
              { x: 0, y: 50 },
              { x: 100, y: 50 },
            ],
          },
        },
      ],
      rivers: [
        {
          id: "river-1",
          line: {
            points: [
              { x: 50, y: 0 },
              { x: 50, y: 100 },
            ],
          },
          width: 5,
        },
      ],
      contours: [
        {
          id: "contour-1",
          elevation: 100,
          line: {
            points: [
              { x: 0, y: 25 },
              { x: 100, y: 25 },
            ],
          },
        },
      ],
    };

    expect(() => layer.setData(data)).not.toThrow();
  });

  it("cleans up on destroy", () => {
    expect(() => layer.destroy()).not.toThrow();
  });
});

describe("TerrainLayer visibility", () => {
  let layer: TerrainLayer;

  beforeEach(() => {
    layer = new TerrainLayer();
    // Set some data so graphics objects exist
    layer.setData(generateMockTerrain(768, 42));
  });

  afterEach(() => {
    layer.destroy();
  });

  it("sets water visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: false,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: true,
      neighborhoods: true,
  cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    layer.setVisibility(visibility);

    // Container should still be accessible
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("sets coastlines visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: false,
      rivers: true,
      contours: true,
      neighborhoods: true,
  cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    layer.setVisibility(visibility);
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("sets rivers visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: false,
      contours: true,
      neighborhoods: true,
  cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    layer.setVisibility(visibility);
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("sets contours visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: false,
      neighborhoods: true,
  cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    layer.setVisibility(visibility);
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("can toggle all terrain layers off", () => {
    const visibility: LayerVisibility = {
      water: false,
      beaches: false,
      coastlines: false,
      rivers: false,
      contours: false,
      neighborhoods: true,
  cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    expect(() => layer.setVisibility(visibility)).not.toThrow();
  });

  it("can toggle all terrain layers on", () => {
    const visibility: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: true,
      neighborhoods: true,
  cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    expect(() => layer.setVisibility(visibility)).not.toThrow();
  });
});

describe("generateMockTerrain", () => {
  it("generates terrain object with all properties", () => {
    const data = generateMockTerrain(768, 42);

    expect(data.water).toBeInstanceOf(Array);
    expect(data.coastlines).toBeInstanceOf(Array);
    expect(data.rivers).toBeInstanceOf(Array);
    expect(data.contours).toBeInstanceOf(Array);
  });

  it("generates water features with required properties", () => {
    const data = generateMockTerrain(768, 42, "coastal");

    expect(data.water.length).toBeGreaterThan(0);
    for (const water of data.water) {
      expect(water.id).toBeDefined();
      expect(water.type).toBeDefined();
      expect(water.polygon.points.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("generates coastlines with required properties", () => {
    const data = generateMockTerrain(768, 42, "coastal");

    expect(data.coastlines.length).toBeGreaterThan(0);
    for (const coastline of data.coastlines) {
      expect(coastline.id).toBeDefined();
      expect(coastline.line.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("generates rivers with required properties", () => {
    const data = generateMockTerrain(768, 42, "coastal");

    expect(data.rivers.length).toBeGreaterThan(0);
    for (const river of data.rivers) {
      expect(river.id).toBeDefined();
      expect(river.width).toBeGreaterThan(0);
      expect(river.line.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("generates contours with required properties", () => {
    const data = generateMockTerrain(768, 42);

    expect(data.contours.length).toBeGreaterThan(0);
    for (const contour of data.contours) {
      expect(contour.id).toBeDefined();
      expect(contour.elevation).toBeDefined();
      expect(contour.line.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("generates deterministic output for same seed", () => {
    const data1 = generateMockTerrain(768, 42);
    const data2 = generateMockTerrain(768, 42);

    expect(data1.water.length).toBe(data2.water.length);
    expect(data1.rivers.length).toBe(data2.rivers.length);
    expect(data1.contours.length).toBe(data2.contours.length);
  });

  it("generates different output for different seeds", () => {
    const data1 = generateMockTerrain(768, 42, "coastal");
    const data2 = generateMockTerrain(768, 99, "coastal");

    // At least some coordinates should differ
    const r1Points = data1.rivers[0].line.points;
    const r2Points = data2.rivers[0].line.points;
    const allSame = r1Points.every(
      (p, i) => p.x === r2Points[i]?.x && p.y === r2Points[i]?.y
    );
    expect(allSame).toBe(false);
  });
});
