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
      neighborhoods: [],
      bridges: [],
    };

    expect(() => layer.setData(data)).not.toThrow();
  });

  it("sets visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: false,
      districts: false,
      roads: true,
      pois: false,
      bridges: true,
      grid: true,
      labels: true,
    };

    layer.setVisibility(visibility);

    // Container should still be accessible
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("toggles districts visibility on and off", () => {
    const allVisible: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
    };

    layer.setVisibility(allVisible);
    layer.setVisibility({ ...allVisible, districts: false });
    layer.setVisibility({ ...allVisible, districts: true });
    expect(layer.getContainer()).toBeDefined();
  });

  it("toggles roads visibility on and off", () => {
    const allVisible: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
    };

    layer.setVisibility(allVisible);
    layer.setVisibility({ ...allVisible, roads: false });
    layer.setVisibility({ ...allVisible, roads: true });
    expect(layer.getContainer()).toBeDefined();
  });

  it("toggles pois visibility on and off", () => {
    const allVisible: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
    };

    layer.setVisibility(allVisible);
    layer.setVisibility({ ...allVisible, pois: false });
    layer.setVisibility({ ...allVisible, pois: true });
    expect(layer.getContainer()).toBeDefined();
  });

  it("cleans up on destroy", () => {
    expect(() => layer.destroy()).not.toThrow();
  });

  describe("hitTest", () => {
    it("returns null when no data is set", () => {
      const result = layer.hitTest(50, 50);
      expect(result).toBeNull();
    });

    it("returns null when clicking on empty space", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [],
        pois: [],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      const result = layer.hitTest(50, 50);
      expect(result).toBeNull();
    });

    it("detects POI clicks", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [],
        pois: [
          {
            id: "poi-1",
            name: "Test POI",
            type: "park",
            position: { x: 50, y: 50 },
          },
        ],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      const result = layer.hitTest(50, 50);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("poi");
      expect(result?.feature.id).toBe("poi-1");
    });

    it("detects POI clicks within hit radius", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [],
        pois: [
          {
            id: "poi-1",
            name: "Test POI",
            type: "park",
            position: { x: 50, y: 50 },
          },
        ],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      // Click slightly off-center but within radius
      const result = layer.hitTest(55, 52);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("poi");
    });

    it("returns null when POI click is too far away", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [],
        pois: [
          {
            id: "poi-1",
            name: "Test POI",
            type: "park",
            position: { x: 50, y: 50 },
          },
        ],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      // Click far away from POI
      const result = layer.hitTest(200, 200);
      expect(result).toBeNull();
    });

    it("detects road clicks", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [
          {
            id: "road-1",
            name: "Test Road",
            roadClass: "arterial",
            line: {
              points: [
                { x: 0, y: 50 },
                { x: 100, y: 50 },
              ],
            },
          },
        ],
        pois: [],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      const result = layer.hitTest(50, 50);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("road");
      expect(result?.feature.id).toBe("road-1");
    });

    it("detects road clicks near the line", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [
          {
            id: "road-1",
            roadClass: "arterial",
            line: {
              points: [
                { x: 0, y: 50 },
                { x: 100, y: 50 },
              ],
            },
          },
        ],
        pois: [],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      // Click slightly above the road (within tolerance)
      const result = layer.hitTest(50, 55);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("road");
    });

    it("detects district clicks", () => {
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
        roads: [],
        pois: [],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      const result = layer.hitTest(50, 50);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("district");
      expect(result?.feature.id).toBe("district-1");
    });

    it("returns null when clicking outside district polygon", () => {
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
        roads: [],
        pois: [],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      const result = layer.hitTest(150, 150);
      expect(result).toBeNull();
    });

    it("prioritizes POI over road", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [
          {
            id: "road-1",
            roadClass: "arterial",
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
            type: "transit",
            position: { x: 50, y: 50 },
          },
        ],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      const result = layer.hitTest(50, 50);
      expect(result?.type).toBe("poi");
    });

    it("prioritizes road over district", () => {
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
            roadClass: "arterial",
            line: {
              points: [
                { x: 0, y: 50 },
                { x: 100, y: 50 },
              ],
            },
          },
        ],
        pois: [],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);

      const result = layer.hitTest(50, 50);
      expect(result?.type).toBe("road");
    });

    it("respects visibility - does not hit hidden POIs", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [],
        pois: [
          {
            id: "poi-1",
            name: "Test POI",
            type: "park",
            position: { x: 50, y: 50 },
          },
        ],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);
      layer.setVisibility({
        water: true,
        beaches: true,
        coastlines: true,
        rivers: true,
        contours: false,
        districts: true,
        roads: true,
        pois: false, // POIs hidden
        bridges: true,
        grid: true,
        labels: true,
      });

      const result = layer.hitTest(50, 50);
      expect(result).toBeNull();
    });

    it("respects visibility - does not hit hidden roads", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [
          {
            id: "road-1",
            roadClass: "arterial",
            line: {
              points: [
                { x: 0, y: 50 },
                { x: 100, y: 50 },
              ],
            },
          },
        ],
        pois: [],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);
      layer.setVisibility({
        water: true,
        beaches: true,
        coastlines: true,
        rivers: true,
        contours: false,
        districts: true,
        roads: false, // Roads hidden
        pois: true,
        bridges: true,
        grid: true,
        labels: true,
      });

      const result = layer.hitTest(50, 50);
      expect(result).toBeNull();
    });

    it("respects visibility - does not hit hidden districts", () => {
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
        roads: [],
        pois: [],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);
      layer.setVisibility({
        water: true,
        beaches: true,
        coastlines: true,
        rivers: true,
        contours: false,
        districts: false, // Districts hidden
        roads: true,
        pois: true,
        bridges: true,
        grid: true,
        labels: true,
      });

      const result = layer.hitTest(50, 50);
      expect(result).toBeNull();
    });
  });

  describe("getData", () => {
    it("returns null when no data set", () => {
      expect(layer.getData()).toBeNull();
    });

    it("returns the data that was set", () => {
      const data: FeaturesData = {
        districts: [],
        roads: [],
        pois: [],
        neighborhoods: [],
        bridges: [],
      };
      layer.setData(data);
      expect(layer.getData()).toBe(data);
    });
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
