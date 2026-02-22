import { describe, it, expect } from "vitest";
import { detectWaterfrontRoads, applyWaterfrontTypes } from "./waterfrontDetection";
import type { Road, TerrainData, WaterFeature, RiverFeature, BeachFeature } from "./types";

/**
 * Tests for waterfront road detection (CITY-181).
 */

// Helper to create an empty terrain data
function emptyTerrain(): TerrainData {
  return {
    water: [],
    coastlines: [],
    rivers: [],
    contours: [],
    beaches: [],
    barrierIslands: [],
    tidalFlats: [],
    duneRidges: [],
    inlets: [],
  };
}

describe("detectWaterfrontRoads", () => {
  it("returns empty result when no roads provided", () => {
    const result = detectWaterfrontRoads([], null);
    expect(result.waterfrontRoads.size).toBe(0);
    expect(result.riverfrontCount).toBe(0);
    expect(result.boardwalkCount).toBe(0);
  });

  it("returns empty result when no terrain data provided", () => {
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: {
          points: [
            { x: 0, y: 50 },
            { x: 100, y: 50 },
          ],
        },
      },
    ];
    const result = detectWaterfrontRoads(roads, null);
    expect(result.waterfrontRoads.size).toBe(0);
  });

  it("returns empty result when terrain has no water", () => {
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: {
          points: [
            { x: 0, y: 50 },
            { x: 100, y: 50 },
          ],
        },
      },
    ];
    const result = detectWaterfrontRoads(roads, emptyTerrain());
    expect(result.waterfrontRoads.size).toBe(0);
  });

  it("detects riverfront drive when road runs parallel to water polygon", () => {
    // Water polygon on the left side (x: 0-10), road runs at x=12 (within threshold of 5)
    const water: WaterFeature = {
      id: "lake-1",
      type: "lake",
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 100 },
          { x: 0, y: 100 },
        ],
      },
    };
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: {
          points: [
            { x: 12, y: 10 },
            { x: 12, y: 90 },
          ],
        },
      },
    ];
    const terrain = { ...emptyTerrain(), water: [water] };

    const result = detectWaterfrontRoads(roads, terrain);
    expect(result.waterfrontRoads.get("road-1")).toBe("riverfront_drive");
    expect(result.riverfrontCount).toBe(1);
  });

  it("detects riverfront drive when road runs parallel to a river", () => {
    // River runs vertically at x=50, road runs at x=52 (within threshold)
    const river: RiverFeature = {
      id: "river-1",
      width: 6,
      line: {
        points: [
          { x: 50, y: 0 },
          { x: 50, y: 100 },
        ],
      },
    };
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "collector",
        line: {
          points: [
            { x: 56, y: 10 },
            { x: 56, y: 90 },
          ],
        },
      },
    ];
    const terrain = { ...emptyTerrain(), rivers: [river] };

    const result = detectWaterfrontRoads(roads, terrain);
    expect(result.waterfrontRoads.get("road-1")).toBe("riverfront_drive");
    expect(result.riverfrontCount).toBe(1);
  });

  it("does not classify road far from water as waterfront", () => {
    const water: WaterFeature = {
      id: "lake-1",
      type: "lake",
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 100 },
          { x: 0, y: 100 },
        ],
      },
    };
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: {
          points: [
            { x: 50, y: 10 }, // Far from water
            { x: 50, y: 90 },
          ],
        },
      },
    ];
    const terrain = { ...emptyTerrain(), water: [water] };

    const result = detectWaterfrontRoads(roads, terrain);
    expect(result.waterfrontRoads.size).toBe(0);
  });

  it("detects boardwalk for trail near beach", () => {
    const beach: BeachFeature = {
      id: "beach-1",
      beachType: "ocean",
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 5 },
          { x: 0, y: 5 },
        ],
      },
    };
    // Ocean polygon adjacent to beach
    const water: WaterFeature = {
      id: "ocean-1",
      type: "ocean",
      polygon: {
        points: [
          { x: 0, y: -100 },
          { x: 100, y: -100 },
          { x: 100, y: 0 },
          { x: 0, y: 0 },
        ],
      },
    };
    const roads: Road[] = [
      {
        id: "trail-1",
        roadClass: "trail",
        line: {
          points: [
            { x: 10, y: 6 }, // Just outside the beach polygon, within boardwalk threshold
            { x: 90, y: 6 },
          ],
        },
      },
    ];
    const terrain = { ...emptyTerrain(), water: [water], beaches: [beach] };

    const result = detectWaterfrontRoads(roads, terrain);
    expect(result.waterfrontRoads.get("trail-1")).toBe("boardwalk");
    expect(result.boardwalkCount).toBe(1);
  });

  it("detects boardwalk for local road near beach", () => {
    const beach: BeachFeature = {
      id: "beach-1",
      beachType: "ocean",
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 5 },
          { x: 0, y: 5 },
        ],
      },
    };
    const water: WaterFeature = {
      id: "ocean-1",
      type: "ocean",
      polygon: {
        points: [
          { x: 0, y: -100 },
          { x: 100, y: -100 },
          { x: 100, y: 0 },
          { x: 0, y: 0 },
        ],
      },
    };
    const roads: Road[] = [
      {
        id: "local-1",
        roadClass: "local",
        line: {
          points: [
            { x: 10, y: 6 },
            { x: 90, y: 6 },
          ],
        },
      },
    ];
    const terrain = { ...emptyTerrain(), water: [water], beaches: [beach] };

    const result = detectWaterfrontRoads(roads, terrain);
    expect(result.waterfrontRoads.get("local-1")).toBe("boardwalk");
    expect(result.boardwalkCount).toBe(1);
  });

  it("does not classify road as waterfront when only partially near water", () => {
    // Water only covers a small portion of the road
    const water: WaterFeature = {
      id: "lake-1",
      type: "lake",
      polygon: {
        points: [
          { x: 0, y: 45 },
          { x: 10, y: 45 },
          { x: 10, y: 55 },
          { x: 0, y: 55 },
        ],
      },
    };
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: {
          points: [
            { x: 12, y: 0 }, // Long road, only small portion near water
            { x: 12, y: 200 },
          ],
        },
      },
    ];
    const terrain = { ...emptyTerrain(), water: [water] };

    // With default minWaterfrontFraction of 0.4, a road mostly far from water should not qualify
    const result = detectWaterfrontRoads(roads, terrain);
    expect(result.waterfrontRoads.size).toBe(0);
  });

  it("classifies multiple roads independently", () => {
    const water: WaterFeature = {
      id: "lake-1",
      type: "lake",
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 100 },
          { x: 0, y: 100 },
        ],
      },
    };
    const roads: Road[] = [
      {
        id: "near-road",
        roadClass: "arterial",
        line: {
          points: [
            { x: 12, y: 10 }, // Near water
            { x: 12, y: 90 },
          ],
        },
      },
      {
        id: "far-road",
        roadClass: "arterial",
        line: {
          points: [
            { x: 50, y: 10 }, // Far from water
            { x: 50, y: 90 },
          ],
        },
      },
    ];
    const terrain = { ...emptyTerrain(), water: [water] };

    const result = detectWaterfrontRoads(roads, terrain);
    expect(result.waterfrontRoads.size).toBe(1);
    expect(result.waterfrontRoads.has("near-road")).toBe(true);
    expect(result.waterfrontRoads.has("far-road")).toBe(false);
  });

  it("respects custom threshold configuration", () => {
    const water: WaterFeature = {
      id: "lake-1",
      type: "lake",
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 100 },
          { x: 0, y: 100 },
        ],
      },
    };
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: {
          points: [
            { x: 18, y: 10 }, // 8 units from water edge — outside default 5, inside custom 10
            { x: 18, y: 90 },
          ],
        },
      },
    ];
    const terrain = { ...emptyTerrain(), water: [water] };

    // Default threshold (5) should NOT classify
    const defaultResult = detectWaterfrontRoads(roads, terrain);
    expect(defaultResult.waterfrontRoads.size).toBe(0);

    // Wider threshold (10) should classify
    const wideResult = detectWaterfrontRoads(roads, terrain, { waterfrontThreshold: 10 });
    expect(wideResult.waterfrontRoads.get("road-1")).toBe("riverfront_drive");
  });
});

