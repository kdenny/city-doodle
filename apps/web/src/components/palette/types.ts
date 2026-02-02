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
  // Transit
  {
    id: "train_station",
    label: "Train Station",
    category: "transit",
    icon: "🚆",
    description: "Commuter rail stop",
  },
  {
    id: "subway",
    label: "Subway Station",
    category: "transit",
    icon: "🚇",
    description: "Metro/subway stop",
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
