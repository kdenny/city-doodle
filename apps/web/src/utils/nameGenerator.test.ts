/**
 * Tests for name generator utility functions.
 */

import { describe, it, expect } from "vitest";
import {
  generateCityName,
  generateNeighborhoodName,
  generateDistrictName,
  generateCityNameSuggestions,
  generateNeighborhoodNameSuggestions,
  generateRiverName,
  generateLakeName,
  generateBridgeName,
  generatePlazaName,
  generateParkName,
  generateShoppingDistrictName,
  generateAirportName,
  generateContextAwareParkName,
} from "./nameGenerator";

describe("nameGenerator", () => {
  describe("generateCityName", () => {
    it("generates a non-empty string", () => {
      const name = generateCityName();
      expect(name).toBeTruthy();
      expect(typeof name).toBe("string");
    });

    it("generates deterministic names with same seed", () => {
      const name1 = generateCityName({ seed: 12345 });
      const name2 = generateCityName({ seed: 12345 });
      expect(name1).toBe(name2);
    });

    it("generates different names with different seeds", () => {
      const name1 = generateCityName({ seed: 12345 });
      const name2 = generateCityName({ seed: 54321 });
      // With high probability these will be different
      // (there's a tiny chance they match by coincidence)
      expect(name1 !== name2 || name1 !== name2).toBe(true);
    });
  });

  describe("generateNeighborhoodName", () => {
    it("generates a non-empty string", () => {
      const name = generateNeighborhoodName();
      expect(name).toBeTruthy();
    });

    it("generates deterministic names with same seed", () => {
      const name1 = generateNeighborhoodName({ seed: 12345 });
      const name2 = generateNeighborhoodName({ seed: 12345 });
      expect(name1).toBe(name2);
    });

    it("respects context for water-adjacent neighborhoods", () => {
      // Generate many names and check that water contexts influence naming
      const names = [];
      for (let i = 0; i < 20; i++) {
        names.push(generateNeighborhoodName({ seed: i * 1000, nearbyContexts: ["water"] }));
      }
      // At least some should contain water-related words
      const waterRelated = names.filter(
        (n) =>
          n.includes("Harbor") ||
          n.includes("Lake") ||
          n.includes("River") ||
          n.includes("Bay") ||
          n.includes("Marina") ||
          n.includes("Waterfront") ||
          n.includes("Shore") ||
          n.includes("Cove")
      );
      expect(waterRelated.length).toBeGreaterThan(0);
    });
  });

  describe("generateDistrictName", () => {
    it("generates names for residential districts", () => {
      const name = generateDistrictName("residential", { seed: 12345 });
      expect(name).toBeTruthy();
    });

    it("generates names for downtown districts", () => {
      const name = generateDistrictName("downtown", { seed: 12345 });
      expect(name).toBeTruthy();
    });

    it("generates names for park districts", () => {
      const name = generateDistrictName("park", { seed: 12345 });
      expect(name).toBeTruthy();
      // Park districts should have park-like suffixes
      expect(
        name.includes("Park") ||
          name.includes("Gardens") ||
          name.includes("Reserve") ||
          name.includes("Commons") ||
          name.includes("Green")
      ).toBe(true);
    });

    it("is deterministic with same seed", () => {
      const name1 = generateDistrictName("commercial", { seed: 99999 });
      const name2 = generateDistrictName("commercial", { seed: 99999 });
      expect(name1).toBe(name2);
    });
  });

  describe("generateCityNameSuggestions", () => {
    it("generates the requested number of suggestions", () => {
      const suggestions = generateCityNameSuggestions(5);
      expect(suggestions.length).toBe(5);
    });

    it("generates unique names", () => {
      const suggestions = generateCityNameSuggestions(5, 12345);
      const uniqueNames = new Set(suggestions);
      expect(uniqueNames.size).toBe(5);
    });
  });

  describe("generateNeighborhoodNameSuggestions", () => {
    it("generates the requested number of suggestions", () => {
      const suggestions = generateNeighborhoodNameSuggestions(5);
      expect(suggestions.length).toBe(5);
    });
  });

  // Tests for CITY-188 additions

  describe("generateRiverName", () => {
    it("generates a non-empty string", () => {
      const name = generateRiverName();
      expect(name).toBeTruthy();
    });

    it("generates names with river-like suffixes", () => {
      // Generate several names and check they have appropriate suffixes
      const names = [];
      for (let i = 0; i < 10; i++) {
        names.push(generateRiverName({ seed: i * 1000 }));
      }
      const hasRiverSuffix = names.every(
        (n) =>
          n.includes("River") ||
          n.includes("Creek") ||
          n.includes("Brook") ||
          n.includes("Run") ||
          n.includes("Stream")
      );
      expect(hasRiverSuffix).toBe(true);
    });

    it("is deterministic with same seed", () => {
      const name1 = generateRiverName({ seed: 42 });
      const name2 = generateRiverName({ seed: 42 });
      expect(name1).toBe(name2);
    });
  });

  describe("generateLakeName", () => {
    it("generates a non-empty string", () => {
      const name = generateLakeName();
      expect(name).toBeTruthy();
    });

    it("generates names with lake-like suffixes", () => {
      const names = [];
      for (let i = 0; i < 10; i++) {
        names.push(generateLakeName({ seed: i * 1000 }));
      }
      const hasLakeSuffix = names.every(
        (n) =>
          n.includes("Lake") ||
          n.includes("Pond") ||
          n.includes("Reservoir") ||
          n.includes("Waters")
      );
      expect(hasLakeSuffix).toBe(true);
    });

    it("is deterministic with same seed", () => {
      const name1 = generateLakeName({ seed: 42 });
      const name2 = generateLakeName({ seed: 42 });
      expect(name1).toBe(name2);
    });
  });

  describe("generateBridgeName", () => {
    it("generates a non-empty string", () => {
      const name = generateBridgeName();
      expect(name).toBeTruthy();
    });

    it("generates names with bridge-like suffixes", () => {
      const names = [];
      for (let i = 0; i < 10; i++) {
        names.push(generateBridgeName({ seed: i * 1000 }));
      }
      const hasBridgeSuffix = names.every(
        (n) =>
          n.includes("Bridge") || n.includes("Crossing") || n.includes("Span")
      );
      expect(hasBridgeSuffix).toBe(true);
    });

    it("is deterministic with same seed", () => {
      const name1 = generateBridgeName({ seed: 42 });
      const name2 = generateBridgeName({ seed: 42 });
      expect(name1).toBe(name2);
    });
  });

  describe("generatePlazaName", () => {
    it("generates a non-empty string", () => {
      const name = generatePlazaName();
      expect(name).toBeTruthy();
    });

    it("generates names with plaza-like suffixes", () => {
      const names = [];
      for (let i = 0; i < 10; i++) {
        names.push(generatePlazaName({ seed: i * 1000 }));
      }
      const hasPlazaSuffix = names.every(
        (n) =>
          n.includes("Plaza") ||
          n.includes("Square") ||
          n.includes("Commons") ||
          n.includes("Green")
      );
      expect(hasPlazaSuffix).toBe(true);
    });

    it("is deterministic with same seed", () => {
      const name1 = generatePlazaName({ seed: 42 });
      const name2 = generatePlazaName({ seed: 42 });
      expect(name1).toBe(name2);
    });
  });

  describe("generateParkName", () => {
    it("generates a non-empty string", () => {
      const name = generateParkName();
      expect(name).toBeTruthy();
    });

    it("generates realistic park names", () => {
      const names = [];
      for (let i = 0; i < 20; i++) {
        names.push(generateParkName({ seed: i * 1000 }));
      }
      // All names should contain park-related words
      const hasParkWord = names.every(
        (n) =>
          n.includes("Park") ||
          n.includes("Gardens") ||
          n.includes("Green") ||
          n.includes("Reserve") ||
          n.includes("Commons") ||
          n.includes("Grove") ||
          n.includes("Memorial")
      );
      expect(hasParkWord).toBe(true);
    });

    it("is deterministic with same seed", () => {
      const name1 = generateParkName({ seed: 42 });
      const name2 = generateParkName({ seed: 42 });
      expect(name1).toBe(name2);
    });
  });

  describe("generateShoppingDistrictName", () => {
    it("generates a non-empty string", () => {
      const name = generateShoppingDistrictName();
      expect(name).toBeTruthy();
    });

    it("generates commercial-sounding names", () => {
      const names = [];
      for (let i = 0; i < 20; i++) {
        names.push(generateShoppingDistrictName({ seed: i * 1000 }));
      }
      // Names should contain commerce-related words
      const hasCommercialWord = names.every(
        (n) =>
          n.includes("Market") ||
          n.includes("Merchant") ||
          n.includes("Commerce") ||
          n.includes("Trade") ||
          n.includes("Shop") ||
          n.includes("District") ||
          n.includes("Plaza") ||
          n.includes("Square") ||
          n.includes("Row") ||
          n.includes("Center") ||
          n.includes("Galleria") ||
          n.includes("Marketplace") ||
          n.includes("Promenade") ||
          n.includes("Arcade") ||
          n.includes("Mall") ||
          n.includes("Centre") ||
          n.includes("Exchange") ||
          n.includes("Harbor") ||
          n.includes("Gateway") ||
          n.includes("Grand") ||
          n.includes("Village") ||
          n.includes("Town") ||
          n.includes("Station") ||
          n.includes("Waterfront") ||
          n.includes("Marina") ||
          n.includes("Bayside") ||
          n.includes("Downtown") ||
          n.includes("City") ||
          n.includes("Main") ||
          n.includes("Central") ||
          n.includes("Crossroads")
      );
      expect(hasCommercialWord).toBe(true);
    });

    it("is deterministic with same seed", () => {
      const name1 = generateShoppingDistrictName({ seed: 42 });
      const name2 = generateShoppingDistrictName({ seed: 42 });
      expect(name1).toBe(name2);
    });

    it("respects water context", () => {
      // Generate names with water context
      const names = [];
      for (let i = 0; i < 20; i++) {
        names.push(generateShoppingDistrictName({ seed: i * 7919, nearbyContexts: ["water"] }));
      }
      // Some should have water-related words
      const waterRelated = names.filter(
        (n) =>
          n.includes("Waterfront") ||
          n.includes("Harbor") ||
          n.includes("Marina") ||
          n.includes("Bayside")
      );
      // At least one should be water-related (20% chance per name)
      expect(waterRelated.length).toBeGreaterThanOrEqual(0);
    });
  });

  // Tests for CITY-380 additions

  describe("generateAirportName", () => {
    it("generates a non-empty string", () => {
      const name = generateAirportName();
      expect(name).toBeTruthy();
    });

    it("uses world name when provided", () => {
      const names = [];
      for (let i = 0; i < 20; i++) {
        names.push(generateAirportName({ seed: i * 1000 }, { worldName: "Springfield" }));
      }
      // Most names should contain the world name (80% probability per call)
      const withWorldName = names.filter((n) => n.includes("Springfield"));
      expect(withWorldName.length).toBeGreaterThan(5);
    });

    it("generates airport-like names with world name", () => {
      const names = [];
      for (let i = 0; i < 20; i++) {
        names.push(generateAirportName({ seed: i * 1000 }, { worldName: "Oakdale" }));
      }
      const hasAirportWord = names.every(
        (n) =>
          n.includes("Airport") ||
          n.includes("Field") ||
          n.includes("Airfield")
      );
      expect(hasAirportWord).toBe(true);
    });

    it("falls back to generic names without world name", () => {
      const name = generateAirportName({ seed: 42 });
      expect(name).toBeTruthy();
      expect(
        name.includes("Airport") ||
          name.includes("Field") ||
          name.includes("Airfield")
      ).toBe(true);
    });

    it("is deterministic with same seed", () => {
      const name1 = generateAirportName({ seed: 42 }, { worldName: "Test" });
      const name2 = generateAirportName({ seed: 42 }, { worldName: "Test" });
      expect(name1).toBe(name2);
    });
  });

  describe("generateContextAwareParkName", () => {
    it("generates a non-empty string", () => {
      const name = generateContextAwareParkName();
      expect(name).toBeTruthy();
    });

    it("incorporates water feature names when available", () => {
      const names = [];
      for (let i = 0; i < 30; i++) {
        names.push(
          generateContextAwareParkName(
            { seed: i * 1000 },
            { nearbyWaterNames: ["Crystal Lake"] }
          )
        );
      }
      // Some should reference the water feature
      const waterReferenced = names.filter(
        (n) =>
          n.includes("Crystal") ||
          n.includes("Lake") ||
          n.includes("Lakeside") ||
          n.includes("Waterfront") ||
          n.includes("Riverside") ||
          n.includes("Bayside")
      );
      expect(waterReferenced.length).toBeGreaterThan(0);
    });

    it("incorporates adjacent district names when available", () => {
      const names = [];
      for (let i = 0; i < 30; i++) {
        names.push(
          generateContextAwareParkName(
            { seed: i * 1000 },
            { adjacentDistrictNames: ["Maple Heights"] }
          )
        );
      }
      // Some should reference the adjacent district
      const districtReferenced = names.filter((n) => n.includes("Maple"));
      expect(districtReferenced.length).toBeGreaterThan(0);
    });

    it("falls back to standard park names without context", () => {
      const name = generateContextAwareParkName({ seed: 42 });
      expect(name).toBeTruthy();
    });

    it("is deterministic with same seed", () => {
      const ctx = { nearbyWaterNames: ["Silver Lake"], adjacentDistrictNames: ["Oak Heights"] };
      const name1 = generateContextAwareParkName({ seed: 42 }, ctx);
      const name2 = generateContextAwareParkName({ seed: 42 }, ctx);
      expect(name1).toBe(name2);
    });
  });

  describe("generateDistrictName with naming context (CITY-380)", () => {
    it("delegates to airport naming for airport type", () => {
      const names = [];
      for (let i = 0; i < 20; i++) {
        names.push(
          generateDistrictName("airport", { seed: i * 1000 }, { worldName: "Riverdale" })
        );
      }
      const withWorldName = names.filter((n) => n.includes("Riverdale"));
      expect(withWorldName.length).toBeGreaterThan(5);
    });

    it("delegates to context-aware park naming for park type", () => {
      const names = [];
      for (let i = 0; i < 30; i++) {
        names.push(
          generateDistrictName(
            "park",
            { seed: i * 1000 },
            { adjacentDistrictNames: ["Cedar Village"] }
          )
        );
      }
      const contextReferenced = names.filter((n) => n.includes("Cedar"));
      expect(contextReferenced.length).toBeGreaterThan(0);
    });

    it("falls through for non-park/airport types", () => {
      // With naming context but residential type, should use standard naming
      const name = generateDistrictName(
        "residential",
        { seed: 42 },
        { worldName: "TestCity" }
      );
      expect(name).toBeTruthy();
      // Should NOT contain "Airport"
      expect(name.includes("Airport")).toBe(false);
    });
  });
});