describe("applyWaterfrontTypes", () => {
  it("returns same reference when no changes needed", () => {
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      },
    ];
    const result = {
      waterfrontRoads: new Map(),
      riverfrontCount: 0,
      boardwalkCount: 0,
    };

    const updated = applyWaterfrontTypes(roads, result);
    expect(updated).toBe(roads); // Same reference
  });

  it("sets waterfrontType on matching roads", () => {
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        line: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      },
      {
        id: "road-2",
        roadClass: "trail",
        line: { points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
      },
    ];
    const waterfrontRoads = new Map<string, "riverfront_drive" | "boardwalk">();
    waterfrontRoads.set("road-1", "riverfront_drive");
    waterfrontRoads.set("road-2", "boardwalk");
    const result = { waterfrontRoads, riverfrontCount: 1, boardwalkCount: 1 };

    const updated = applyWaterfrontTypes(roads, result);
    expect(updated).not.toBe(roads);
    expect(updated[0].waterfrontType).toBe("riverfront_drive");
    expect(updated[1].waterfrontType).toBe("boardwalk");
  });

  it("clears waterfrontType when road no longer qualifies", () => {
    const roads: Road[] = [
      {
        id: "road-1",
        roadClass: "arterial",
        waterfrontType: "riverfront_drive",
        line: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      },
    ];
    const result = {
      waterfrontRoads: new Map(),
      riverfrontCount: 0,
      boardwalkCount: 0,
    };

    const updated = applyWaterfrontTypes(roads, result);
    expect(updated).not.toBe(roads);
    expect(updated[0].waterfrontType).toBeUndefined();
  });
});
