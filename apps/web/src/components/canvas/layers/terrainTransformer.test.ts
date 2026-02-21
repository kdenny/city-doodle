import { describe, it, expect } from "vitest";
import { transformTileFeatures, emptyTerrainData } from "./terrainTransformer";

// ---------------------------------------------------------------------------
// Helper to build a minimal GeoJSON FeatureCollection
// ---------------------------------------------------------------------------

function fc(...features: Record<string, unknown>[]) {
  return { type: "FeatureCollection", features };
}

function feature(
  featureType: string,
  geometry: Record<string, unknown>,
  extraProps: Record<string, unknown> = {}
) {
  return {
    type: "Feature",
    geometry,
    properties: { feature_type: featureType, ...extraProps },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("transformTileFeatures", () => {
  it("returns empty terrain for null/undefined input", () => {
    expect(transformTileFeatures(null)).toEqual(emptyTerrainData());
    expect(transformTileFeatures(undefined)).toEqual(emptyTerrainData());
  });

  it("returns empty terrain for invalid input", () => {
    expect(transformTileFeatures({})).toEqual(emptyTerrainData());
    expect(transformTileFeatures({ type: "Point" })).toEqual(emptyTerrainData());
    expect(transformTileFeatures("string")).toEqual(emptyTerrainData());
  });

  it("returns empty terrain for empty FeatureCollection", () => {
    expect(transformTileFeatures(fc())).toEqual(emptyTerrainData());
  });

  it("transforms coastline polygon into ocean water + coastline line", () => {
    const coords = [[[0, 0], [100, 0], [100, 50], [0, 50], [0, 0]]];
    const result = transformTileFeatures(
      fc(feature("coastline", { type: "Polygon", coordinates: coords }, { area: 5000 }))
    );

    expect(result.water).toHaveLength(1);
    expect(result.water[0].type).toBe("ocean");
    expect(result.water[0].id).toBe("ocean-1");
    expect(result.water[0].polygon.points).toHaveLength(5);
    expect(result.water[0].polygon.points[0]).toEqual({ x: 0, y: 0 });

    expect(result.coastlines).toHaveLength(1);
    expect(result.coastlines[0].id).toBe("coast-1");
    expect(result.coastlines[0].line.points).toHaveLength(5);
    expect(result.coastlines[0].line.width).toBe(2);
  });

  it("transforms lake polygon with metrics and lakeType", () => {
    const coords = [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]];
    const result = transformTileFeatures(
      fc(
        feature("lake", { type: "Polygon", coordinates: coords }, {
          area: 100,
          lake_type: "crater",
          circularity: 0.95,
          elongation: 1.1,
          avg_depth: 0.05,
          max_depth: 0.12,
          rim_elevation: 0.4,
        })
      )
    );

    expect(result.water).toHaveLength(1);
    const lake = result.water[0];
    expect(lake.type).toBe("lake");
    expect(lake.id).toBe("lake-1");
    expect(lake.lakeType).toBe("crater");
    expect(lake.metrics).toEqual({
      circularity: 0.95,
      elongation: 1.1,
      avgDepth: 0.05,
      maxDepth: 0.12,
    });
  });

  it("handles unknown lake_type gracefully", () => {
    const coords = [[[0, 0], [1, 0], [1, 1], [0, 0]]];
    const result = transformTileFeatures(
      fc(feature("lake", { type: "Polygon", coordinates: coords }, { lake_type: "unknown_type" }))
    );
    expect(result.water[0].lakeType).toBeUndefined();
  });

  it("transforms river linestring with width", () => {
    const coords = [[0, 0], [50, 25], [100, 50]];
    const result = transformTileFeatures(
      fc(
        feature("river", { type: "LineString", coordinates: coords }, {
          width: 5.5,
          length: 111.8,
          max_flow: 42.0,
          avg_flow: 28.3,
        })
      )
    );

    expect(result.rivers).toHaveLength(1);
    const river = result.rivers[0];
    expect(river.id).toBe("river-1");
    expect(river.width).toBe(5.5);
    expect(river.line.points).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 25 },
      { x: 100, y: 50 },
    ]);
  });

  it("defaults river width to 3 when not provided", () => {
    const coords = [[0, 0], [10, 10]];
    const result = transformTileFeatures(
      fc(feature("river", { type: "LineString", coordinates: coords }))
    );
    expect(result.rivers[0].width).toBe(3);
  });

  it("transforms contour linestring with elevation", () => {
    const coords = [[0, 50], [100, 55]];
    const result = transformTileFeatures(
      fc(feature("contour", { type: "LineString", coordinates: coords }, { elevation: 0.5 }))
    );

    expect(result.contours).toHaveLength(1);
    expect(result.contours[0].elevation).toBe(0.5);
    expect(result.contours[0].id).toBe("contour-1");
  });

  it("transforms beach polygon with beachType", () => {
    const coords = [[[0, 0], [10, 0], [10, 2], [0, 2], [0, 0]]];
    const result = transformTileFeatures(
      fc(
        feature("beach", { type: "Polygon", coordinates: coords }, {
          beach_type: "bay",
          width: 2.5,
          area: 20,
        })
      )
    );

    expect(result.beaches).toHaveLength(1);
    const beach = result.beaches[0];
    expect(beach.beachType).toBe("bay");
    expect(beach.width).toBe(2.5);
    expect(beach.id).toBe("beach-1");
  });

  it("defaults beachType to ocean for unknown values", () => {
    const coords = [[[0, 0], [1, 0], [1, 1], [0, 0]]];
    const result = transformTileFeatures(
      fc(feature("beach", { type: "Polygon", coordinates: coords }, { beach_type: "swamp" }))
    );
    expect(result.beaches[0].beachType).toBe("ocean");
  });

  it("transforms bay polygon as ocean water feature", () => {
    const coords = [[[0, 0], [30, 0], [30, 20], [0, 20], [0, 0]]];
    const result = transformTileFeatures(
      fc(feature("bay", { type: "Polygon", coordinates: coords }, { bay_size: "harbor" }))
    );

    expect(result.water).toHaveLength(1);
    expect(result.water[0].type).toBe("ocean");
    expect(result.water[0].id).toBe("bay-1");
  });

  it("transforms lagoon polygon as ocean water feature", () => {
    const coords = [[[5, 5], [15, 5], [15, 8], [5, 8], [5, 5]]];
    const result = transformTileFeatures(
      fc(feature("lagoon", { type: "Polygon", coordinates: coords }, { depth: 0.02 }))
    );

    expect(result.water).toHaveLength(1);
    expect(result.water[0].type).toBe("ocean");
    expect(result.water[0].id).toBe("lagoon-1");
  });

  it("transforms barrier_island polygon into barrierIslands array", () => {
    const coords = [[[0, 0], [20, 0], [20, 5], [0, 5], [0, 0]]];
    const result = transformTileFeatures(
      fc(
        feature("barrier_island", { type: "Polygon", coordinates: coords }, {
          island_index: 2,
          width: 5.0,
        })
      )
    );

    expect(result.barrierIslands).toHaveLength(1);
    const island = result.barrierIslands[0];
    expect(island.id).toBe("barrier-1");
    expect(island.polygon.points).toHaveLength(5);
    expect(island.polygon.points[0]).toEqual({ x: 0, y: 0 });
    expect(island.islandIndex).toBe(2);
    expect(island.width).toBe(5.0);
  });

  it("transforms tidal_flat polygon into tidalFlats array", () => {
    const coords = [[[10, 10], [30, 10], [30, 15], [10, 15], [10, 10]]];
    const result = transformTileFeatures(
      fc(feature("tidal_flat", { type: "Polygon", coordinates: coords }))
    );

    expect(result.tidalFlats).toHaveLength(1);
    const flat = result.tidalFlats[0];
    expect(flat.id).toBe("tidal-1");
    expect(flat.polygon.points).toHaveLength(5);
    expect(flat.polygon.points[0]).toEqual({ x: 10, y: 10 });
  });

  it("transforms dune_ridge linestring into duneRidges array", () => {
    const coords = [[0, 0], [10, 5], [20, 3]];
    const result = transformTileFeatures(
      fc(feature("dune_ridge", { type: "LineString", coordinates: coords }, { height: 3.5 }))
    );

    expect(result.duneRidges).toHaveLength(1);
    const dune = result.duneRidges[0];
    expect(dune.id).toBe("dune-1");
    expect(dune.line.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 3 },
    ]);
    expect(dune.height).toBe(3.5);
  });

  it("transforms inlet polygon into inlets array", () => {
    const coords = [[[5, 0], [10, 0], [10, 8], [5, 8], [5, 0]]];
    const result = transformTileFeatures(
      fc(feature("inlet", { type: "Polygon", coordinates: coords }, { width: 4.2 }))
    );

    expect(result.inlets).toHaveLength(1);
    const inlet = result.inlets[0];
    expect(inlet.id).toBe("inlet-1");
    expect(inlet.polygon.points).toHaveLength(5);
    expect(inlet.width).toBe(4.2);
  });

  it("skips barrier_island with wrong geometry type", () => {
    const result = transformTileFeatures(
      fc(feature("barrier_island", { type: "LineString", coordinates: [[0, 0], [1, 1]] }))
    );
    expect(result.barrierIslands).toHaveLength(0);
  });

  it("skips dune_ridge with wrong geometry type", () => {
    const result = transformTileFeatures(
      fc(feature("dune_ridge", { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }))
    );
    expect(result.duneRidges).toHaveLength(0);
  });

  it("skips inlet with wrong geometry type", () => {
    const result = transformTileFeatures(
      fc(feature("inlet", { type: "Point", coordinates: [5, 5] }))
    );
    expect(result.inlets).toHaveLength(0);
  });

  it("skips features with mismatched geometry type", () => {
    const result = transformTileFeatures(
      fc(feature("coastline", { type: "LineString", coordinates: [[0, 0], [1, 1]] }))
    );
    expect(result.water).toHaveLength(0);
    expect(result.coastlines).toHaveLength(0);
  });

  it("handles mixed feature types in a single collection", () => {
    const result = transformTileFeatures(
      fc(
        feature("coastline", {
          type: "Polygon",
          coordinates: [[[0, 0], [100, 0], [100, 30], [0, 30], [0, 0]]],
        }),
        feature("lake", {
          type: "Polygon",
          coordinates: [[[50, 50], [60, 50], [60, 60], [50, 50]]],
        }, { lake_type: "pond" }),
        feature("river", {
          type: "LineString",
          coordinates: [[60, 55], [80, 40], [100, 30]],
        }, { width: 4 }),
        feature("contour", {
          type: "LineString",
          coordinates: [[0, 40], [100, 45]],
        }, { elevation: 0.3 }),
        feature("beach", {
          type: "Polygon",
          coordinates: [[[0, 28], [100, 28], [100, 32], [0, 32], [0, 28]]],
        }, { beach_type: "ocean", width: 3 }),
        feature("bay", {
          type: "Polygon",
          coordinates: [[[40, 0], [60, 0], [55, 15], [45, 15], [40, 0]]],
        }),
      )
    );

    expect(result.water).toHaveLength(3); // ocean + lake + bay
    expect(result.coastlines).toHaveLength(1);
    expect(result.rivers).toHaveLength(1);
    expect(result.contours).toHaveLength(1);
    expect(result.beaches).toHaveLength(1);

    expect(result.water[0].id).toBe("ocean-1");
    expect(result.water[1].id).toBe("lake-1");
    expect(result.water[2].id).toBe("bay-1");
  });

  it("skips features without feature_type property", () => {
    const result = transformTileFeatures({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { name: "mystery" },
        },
      ],
    });
    expect(result).toEqual(emptyTerrainData());
  });
});

describe("emptyTerrainData", () => {
  it("returns all empty arrays", () => {
    const empty = emptyTerrainData();
    expect(empty.water).toEqual([]);
    expect(empty.coastlines).toEqual([]);
    expect(empty.rivers).toEqual([]);
    expect(empty.contours).toEqual([]);
    expect(empty.beaches).toEqual([]);
    expect(empty.barrierIslands).toEqual([]);
    expect(empty.tidalFlats).toEqual([]);
    expect(empty.duneRidges).toEqual([]);
    expect(empty.inlets).toEqual([]);
  });
});
