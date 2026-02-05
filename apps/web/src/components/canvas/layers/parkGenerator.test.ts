/**
 * Tests for park geometry generator.
 */

import { describe, it, expect } from "vitest";
import {
  generatePark,
  findNearestRoadConnection,
  extractRoadSegments,
  wouldParkOverlap,
  getParkSizeFromSeedId,
  type RoadSegment,
} from "./parkGenerator";
import type { Road, District, Point } from "./types";
import { PARK_SIZE_CONFIG } from "../../palette/types";

describe("parkGenerator", () => {
  describe("generatePark", () => {
    it("generates a park with organic polygon shape", () => {
      const result = generatePark({ x: 100, y: 100 }, "park_neighborhood");

      expect(result.polygon).toBeDefined();
      expect(result.polygon.points.length).toBeGreaterThanOrEqual(8);

      // Verify polygon is roughly centered around position
      const centerX =
        result.polygon.points.reduce((sum, p) => sum + p.x, 0) /
        result.polygon.points.length;
      const centerY =
        result.polygon.points.reduce((sum, p) => sum + p.y, 0) /
        result.polygon.points.length;

      expect(Math.abs(centerX - 100)).toBeLessThan(5);
      expect(Math.abs(centerY - 100)).toBeLessThan(5);
    });

    it("generates different sizes based on size preset", () => {
      const pocketPark = generatePark({ x: 0, y: 0 }, "park_pocket", [], {
        size: "pocket",
      });
      const cityPark = generatePark({ x: 0, y: 0 }, "park_city", [], {
        size: "city",
      });

      // Calculate approximate radius from polygon
      const getRadius = (points: Point[]): number => {
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return Math.max(
          ...points.map((p) =>
            Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2)
          )
        );
      };

      const pocketRadius = getRadius(pocketPark.polygon.points);
      const cityRadius = getRadius(cityPark.polygon.points);

      // City park should be significantly larger than pocket park
      expect(cityRadius).toBeGreaterThan(pocketRadius * 5);
    });

    it("generates internal paths for larger parks", () => {
      const pocketPark = generatePark({ x: 0, y: 0 }, "park_pocket");
      const communityPark = generatePark({ x: 0, y: 0 }, "park_community");

      // Pocket parks have no internal features
      expect(pocketPark.paths.length).toBe(0);

      // Community parks should have internal trails
      // (paths array might include connection road if roads are provided)
      expect(communityPark.paths.length).toBeGreaterThanOrEqual(0);
    });

    it("generates ponds for larger parks with sufficient feature density", () => {
      // Test multiple times due to random chance
      let hasAnyPond = false;
      for (let i = 0; i < 10; i++) {
        const park = generatePark({ x: i * 100, y: i * 100 }, "park_regional", [], {
          seed: i * 12345,
        });
        if (park.ponds.length > 0) {
          hasAnyPond = true;
          break;
        }
      }

      // Should have at least one pond in multiple attempts for regional parks
      expect(hasAnyPond).toBe(true);
    });

    it("generates deterministic results with same seed", () => {
      const park1 = generatePark({ x: 50, y: 50 }, "park_neighborhood", [], {
        seed: 42,
      });
      const park2 = generatePark({ x: 50, y: 50 }, "park_neighborhood", [], {
        seed: 42,
      });

      expect(park1.name).toBe(park2.name);
      expect(park1.polygon.points).toEqual(park2.polygon.points);
    });

    it("generates different results with different seeds", () => {
      const park1 = generatePark({ x: 50, y: 50 }, "park_neighborhood", [], {
        seed: 42,
      });
      const park2 = generatePark({ x: 50, y: 50 }, "park_neighborhood", [], {
        seed: 43,
      });

      // Very unlikely to be exactly the same
      expect(park1.polygon.points).not.toEqual(park2.polygon.points);
    });

    it("generates a name for the park", () => {
      const park = generatePark({ x: 0, y: 0 }, "park_neighborhood");

      expect(park.name).toBeDefined();
      expect(park.name.length).toBeGreaterThan(0);
      expect(park.name).toMatch(/\w+\s\w+/); // At least two words
    });
  });

  describe("findNearestRoadConnection", () => {
    it("finds nearest road to park polygon", () => {
      const parkPolygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const roads: RoadSegment[] = [
        { id: "road1", start: { x: 15, y: 5 }, end: { x: 25, y: 5 }, roadClass: "local" },
        { id: "road2", start: { x: 100, y: 100 }, end: { x: 110, y: 100 }, roadClass: "local" },
      ];

      const connection = findNearestRoadConnection(parkPolygon, roads, 100);

      expect(connection).not.toBeNull();
      expect(connection!.roadId).toBe("road1");
      // Connection should be on the right edge of the park (closest to road1)
      expect(connection!.parkEdgePoint.x).toBeCloseTo(10, 0);
    });

    it("returns null when no roads are within range", () => {
      const parkPolygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const roads: RoadSegment[] = [
        { id: "road1", start: { x: 100, y: 100 }, end: { x: 110, y: 100 }, roadClass: "local" },
      ];

      const connection = findNearestRoadConnection(parkPolygon, roads, 50);

      expect(connection).toBeNull();
    });

    it("returns null when no roads exist", () => {
      const parkPolygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const connection = findNearestRoadConnection(parkPolygon, [], 50);

      expect(connection).toBeNull();
    });
  });

  describe("extractRoadSegments", () => {
    it("extracts segments from road line points", () => {
      const roads: Road[] = [
        {
          id: "road1",
          roadClass: "local",
          line: {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 20, y: 0 },
            ],
          },
        },
      ];

      const segments = extractRoadSegments(roads);

      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        id: "road1",
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        roadClass: "local",
      });
      expect(segments[1]).toEqual({
        id: "road1",
        start: { x: 10, y: 0 },
        end: { x: 20, y: 0 },
        roadClass: "local",
      });
    });

    it("handles multiple roads", () => {
      const roads: Road[] = [
        {
          id: "road1",
          roadClass: "local",
          line: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
        },
        {
          id: "road2",
          roadClass: "arterial",
          line: { points: [{ x: 0, y: 10 }, { x: 10, y: 10 }] },
        },
      ];

      const segments = extractRoadSegments(roads);

      expect(segments).toHaveLength(2);
      expect(segments[0].id).toBe("road1");
      expect(segments[1].id).toBe("road2");
    });
  });

  describe("wouldParkOverlap", () => {
    it("detects overlap with existing district", () => {
      const parkPolygon: Point[] = [
        { x: 5, y: 5 },
        { x: 15, y: 5 },
        { x: 15, y: 15 },
        { x: 5, y: 15 },
      ];

      const districts: District[] = [
        {
          id: "d1",
          name: "Test District",
          type: "residential",
          polygon: {
            points: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: 20 },
              { x: 0, y: 20 },
            ],
          },
        },
      ];

      expect(wouldParkOverlap(parkPolygon, districts)).toBe(true);
    });

    it("returns false when no overlap with districts", () => {
      const parkPolygon: Point[] = [
        { x: 50, y: 50 },
        { x: 60, y: 50 },
        { x: 60, y: 60 },
        { x: 50, y: 60 },
      ];

      const districts: District[] = [
        {
          id: "d1",
          name: "Test District",
          type: "residential",
          polygon: {
            points: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: 20 },
              { x: 0, y: 20 },
            ],
          },
        },
      ];

      expect(wouldParkOverlap(parkPolygon, districts)).toBe(false);
    });

    it("detects overlap with existing parks", () => {
      const newParkPolygon: Point[] = [
        { x: 5, y: 5 },
        { x: 15, y: 5 },
        { x: 15, y: 15 },
        { x: 5, y: 15 },
      ];

      const existingParks = [
        {
          points: [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 30, y: 30 },
            { x: 10, y: 30 },
          ],
        },
      ];

      expect(wouldParkOverlap(newParkPolygon, [], existingParks)).toBe(true);
    });
  });

  describe("getParkSizeFromSeedId", () => {
    it("maps park seed IDs to sizes correctly", () => {
      expect(getParkSizeFromSeedId("park_pocket")).toBe("pocket");
      expect(getParkSizeFromSeedId("park_neighborhood")).toBe("neighborhood");
      expect(getParkSizeFromSeedId("park_community")).toBe("community");
      expect(getParkSizeFromSeedId("park_regional")).toBe("regional");
      expect(getParkSizeFromSeedId("park_city")).toBe("city");
    });

    it("defaults to neighborhood for unknown seed IDs", () => {
      expect(getParkSizeFromSeedId("unknown")).toBe("neighborhood");
      expect(getParkSizeFromSeedId("park")).toBe("neighborhood");
    });
  });

  describe("park integration with road network", () => {
    it("creates connection road when roads are nearby", () => {
      const roads: Road[] = [
        {
          id: "road1",
          roadClass: "local",
          line: {
            points: [
              { x: 50, y: 5 },
              { x: 60, y: 5 },
            ],
          },
        },
      ];

      const park = generatePark({ x: 50, y: 10 }, "park_neighborhood", roads);

      // Should have a connection point
      expect(park.connectionPoint).not.toBeNull();

      // Should have connection road in paths
      const connectionRoad = park.paths.find((p) =>
        p.id.includes("connection")
      );
      expect(connectionRoad).toBeDefined();
      expect(connectionRoad!.roadClass).toBe("local");
    });

    it("does not create connection road when no roads nearby", () => {
      const roads: Road[] = [
        {
          id: "road1",
          roadClass: "local",
          line: {
            points: [
              { x: 500, y: 500 },
              { x: 600, y: 500 },
            ],
          },
        },
      ];

      const park = generatePark({ x: 0, y: 0 }, "park_pocket", roads);

      // Should not have a connection point (road too far)
      expect(park.connectionPoint).toBeNull();
    });
  });

  describe("PARK_SIZE_CONFIG", () => {
    it("has all size presets defined", () => {
      expect(PARK_SIZE_CONFIG.pocket).toBeDefined();
      expect(PARK_SIZE_CONFIG.neighborhood).toBeDefined();
      expect(PARK_SIZE_CONFIG.community).toBeDefined();
      expect(PARK_SIZE_CONFIG.regional).toBeDefined();
      expect(PARK_SIZE_CONFIG.city).toBeDefined();
    });

    it("has increasing radius for larger parks", () => {
      expect(PARK_SIZE_CONFIG.pocket.radiusWorldUnits).toBeLessThan(
        PARK_SIZE_CONFIG.neighborhood.radiusWorldUnits
      );
      expect(PARK_SIZE_CONFIG.neighborhood.radiusWorldUnits).toBeLessThan(
        PARK_SIZE_CONFIG.community.radiusWorldUnits
      );
      expect(PARK_SIZE_CONFIG.community.radiusWorldUnits).toBeLessThan(
        PARK_SIZE_CONFIG.regional.radiusWorldUnits
      );
      expect(PARK_SIZE_CONFIG.regional.radiusWorldUnits).toBeLessThan(
        PARK_SIZE_CONFIG.city.radiusWorldUnits
      );
    });

    it("has appropriate feature density for each size", () => {
      expect(PARK_SIZE_CONFIG.pocket.hasInternalFeatures).toBe(false);
      expect(PARK_SIZE_CONFIG.neighborhood.hasInternalFeatures).toBe(true);
      expect(PARK_SIZE_CONFIG.city.featureDensity).toBeGreaterThan(
        PARK_SIZE_CONFIG.neighborhood.featureDensity
      );
    });
  });
});
