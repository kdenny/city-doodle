/**
 * Seed types and placement-related types.
 */

export type SeedCategory = "district" | "poi" | "transit" | "park";

/**
+ * Park size preset options.
+ */
export type ParkSize = "pocket" | "neighborhood" | "community" | "regional" | "city";

export interface SeedType {
  id: string;
  label: string;
  category: SeedCategory;
  icon: string; // Emoji for now, could be SVG path later
  description: string;
  /**
   * Whether this seed type can be placed independent of districts.
   * Parks have this set to true, allowing placement anywhere.
   */
  independentPlacement?: boolean;
  /**
   * Available size presets for this seed type (only for parks).
   */
  sizePresets?: ParkSize[];
}

// All available seed types for placement
export const SEED_TYPES: SeedType[] = [
  // Districts
  {
    id: "residential",
    label: "Residential",
    category: "district",
    icon: "🏘️",
    description: "Housing and neighborhoods",
  },
  {
    id: "downtown",
    label: "Downtown",
    category: "district",
    icon: "🏙️",
    description: "Mixed-use urban core",
  },
  {
    id: "shopping",
    label: "Shopping",
    category: "district",
    icon: "🛍️",
    description: "Retail and commercial",
  },
  {
    id: "industrial",
    label: "Industrial",
    category: "district",
    icon: "🏭",
    description: "Manufacturing and warehouses",
  },
  // POIs
  {
    id: "hospital",
    label: "Hospital",
    category: "poi",
    icon: "🏥",
    description: "Medical center",
  },
  {
    id: "university",
    label: "University",
    category: "poi",
    icon: "🎓",
    description: "Higher education campus",
  },
  {
    id: "k12",
    label: "K-12 School",
    category: "poi",
    icon: "🏫",
    description: "Primary and secondary school",
  },
  {
    id: "trail",
    label: "Trail",
    category: "poi",
    icon: "🚶",
    description: "Walking and biking path",
  },
  {
    id: "airport",
    label: "Airport",
    category: "poi",
    icon: "✈️",
    description: "Regional airport",
  },
  // Parks (independent placement)
  {
    id: "park_pocket",
    label: "Pocket Park",
    category: "park",
    icon: "🌱",
    description: "Small neighborhood green space (0.1-0.5 acres)",
    independentPlacement: true,
    sizePresets: ["pocket"],
  },
  {
    id: "park_neighborhood",
    label: "Neighborhood Park",
    category: "park",
    icon: "🌳",
    description: "Local park with playground (1-5 acres)",
    independentPlacement: true,
    sizePresets: ["neighborhood"],
  },
  {
    id: "park_community",
    label: "Community Park",
    category: "park",
    icon: "🏞️",
    description: "Multi-use park with sports fields (10-50 acres)",
    independentPlacement: true,
    sizePresets: ["community"],
  },
  {
    id: "park_regional",
    label: "Regional Park",
    category: "park",
    icon: "🌲",
    description: "Large natural area with trails (50-200 acres)",
    independentPlacement: true,
    sizePresets: ["regional"],
  },
  {
    id: "park_city",
    label: "City Park",
    category: "park",
    icon: "🏛️",
    description: "Major urban park (200+ acres, like Central Park)",
    independentPlacement: true,
    sizePresets: ["city"],
  },
  // Transit
  {
    id: "subway",
    label: "Subway Station",
    category: "transit",
    icon: "🚇",
    description: "Underground metro stop",
  },
  {
    id: "rail_station",
    label: "Rail Station",
    category: "transit",
    icon: "🚂",
    description: "Commuter rail station with visible tracks (must be placed in district)",
  },
];

export const SEED_CATEGORIES: { id: SeedCategory; label: string }[] = [
  { id: "district", label: "Districts" },
  { id: "park", label: "Parks" },
  { id: "poi", label: "Points of Interest" },
  { id: "transit", label: "Transit" },
];

/**
 * Park size configurations in world units (768 = 50 miles).
 * Sizes are based on real-world park size guidelines.
 */
export const PARK_SIZE_CONFIG: Record<
  ParkSize,
  {
    label: string;
    /** Base radius in world units (~105m per world unit) */
    radiusWorldUnits: number;
    /** Size range in acres for display */
    acresRange: string;
    /** Whether this size includes internal features */
    hasInternalFeatures: boolean;
    /** Feature density (0-1) for internal paths, ponds, etc. */
    featureDensity: number;
  }
> = {
  pocket: {
    label: "Pocket",
    radiusWorldUnits: 0.5, // ~50m radius
    acresRange: "0.1-0.5",
    hasInternalFeatures: false,
    featureDensity: 0,
  },
  neighborhood: {
    label: "Neighborhood",
    radiusWorldUnits: 2, // ~200m radius
    acresRange: "1-5",
    hasInternalFeatures: true,
    featureDensity: 0.3,
  },
  community: {
    label: "Community",
    radiusWorldUnits: 5, // ~500m radius
    acresRange: "10-50",
    hasInternalFeatures: true,
    featureDensity: 0.5,
  },
  regional: {
    label: "Regional",
    radiusWorldUnits: 10, // ~1km radius
    acresRange: "50-200",
    hasInternalFeatures: true,
    featureDensity: 0.7,
  },
  city: {
    label: "City",
    radiusWorldUnits: 20, // ~2km radius
    acresRange: "200+",
    hasInternalFeatures: true,
    featureDensity: 0.8,
  },
};

export function getSeedsByCategory(category: SeedCategory): SeedType[] {
  return SEED_TYPES.filter((seed) => seed.category === category);
}
