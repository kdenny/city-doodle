import { describe, it, expect } from "vitest";
import {
  TILE_SIZE,
  WORLD_TILES,
  WORLD_SIZE,
  WORLD_SIZE_MILES,
  METERS_PER_MILE,
  WORLD_SIZE_METERS,
  metersToWorldUnits,
  worldUnitsToMeters,
  milesToWorldUnits,
  worldUnitsToMiles,
} from "./worldConstants";

describe("worldConstants", () => {
  describe("constants", () => {
    it("should have correct tile and world sizes", () => {
      expect(TILE_SIZE).toBe(256);
      expect(WORLD_TILES).toBe(3);
      expect(WORLD_SIZE).toBe(768);
    });

    it("should have consistent world size calculation", () => {
      expect(WORLD_SIZE).toBe(TILE_SIZE * WORLD_TILES);
    });

    it("should have correct real-world scale constants", () => {
      expect(WORLD_SIZE_MILES).toBe(50);
      expect(METERS_PER_MILE).toBeCloseTo(1609.34, 2);
      expect(WORLD_SIZE_METERS).toBeCloseTo(80467, 0);
    });
  });

  describe("metersToWorldUnits", () => {
    it("should convert meters to world units correctly", () => {
      // 1 world unit ≈ 104.8 meters
      const oneUnit = metersToWorldUnits(104.8);
      expect(oneUnit).toBeCloseTo(1, 1);
    });

    it("should convert the full world size correctly", () => {
      const fullWorld = metersToWorldUnits(WORLD_SIZE_METERS);
      expect(fullWorld).toBeCloseTo(WORLD_SIZE, 1);
    });

    it("should handle zero", () => {
      expect(metersToWorldUnits(0)).toBe(0);
    });
  });

  describe("worldUnitsToMeters", () => {
    it("should convert world units to meters correctly", () => {
      const meters = worldUnitsToMeters(1);
      expect(meters).toBeCloseTo(104.8, 0);
    });

    it("should be inverse of metersToWorldUnits", () => {
      const meters = 500;
      const units = metersToWorldUnits(meters);
      const backToMeters = worldUnitsToMeters(units);
      expect(backToMeters).toBeCloseTo(meters, 5);
    });
  });

  describe("milesToWorldUnits", () => {
    it("should convert miles to world units correctly", () => {
      // 50 miles = 768 world units
      expect(milesToWorldUnits(50)).toBe(768);
    });

    it("should handle partial miles", () => {
      expect(milesToWorldUnits(25)).toBe(384);
    });
  });

  describe("worldUnitsToMiles", () => {
    it("should convert world units to miles correctly", () => {
      expect(worldUnitsToMiles(768)).toBe(50);
    });

    it("should be inverse of milesToWorldUnits", () => {
      const miles = 10;
      const units = milesToWorldUnits(miles);
      const backToMiles = worldUnitsToMiles(units);
      expect(backToMiles).toBeCloseTo(miles, 5);
    });
  });
});
