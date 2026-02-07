import { describe, it, expect } from "vitest";
import {
  angleDiffFromGrid,
  findDistrictsCrossedByArterial,
  validateDiagonalForDistrict,
  splitGridStreetsAtArterial,
} from "./diagonalArterialValidator";
import type { District, Road, Point } from "./types";

// Helper to create a simple square district polygon
function makeDistrict(id: string, cx: number, cy: number, size: number, gridAngle = 0): District {
  const half = size / 2;
  return {
    id,
    type: "residential",
    name: `District ${id}`,
    polygon: {
      points: [
        { x: cx - half, y: cy - half },
        { x: cx + half, y: cy - half },
        { x: cx + half, y: cy + half },
        { x: cx - half, y: cy + half },
      ],
    },
    gridAngle,
  };
}

// Helper to create a road
function makeRoad(
  id: string,
  points: Point[],
  roadClass: "arterial" | "local" | "collector" = "local"
): Road {
  return { id, roadClass, line: { points } };
}

describe("diagonalArterialValidator", () => {
  describe("angleDiffFromGrid", () => {
    it("returns 0 for same angle", () => {
      expect(angleDiffFromGrid(0.5, 0.5)).toBeCloseTo(0);
    });

    it("returns correct angle for 45° difference", () => {
      expect(angleDiffFromGrid(Math.PI / 4, 0)).toBeCloseTo(Math.PI / 4);
    });

    it("handles grid symmetry (90° = 0°)", () => {
      expect(angleDiffFromGrid(Math.PI / 2, 0)).toBeCloseTo(0, 5);
    });

    it("handles near-perpendicular as small angle", () => {
      // 80° from grid → 10° from nearest grid axis
      const angle = (80 * Math.PI) / 180;
      expect(angleDiffFromGrid(angle, 0)).toBeCloseTo((10 * Math.PI) / 180, 2);
    });
  });

  describe("findDistrictsCrossedByArterial", () => {
    const district = makeDistrict("d1", 50, 50, 40);

    it("finds district when arterial passes through", () => {
      const arterial = [
        { x: 30, y: 50 },
        { x: 70, y: 50 },
      ];
      const result = findDistrictsCrossedByArterial(arterial, [district]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("d1");
    });

    it("finds district when arterial starts outside and crosses boundary", () => {
      const arterial = [
        { x: 0, y: 50 },
        { x: 50, y: 50 },
      ];
      const result = findDistrictsCrossedByArterial(arterial, [district]);
      expect(result).toHaveLength(1);
    });

    it("returns empty when arterial misses district", () => {
      const arterial = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ];
      const result = findDistrictsCrossedByArterial(arterial, [district]);
      expect(result).toHaveLength(0);
    });

    it("finds multiple crossed districts", () => {
      const d1 = makeDistrict("d1", 50, 50, 40);
      const d2 = makeDistrict("d2", 150, 50, 40);
      const arterial = [
        { x: 40, y: 50 },
        { x: 160, y: 50 },
      ];
      const result = findDistrictsCrossedByArterial(arterial, [d1, d2]);
      expect(result).toHaveLength(2);
    });
  });

  describe("validateDiagonalForDistrict", () => {
    it("identifies diagonal arterial at 45°", () => {
      const district = makeDistrict("d1", 50, 50, 40, 0);
      const arterial = [
        { x: 30, y: 30 },
        { x: 70, y: 70 },
      ]; // 45° angle
      const result = validateDiagonalForDistrict(arterial, district, []);
      expect(result.isDiagonal).toBe(true);
      expect(result.angleDeg).toBe(45);
      expect(result.warning).toBeNull();
    });

    it("rejects near-grid-aligned arterial (< 15°)", () => {
      const district = makeDistrict("d1", 50, 50, 40, 0);
      // ~10° angle
      const arterial = [
        { x: 0, y: 0 },
        { x: 100, y: 17.6 },
      ];
      const result = validateDiagonalForDistrict(arterial, district, []);
      expect(result.isDiagonal).toBe(false);
    });

    it("warns when district already has 2 diagonals", () => {
      const district = makeDistrict("d1", 50, 50, 40, 0);
      // Two existing diagonal arterials passing through the district
      const existingRoads: Road[] = [
        makeRoad("ext-1", [{ x: 35, y: 35 }, { x: 65, y: 65 }], "arterial"),
        makeRoad("ext-2", [{ x: 35, y: 65 }, { x: 65, y: 35 }], "arterial"),
      ];
      const newArterial = [
        { x: 30, y: 40 },
        { x: 70, y: 60 },
      ];
      const result = validateDiagonalForDistrict(newArterial, district, existingRoads);
      expect(result.isDiagonal).toBe(true);
      expect(result.warning).toContain("already has 2 diagonal");
    });

    it("allows diagonal when district has fewer than 2", () => {
      const district = makeDistrict("d1", 50, 50, 40, 0);
      const existingRoads: Road[] = [
        makeRoad("ext-1", [{ x: 35, y: 35 }, { x: 65, y: 65 }], "arterial"),
      ];
      const newArterial = [
        { x: 35, y: 65 },
        { x: 65, y: 35 },
      ];
      const result = validateDiagonalForDistrict(newArterial, district, existingRoads);
      expect(result.isDiagonal).toBe(true);
      expect(result.warning).toBeNull();
    });

    it("does not count district-internal roads as diagonals", () => {
      const district = makeDistrict("d1", 50, 50, 40, 0);
      // Roads with IDs starting with district ID are generated grid roads
      const existingRoads: Road[] = [
        makeRoad("d1-street-1", [{ x: 35, y: 35 }, { x: 65, y: 65 }], "arterial"),
        makeRoad("d1-street-2", [{ x: 35, y: 65 }, { x: 65, y: 35 }], "arterial"),
      ];
      const newArterial = [
        { x: 30, y: 40 },
        { x: 70, y: 60 },
      ];
      const result = validateDiagonalForDistrict(newArterial, district, existingRoads);
      expect(result.isDiagonal).toBe(true);
      // No warning because district-internal roads don't count
      expect(result.warning).toBeNull();
    });
  });

  describe("splitGridStreetsAtArterial", () => {
    it("splits a crossing local street into two halves", () => {
      const districtId = "d1";
      // Horizontal local street crossing through the center
      const roads: Road[] = [
        makeRoad("d1-street-h", [{ x: 30, y: 50 }, { x: 70, y: 50 }], "local"),
      ];
      // Diagonal arterial from bottom-left to top-right
      const arterial = [
        { x: 40, y: 70 },
        { x: 60, y: 30 },
      ];

      const result = splitGridStreetsAtArterial(districtId, roads, arterial);
      expect(result.removedRoadIds).toContain("d1-street-h");
      expect(result.newRoads).toHaveLength(2);
      // Both halves should have the same road class
      expect(result.newRoads[0].roadClass).toBe("local");
      expect(result.newRoads[1].roadClass).toBe("local");
    });

    it("does not split roads that don't intersect the arterial", () => {
      const districtId = "d1";
      const roads: Road[] = [
        makeRoad("d1-street-h", [{ x: 30, y: 50 }, { x: 70, y: 50 }], "local"),
      ];
      // Arterial that doesn't cross the road
      const arterial = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ];

      const result = splitGridStreetsAtArterial(districtId, roads, arterial);
      expect(result.removedRoadIds).toHaveLength(0);
      expect(result.newRoads).toHaveLength(0);
    });

    it("only splits roads belonging to the district", () => {
      const districtId = "d1";
      const roads: Road[] = [
        makeRoad("d1-street-h", [{ x: 30, y: 50 }, { x: 70, y: 50 }], "local"),
        makeRoad("other-road", [{ x: 30, y: 50 }, { x: 70, y: 50 }], "local"),
      ];
      const arterial = [
        { x: 50, y: 30 },
        { x: 50, y: 70 },
      ];

      const result = splitGridStreetsAtArterial(districtId, roads, arterial);
      expect(result.removedRoadIds).toContain("d1-street-h");
      expect(result.removedRoadIds).not.toContain("other-road");
    });

    it("handles multiple intersections on a multi-segment road", () => {
      const districtId = "d1";
      // Zigzag road
      const roads: Road[] = [
        makeRoad("d1-zigzag", [
          { x: 30, y: 40 },
          { x: 50, y: 60 },
          { x: 70, y: 40 },
        ], "collector"),
      ];
      // Horizontal arterial crossing both segments
      const arterial = [
        { x: 20, y: 50 },
        { x: 80, y: 50 },
      ];

      const result = splitGridStreetsAtArterial(districtId, roads, arterial);
      expect(result.removedRoadIds).toContain("d1-zigzag");
      // Should create 3 segments (split at 2 intersection points)
      expect(result.newRoads).toHaveLength(3);
    });

    it("returns empty when no roads exist", () => {
      const result = splitGridStreetsAtArterial("d1", [], [{ x: 0, y: 0 }, { x: 10, y: 10 }]);
      expect(result.removedRoadIds).toHaveLength(0);
      expect(result.newRoads).toHaveLength(0);
    });

    it("preserves collector road class in split segments", () => {
      const districtId = "d1";
      const roads: Road[] = [
        makeRoad("d1-collector-1", [{ x: 30, y: 50 }, { x: 70, y: 50 }], "collector"),
      ];
      const arterial = [
        { x: 50, y: 30 },
        { x: 50, y: 70 },
      ];

      const result = splitGridStreetsAtArterial(districtId, roads, arterial);
      expect(result.newRoads[0].roadClass).toBe("collector");
      expect(result.newRoads[1].roadClass).toBe("collector");
    });
  });
});
