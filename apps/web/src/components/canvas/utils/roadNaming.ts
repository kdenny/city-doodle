/**
 * Auto-naming utility for roads (CITY-567).
 *
 * Generates contextually appropriate names for roads based on their class:
 * - Highway: "Interstate 42", "Highway 101", etc.
 * - Arterial: "Oak Boulevard", "Maple Avenue", etc.
 * - Collector: "Elm Street", "Cedar Drive", etc.
 * - Local/Trail: "Pine Lane", "Birch Court", etc.
 *
 * Names are unique within the current road set. A seeded RNG option
 * allows deterministic naming for grid-generated roads.
 */

import type { RoadClass } from "../layers/types";

// Word lists for generating road names
const HIGHWAY_PREFIXES = ["Interstate", "Highway", "Route", "Expressway"];
const BOULEVARD_NAMES = [
  "Oak", "Elm", "Maple", "Cedar", "Pine", "Birch", "Willow", "Ash",
  "Walnut", "Chestnut", "Magnolia", "Cypress", "Redwood", "Sequoia",
  "Laurel", "Poplar", "Hickory", "Spruce", "Sycamore", "Beech",
];
const ARTERIAL_SUFFIXES = ["Boulevard", "Avenue", "Parkway"];
const COLLECTOR_SUFFIXES = ["Street", "Drive", "Road", "Way"];
const LOCAL_SUFFIXES = ["Lane", "Court", "Place", "Circle", "Terrace"];

/**
 * Simple seeded RNG (mulberry32).
 * Returns a function that yields a new pseudo-random float in [0, 1) each call.
 */
function seededRandom(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a contextually appropriate name for a road based on its class.
 *
 * @param roadClass - The road's hierarchy class
 * @param existingNames - Set of names already in use (to avoid duplicates)
 * @param seed - Optional seed for deterministic name generation
 * @returns A unique road name
 */
export function generateRoadName(
  roadClass: RoadClass,
  existingNames: Set<string>,
  seed?: number
): string {
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;

  let name: string;
  let attempts = 0;

  do {
    switch (roadClass) {
      case "highway": {
        const prefix = HIGHWAY_PREFIXES[Math.floor(rng() * HIGHWAY_PREFIXES.length)];
        const num = Math.floor(rng() * 200) + 1;
        name = `${prefix} ${num}`;
        break;
      }
      case "arterial": {
        const artName = BOULEVARD_NAMES[Math.floor(rng() * BOULEVARD_NAMES.length)];
        const artSuffix = ARTERIAL_SUFFIXES[Math.floor(rng() * ARTERIAL_SUFFIXES.length)];
        name = `${artName} ${artSuffix}`;
        break;
      }
      case "collector": {
        const colName = BOULEVARD_NAMES[Math.floor(rng() * BOULEVARD_NAMES.length)];
        const colSuffix = COLLECTOR_SUFFIXES[Math.floor(rng() * COLLECTOR_SUFFIXES.length)];
        name = `${colName} ${colSuffix}`;
        break;
      }
      case "local":
      case "trail":
      default: {
        const locName = BOULEVARD_NAMES[Math.floor(rng() * BOULEVARD_NAMES.length)];
        const locSuffix = LOCAL_SUFFIXES[Math.floor(rng() * LOCAL_SUFFIXES.length)];
        name = `${locName} ${locSuffix}`;
        break;
      }
    }
    attempts++;
  } while (existingNames.has(name) && attempts < 100);

  // If still duplicate after 100 attempts, append a numeric suffix
  if (existingNames.has(name)) {
    let suffix = 2;
    while (existingNames.has(`${name} ${suffix}`)) suffix++;
    name = `${name} ${suffix}`;
  }

  return name;
}
