import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RoadEndpointLayer } from "./RoadEndpointLayer";
import type { Road } from "./types";

describe("RoadEndpointLayer", () => {
  let layer: RoadEndpointLayer;

  const testRoad: Road = {
    id: "road-1",
    name: "Test Road",
    roadClass: "arterial",
    line: {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
    },
  };

  const multiPointRoad: Road = {
    id: "road-2",
    name: "Multi-point Road",
    roadClass: "collector",
    line: {
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 25 },
        { x: 100, y: 50 },
        { x: 150, y: 75 },
      ],
    },
  };

  beforeEach(() => {
    layer = new RoadEndpointLayer();
    layer.setRoads([testRoad, multiPointRoad]);
  });

  afterEach(() => {
    layer.destroy();
  });

  describe("initialization", () => {
    it("creates a container with correct label", () => {
      const container = layer.getContainer();
      expect(container.label).toBe("road-endpoints");
    });

    it("has no selected road by default", () => {
      expect(layer.getSelectedRoad()).toBeNull();
    });
  });

  describe("setSelectedRoad", () => {
    it("stores the selected road", () => {
      layer.setSelectedRoad(testRoad);
      expect(layer.getSelectedRoad()).toBe(testRoad);
    });

    it("clears selection when set to null", () => {
      layer.setSelectedRoad(testRoad);
      layer.setSelectedRoad(null);
      expect(layer.getSelectedRoad()).toBeNull();
    });
  });

  describe("hitTest", () => {
    it("returns null when no road is selected", () => {
      expect(layer.hitTest(0, 0)).toBeNull();
    });

    it("detects hit on start endpoint", () => {
      layer.setSelectedRoad(testRoad);
      const result = layer.hitTest(0, 0);

      expect(result).not.toBeNull();
      expect(result!.endpointIndex).toBe(0);
      expect(result!.position).toEqual({ x: 0, y: 0 });
    });

    it("detects hit on end endpoint", () => {
      layer.setSelectedRoad(testRoad);
      const result = layer.hitTest(100, 100);

      expect(result).not.toBeNull();
      expect(result!.endpointIndex).toBe(1);
      expect(result!.position).toEqual({ x: 100, y: 100 });
    });

    it("detects hit within handle radius", () => {
      layer.setSelectedRoad(testRoad);
      // Hit test slightly off-center but within hit radius (12 units)
      const result = layer.hitTest(5, 5);
      expect(result).not.toBeNull();
      expect(result!.endpointIndex).toBe(0);
    });

    it("returns null when click is too far from endpoints", () => {
      layer.setSelectedRoad(testRoad);
      const result = layer.hitTest(50, 50);
      expect(result).toBeNull();
    });

    it("works with multi-point roads (start is index 0, end is last index)", () => {
      layer.setSelectedRoad(multiPointRoad);

      // Test start endpoint
      const startResult = layer.hitTest(0, 0);
      expect(startResult).not.toBeNull();
      expect(startResult!.endpointIndex).toBe(0);

      // Test end endpoint
      const endResult = layer.hitTest(150, 75);
      expect(endResult).not.toBeNull();
      expect(endResult!.endpointIndex).toBe(3);
    });
  });

  describe("isNearHandle", () => {
    it("returns false when no road is selected", () => {
      expect(layer.isNearHandle(0, 0)).toBe(false);
    });

    it("returns true when near a handle", () => {
      layer.setSelectedRoad(testRoad);
      expect(layer.isNearHandle(0, 0)).toBe(true);
      expect(layer.isNearHandle(100, 100)).toBe(true);
    });

    it("returns false when not near any handle", () => {
      layer.setSelectedRoad(testRoad);
      expect(layer.isNearHandle(50, 50)).toBe(false);
    });
  });

  describe("drag preview", () => {
    it("accepts drag preview state", () => {
      layer.setSelectedRoad(testRoad);
      expect(() => {
        layer.setDragPreview({
          roadId: "road-1",
          endpointIndex: 0,
          currentPosition: { x: 25, y: 25 },
          isSnapped: false,
        });
      }).not.toThrow();
    });

    it("clears drag preview when set to null", () => {
      layer.setSelectedRoad(testRoad);
      layer.setDragPreview({
        roadId: "road-1",
        endpointIndex: 0,
        currentPosition: { x: 25, y: 25 },
        isSnapped: false,
      });
      expect(() => layer.setDragPreview(null)).not.toThrow();
    });

    it("handles snapped state", () => {
      layer.setSelectedRoad(testRoad);
      expect(() => {
        layer.setDragPreview({
          roadId: "road-1",
          endpointIndex: 0,
          currentPosition: { x: 25, y: 25 },
          isSnapped: true,
        });
      }).not.toThrow();
    });
  });

  describe("setHoveredEndpoint", () => {
    it("accepts hovered endpoint index", () => {
      layer.setSelectedRoad(testRoad);
      expect(() => layer.setHoveredEndpoint(0)).not.toThrow();
      expect(() => layer.setHoveredEndpoint(1)).not.toThrow();
    });

    it("clears hover state when set to null", () => {
      layer.setSelectedRoad(testRoad);
      layer.setHoveredEndpoint(0);
      expect(() => layer.setHoveredEndpoint(null)).not.toThrow();
    });
  });

  describe("updateAnimation", () => {
    it("does not throw when updating animation", () => {
      layer.setSelectedRoad(testRoad);
      layer.setDragPreview({
        roadId: "road-1",
        endpointIndex: 0,
        currentPosition: { x: 25, y: 25 },
        isSnapped: true,
      });
      expect(() => layer.updateAnimation(16)).not.toThrow(); // ~60fps frame
    });
  });
});
