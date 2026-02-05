/**
 * Tests for TransitLineDrawingLayer.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TransitLineDrawingLayer, type TransitLineDrawingState } from "./TransitLineDrawingLayer";

describe("TransitLineDrawingLayer", () => {
  let layer: TransitLineDrawingLayer;

  beforeEach(() => {
    layer = new TransitLineDrawingLayer();
  });

  describe("constructor", () => {
    it("should create a container with correct label", () => {
      const container = layer.getContainer();
      expect(container.label).toBe("transit-line-drawing");
    });

    it("should have child containers for different elements", () => {
      const container = layer.getContainer();
      expect(container.children.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("setState", () => {
    it("should handle empty state without errors", () => {
      const state: TransitLineDrawingState = {
        isDrawing: false,
        firstStation: null,
        connectedStations: [],
        previewPosition: null,
        hoveredStation: null,
        lineColor: "#B22222",
      };

      expect(() => layer.setState(state)).not.toThrow();
    });

    it("should handle state with first station", () => {
      const state: TransitLineDrawingState = {
        isDrawing: true,
        firstStation: { id: "station-a", position: { x: 100, y: 100 } },
        connectedStations: [{ id: "station-a", position: { x: 100, y: 100 } }],
        previewPosition: null,
        hoveredStation: null,
        lineColor: "#B22222",
      };

      expect(() => layer.setState(state)).not.toThrow();
    });

    it("should handle state with preview line", () => {
      const state: TransitLineDrawingState = {
        isDrawing: true,
        firstStation: { id: "station-a", position: { x: 100, y: 100 } },
        connectedStations: [{ id: "station-a", position: { x: 100, y: 100 } }],
        previewPosition: { x: 200, y: 200 },
        hoveredStation: null,
        lineColor: "#2E8B57",
      };

      expect(() => layer.setState(state)).not.toThrow();
    });

    it("should handle state with hovered station", () => {
      const state: TransitLineDrawingState = {
        isDrawing: true,
        firstStation: { id: "station-a", position: { x: 100, y: 100 } },
        connectedStations: [{ id: "station-a", position: { x: 100, y: 100 } }],
        previewPosition: { x: 200, y: 200 },
        hoveredStation: { id: "station-b", position: { x: 200, y: 200 } },
        lineColor: "#4169E1",
      };

      expect(() => layer.setState(state)).not.toThrow();
    });

    it("should handle multiple connected stations", () => {
      const state: TransitLineDrawingState = {
        isDrawing: true,
        firstStation: { id: "station-c", position: { x: 300, y: 300 } },
        connectedStations: [
          { id: "station-a", position: { x: 100, y: 100 } },
          { id: "station-b", position: { x: 200, y: 200 } },
          { id: "station-c", position: { x: 300, y: 300 } },
        ],
        previewPosition: null,
        hoveredStation: null,
        lineColor: "#DAA520",
      };

      expect(() => layer.setState(state)).not.toThrow();
    });
  });

  describe("findNearestStation", () => {
    it("should find station within threshold", () => {
      const stations = [
        { id: "station-a", position: { x: 100, y: 100 } },
        { id: "station-b", position: { x: 200, y: 200 } },
      ];

      const result = layer.findNearestStation({ x: 110, y: 105 }, stations, 30);

      expect(result).not.toBeNull();
      expect(result?.id).toBe("station-a");
    });

    it("should return null if no station within threshold", () => {
      const stations = [
        { id: "station-a", position: { x: 100, y: 100 } },
        { id: "station-b", position: { x: 200, y: 200 } },
      ];

      const result = layer.findNearestStation({ x: 500, y: 500 }, stations, 30);

      expect(result).toBeNull();
    });

    it("should return the nearest station when multiple are in range", () => {
      const stations = [
        { id: "station-a", position: { x: 100, y: 100 } },
        { id: "station-b", position: { x: 120, y: 100 } },
      ];

      const result = layer.findNearestStation({ x: 115, y: 100 }, stations, 30);

      expect(result).not.toBeNull();
      expect(result?.id).toBe("station-b");
    });

    it("should handle empty stations array", () => {
      const result = layer.findNearestStation({ x: 100, y: 100 }, [], 30);

      expect(result).toBeNull();
    });
  });

  describe("setVisible", () => {
    it("should set container visibility", () => {
      layer.setVisible(false);
      expect(layer.getContainer().visible).toBe(false);

      layer.setVisible(true);
      expect(layer.getContainer().visible).toBe(true);
    });
  });

  describe("destroy", () => {
    it("should not throw when destroyed", () => {
      expect(() => layer.destroy()).not.toThrow();
    });
  });
});
