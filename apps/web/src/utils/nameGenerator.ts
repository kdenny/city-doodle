/**
 * Name generator for cities, neighborhoods, and districts.
 *
 * Generates realistic-sounding names using prefix/suffix combinations
 * and context-aware suggestions based on nearby features.
 */

/**
 * Simple seeded random number generator for deterministic names.
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  intRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  pick<T>(arr: T[]): T {
    return arr[this.intRange(0, arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.intRange(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// City name components
const CITY_PREFIXES = [
  "North",
  "South",
  "East",
  "West",
  "New",
  "Old",
  "Lake",
  "River",
  "Oak",
  "Pine",
  "Cedar",
  "Mill",
  "Harbor",
  "Green",
  "Fair",
  "Spring",
  "Bay",
  "Hill",
  "Stone",
  "Silver",
  "Golden",
  "Maple",
  "Willow",
  "Crystal",
  "Sun",
  "Moon",
];

const CITY_SUFFIXES = [
  "ville",
  "ton",
  "wood",
  "view",
  "dale",
  "field",
  "brook",
  "port",
  "gate",
  "haven",
  "ridge",
  "ford",
  "bury",
  "mont",
  "land",
  "crest",
];

const CITY_STANDALONE = [
  "Riverside",
  "Lakeview",
  "Harborview",
  "Millbrook",
  "Greenfield",
  "Fairview",
  "Springfield",
  "Oakdale",
  "Cedarville",
  "Pinewood",
  "Stonegate",
  "Bayview",
  "Hillcrest",
  "Silverton",
  "Maplewood",
  "Willowbrook",
  "Sundale",
  "Northgate",
  "Southfield",
  "Eastwood",
  "Westport",
  "Newport",
  "Newbury",
];

// Neighborhood name components by context
const NEIGHBORHOOD_CONTEXTS = {
  water: {
    prefixes: ["Harbor", "Lake", "River", "Bay", "Marina", "Waterfront", "Pier"],
    suffixes: ["Landing", "Shore", "Point", "Cove", "View"],
  },
  park: {
    prefixes: ["Green", "Park", "Garden", "Forest", "Meadow", "Grove"],
    suffixes: ["Heights", "Commons", "Glen", "View", "Side"],
  },
  downtown: {
    prefixes: ["Central", "Mid", "Up", "Old", "Market", "Main"],
    suffixes: ["town", "District", "Square", "Quarter", "Center"],
  },
  industrial: {
    prefixes: ["Iron", "Mill", "Foundry", "Factory", "Works"],
    suffixes: ["District", "Works", "Quarter", "Yards"],
  },
  residential: {
    prefixes: ["Oak", "Maple", "Pine", "Cedar", "Elm", "Birch", "Willow", "Cherry"],
    suffixes: ["Heights", "Village", "Glen", "Park", "Grove", "Hills", "Terrace"],
  },
  commercial: {
    prefixes: ["Commerce", "Trade", "Market", "Plaza", "Gateway"],
    suffixes: ["District", "Center", "Square", "Row"],
  },
  general: {
    prefixes: [
      "North",
      "South",
      "East",
      "West",
      "Upper",
      "Lower",
      "Old",
      "New",
    ],
    suffixes: ["side", "town", "District", "Quarter", "Heights", "Park"],
  },
};

const NEIGHBORHOOD_STANDALONE = [
  "The Flats",
  "The Heights",
  "Downtown",
  "Midtown",
  "Uptown",
  "The Waterfront",
  "The Marina",
  "Old Town",
  "The Village",
  "The Commons",
];

export type DistrictType =
  | "residential"
  | "downtown"
  | "commercial"
  | "industrial"
  | "hospital"
  | "university"
  | "k12"
  | "park"
  | "airport";

export type NearbyContext = "water" | "park" | "downtown" | "industrial" | "residential" | "commercial";

export interface NameGeneratorOptions {
  /** Seed for deterministic generation */
  seed?: number;
  /** Nearby feature types for context-aware naming */
  nearbyContexts?: NearbyContext[];
}

/**
 * Generate a random city name.
 */
export function generateCityName(options: NameGeneratorOptions = {}): string {
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);
  const rng = new SeededRandom(seed);

  // 30% chance of using a standalone name
  if (rng.next() < 0.3) {
    return rng.pick(CITY_STANDALONE);
  }

  // Otherwise, combine prefix + suffix
  const prefix = rng.pick(CITY_PREFIXES);
  const suffix = rng.pick(CITY_SUFFIXES);

  return `${prefix}${suffix}`;
}

