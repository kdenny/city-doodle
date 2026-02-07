/**
 * Name generator for cities, neighborhoods, and districts.
 *
 * Generates realistic-sounding names using prefix/suffix combinations
 * and context-aware suggestions based on nearby features.
 */

/**
 * Generate a random seed value for deterministic name generation.
 * Returns an integer in the range [0, 999999].
 */
function getRandomSeed(): number {
  return Math.floor(Math.random() * 1000000);
}

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
 * Context for generating names aware of nearby features.
 * Used by park and airport name generators for realistic naming.
 */
export interface NamingContext {
  /** World/city name (used for airport naming) */
  worldName?: string;
  /** Names of adjacent districts */
  adjacentDistrictNames?: string[];
  /** Names of nearby water features (lakes, rivers) */
  nearbyWaterNames?: string[];
  /** Types of adjacent districts */
  adjacentDistrictTypes?: NearbyContext[];
}

/**
 * Generate a random city name.
 */
export function generateCityName(options: NameGeneratorOptions = {}): string {
  const seed = options.seed ?? getRandomSeed();
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
  const seed = options.seed ?? getRandomSeed();
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
 *
 * For parks and airports, delegates to context-aware generators when
 * a NamingContext is provided (CITY-380).
 */
export function generateDistrictName(
  districtType: DistrictType,
  options: NameGeneratorOptions = {},
  namingContext?: NamingContext
): string {
  // Delegate to context-aware generators for park and airport types
  if (districtType === "airport") {
    return generateAirportName(options, namingContext);
  }
  if (districtType === "park" && namingContext) {
    return generateContextAwareParkName(options, namingContext);
  }

  const seed = options.seed ?? getRandomSeed();
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
  const seed = baseSeed ?? getRandomSeed();
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
  const seed = options.seed ?? getRandomSeed();
  const names = new Set<string>();

  for (let i = 0; names.size < count && i < count * 3; i++) {
    names.add(generateNeighborhoodName({ ...options, seed: seed + i * 7919 }));
  }

  return Array.from(names);
}

// ============================================
// Natural Feature Name Generation (CITY-188)
// ============================================

// River/stream name components
const RIVER_DESCRIPTORS = [
  "Clear",
  "Stone",
  "Copper",
  "Silver",
  "Mill",
  "Deer",
  "Bear",
  "Fox",
  "Willow",
  "Cedar",
  "Pine",
  "Oak",
  "Maple",
  "Swift",
  "Muddy",
  "Rocky",
  "Sandy",
  "Black",
  "White",
  "Blue",
];

const RIVER_SUFFIXES = [
  "River",
  "Creek",
  "Brook",
  "Run",
  "Stream",
];

// Lake/pond name components
const LAKE_DESCRIPTORS = [
  "Mirror",
  "Crystal",
  "Blue",
  "Hidden",
  "Shadow",
  "Founders",
  "Memorial",
  "Silver",
  "Golden",
  "Emerald",
  "Moonlight",
  "Sunrise",
  "Sunset",
  "Cedar",
  "Pine",
  "Willow",
  "Deep",
  "Clear",
  "Still",
  "Echo",
];

const LAKE_SUFFIXES = [
  "Lake",
  "Pond",
  "Reservoir",
  "Waters",
];

// Bridge name components
const BRIDGE_PREFIXES = [
  "Iron",
  "Stone",
  "Old",
  "New",
  "Market",
  "Mill",
  "Harbor",
  "River",
  "Memorial",
  "Veterans",
  "Liberty",
  "Unity",
  "Commerce",
];

const BRIDGE_SUFFIXES = [
  "Bridge",
  "Crossing",
  "Span",
];

// Plaza/square name components
const PLAZA_PREFIXES = [
  "Liberty",
  "Founders",
  "Market",
  "Commerce",
  "Union",
  "Veterans",
  "Memorial",
  "Central",
  "Grand",
  "City",
];

const PLAZA_SUFFIXES = [
  "Plaza",
  "Square",
  "Commons",
  "Green",
];

/**
 * Generate a river or stream name.
 */
export function generateRiverName(options: NameGeneratorOptions = {}): string {
  const seed = options.seed ?? getRandomSeed();
  const rng = new SeededRandom(seed);

  const descriptor = rng.pick(RIVER_DESCRIPTORS);
  const suffix = rng.pick(RIVER_SUFFIXES);

  return `${descriptor} ${suffix}`;
}

/**
 * Generate a lake or pond name.
 */
export function generateLakeName(options: NameGeneratorOptions = {}): string {
  const seed = options.seed ?? getRandomSeed();
  const rng = new SeededRandom(seed);

  const descriptor = rng.pick(LAKE_DESCRIPTORS);
  const suffix = rng.pick(LAKE_SUFFIXES);

  return `${descriptor} ${suffix}`;
}

/**
 * Generate a bridge name.
 */
export function generateBridgeName(options: NameGeneratorOptions = {}): string {
  const seed = options.seed ?? getRandomSeed();
  const rng = new SeededRandom(seed);

  const prefix = rng.pick(BRIDGE_PREFIXES);
  const suffix = rng.pick(BRIDGE_SUFFIXES);

  return `${prefix} ${suffix}`;
}

/**
 * Generate a plaza or square name.
 */
export function generatePlazaName(options: NameGeneratorOptions = {}): string {
  const seed = options.seed ?? getRandomSeed();
  const rng = new SeededRandom(seed);

  const prefix = rng.pick(PLAZA_PREFIXES);
  const suffix = rng.pick(PLAZA_SUFFIXES);

  return `${prefix} ${suffix}`;
}

/**
 * Generate a park name (enhanced version for standalone parks, not district-type parks).
 * Uses more varied naming patterns than the district park naming.
 */
export function generateParkName(options: NameGeneratorOptions = {}): string {
  const seed = options.seed ?? getRandomSeed();
  const rng = new SeededRandom(seed);

  // Park name patterns:
  // 1. Nature word + Park/Gardens/Green/Reserve (40%)
  // 2. Founder/Memorial + Park (30%)
  // 3. Geographic feature + Park (20%)
  // 4. Tree/Plant + suffix (10%)

  const pattern = rng.next();

  if (pattern < 0.4) {
    // Nature word + suffix
    const natureWords = ["Pinehurst", "Riverside", "Meadow", "Sunset", "Valley", "Hillside", "Lakefront", "Woodland"];
    const suffixes = ["Park", "Gardens", "Green", "Reserve", "Commons"];
    return `${rng.pick(natureWords)} ${rng.pick(suffixes)}`;
  } else if (pattern < 0.7) {
    // Memorial/Founder pattern
    const founderNames = ["Jefferson", "Washington", "Lincoln", "Roosevelt", "Kennedy", "King", "Adams", "Hamilton"];
    const suffixes = ["Memorial Park", "Park", "Memorial"];
    return `${rng.pick(founderNames)} ${rng.pick(suffixes)}`;
  } else if (pattern < 0.9) {
    // Geographic pattern
    const geoWords = ["Hilltop", "Lakeside", "Riverside", "Creekside", "Bayside", "Mountain View", "Valley"];
    return `${rng.pick(geoWords)} Park`;
  } else {
    // Tree/Plant pattern
    const trees = ["Oak", "Cedar", "Pine", "Willow", "Maple", "Birch", "Magnolia", "Elm"];
    const suffixes = ["Park", "Grove", "Gardens"];
    return `${rng.pick(trees)} ${rng.pick(suffixes)}`;
  }
}

/**
 * Generate an airport name using the world/city name.
 *
 * Real airport naming patterns:
 * - "{City} International Airport" (LAX, JFK, Dulles)
 * - "{City} Regional Airport"
 * - "{City} Municipal Airport"
 * - "{City}-{Direction} Airport" (e.g., "Chicago-O'Hare")
 * - "{Notable person} International Airport" (JFK, Reagan)
 *
 * When no world name is available, falls back to generic patterns.
 */
export function generateAirportName(
  options: NameGeneratorOptions = {},
  namingContext?: NamingContext
): string {
  const seed = options.seed ?? getRandomSeed();
  const rng = new SeededRandom(seed);
  const worldName = namingContext?.worldName;

  if (worldName) {
    // Use world name for realistic airport naming (80% of the time)
    if (rng.next() < 0.8) {
      const pattern = rng.next();
      if (pattern < 0.45) {
        return `${worldName} International Airport`;
      } else if (pattern < 0.65) {
        return `${worldName} Regional Airport`;
      } else if (pattern < 0.80) {
        return `${worldName} Municipal Airport`;
      } else {
        // Abbreviated form
        return `${worldName} Int'l Airport`;
      }
    }
  }

  // Fallback: Memorial/notable person pattern
  const notableNames = [
    "Kennedy", "Lincoln", "Reagan", "Marshall", "Grant",
    "Douglas", "Sherman", "Hamilton", "Monroe", "Jackson",
  ];
  const suffixes = ["International Airport", "Regional Airport", "Field", "Airfield"];
  return `${rng.pick(notableNames)} ${rng.pick(suffixes)}`;
}

/**
 * Generate a context-aware park name.
 *
 * When nearby context is available, incorporates it into the name:
 * - Adjacent water feature: "Lakeside Park", "{Water Name} Park"
 * - Adjacent district: "{District Name} Park", "{District Name} Green"
 * - No context: falls back to standard park naming patterns
 */
export function generateContextAwareParkName(
  options: NameGeneratorOptions = {},
  namingContext?: NamingContext
): string {
  const seed = options.seed ?? getRandomSeed();
  const rng = new SeededRandom(seed);

  const waterNames = namingContext?.nearbyWaterNames ?? [];
  const districtNames = namingContext?.adjacentDistrictNames ?? [];

  // 40% chance to reference a nearby water feature if available
  if (waterNames.length > 0 && rng.next() < 0.4) {
    const waterName = rng.pick(waterNames);
    // Extract the base name (e.g., "Crystal" from "Crystal Lake")
    const baseName = waterName.split(" ")[0];
    const pattern = rng.next();
    if (pattern < 0.4) {
      return `${baseName} Park`;
    } else if (pattern < 0.7) {
      return `${waterName} Park`;
    } else {
      const waterPrefixes = ["Lakeside", "Waterfront", "Riverside", "Bayside"];
      return `${rng.pick(waterPrefixes)} Park`;
    }
  }

  // 30% chance to reference an adjacent district if available
  if (districtNames.length > 0 && rng.next() < 0.3) {
    const districtName = rng.pick(districtNames);
    // Extract first word of district name (e.g., "Oak" from "Oak Heights")
    const baseName = districtName.split(" ")[0];
    const suffixes = ["Park", "Green", "Commons", "Gardens"];
    return `${baseName} ${rng.pick(suffixes)}`;
  }

  // Fall back to the existing park name generator
  return generateParkName(options);
}

/**
 * Generate a shopping/commercial district name.
 */
export function generateShoppingDistrictName(options: NameGeneratorOptions = {}): string {
  const seed = options.seed ?? getRandomSeed();
  const rng = new SeededRandom(seed);

  // Shopping district patterns:
  // 1. The + Name (30%)
  // 2. Name + Row/Square/District/Plaza (50%)
  // 3. Contextual reference pattern (20%)

  const pattern = rng.next();

  if (pattern < 0.3) {
    // "The" pattern
    const names = ["Galleria", "Marketplace", "Promenade", "Arcade", "Mall", "Centre", "Exchange"];
    return `The ${rng.pick(names)}`;
  } else if (pattern < 0.8) {
    // Standard pattern
    const prefixes = ["Merchant", "Market", "Commerce", "Trade", "Harbor", "Gateway", "Grand"];
    const suffixes = ["Row", "Square", "District", "Plaza", "Center"];
    return `${rng.pick(prefixes)} ${rng.pick(suffixes)}`;
  } else {
    // Contextual pattern (references a nearby feature type)
    const contexts = options.nearbyContexts ?? [];
    if (contexts.includes("water")) {
      return rng.pick(["Waterfront Shops", "Harbor Market", "Marina District", "Bayside Center"]);
    } else if (contexts.includes("downtown")) {
      return rng.pick(["Downtown Market", "City Center Shops", "Main Street District", "Central Market"]);
    } else {
      return rng.pick(["Village Square", "Town Center", "Crossroads Market", "Station Plaza"]);
    }
  }
}
