import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FeaturesLayer, generateMockFeatures } from "./FeaturesLayer";
import type { FeaturesData, LayerVisibility } from "./types";

describe("FeaturesLayer", () => {
  let layer: FeaturesLayer;

  beforeEach(() => {
    layer = new FeaturesLayer();
  });

  afterEach(() => {
    layer.destroy();
  });

  it("creates a container with correct label", () => {
    const container = layer.getContainer();
    expect(container.label).toBe("features");
  });

  it("accepts data without throwing", () => {
    const data: FeaturesData = {
      districts: [
        {
          id: "district-1",
          type: "residential",
          name: "Test District",
          polygon: {
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
            ],
          },
        },
      ],
      roads: [
        {
          id: "road-1",
          roadClass: "local",
          line: {
            points: [
              { x: 0, y: 50 },
              { x: 100, y: 50 },
            ],
          },
        },
      ],
      pois: [
        {
          id: "poi-1",
          name: "Test POI",
          type: "park",
          position: { x: 50, y: 50 },
        },
      ],
    };

    expect(() => layer.setData(data)).not.toThrow();
  });

  it("sets visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: true,
      coastlines: true,
      rivers: true,
      contours: false,
      districts: false,
      roads: true,
      pois: false,
      grid: true,
    };

    layer.setVisibility(visibility);

    // Container should still be accessible
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("cleans up on destroy", () => {
    expect(() => layer.destroy()).not.toThrow();
  });
});

describe("generateMockFeatures", () => {
  it("generates features object with all properties", () => {
    const data = generateMockFeatures(768, 42);

    expect(data.districts).toBeInstanceOf(Array);
    expect(data.roads).toBeInstanceOf(Array);
    expect(data.pois).toBeInstanceOf(Array);
  });

  it("generates districts with required properties", () => {
    const data = generateMockFeatures(768, 42);

    expect(data.districts.length).toBeGreaterThan(0);
    for (const district of data.districts) {
      expect(district.id).toBeDefined();
      expect(district.type).toBeDefined();
      expect(district.name).toBeDefined();
      expect(district.polygon.points.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("generates roads with required properties", () => {
    const data = generateMockFeatures(768, 42);

    expect(data.roads.length).toBeGreaterThan(0);
    for (const road of data.roads) {
      expect(road.id).toBeDefined();
      expect(road.roadClass).toBeDefined();
      expect(road.line.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("generates POIs with required properties", () => {
    const data = generateMockFeatures(768, 42);

    expect(data.pois.length).toBeGreaterThan(0);
    for (const poi of data.pois) {
      expect(poi.id).toBeDefined();
      expect(poi.name).toBeDefined();
      expect(poi.type).toBeDefined();
      expect(poi.position.x).toBeDefined();
      expect(poi.position.y).toBeDefined();
    }
  });

  it("generates deterministic output for same seed", () => {
    const data1 = generateMockFeatures(768, 42);
    const data2 = generateMockFeatures(768, 42);

    expect(data1.districts.length).toBe(data2.districts.length);
    expect(data1.roads.length).toBe(data2.roads.length);
    expect(data1.pois.length).toBe(data2.pois.length);
  });

  it("generates different output for different seeds", () => {
    const data1 = generateMockFeatures(768, 42);
    const data2 = generateMockFeatures(768, 99);

    // District polygons should differ
    const d1Points = data1.districts[0].polygon.points;
    const d2Points = data2.districts[0].polygon.points;

    // At least some points should be different
    const allSame = d1Points.every(
      (p, i) => p.x === d2Points[i]?.x && p.y === d2Points[i]?.y
    );
    expect(allSame).toBe(false);
  });

  it("generates roads of various classes", () => {
    const data = generateMockFeatures(768, 42);
    const roadClasses = new Set(data.roads.map((r) => r.roadClass));

    expect(roadClasses.has("highway")).toBe(true);
    expect(roadClasses.has("arterial")).toBe(true);
  });

  it("generates POIs of various types", () => {
    const data = generateMockFeatures(768, 42);
    const poiTypes = new Set(data.pois.map((p) => p.type));

    expect(poiTypes.size).toBeGreaterThan(1);
  });

  it("includes at least one historic district", () => {
    const data = generateMockFeatures(768, 42);
    const hasHistoric = data.districts.some((d) => d.isHistoric);

    expect(hasHistoric).toBe(true);
  });

  it("generates features within world bounds", () => {
    const worldSize = 500;
    const data = generateMockFeatures(worldSize, 42);

    // Check POI positions
    for (const poi of data.pois) {
      expect(poi.position.x).toBeGreaterThanOrEqual(0);
      expect(poi.position.x).toBeLessThanOrEqual(worldSize);
      expect(poi.position.y).toBeGreaterThanOrEqual(0);
      expect(poi.position.y).toBeLessThanOrEqual(worldSize);
    }
  });
});
