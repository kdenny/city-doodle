/**
 * Seed types and placement-related types.
 */

export type SeedCategory = "district" | "poi" | "transit";

export interface SeedType {
  id: string;
  label: string;
  category: SeedCategory;
  icon: string; // Emoji for now, could be SVG path later
  description: string;
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
    id: "park",
    label: "Park",
    category: "poi",
    icon: "🌳",
    description: "Green space and recreation",
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
  // Stadiums (large POIs with street grid impact)
  {
    id: "baseball_stadium",
    label: "Baseball Stadium",
    category: "poi",
    icon: "⚾",
    description: "Baseball stadium with parking",
  },
  {
    id: "football_stadium",
    label: "Football Stadium",
    category: "poi",
    icon: "🏈",
    description: "Football stadium with parking",
  },
  {
    id: "arena",
    label: "Arena",
    category: "poi",
    icon: "🏟️",
    description: "Multi-purpose arena",
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
  { id: "poi", label: "Points of Interest" },
  { id: "transit", label: "Transit" },
];

export function getSeedsByCategory(category: SeedCategory): SeedType[] {
  return SEED_TYPES.filter((seed) => seed.category === category);
}
