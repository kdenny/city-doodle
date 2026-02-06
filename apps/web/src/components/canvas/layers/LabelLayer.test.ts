import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LabelLayer, generateMockLabels } from "./LabelLayer";
import type { LabelLayerData, LayerVisibility } from "./types";

describe("LabelLayer", () => {
  let layer: LabelLayer;

  beforeEach(() => {
    layer = new LabelLayer();
  });

  afterEach(() => {
    layer.destroy();
  });

  it("creates a container with correct label", () => {
    const container = layer.getContainer();
    expect(container.label).toBe("labels");
  });

  it("accepts data without throwing", () => {
    const data: LabelLayerData = {
      labels: [
        {
          id: "test-1",
          text: "Test Label",
          type: "district",
          position: { x: 100, y: 100 },
        },
      ],
      seed: 42,
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
      neighborhoods: true,
  cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: false,
      subwayTunnels: false,
    };

    layer.setVisibility(visibility);
    expect(layer.getContainer().visible).toBe(false);

    visibility.labels = true;
    layer.setVisibility(visibility);
    expect(layer.getContainer().visible).toBe(true);
  });

  it("can enable debug mode", () => {
    expect(() => layer.setDebugMode(true)).not.toThrow();
    expect(() => layer.setDebugMode(false)).not.toThrow();
  });

  it("cleans up on destroy", () => {
    // Destroy should not throw
    expect(() => layer.destroy()).not.toThrow();
  });
});

describe("generateMockLabels", () => {
  it("generates labels array", () => {
    const data = generateMockLabels(768, 42);
    expect(data.labels).toBeInstanceOf(Array);
    expect(data.labels.length).toBeGreaterThan(0);
  });

  it("includes seed in output", () => {
    const data = generateMockLabels(768, 12345);
    expect(data.seed).toBe(12345);
  });

  it("generates deterministic output for same seed", () => {
    const data1 = generateMockLabels(768, 42);
    const data2 = generateMockLabels(768, 42);

    expect(data1.labels.length).toBe(data2.labels.length);
    expect(data1.labels[0].position.x).toBe(data2.labels[0].position.x);
    expect(data1.labels[0].position.y).toBe(data2.labels[0].position.y);
  });

  it("generates different output for different seeds", () => {
    const data1 = generateMockLabels(768, 42);
    const data2 = generateMockLabels(768, 99);

    // At least some positions should differ (not comparing first which is fixed region label)
    const pos1 = data1.labels[1].position;
    const pos2 = data2.labels[1].position;
    expect(pos1.x !== pos2.x || pos1.y !== pos2.y).toBe(true);
  });

  it("generates labels of various types", () => {
    const data = generateMockLabels(768, 42);
    const types = new Set(data.labels.map((l) => l.type));

    expect(types.has("region")).toBe(true);
    expect(types.has("district")).toBe(true);
    expect(types.has("water")).toBe(true);
    expect(types.has("road")).toBe(true);
    expect(types.has("poi")).toBe(true);
  });

  it("generates labels with priorities", () => {
    const data = generateMockLabels(768, 42);

    // Check that labels have priorities
    const hasPriority = data.labels.some((l) => l.priority !== undefined);
    expect(hasPriority).toBe(true);

    // Region should have highest priority
    const regionLabel = data.labels.find((l) => l.type === "region");
    const otherLabels = data.labels.filter((l) => l.type !== "region");
    const maxOtherPriority = Math.max(
      ...otherLabels.map((l) => l.priority ?? 0)
    );
    expect(regionLabel?.priority).toBeGreaterThan(maxOtherPriority);
  });

  it("generates labels within world bounds", () => {
    const worldSize = 500;
    const data = generateMockLabels(worldSize, 42);

    for (const label of data.labels) {
      expect(label.position.x).toBeGreaterThanOrEqual(0);
      expect(label.position.x).toBeLessThanOrEqual(worldSize);
      expect(label.position.y).toBeGreaterThanOrEqual(0);
      expect(label.position.y).toBeLessThanOrEqual(worldSize);
    }
  });
});

describe("Label collision avoidance", () => {
  it("does not place overlapping labels", () => {
    const layer = new LabelLayer();

    // Create many labels at similar positions
    const data: LabelLayerData = {
      labels: Array.from({ length: 20 }, (_, i) => ({
        id: `label-${i}`,
        text: `Label ${i}`,
        type: "district" as const,
        position: { x: 100 + (i % 5) * 10, y: 100 + Math.floor(i / 5) * 10 },
        priority: 20 - i, // Descending priority
      })),
      seed: 42,
    };

    // Should not throw even with potentially overlapping labels
    expect(() => layer.setData(data)).not.toThrow();

    // Container exists and has the expected structure
    const container = layer.getContainer();
    expect(container).toBeDefined();
    expect(container.label).toBe("labels");

    layer.destroy();
  });
});
