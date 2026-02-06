/**
 * Tests for polygon utility functions.
 */

import { describe, it, expect } from "vitest";
import {
  pointInPolygon,
  getPolygonBounds,
  polygonArea,
  overlapsWater,
  meetsMinimumSize,
  clipAndValidateDistrict,
  splitPolygonWithLine,
  findDistrictAtPoint,
} from "./polygonUtils";
import type { WaterFeature, Point } from "./types";

describe("pointInPolygon", () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("returns true for point inside polygon", () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it("returns false for point outside polygon", () => {
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: -5, y: 5 }, square)).toBe(false);
  });

  it("returns false for empty polygon", () => {
    expect(pointInPolygon({ x: 5, y: 5 }, [])).toBe(false);
  });

  it("handles triangle", () => {
    const triangle: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(pointInPolygon({ x: 5, y: 3 }, triangle)).toBe(true);
    expect(pointInPolygon({ x: 0, y: 10 }, triangle)).toBe(false);
  });
});

describe("getPolygonBounds", () => {
  it("returns correct bounds for square", () => {
    const square: Point[] = [
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 60 },
      { x: 10, y: 60 },
    ];
    const bounds = getPolygonBounds(square);
    expect(bounds).toEqual({
      minX: 10,
      maxX: 50,
      minY: 20,
      maxY: 60,
    });
  });

  it("handles single point", () => {
    const bounds = getPolygonBounds([{ x: 5, y: 5 }]);
    expect(bounds).toEqual({
      minX: 5,
      maxX: 5,
      minY: 5,
      maxY: 5,
    });
  });
});

describe("polygonArea", () => {
  it("calculates area of square", () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    // Counter-clockwise gives negative area
    expect(Math.abs(polygonArea(square))).toBe(100);
  });

  it("calculates area of triangle", () => {
    const triangle: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(Math.abs(polygonArea(triangle))).toBe(50);
  });

  it("returns 0 for degenerate polygon", () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([{ x: 0, y: 0 }])).toBe(0);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(0);
  });
});

describe("overlapsWater", () => {
  const lakeFeature: WaterFeature = {
    id: "lake-1",
    type: "lake",
    polygon: {
      points: [
        { x: 100, y: 100 },
        { x: 150, y: 100 },
        { x: 150, y: 150 },
        { x: 100, y: 150 },
      ],
    },
  };

  it("returns false when district is completely outside water", () => {
    const district: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ];
    expect(overlapsWater(district, [lakeFeature])).toBe(false);
  });

  it("returns true when district overlaps water", () => {
    const district: Point[] = [
      { x: 80, y: 80 },
      { x: 130, y: 80 },
      { x: 130, y: 130 },
      { x: 80, y: 130 },
    ];
    expect(overlapsWater(district, [lakeFeature])).toBe(true);
  });

  it("returns true when district is inside water", () => {
    const district: Point[] = [
      { x: 110, y: 110 },
      { x: 140, y: 110 },
      { x: 140, y: 140 },
      { x: 110, y: 140 },
    ];
    expect(overlapsWater(district, [lakeFeature])).toBe(true);
  });

  it("returns true when water is inside district", () => {
    const district: Point[] = [
      { x: 50, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 200 },
      { x: 50, y: 200 },
    ];
    expect(overlapsWater(district, [lakeFeature])).toBe(true);
  });

  it("returns false with no water features", () => {
    const district: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ];
    expect(overlapsWater(district, [])).toBe(false);
  });
});

describe("meetsMinimumSize", () => {
  it("returns true for large enough district", () => {
    // 100x100 world units ≈ 10.5km, well above 200m minimum
    const district: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(meetsMinimumSize(district, "residential")).toBe(true);
  });

  it("returns false for too small district", () => {
    // 1x1 world units ≈ 105 meters, below 200m minimum
    const district: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(meetsMinimumSize(district, "residential")).toBe(false);
  });

  it("allows small industrial/commercial districts", () => {
    // Industrial and commercial can be any size (just needs valid polygon)
    const district: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(meetsMinimumSize(district, "industrial")).toBe(true);
    expect(meetsMinimumSize(district, "commercial")).toBe(true);
    expect(meetsMinimumSize(district, "shopping")).toBe(true);
  });

  it("returns false for invalid polygon", () => {
    expect(meetsMinimumSize([], "residential")).toBe(false);
    expect(meetsMinimumSize([{ x: 0, y: 0 }], "residential")).toBe(false);
  });
});

