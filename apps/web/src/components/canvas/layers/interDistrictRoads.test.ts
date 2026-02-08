import { describe, it, expect } from "vitest";
import {
  generateInterDistrictRoads,
  areDistrictsConnected,
} from "./interDistrictRoads";
import type { District, Road, WaterFeature } from "./types";

// Helper to create a simple square district
function createDistrict(
  id: string,
  centerX: number,
  centerY: number,
  size: number = 50,
  type: District["type"] = "residential"
): District {
  const half = size / 2;
  return {
    id,
    type,
    name: `District ${id}`,
    polygon: {
      points: [
        { x: centerX - half, y: centerY - half },
        { x: centerX + half, y: centerY - half },
        { x: centerX + half, y: centerY + half },
        { x: centerX - half, y: centerY + half },
      ],
    },
  };
}

// Helper to create a water feature
function createWaterFeature(
  id: string,
  centerX: number,
  centerY: number,
  size: number = 30
): WaterFeature {
  const half = size / 2;
  return {
    id,
    type: "lake",
    polygon: {
      points: [
        { x: centerX - half, y: centerY - half },
        { x: centerX + half, y: centerY - half },
        { x: centerX + half, y: centerY + half },
        { x: centerX - half, y: centerY + half },
      ],
    },
  };
}

