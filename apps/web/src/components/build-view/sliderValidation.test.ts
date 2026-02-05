import { describe, it, expect } from "vitest";
import {
  validateSliders,
  snapToValidRange,
  isValueValid,
  applyConstraints,
  getValidationWarnings,
  isHistoricEra,
  HISTORIC_SPRAWL_MIN,
  type SliderValidationContext,
  type SliderState,
} from "./sliderValidation";
import type { DistrictPersonality } from "../canvas/layers/types";
import { HISTORIC_THRESHOLD_YEAR } from "./EraSelector";

describe("sliderValidation", () => {
  const modernPersonality: DistrictPersonality = {
    grid_organic: 0.5,
    sprawl_compact: 0.5,
    transit_car: 0.5,
    era_year: 2024,
  };

  const historicPersonality: DistrictPersonality = {
    grid_organic: 0.5,
    sprawl_compact: 0.5,
    transit_car: 0.5,
    era_year: 1900,
  };

  describe("isHistoricEra", () => {
    it("returns true for years before 1940", () => {
      expect(isHistoricEra(1200)).toBe(true);
      expect(isHistoricEra(1900)).toBe(true);
      expect(isHistoricEra(1920)).toBe(true);
      expect(isHistoricEra(1939)).toBe(true);
    });

    it("returns false for years >= 1940", () => {
      expect(isHistoricEra(1940)).toBe(false);
      expect(isHistoricEra(1960)).toBe(false);
      expect(isHistoricEra(2024)).toBe(false);
    });

    it("uses correct threshold year", () => {
      expect(HISTORIC_THRESHOLD_YEAR).toBe(1940);
    });
  });

  describe("validateSliders", () => {
    describe("grid_organic slider", () => {
      it("has no constraints for any era", () => {
        const context: SliderValidationContext = {
          personality: modernPersonality,
          isHistoric: false,
          hasTransitStations: true,
        };

        const result = validateSliders(context);

        expect(result.grid_organic.disabled).toBe(false);
        expect(result.grid_organic.min).toBe(0);
        expect(result.grid_organic.max).toBe(1);
        expect(result.grid_organic.constraintReason).toBeUndefined();
      });

      it("remains unconstrained even for historic districts", () => {
        const context: SliderValidationContext = {
          personality: historicPersonality,
          isHistoric: true,
          hasTransitStations: true,
        };

        const result = validateSliders(context);

        expect(result.grid_organic.disabled).toBe(false);
        expect(result.grid_organic.min).toBe(0);
        expect(result.grid_organic.max).toBe(1);
      });
    });

    describe("sprawl_compact slider (Historic + Sprawl Forbidden)", () => {
      it("is constrained for pre-1940 eras", () => {
        const context: SliderValidationContext = {
          personality: historicPersonality,
          isHistoric: false,
          hasTransitStations: true,
        };

        const result = validateSliders(context);

        expect(result.sprawl_compact.disabled).toBe(false);
        expect(result.sprawl_compact.min).toBe(HISTORIC_SPRAWL_MIN);
        expect(result.sprawl_compact.max).toBe(1);
        expect(result.sprawl_compact.constraintReason).toContain("Historic districts");
        expect(result.sprawl_compact.constraintReason).toContain("1940");
      });

      it("is unconstrained for modern eras", () => {
        const context: SliderValidationContext = {
          personality: modernPersonality,
          isHistoric: false,
          hasTransitStations: true,
        };

        const result = validateSliders(context);

        expect(result.sprawl_compact.disabled).toBe(false);
        expect(result.sprawl_compact.min).toBe(0);
        expect(result.sprawl_compact.max).toBe(1);
        expect(result.sprawl_compact.constraintReason).toBeUndefined();
      });

      it("is constrained at exactly 1940", () => {
        const context: SliderValidationContext = {
          personality: { ...modernPersonality, era_year: 1940 },
          isHistoric: false,
          hasTransitStations: true,
        };

        const result = validateSliders(context);

        // 1940 is NOT historic, so no constraint
        expect(result.sprawl_compact.min).toBe(0);
      });

      it("is constrained at 1939", () => {
        const context: SliderValidationContext = {
          personality: { ...modernPersonality, era_year: 1939 },
          isHistoric: false,
          hasTransitStations: true,
        };

        const result = validateSliders(context);

        // 1939 IS historic, so constrained
        expect(result.sprawl_compact.min).toBe(HISTORIC_SPRAWL_MIN);
      });
    });

    describe("transit_car slider (Historic Supersedes Transit)", () => {
      it("is disabled when district is marked historic", () => {
        const context: SliderValidationContext = {
          personality: historicPersonality,
          isHistoric: true,
          hasTransitStations: true,
        };

        const result = validateSliders(context);

        expect(result.transit_car.disabled).toBe(true);
        expect(result.transit_car.constraintReason).toContain("Historic Districts");
      });

      it("is not disabled when district is not marked historic", () => {
        const context: SliderValidationContext = {
          personality: historicPersonality,
          isHistoric: false,
          hasTransitStations: true,
        };

        const result = validateSliders(context);

        expect(result.transit_car.disabled).toBe(false);
      });
    });

    describe("transit_car slider (Transit Requires Transit Stations)", () => {
      it("is disabled when no transit stations exist", () => {
        const context: SliderValidationContext = {
          personality: modernPersonality,
          isHistoric: false,
          hasTransitStations: false,
        };

        const result = validateSliders(context);

        expect(result.transit_car.disabled).toBe(true);
        expect(result.transit_car.constraintReason).toContain("No transit stations");
      });

      it("is enabled when transit stations exist", () => {
        const context: SliderValidationContext = {
          personality: modernPersonality,
          isHistoric: false,
          hasTransitStations: true,
        };

        const result = validateSliders(context);

        expect(result.transit_car.disabled).toBe(false);
      });

      it("historic constraint takes precedence over no-transit constraint", () => {
        const context: SliderValidationContext = {
          personality: historicPersonality,
          isHistoric: true,
          hasTransitStations: false,
        };

        const result = validateSliders(context);

        expect(result.transit_car.disabled).toBe(true);
        // Should mention historic, not no-transit
        expect(result.transit_car.constraintReason).toContain("Historic Districts");
      });
    });
  });

  describe("snapToValidRange", () => {
    it("snaps values below minimum to minimum", () => {
      const state: SliderState = { disabled: false, min: 0.3, max: 1 };
      expect(snapToValidRange(0.1, state)).toBe(0.3);
      expect(snapToValidRange(0, state)).toBe(0.3);
      expect(snapToValidRange(0.29, state)).toBe(0.3);
    });

    it("snaps values above maximum to maximum", () => {
      const state: SliderState = { disabled: false, min: 0, max: 0.8 };
      expect(snapToValidRange(0.9, state)).toBe(0.8);
      expect(snapToValidRange(1, state)).toBe(0.8);
    });

    it("does not change values within range", () => {
      const state: SliderState = { disabled: false, min: 0.3, max: 0.8 };
      expect(snapToValidRange(0.5, state)).toBe(0.5);
      expect(snapToValidRange(0.3, state)).toBe(0.3);
      expect(snapToValidRange(0.8, state)).toBe(0.8);
    });
  });

  describe("isValueValid", () => {
    it("returns true for values within range", () => {
      const state: SliderState = { disabled: false, min: 0.3, max: 0.8 };
      expect(isValueValid(0.5, state)).toBe(true);
      expect(isValueValid(0.3, state)).toBe(true);
      expect(isValueValid(0.8, state)).toBe(true);
    });

    it("returns false for values outside range", () => {
      const state: SliderState = { disabled: false, min: 0.3, max: 0.8 };
      expect(isValueValid(0.1, state)).toBe(false);
      expect(isValueValid(0.9, state)).toBe(false);
      expect(isValueValid(0.29, state)).toBe(false);
    });
  });

  describe("applyConstraints", () => {
    it("snaps out-of-range sprawl values for historic eras", () => {
      const context: SliderValidationContext = {
        personality: { ...historicPersonality, sprawl_compact: 0.1 },
        isHistoric: false,
        hasTransitStations: true,
      };
      const validation = validateSliders(context);

      const result = applyConstraints(context.personality, validation);

      expect(result.sprawl_compact).toBe(HISTORIC_SPRAWL_MIN);
      // Other values should remain unchanged
      expect(result.grid_organic).toBe(0.5);
      expect(result.transit_car).toBe(0.5);
    });

    it("does not change values that are already valid", () => {
      const personality: DistrictPersonality = {
        ...historicPersonality,
        sprawl_compact: 0.5,
      };
      const context: SliderValidationContext = {
        personality,
        isHistoric: false,
        hasTransitStations: true,
      };
      const validation = validateSliders(context);

      const result = applyConstraints(personality, validation);

      expect(result).toEqual(personality);
    });
  });

  describe("getValidationWarnings", () => {
    it("returns warning for out-of-range sprawl value", () => {
      const personality: DistrictPersonality = {
        ...historicPersonality,
        sprawl_compact: 0.1,
      };
      const context: SliderValidationContext = {
        personality,
        isHistoric: false,
        hasTransitStations: true,
      };
      const validation = validateSliders(context);

      const warnings = getValidationWarnings(personality, validation);

      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("Sprawl");
    });

    it("returns empty array when all values are valid", () => {
      const context: SliderValidationContext = {
        personality: historicPersonality,
        isHistoric: false,
        hasTransitStations: true,
      };
      const validation = validateSliders(context);

      const warnings = getValidationWarnings(historicPersonality, validation);

      expect(warnings).toEqual([]);
    });
  });

  describe("HISTORIC_SPRAWL_MIN constant", () => {
    it("is 0.3 as specified in requirements", () => {
      expect(HISTORIC_SPRAWL_MIN).toBe(0.3);
    });
  });
});