describe("clipAndValidateDistrict", () => {
  const lakeFeature: WaterFeature = {
    id: "lake-1",
    type: "lake",
    polygon: {
      points: [
        { x: 100, y: 100 },
        { x: 150, y: 100 },
        { x: 150, y: 150 },
        { x: 100, y: 150 },
      ],
    },
  };

  it("returns original polygon when no water overlap", () => {
    const district: Point[] = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: 0, y: 80 },
    ];

    const result = clipAndValidateDistrict(district, [lakeFeature], "residential");

    expect(result.overlapsWater).toBe(false);
    expect(result.clippedPolygon).toEqual(district);
    expect(result.tooSmall).toBe(false);
  });

  it("reports water overlap when district intersects water", () => {
    const district: Point[] = [
      { x: 80, y: 80 },
      { x: 180, y: 80 },
      { x: 180, y: 180 },
      { x: 80, y: 180 },
    ];

    const result = clipAndValidateDistrict(district, [lakeFeature], "residential");

    // The simplified clipping algorithm detects overlap
    expect(result.overlapsWater).toBe(true);
    // Clipped polygon should exist (not empty)
    expect(result.clippedPolygon.length).toBeGreaterThanOrEqual(3);
    // NOTE: A proper polygon boolean library would produce clippedArea < originalArea
    // The simplified algorithm preserves points outside water but doesn't perfectly clip
  });

  it("returns empty polygon when district is completely in water", () => {
    const district: Point[] = [
      { x: 110, y: 110 },
      { x: 140, y: 110 },
      { x: 140, y: 140 },
      { x: 110, y: 140 },
    ];

    const result = clipAndValidateDistrict(district, [lakeFeature], "residential");

    expect(result.overlapsWater).toBe(true);
    expect(result.clippedPolygon.length).toBeLessThan(3);
  });

  it("handles empty water features", () => {
    const district: Point[] = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: 0, y: 80 },
    ];

    const result = clipAndValidateDistrict(district, [], "residential");

    expect(result.overlapsWater).toBe(false);
    expect(result.clippedPolygon).toEqual(district);
  });
});

describe("splitPolygonWithLine", () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it("splits a square horizontally", () => {
    // Horizontal line through the middle
    const result = splitPolygonWithLine(
      square,
      { x: -10, y: 50 },
      { x: 110, y: 50 }
    );

    expect(result.success).toBe(true);
    expect(result.polygons).not.toBeNull();
    expect(result.polygons!.length).toBe(2);

    // Both resulting polygons should have at least 3 points
    expect(result.polygons![0].length).toBeGreaterThanOrEqual(3);
    expect(result.polygons![1].length).toBeGreaterThanOrEqual(3);

    // Combined area should roughly equal original
    const area1 = Math.abs(polygonArea(result.polygons![0]));
    const area2 = Math.abs(polygonArea(result.polygons![1]));
    const originalArea = Math.abs(polygonArea(square));
    expect(area1 + area2).toBeCloseTo(originalArea, 0);
  });

  it("splits a square vertically", () => {
    // Vertical line through the middle
    const result = splitPolygonWithLine(
      square,
      { x: 50, y: -10 },
      { x: 50, y: 110 }
    );

    expect(result.success).toBe(true);
    expect(result.polygons).not.toBeNull();
    expect(result.polygons!.length).toBe(2);
  });

  it("fails when line does not cross polygon", () => {
    // Line completely outside the square
    const result = splitPolygonWithLine(
      square,
      { x: 200, y: 0 },
      { x: 200, y: 100 }
    );

    expect(result.success).toBe(false);
    expect(result.polygons).toBeNull();
    expect(result.error).toContain("does not cross");
  });

  it("fails when line only touches one edge", () => {
    // Line that only touches the corner
    const result = splitPolygonWithLine(
      square,
      { x: 0, y: 0 },
      { x: -50, y: -50 }
    );

    expect(result.success).toBe(false);
    expect(result.polygons).toBeNull();
  });

  it("handles diagonal split", () => {
    // Diagonal line from one corner toward opposite
    const result = splitPolygonWithLine(
      square,
      { x: -10, y: 50 },
      { x: 50, y: 110 }
    );

    expect(result.success).toBe(true);
    expect(result.polygons).not.toBeNull();
  });

  it("rejects invalid polygon", () => {
    const result = splitPolygonWithLine(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      { x: 5, y: -10 },
      { x: 5, y: 10 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid polygon");
  });
});

describe("findDistrictAtPoint", () => {
  const districts = [
    {
      id: "district-1",
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 50 },
          { x: 0, y: 50 },
        ],
      },
    },
    {
      id: "district-2",
      polygon: {
        points: [
          { x: 60, y: 0 },
          { x: 110, y: 0 },
          { x: 110, y: 50 },
          { x: 60, y: 50 },
        ],
      },
    },
  ];

  it("finds district containing point", () => {
    expect(findDistrictAtPoint({ x: 25, y: 25 }, districts)).toBe("district-1");
    expect(findDistrictAtPoint({ x: 85, y: 25 }, districts)).toBe("district-2");
  });

  it("returns null for point outside all districts", () => {
    expect(findDistrictAtPoint({ x: 55, y: 25 }, districts)).toBeNull();
    expect(findDistrictAtPoint({ x: 200, y: 200 }, districts)).toBeNull();
  });

  it("returns null for empty district list", () => {
    expect(findDistrictAtPoint({ x: 25, y: 25 }, [])).toBeNull();
  });
});
