import { describe, it, expect } from "vitest";
import {
  douglasPeucker,
  simplifyPolygon,
  calculateAutoEpsilon,
} from "./pathSimplification";

describe("douglasPeucker", () => {
  it("returns original points if 2 or fewer", () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    expect(douglasPeucker(points, 1)).toEqual(points);
  });

  it("simplifies a straight line to just endpoints", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ];
    const result = douglasPeucker(points, 0.1);
    expect(result).toEqual([{ x: 0, y: 0 }, { x: 4, y: 4 }]);
  });

  it("preserves points that deviate significantly", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 }, // This point deviates significantly
      { x: 10, y: 5 },
    ];
    const result = douglasPeucker(points, 1);
    // Should keep the corner point
    expect(result.length).toBeGreaterThan(2);
    expect(result).toContainEqual({ x: 5, y: 5 });
  });

  it("removes points within epsilon threshold", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0.1 }, // Very close to the line
      { x: 10, y: 0 },
    ];
    const result = douglasPeucker(points, 0.5);
    expect(result).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
  });
});

describe("simplifyPolygon", () => {
  it("returns input if less than 4 points", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(simplifyPolygon(points, 1)).toEqual(points);
  });

  it("simplifies a complex polygon", () => {
    // Square with extra points on each side
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
    ];
    const result = simplifyPolygon(points, 1);
    // Should simplify to just the corners
    expect(result.length).toBeLessThan(points.length);
    expect(result.length).toBeGreaterThanOrEqual(3); // At least a valid polygon
  });

  it("maintains minimum 3 points for valid polygon", () => {
    // Even with aggressive simplification, should keep 3 points
    const points = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 0.2, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0.1 },
      { x: 10, y: 10 },
    ];
    const result = simplifyPolygon(points, 100);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});

describe("calculateAutoEpsilon", () => {
  it("returns 1 for empty or tiny arrays", () => {
    expect(calculateAutoEpsilon([])).toBe(1);
    expect(calculateAutoEpsilon([{ x: 0, y: 0 }])).toBe(1);
    expect(calculateAutoEpsilon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(1);
  });

  it("scales with bounding box size", () => {
    const smallPoints = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const largePoints = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];

    const smallEpsilon = calculateAutoEpsilon(smallPoints);
    const largeEpsilon = calculateAutoEpsilon(largePoints);

    expect(largeEpsilon).toBeGreaterThan(smallEpsilon);
  });
});
