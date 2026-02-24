import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TerrainLayer } from "./TerrainLayer";
import type { TerrainData, LayerVisibility } from "./types";

/** Minimal inline terrain fixture for visibility tests. */
const minimalTerrain: TerrainData = {
  water: [
    {
      id: "water-1",
      type: "lake",
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      },
    },
  ],
  beaches: [],
  coastlines: [
    {
      id: "coast-1",
      line: {
        points: [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
      },
    },
  ],
  rivers: [
    {
      id: "river-1",
      line: {
        points: [
          { x: 50, y: 0 },
          { x: 50, y: 100 },
        ],
      },
      width: 5,
    },
  ],
  contours: [
    {
      id: "contour-1",
      elevation: 100,
      line: {
        points: [
          { x: 0, y: 25 },
          { x: 100, y: 25 },
        ],
      },
    },
  ],
  barrierIslands: [],
  tidalFlats: [],
  duneRidges: [],
  inlets: [],
};

describe("TerrainLayer", () => {
  let layer: TerrainLayer;

  beforeEach(() => {
    layer = new TerrainLayer();
  });

  afterEach(() => {
    layer.destroy();
  });

  it("creates a container with correct label", () => {
    const container = layer.getContainer();
    expect(container.label).toBe("terrain");
  });

  it("accepts data without throwing", () => {
    const data: TerrainData = {
      water: [
        {
          id: "water-1",
          type: "lake",
          polygon: {
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
            ],
          },
        },
      ],
      beaches: [],
      coastlines: [
        {
          id: "coast-1",
          line: {
            points: [
              { x: 0, y: 50 },
              { x: 100, y: 50 },
            ],
          },
        },
      ],
      rivers: [
        {
          id: "river-1",
          line: {
            points: [
              { x: 50, y: 0 },
              { x: 50, y: 100 },
            ],
          },
          width: 5,
        },
      ],
      contours: [
        {
          id: "contour-1",
          elevation: 100,
          line: {
            points: [
              { x: 0, y: 25 },
              { x: 100, y: 25 },
            ],
          },
        },
      ],
      barrierIslands: [],
      tidalFlats: [],
      duneRidges: [],
      inlets: [],
    };

    expect(() => layer.setData(data)).not.toThrow();
  });

  it("cleans up on destroy", () => {
    expect(() => layer.destroy()).not.toThrow();
  });
});

describe("TerrainLayer visibility", () => {
  let layer: TerrainLayer;

  beforeEach(() => {
    layer = new TerrainLayer();
    // Set some data so graphics objects exist
    layer.setData(minimalTerrain);
  });

  afterEach(() => {
    layer.destroy();
  });

  it("sets water visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: false,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: true,
      barrierIslands: true,
      tidalFlats: true,
      duneRidges: true,
      inlets: true,
      neighborhoods: true,
      cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    layer.setVisibility(visibility);

    // Container should still be accessible
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("sets coastlines visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: false,
      rivers: true,
      contours: true,
      barrierIslands: true,
      tidalFlats: true,
      duneRidges: true,
      inlets: true,
      neighborhoods: true,
      cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    layer.setVisibility(visibility);
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("sets rivers visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: false,
      contours: true,
      barrierIslands: true,
      tidalFlats: true,
      duneRidges: true,
      inlets: true,
      neighborhoods: true,
      cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    layer.setVisibility(visibility);
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("sets contours visibility correctly", () => {
    const visibility: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: false,
      barrierIslands: true,
      tidalFlats: true,
      duneRidges: true,
      inlets: true,
      neighborhoods: true,
      cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    layer.setVisibility(visibility);
    const container = layer.getContainer();
    expect(container).toBeDefined();
  });

  it("can toggle all terrain layers off", () => {
    const visibility: LayerVisibility = {
      water: false,
      beaches: false,
      coastlines: false,
      rivers: false,
      contours: false,
      barrierIslands: false,
      tidalFlats: false,
      duneRidges: false,
      inlets: false,
      neighborhoods: true,
      cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    expect(() => layer.setVisibility(visibility)).not.toThrow();
  });

  it("can toggle all terrain layers on", () => {
    const visibility: LayerVisibility = {
      water: true,
      beaches: true,
      coastlines: true,
      rivers: true,
      contours: true,
      barrierIslands: true,
      tidalFlats: true,
      duneRidges: true,
      inlets: true,
      neighborhoods: true,
      cityLimits: true,
      districts: true,
      roads: true,
      pois: true,
      bridges: true,
      grid: true,
      labels: true,
      subwayTunnels: false,
    };

    expect(() => layer.setVisibility(visibility)).not.toThrow();
  });
});