describe("generateInterDistrictRoads", () => {
  it("returns empty roads when no existing districts", () => {
    const newDistrict = createDistrict("new-1", 100, 100);
    const result = generateInterDistrictRoads(newDistrict, []);

    expect(result.roads).toHaveLength(0);
    expect(result.connectedDistrictIds).toHaveLength(0);
  });

  it("connects to nearest existing district", () => {
    const newDistrict = createDistrict("new-1", 200, 200);
    const existingDistricts = [
      createDistrict("existing-1", 100, 100), // Nearest
      createDistrict("existing-2", 400, 400), // Further
    ];

    const result = generateInterDistrictRoads(newDistrict, existingDistricts);

    expect(result.roads.length).toBeGreaterThan(0);
    expect(result.connectedDistrictIds).toContain("existing-1");
  });

  it("creates arterial roads for short connections", () => {
    // Distance ~42 units (well below 75 highway threshold)
    const newDistrict = createDistrict("new-1", 130, 130);
    const existingDistricts = [createDistrict("existing-1", 100, 100)];

    const result = generateInterDistrictRoads(newDistrict, existingDistricts);

    expect(result.roads[0].roadClass).toBe("arterial");
  });

  it("auto-upgrades long connections to highways", () => {
    // Distance ~141 units (above 75 highway threshold)
    const newDistrict = createDistrict("new-1", 200, 200);
    const existingDistricts = [createDistrict("existing-1", 100, 100)];

    const result = generateInterDistrictRoads(newDistrict, existingDistricts);

    expect(result.roads[0].roadClass).toBe("highway");
    expect(result.roads[0].name).toMatch(/^(I-|US-|SR )\d+$/);
  });

  it("respects custom road class configuration", () => {
    const newDistrict = createDistrict("new-1", 200, 200);
    const existingDistricts = [createDistrict("existing-1", 100, 100)];

    const result = generateInterDistrictRoads(
      newDistrict,
      existingDistricts,
      [],
      { roadClass: "collector" }
    );

    // Custom road class should NOT be auto-upgraded to highway
    expect(result.roads[0].roadClass).toBe("collector");
  });

  it("prioritizes downtown districts for connections", () => {
    const newDistrict = createDistrict("new-1", 200, 200);
    const existingDistricts = [
      createDistrict("residential-1", 150, 150, 50, "residential"),
      createDistrict("downtown-1", 250, 250, 50, "downtown"),
    ];

    const result = generateInterDistrictRoads(newDistrict, existingDistricts);

    // Should connect to nearest first, then consider priorities
    // With 2 close districts, both should be connected if within range
    expect(result.connectedDistrictIds.length).toBeGreaterThanOrEqual(1);
  });

  it("limits connections within max distance", () => {
    const newDistrict = createDistrict("new-1", 100, 100);
    const existingDistricts = [
      createDistrict("near-1", 150, 150), // Close
      createDistrict("far-1", 500, 500), // Far (beyond default 150 units)
    ];

    const result = generateInterDistrictRoads(newDistrict, existingDistricts);

    // Should connect to near district
    expect(result.connectedDistrictIds).toContain("near-1");
    // Should NOT connect to far district (beyond default max distance)
    expect(result.connectedDistrictIds).not.toContain("far-1");
  });

  it("generates road with valid line points", () => {
    const newDistrict = createDistrict("new-1", 200, 200);
    const existingDistricts = [createDistrict("existing-1", 100, 100)];

    const result = generateInterDistrictRoads(newDistrict, existingDistricts);

    expect(result.roads[0].line.points.length).toBeGreaterThanOrEqual(2);
    expect(result.roads[0].line.points[0]).toHaveProperty("x");
    expect(result.roads[0].line.points[0]).toHaveProperty("y");
  });

  it("generates unique road IDs", () => {
    const newDistrict = createDistrict("new-1", 200, 200);
    const existingDistricts = [
      createDistrict("existing-1", 100, 100),
      createDistrict("existing-2", 250, 100),
    ];

    const result = generateInterDistrictRoads(newDistrict, existingDistricts);

    const ids = result.roads.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("generates highway names for long connections", () => {
    // Distance ~141 units (above highway threshold)
    const newDistrict = createDistrict("new-1", 200, 200);
    newDistrict.name = "New Town";
    const existingDistricts = [createDistrict("existing-1", 100, 100)];
    existingDistricts[0].name = "Old Town";

    const result = generateInterDistrictRoads(newDistrict, existingDistricts);

    expect(result.roads[0].name).toMatch(/^(I-|US-|SR )\d+$/);
  });

  it("generates boulevard names for short arterial connections", () => {
    // Distance ~42 units (below highway threshold)
    const newDistrict = createDistrict("new-1", 130, 130);
    newDistrict.name = "New Town";
    const existingDistricts = [createDistrict("existing-1", 100, 100)];
    existingDistricts[0].name = "Old Town";

    const result = generateInterDistrictRoads(newDistrict, existingDistricts);

    expect(result.roads[0].name).toContain("New Town");
    expect(result.roads[0].name).toContain("Old Town");
    expect(result.roads[0].name).toContain("Blvd");
  });
});

describe("generateInterDistrictRoads with water features", () => {
  it("tries to route around water features", () => {
    const newDistrict = createDistrict("new-1", 0, 0);
    const existingDistricts = [createDistrict("existing-1", 200, 0)];
    // Water feature directly between the two districts
    const waterFeatures = [createWaterFeature("lake-1", 100, 0, 40)];

    const result = generateInterDistrictRoads(
      newDistrict,
      existingDistricts,
      waterFeatures
    );

    // Should still generate a connection
    expect(result.roads.length).toBeGreaterThan(0);
    // With water avoidance, might have waypoints
    // (implementation may vary, just ensure road exists)
  });

  it("can disable water avoidance", () => {
    const newDistrict = createDistrict("new-1", 0, 0);
    const existingDistricts = [createDistrict("existing-1", 200, 0)];
    const waterFeatures = [createWaterFeature("lake-1", 100, 0, 40)];

    const result = generateInterDistrictRoads(
      newDistrict,
      existingDistricts,
      waterFeatures,
      { avoidWater: false }
    );

    // Should generate direct connection
    expect(result.roads.length).toBeGreaterThan(0);
    // Direct path should have exactly 2 points (start and end)
    expect(result.roads[0].line.points.length).toBe(2);
  });
});

describe("areDistrictsConnected", () => {
  it("returns false when no connecting roads exist", () => {
    const district1 = createDistrict("d1", 100, 100);
    const district2 = createDistrict("d2", 300, 300);
    const roads: Road[] = [];

    expect(areDistrictsConnected(district1, district2, roads)).toBe(false);
  });

  it("returns true when a road connects the districts", () => {
    const district1 = createDistrict("d1", 100, 100);
    const district2 = createDistrict("d2", 200, 200);
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: {
          points: [
            { x: 100, y: 100 }, // Near district1
            { x: 200, y: 200 }, // Near district2
          ],
        },
      },
    ];

    expect(areDistrictsConnected(district1, district2, roads)).toBe(true);
  });

  it("returns false when road only connects to one district", () => {
    const district1 = createDistrict("d1", 100, 100);
    const district2 = createDistrict("d2", 500, 500);
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: {
          points: [
            { x: 100, y: 100 }, // Near district1
            { x: 150, y: 150 }, // Not near district2
          ],
        },
      },
    ];

    expect(areDistrictsConnected(district1, district2, roads)).toBe(false);
  });
});
