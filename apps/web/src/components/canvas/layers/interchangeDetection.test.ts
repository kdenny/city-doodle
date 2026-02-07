import { describe, it, expect } from "vitest";
import { detectInterchanges } from "./interchangeDetection";
import type { Road } from "./types";

describe("detectInterchanges", () => {
  const makeRoad = (
    id: string,
    roadClass: Road["roadClass"],
    points: { x: number; y: number }[]
  ): Road => ({
    id,
    roadClass,
    line: { points },
  });

  it("detects interchange where highway crosses an arterial", () => {
    const highway = makeRoad("hw-1", "highway", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]);
    const arterial = makeRoad("art-1", "arterial", [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);

    const interchanges = detectInterchanges(highway, [arterial]);

    expect(interchanges).toHaveLength(1);
    expect(interchanges[0].highwayId).toBe("hw-1");
    expect(interchanges[0].connectedRoadId).toBe("art-1");
    expect(interchanges[0].type).toBe("diamond");
    expect(interchanges[0].position.x).toBeCloseTo(50);
    expect(interchanges[0].position.y).toBeCloseTo(50);
  });

  it("detects interchange where highway crosses a collector", () => {
    const highway = makeRoad("hw-1", "highway", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]);
    const collector = makeRoad("col-1", "collector", [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);

    const interchanges = detectInterchanges(highway, [collector]);

    expect(interchanges).toHaveLength(1);
    expect(interchanges[0].connectedRoadId).toBe("col-1");
  });

  it("ignores local roads (no interchange)", () => {
    const highway = makeRoad("hw-1", "highway", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]);
    const local = makeRoad("local-1", "local", [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);

    const interchanges = detectInterchanges(highway, [local]);

    expect(interchanges).toHaveLength(0);
  });

  it("ignores trails (no interchange)", () => {
    const highway = makeRoad("hw-1", "highway", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]);
    const trail = makeRoad("trail-1", "trail", [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);

    const interchanges = detectInterchanges(highway, [trail]);

    expect(interchanges).toHaveLength(0);
  });

  it("ignores other highways (highway-highway crossing)", () => {
    const highway1 = makeRoad("hw-1", "highway", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]);
    const highway2 = makeRoad("hw-2", "highway", [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);

    const interchanges = detectInterchanges(highway1, [highway2]);

    expect(interchanges).toHaveLength(0);
  });

  it("detects multiple interchanges on a long highway", () => {
    const highway = makeRoad("hw-1", "highway", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]);
    const arterial1 = makeRoad("art-1", "arterial", [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);
    const arterial2 = makeRoad("art-2", "arterial", [
      { x: 150, y: 0 },
      { x: 150, y: 100 },
    ]);

    const interchanges = detectInterchanges(highway, [arterial1, arterial2]);

    expect(interchanges).toHaveLength(2);
    expect(interchanges[0].position.x).toBeCloseTo(50);
    expect(interchanges[1].position.x).toBeCloseTo(150);
  });

  it("returns empty array when no roads cross", () => {
    const highway = makeRoad("hw-1", "highway", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]);
    const arterial = makeRoad("art-1", "arterial", [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]); // Parallel, no crossing

    const interchanges = detectInterchanges(highway, [arterial]);

    expect(interchanges).toHaveLength(0);
  });

  it("works with multi-segment polylines", () => {
    const highway = makeRoad("hw-1", "highway", [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
    const arterial = makeRoad("art-1", "arterial", [
      { x: 0, y: 25 },
      { x: 100, y: 25 },
    ]);

    const interchanges = detectInterchanges(highway, [arterial]);

    // Highway goes from (0,0) to (50,50) to (100,0), crossing the horizontal arterial at y=25 twice
    expect(interchanges).toHaveLength(2);
  });

  it("supports custom interchange type", () => {
    const highway = makeRoad("hw-1", "highway", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]);
    const arterial = makeRoad("art-1", "arterial", [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);

    const interchanges = detectInterchanges(highway, [arterial], "cloverleaf");

    expect(interchanges).toHaveLength(1);
    expect(interchanges[0].type).toBe("cloverleaf");
  });

  it("skips self (highway not in existing roads)", () => {
    const highway = makeRoad("hw-1", "highway", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]);

    // Include the highway itself in the roads list (shouldn't match)
    const interchanges = detectInterchanges(highway, [highway]);

    expect(interchanges).toHaveLength(0);
  });
});
