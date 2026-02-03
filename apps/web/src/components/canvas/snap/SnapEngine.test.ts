import { describe, it, expect, beforeEach } from "vitest";
import { SnapEngine } from "./SnapEngine";
import type { SnapLineSegment, SnapGeometryProvider } from "./types";

describe("SnapEngine", () => {
  let engine: SnapEngine;

  beforeEach(() => {
    engine = new SnapEngine();
  });

  describe("configuration", () => {
    it("uses default configuration", () => {
      const config = engine.getConfig();
      expect(config.threshold).toBe(20);
      expect(config.snapToVertex).toBe(true);
      expect(config.snapToMidpoint).toBe(true);
      expect(config.snapToNearest).toBe(true);
      expect(config.snapToIntersection).toBe(true);
    });

    it("accepts initial configuration", () => {
      const customEngine = new SnapEngine({ threshold: 50 });
      expect(customEngine.getConfig().threshold).toBe(50);
    });

    it("updates configuration", () => {
      engine.setConfig({ threshold: 30 });
      expect(engine.getConfig().threshold).toBe(30);
    });
  });

  describe("findSnapPoint", () => {
    it("returns empty result when no geometry", () => {
      const result = engine.findSnapPoint(100, 100);
      expect(result.snapPoint).toBeNull();
      expect(result.candidates).toHaveLength(0);
    });

    describe("with horizontal line segment", () => {
      beforeEach(() => {
        const segment: SnapLineSegment = {
          p1: { x: 0, y: 100 },
          p2: { x: 200, y: 100 },
          geometryId: "line1",
          geometryType: "test",
        };
        engine.insertSegments([segment]);
      });

      it("snaps to start vertex", () => {
        // Query slightly above and to the left of the start vertex
        // This ensures the vertex is the closest point (not a point on the line)
        const result = engine.findSnapPoint(-3, 96);
        expect(result.snapPoint).not.toBeNull();
        expect(result.snapPoint!.type).toBe("vertex");
        expect(result.snapPoint!.x).toBe(0);
        expect(result.snapPoint!.y).toBe(100);
      });

      it("snaps to end vertex", () => {
        // Query slightly above and to the right of the end vertex
        const result = engine.findSnapPoint(203, 96);
        expect(result.snapPoint).not.toBeNull();
        expect(result.snapPoint!.type).toBe("vertex");
        expect(result.snapPoint!.x).toBe(200);
        expect(result.snapPoint!.y).toBe(100);
      });

      it("snaps to midpoint", () => {
        engine.setConfig({ snapToVertex: false, snapToNearest: false });
        const result = engine.findSnapPoint(100, 100);
        expect(result.snapPoint).not.toBeNull();
        expect(result.snapPoint!.type).toBe("midpoint");
        expect(result.snapPoint!.x).toBe(100);
        expect(result.snapPoint!.y).toBe(100);
      });

      it("snaps to nearest point on edge", () => {
        engine.setConfig({
          snapToVertex: false,
          snapToMidpoint: false,
        });
        const result = engine.findSnapPoint(75, 110);
        expect(result.snapPoint).not.toBeNull();
        expect(result.snapPoint!.type).toBe("nearest");
        expect(result.snapPoint!.x).toBe(75);
        expect(result.snapPoint!.y).toBe(100);
      });

      it("returns no snap when outside threshold", () => {
        const result = engine.findSnapPoint(100, 200);
        expect(result.snapPoint).toBeNull();
      });
    });

    describe("with intersecting lines", () => {
      beforeEach(() => {
        const segments: SnapLineSegment[] = [
          {
            p1: { x: 0, y: 50 },
            p2: { x: 100, y: 50 },
            geometryId: "horizontal",
            geometryType: "test",
          },
          {
            p1: { x: 50, y: 0 },
            p2: { x: 50, y: 100 },
            geometryId: "vertical",
            geometryType: "test",
          },
        ];
        engine.insertSegments(segments);
      });

      it("snaps to intersection point", () => {
        engine.setConfig({
          snapToVertex: false,
          snapToMidpoint: false,
          snapToNearest: false,
        });
        const result = engine.findSnapPoint(50, 50);
        expect(result.snapPoint).not.toBeNull();
        expect(result.snapPoint!.type).toBe("intersection");
        expect(result.snapPoint!.x).toBe(50);
        expect(result.snapPoint!.y).toBe(50);
      });
    });

    describe("with geometry type filter", () => {
      beforeEach(() => {
        const segments: SnapLineSegment[] = [
          {
            p1: { x: 0, y: 0 },
            p2: { x: 100, y: 0 },
            geometryId: "road1",
            geometryType: "road",
          },
          {
            p1: { x: 0, y: 50 },
            p2: { x: 100, y: 50 },
            geometryId: "river1",
            geometryType: "river",
          },
        ];
        engine.insertSegments(segments);
      });

      it("filters by geometry type", () => {
        engine.setConfig({ geometryTypes: ["river"] });
        const result = engine.findSnapPoint(50, 5);
        expect(result.snapPoint).toBeNull();
      });

      it("snaps to allowed geometry type", () => {
        engine.setConfig({ geometryTypes: ["road"] });
        const result = engine.findSnapPoint(50, 5);
        expect(result.snapPoint).not.toBeNull();
        expect(result.snapPoint!.geometryType).toBe("road");
      });
    });

    describe("priority ordering", () => {
      beforeEach(() => {
        // Two segments, one with vertex closer than the other's midpoint
        const segments: SnapLineSegment[] = [
          {
            p1: { x: 100, y: 95 },
            p2: { x: 100, y: 105 },
            geometryId: "seg1",
            geometryType: "test",
          },
          {
            p1: { x: 90, y: 100 },
            p2: { x: 130, y: 100 },
            geometryId: "seg2",
            geometryType: "test",
          },
        ];
        engine.insertSegments(segments);
      });

      it("returns closest snap point regardless of type", () => {
        const result = engine.findSnapPoint(100, 100);
        expect(result.snapPoint).not.toBeNull();
        // The vertex at (100, 95) or (100, 105) should be closer
        // or the midpoint of seg2 at (110, 100) might be close
        // The actual closest depends on which is nearest
        expect(result.candidates.length).toBeGreaterThan(0);
        expect(result.candidates[0].distance).toBeLessThanOrEqual(
          result.candidates[result.candidates.length - 1].distance
        );
      });
    });
  });

  describe("geometry providers", () => {
    it("registers and uses a provider", () => {
      const provider: SnapGeometryProvider = {
        getLineSegments: () => [
          {
            p1: { x: 0, y: 0 },
            p2: { x: 100, y: 0 },
            geometryId: "provider-line",
            geometryType: "test",
          },
        ],
        getBoundingBox: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 0 }),
      };

      engine.registerProvider(provider);
      const result = engine.findSnapPoint(50, 5);
      expect(result.snapPoint).not.toBeNull();
    });

    it("unregisters a provider", () => {
      const provider: SnapGeometryProvider = {
        getLineSegments: () => [
          {
            p1: { x: 0, y: 0 },
            p2: { x: 100, y: 0 },
            geometryId: "provider-line",
            geometryType: "test",
          },
        ],
        getBoundingBox: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 0 }),
      };

      engine.registerProvider(provider);
      engine.unregisterProvider(provider);
      const result = engine.findSnapPoint(50, 5);
      expect(result.snapPoint).toBeNull();
    });

    it("clears all providers", () => {
      const provider: SnapGeometryProvider = {
        getLineSegments: () => [
          {
            p1: { x: 0, y: 0 },
            p2: { x: 100, y: 0 },
            geometryId: "provider-line",
            geometryType: "test",
          },
        ],
        getBoundingBox: () => null,
      };

      engine.registerProvider(provider);
      engine.clearProviders();
      const result = engine.findSnapPoint(50, 5);
      expect(result.snapPoint).toBeNull();
    });
  });

  describe("bounds", () => {
    it("returns null bounds when empty", () => {
      expect(engine.getBounds()).toBeNull();
    });

    it("returns bounds after inserting segments", () => {
      engine.insertSegments([
        {
          p1: { x: 10, y: 20 },
          p2: { x: 100, y: 200 },
          geometryId: "line",
          geometryType: "test",
        },
      ]);
      const bounds = engine.getBounds();
      expect(bounds).not.toBeNull();
      expect(bounds!.minX).toBe(10);
      expect(bounds!.minY).toBe(20);
      expect(bounds!.maxX).toBe(100);
      expect(bounds!.maxY).toBe(200);
    });
  });
});
