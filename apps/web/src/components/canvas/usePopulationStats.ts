/**
 * Hook for calculating population statistics from placed districts.
 */

import { useMemo } from "react";
import type { District, Point } from "./layers";
import { useFeaturesOptional } from "./FeaturesContext";

/**
 * Population density per square unit (in our coordinate system).
 * These are approximate and will scale based on district area.
 */
const POPULATION_DENSITY: Record<string, number> = {
  // Residential types - people per 10,000 sq units
  residential: 2000,
  downtown: 8000, // High density downtown living
  commercial: 500, // Some residential above shops
  industrial: 50, // Very few residents
  hospital: 200, // Staff, patients
  university: 1500, // Students, staff, housing
  k12: 100, // School staff only
  park: 0, // No permanent residents
  airport: 50, // Workers only
};

/**
 * Calculate the area of a polygon using the Shoelace formula.
 */
function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Calculate population for a single district based on its type and area.
 */
function calculateDistrictPopulation(district: District): number {
  const area = calculatePolygonArea(district.polygon.points);
  const densityPer10kSqUnits = POPULATION_DENSITY[district.type] || 500;

  // Scale by area (density is per 10,000 sq units)
  const population = (area / 10000) * densityPer10kSqUnits;

  // Apply sprawl_compact modifier if personality is set
  // compact (1.0) = 1.5x density, sprawl (0.0) = 0.7x density
  if (district.personality) {
    const compactMultiplier = 0.7 + district.personality.sprawl_compact * 0.8;
    return Math.round(population * compactMultiplier);
  }

  return Math.round(population);
}

export interface PopulationStats {
  /** Total population across all districts */
  totalPopulation: number;
  /** Population growth percentage (simulated for now) */
  growthPercent: number;
  /** Population by district type */
  populationByType: Record<string, number>;
  /** Number of districts */
  districtCount: number;
}

/**
 * Hook to calculate population statistics from features context.
 * Returns null if no features context is available.
 */
export function usePopulationStats(): PopulationStats | null {
  const features = useFeaturesOptional();

  return useMemo(() => {
    if (!features) return null;

    const districts = features.features.districts;
    const populationByType: Record<string, number> = {};
    let totalPopulation = 0;

    for (const district of districts) {
      const pop = calculateDistrictPopulation(district);
      totalPopulation += pop;
      populationByType[district.type] =
        (populationByType[district.type] || 0) + pop;
    }

    // Growth rate is simulated based on district mix
    // More residential = faster growth, more industrial = slower
    const residentialRatio =
      totalPopulation > 0
        ? ((populationByType["residential"] || 0) +
            (populationByType["downtown"] || 0)) /
          totalPopulation
        : 0.5;
    const growthPercent = 1.0 + residentialRatio * 3.0; // 1% to 4%

    return {
      totalPopulation,
      growthPercent: Math.round(growthPercent * 10) / 10,
      populationByType,
      districtCount: districts.length,
    };
  }, [features]);
}

/**
 * Calculate population for a list of districts directly.
 * Use this when you don't have access to FeaturesContext.
 */
export function calculatePopulation(districts: District[]): PopulationStats {
  const populationByType: Record<string, number> = {};
  let totalPopulation = 0;

  for (const district of districts) {
    const pop = calculateDistrictPopulation(district);
    totalPopulation += pop;
    populationByType[district.type] =
      (populationByType[district.type] || 0) + pop;
  }

  const residentialRatio =
    totalPopulation > 0
      ? ((populationByType["residential"] || 0) +
          (populationByType["downtown"] || 0)) /
        totalPopulation
      : 0.5;
  const growthPercent = 1.0 + residentialRatio * 3.0;

  return {
    totalPopulation,
    growthPercent: Math.round(growthPercent * 10) / 10,
    populationByType,
    districtCount: districts.length,
  };
}
