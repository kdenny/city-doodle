/**
 * Tests for path simplification utilities.
 */

import { describe, it, expect } from "vitest";
import {
  douglasPeucker,
  simplifyPath,
  shouldSamplePoint,
} from "./pathSimplification";
import type { Point } from "./layers";

describe("pathSimplification", () => {
  describe("douglasPeucker", () => {
    it("returns empty array for empty input", () => {
      expect(douglasPeucker([], 1)).toEqual([]);
    });

    it("returns single point for single point input", () => {
      const points: Point[] = [{ x: 0, y: 0 }];
      expect(douglasPeucker(points, 1)).toEqual(points);
    });

    it("returns both points for two-point input", () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ];
      expect(douglasPeucker(points, 1)).toEqual(points);
    });

    it("removes collinear points within tolerance", () => {
      // Three points on a line
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ];
      const result = douglasPeucker(points, 1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ x: 0, y: 0 });
      expect(result[1]).toEqual({ x: 10, y: 0 });
    });

    it("preserves points outside tolerance", () => {
      // Triangle shape - middle point is 5 units from line
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 },
      ];
      const result = douglasPeucker(points, 2);
      expect(result).toHaveLength(3);
    });

    it("simplifies complex path", () => {
      // A wavy line that can be simplified
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 2, y: 0.5 },
        { x: 4, y: 0 },
        { x: 6, y: 0.5 },
        { x: 8, y: 0 },
        { x: 10, y: 0.5 },
        { x: 12, y: 0 },
      ];
      const result = douglasPeucker(points, 1);
      expect(result.length).toBeLessThan(points.length);
      // Should at least keep first and last
      expect(result[0]).toEqual(points[0]);
      expect(result[result.length - 1]).toEqual(points[points.length - 1]);
    });
  });

  describe("simplifyPath", () => {
    it("returns short paths unchanged", () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 },
      ];
      expect(simplifyPath(points)).toEqual(points);
    });

    it("simplifies longer paths", () => {
      // Create a path with 100 points in a slightly wavy line
      const points: Point[] = [];
      for (let i = 0; i < 100; i++) {
        points.push({
          x: i * 10,
          y: Math.sin(i * 0.1) * 2,
        });
      }
      const result = simplifyPath(points);
      expect(result.length).toBeLessThan(points.length);
      // Default maxVertices is 50
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it("respects maxVertices parameter", () => {
      // Create a complex path
      const points: Point[] = [];
      for (let i = 0; i < 200; i++) {
        const angle = (i / 200) * Math.PI * 4;
        points.push({
          x: Math.cos(angle) * 100 + i,
          y: Math.sin(angle) * 50,
        });
      }
      const result = simplifyPath(points, 3, 20);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it("preserves first and last points", () => {
      const points: Point[] = [];
      for (let i = 0; i < 50; i++) {
        points.push({ x: i * 2, y: Math.random() * 10 });
      }
      const result = simplifyPath(points);
      expect(result[0]).toEqual(points[0]);
      expect(result[result.length - 1]).toEqual(points[points.length - 1]);
    });
  });

  describe("shouldSamplePoint", () => {
    it("returns true for null lastPoint", () => {
      expect(shouldSamplePoint(null, { x: 0, y: 0 })).toBe(true);
    });

    it("returns true when distance exceeds threshold", () => {
      const lastPoint: Point = { x: 0, y: 0 };
      const newPoint: Point = { x: 10, y: 0 };
      expect(shouldSamplePoint(lastPoint, newPoint, 5)).toBe(true);
    });

    it("returns false when distance is below threshold", () => {
      const lastPoint: Point = { x: 0, y: 0 };
      const newPoint: Point = { x: 2, y: 2 };
      expect(shouldSamplePoint(lastPoint, newPoint, 5)).toBe(false);
    });

    it("returns true when distance equals threshold", () => {
      const lastPoint: Point = { x: 0, y: 0 };
      const newPoint: Point = { x: 5, y: 0 };
      expect(shouldSamplePoint(lastPoint, newPoint, 5)).toBe(true);
    });

    it("uses default minDistance of 5", () => {
      const lastPoint: Point = { x: 0, y: 0 };
      // Distance of 3 should be below default threshold
      expect(shouldSamplePoint(lastPoint, { x: 3, y: 0 })).toBe(false);
      // Distance of 6 should be above default threshold
      expect(shouldSamplePoint(lastPoint, { x: 6, y: 0 })).toBe(true);
    });
  });
});
