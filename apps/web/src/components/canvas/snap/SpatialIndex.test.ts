import { describe, it, expect, beforeEach } from "vitest";
import { SpatialIndex } from "./SpatialIndex";
import type { SnapLineSegment } from "./types";

describe("SpatialIndex", () => {
  let index: SpatialIndex;

  beforeEach(() => {
    index = new SpatialIndex(50); // 50 unit cell size
  });

  describe("insert and query", () => {
    it("returns empty array when no segments inserted", () => {
      const result = index.query({ x: 100, y: 100 }, 20);
      expect(result).toHaveLength(0);
    });

    it("returns segment within query radius", () => {
      const segment: SnapLineSegment = {
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        geometryId: "seg1",
        geometryType: "test",
      };
      index.insert(segment);

      const result = index.query({ x: 50, y: 10 }, 20);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(segment);
    });

    it("returns multiple segments", () => {
      const seg1: SnapLineSegment = {
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        geometryId: "seg1",
        geometryType: "test",
      };
      const seg2: SnapLineSegment = {
        p1: { x: 0, y: 20 },
        p2: { x: 100, y: 20 },
        geometryId: "seg2",
        geometryType: "test",
      };
      index.insert(seg1);
      index.insert(seg2);

      const result = index.query({ x: 50, y: 10 }, 30);
      expect(result).toHaveLength(2);
    });

    it("does not return segments outside radius", () => {
      const segment: SnapLineSegment = {
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        geometryId: "seg1",
        geometryType: "test",
      };
      index.insert(segment);

      const result = index.query({ x: 50, y: 200 }, 20);
      expect(result).toHaveLength(0);
    });

    it("handles diagonal segments", () => {
      const segment: SnapLineSegment = {
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 100 },
        geometryId: "diagonal",
        geometryType: "test",
      };
      index.insert(segment);

      const result = index.query({ x: 50, y: 50 }, 20);
      expect(result).toHaveLength(1);
    });

    it("insertAll adds multiple segments", () => {
      const segments: SnapLineSegment[] = [
        { p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 }, geometryId: "s1", geometryType: "test" },
        { p1: { x: 0, y: 50 }, p2: { x: 50, y: 50 }, geometryId: "s2", geometryType: "test" },
        { p1: { x: 0, y: 100 }, p2: { x: 50, y: 100 }, geometryId: "s3", geometryType: "test" },
      ];
      index.insertAll(segments);

      const result = index.query({ x: 25, y: 50 }, 60);
      expect(result).toHaveLength(3);
    });
  });

  describe("clear", () => {
    it("removes all segments", () => {
      index.insert({
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        geometryId: "seg",
        geometryType: "test",
      });
      index.clear();

      const result = index.query({ x: 50, y: 0 }, 20);
      expect(result).toHaveLength(0);
    });

    it("clears bounds", () => {
      index.insert({
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 100 },
        geometryId: "seg",
        geometryType: "test",
      });
      expect(index.getBounds()).not.toBeNull();

      index.clear();
      expect(index.getBounds()).toBeNull();
    });
  });

  describe("bounds", () => {
    it("returns null when empty", () => {
      expect(index.getBounds()).toBeNull();
    });

    it("calculates bounds from single segment", () => {
      index.insert({
        p1: { x: 10, y: 20 },
        p2: { x: 50, y: 80 },
        geometryId: "seg",
        geometryType: "test",
      });

      const bounds = index.getBounds();
      expect(bounds).toEqual({
        minX: 10,
        minY: 20,
        maxX: 50,
        maxY: 80,
      });
    });

    it("expands bounds with additional segments", () => {
      index.insert({
        p1: { x: 10, y: 20 },
        p2: { x: 50, y: 80 },
        geometryId: "seg1",
        geometryType: "test",
      });
      index.insert({
        p1: { x: 5, y: 100 },
        p2: { x: 60, y: 10 },
        geometryId: "seg2",
        geometryType: "test",
      });

      const bounds = index.getBounds();
      expect(bounds).toEqual({
        minX: 5,
        minY: 10,
        maxX: 60,
        maxY: 100,
      });
    });
  });

  describe("stats", () => {
    it("reports cell count", () => {
      expect(index.getCellCount()).toBe(0);

      index.insert({
        p1: { x: 0, y: 0 },
        p2: { x: 10, y: 0 },
        geometryId: "seg",
        geometryType: "test",
      });

      expect(index.getCellCount()).toBeGreaterThan(0);
    });

    it("reports segment reference count", () => {
      expect(index.getSegmentReferenceCount()).toBe(0);

      // A segment spanning multiple cells will have multiple references
      index.insert({
        p1: { x: 0, y: 0 },
        p2: { x: 200, y: 0 },
        geometryId: "seg",
        geometryType: "test",
      });

      // With 50 unit cells, a 200 unit segment should span ~4-5 cells
      expect(index.getSegmentReferenceCount()).toBeGreaterThanOrEqual(4);
    });
  });

  describe("deduplication", () => {
    it("returns each segment only once per query", () => {
      // A segment that spans multiple cells
      const segment: SnapLineSegment = {
        p1: { x: 0, y: 0 },
        p2: { x: 200, y: 0 },
        geometryId: "long-seg",
        geometryType: "test",
      };
      index.insert(segment);

      // Query with radius that covers multiple cells
      const result = index.query({ x: 100, y: 0 }, 100);
      expect(result).toHaveLength(1);
    });
  });
});