/**
 * Generate a neighborhood/district name with optional context awareness.
 */
export function generateNeighborhoodName(options: NameGeneratorOptions = {}): string {
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);
  const rng = new SeededRandom(seed);
  const contexts = options.nearbyContexts ?? [];

  // 15% chance of standalone name
  if (rng.next() < 0.15) {
    return rng.pick(NEIGHBORHOOD_STANDALONE);
  }

  // Choose context for naming
  let contextKey: keyof typeof NEIGHBORHOOD_CONTEXTS = "general";
  if (contexts.length > 0) {
    // Use first matching context with 70% probability
    if (rng.next() < 0.7) {
      contextKey = contexts[0] as keyof typeof NEIGHBORHOOD_CONTEXTS;
    }
  }

  const context = NEIGHBORHOOD_CONTEXTS[contextKey] || NEIGHBORHOOD_CONTEXTS.general;
  const prefix = rng.pick(context.prefixes);
  const suffix = rng.pick(context.suffixes);

  return `${prefix} ${suffix}`;
}

/**
 * Generate a district name based on district type.
 */
export function generateDistrictName(
  districtType: DistrictType,
  options: NameGeneratorOptions = {}
): string {
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);
  const rng = new SeededRandom(seed);

  const prefixes: Record<DistrictType, string[]> = {
    residential: ["Oak", "Maple", "Pine", "Cedar", "Elm", "Birch", "Willow", "Cherry", "Aspen"],
    downtown: ["Central", "Main", "Market", "Metro", "Core", "City", "Grand"],
    commercial: ["Harbor", "Gateway", "Plaza", "Commerce", "Trade", "Market"],
    industrial: ["Foundry", "Steel", "Iron", "Factory", "Mill", "Works"],
    hospital: ["Medical", "Health", "Care", "Mercy", "Grace", "Memorial"],
    university: ["Scholar", "Academy", "Campus", "College", "Learning", "Knowledge"],
    k12: ["Lincoln", "Washington", "Jefferson", "Roosevelt", "Kennedy", "Madison"],
    park: ["Green", "Meadow", "Garden", "Nature", "Forest", "Riverside", "Sunset"],
    airport: ["Sky", "Flight", "Aviation", "Aero", "Wing", "Horizon"],
  };

  const suffixes: Record<DistrictType, string[]> = {
    residential: ["Heights", "Village", "Neighborhood", "Commons", "Grove", "Hills", "Terrace"],
    downtown: ["District", "Square", "Center", "Hub", "Core"],
    commercial: ["District", "Center", "Square", "Quarter", "Plaza"],
    industrial: ["Park", "Zone", "District", "Works", "Yards"],
    hospital: ["Center", "Campus", "District", "Complex"],
    university: ["Quarter", "District", "Campus", "Center"],
    k12: ["School District", "Learning Center", "Academy"],
    park: ["Park", "Gardens", "Reserve", "Commons", "Green"],
    airport: ["Field", "Port", "Hub", "International"],
  };

  // Use context from options if provided
  const nearbyContexts = options.nearbyContexts ?? [];

  // Sometimes incorporate nearby context into the name
  if (nearbyContexts.length > 0 && rng.next() < 0.3) {
    const context = nearbyContexts[0];
    const contextPrefixes = NEIGHBORHOOD_CONTEXTS[context]?.prefixes;
    if (contextPrefixes && contextPrefixes.length > 0) {
      const prefix = rng.pick(contextPrefixes);
      const suffix = rng.pick(suffixes[districtType]);
      return `${prefix} ${suffix}`;
    }
  }

  const prefix = rng.pick(prefixes[districtType]);
  const suffix = rng.pick(suffixes[districtType]);

  return `${prefix} ${suffix}`;
}

/**
 * Generate multiple unique city name suggestions.
 */
export function generateCityNameSuggestions(count: number = 5, baseSeed?: number): string[] {
  const seed = baseSeed ?? Math.floor(Math.random() * 1000000);
  const names = new Set<string>();

  for (let i = 0; names.size < count && i < count * 3; i++) {
    names.add(generateCityName({ seed: seed + i * 7919 }));
  }

  return Array.from(names);
}

/**
 * Generate multiple unique neighborhood name suggestions.
 */
export function generateNeighborhoodNameSuggestions(
  count: number = 5,
  options: NameGeneratorOptions = {}
): string[] {
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);
  const names = new Set<string>();

  for (let i = 0; names.size < count && i < count * 3; i++) {
    names.add(generateNeighborhoodName({ ...options, seed: seed + i * 7919 }));
  }

  return Array.from(names);
}
