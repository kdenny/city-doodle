/**
 * Auto-generate POIs matching district type on district placement (CITY-345).
 *
 * When a district is placed, generates 2-5 appropriate POIs inside the polygon
 * at plausible, spread-out locations. The user can delete or move them afterward.
 */

import type { Point, POI, POIType, DistrictType } from "./types";
import { pointInPolygon, getPolygonBounds } from "./polygonUtils";
import { generateId } from "../../../utils/idGenerator";

// ============================================================================
// District type -> POI type mapping
// ============================================================================

/**
 * POI template: a POI type with either contextual street-based naming or a
 * fixed name pool for institutional POIs.
 *
 * Contextual templates combine a generated street name with a suffix
 * (e.g. "Oak St Cafe"). Fixed templates pick from a static pool
 * (e.g. "Memorial Hospital").
 */
interface POITemplate {
  type: POIType;
  /** Suffixes combined with a street name for contextual naming (CITY-416). */
  suffixes?: string[];
  /** Static name pool for institutional POIs that don't use street names. */
  namePool?: string[];
}

// Street name prefixes for contextual POI naming (CITY-416)
const STREET_NAME_PREFIXES = [
  "Oak", "Elm", "Maple", "Pine", "Cedar", "Birch", "Willow", "Main", "Park",
  "Lake", "River", "Hill", "Harbor", "Bay", "Bridge", "Mill", "Church",
  "Market", "Spring", "Meadow", "Forest", "Ridge", "Valley", "Sunset",
  "Highland", "Grove", "Prospect", "Union", "Franklin", "Liberty",
];

const STREET_TYPE_SUFFIXES = ["St", "Ave", "Blvd", "Dr", "Ln", "Way", "Rd", "Pl"];

/**
 * Mapping from district type to the set of POI templates that should be
 * auto-generated when that district type is placed.
 *
 * Templates with `suffixes` use contextual street-name-based naming.
 * Templates with `namePool` use traditional fixed names (for institutions).
 * District types that should NOT generate POIs (e.g., park, airport) are
 * omitted and will return an empty array.
 */
const DISTRICT_POI_TEMPLATES: Partial<Record<DistrictType, POITemplate[]>> = {
  hospital: [
    { type: "hospital", namePool: ["General Hospital", "Memorial Hospital", "City Medical Center", "Regional Hospital", "Community Hospital"] },
    { type: "civic", namePool: ["Medical Office Building", "Health Sciences Library", "Research Pavilion", "Urgent Care Clinic"] },
  ],
  downtown: [
    { type: "civic", namePool: ["City Hall", "Municipal Building", "Civic Center", "County Courthouse"] },
    { type: "shopping", suffixes: ["Market", "Shops", "Plaza", "Galleria", "Emporium"] },
    { type: "transit", namePool: ["Central Station", "Downtown Transit Hub", "Bus Terminal", "Metro Station"] },
  ],
  university: [
    { type: "university", namePool: ["Main Campus Hall", "University Hall", "Administration Building", "Founders Hall"] },
    { type: "civic", namePool: ["University Library", "Student Union", "Campus Commons", "Recreation Center"] },
  ],
  industrial: [
    { type: "industrial", suffixes: ["Manufacturing", "Assembly Works", "Production Facility", "Processing Plant"] },
    { type: "industrial", suffixes: ["Warehouse", "Logistics Center", "Freight Terminal", "Storage Depot"] },
  ],
  k12: [
    { type: "school", namePool: ["Elementary School", "Primary School", "Middle School", "Academy", "Preparatory School"] },
    { type: "park", namePool: ["School Playground", "Athletic Field", "Sports Complex"] },
  ],
  residential: [
    { type: "park", namePool: ["Community Park", "Pocket Park", "Playground", "Dog Park", "Neighborhood Green"] },
    { type: "shopping", suffixes: ["Cafe", "Bakery", "Deli", "Coffee House", "Corner Store"] },
  ],
  commercial: [
    { type: "shopping", suffixes: ["Shopping Center", "Retail Plaza", "Marketplace", "Town Center"] },
    { type: "civic", suffixes: ["Office Park", "Business Center", "Professional Building"] },
  ],
};

/**
 * How many POIs to generate per district type.
 * Range [min, max] -- actual count is randomly selected within this range.
 */
const POI_COUNT_RANGE: Partial<Record<DistrictType, [number, number]>> = {
  hospital: [2, 3],
  downtown: [3, 5],
  university: [3, 4],
  industrial: [2, 3],
  k12: [2, 3],
  residential: [2, 3],
  commercial: [3, 4],
};

// ============================================================================
// Simple seeded random (matches codebase pattern)
// ============================================================================

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

// ============================================================================
// Position generation
// ============================================================================

/**
 * Minimum distance between generated POIs (in world units) to ensure spread.
 */
const MIN_POI_SPACING = 1.5;

/**
 * Inset margin from polygon edges (fraction of bounding-box dimension).
 * Keeps POIs from sitting right on the boundary.
 */
const EDGE_INSET_FRACTION = 0.15;

/**
 * Generate candidate positions inside a polygon that are well-spread-out.
 *
 * Uses rejection sampling: pick random points inside the bounding box,
 * keep those that pass point-in-polygon and minimum-spacing checks.
 *
 * @param polygon - Polygon vertices
 * @param count - Number of positions to generate
 * @param rng - Seeded random instance
 * @returns Array of points inside the polygon
 */
function generateSpreadPositions(
  polygon: Point[],
  count: number,
  rng: SeededRandom
): Point[] {
  const bounds = getPolygonBounds(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  // Inset the sampling area slightly from the edges
  const insetX = width * EDGE_INSET_FRACTION;
  const insetY = height * EDGE_INSET_FRACTION;
  const sampleMinX = bounds.minX + insetX;
  const sampleMaxX = bounds.maxX - insetX;
  const sampleMinY = bounds.minY + insetY;
  const sampleMaxY = bounds.maxY - insetY;

  const positions: Point[] = [];
  const maxAttempts = count * 50; // Generous limit to avoid infinite loops
  let attempts = 0;

  while (positions.length < count && attempts < maxAttempts) {
    attempts++;

    const candidate: Point = {
      x: sampleMinX + rng.next() * (sampleMaxX - sampleMinX),
      y: sampleMinY + rng.next() * (sampleMaxY - sampleMinY),
    };

    // Must be inside the polygon
    if (!pointInPolygon(candidate, polygon)) continue;

    // Must be far enough from all existing positions
    const tooClose = positions.some((existing) => {
      const dx = candidate.x - existing.x;
      const dy = candidate.y - existing.y;
      return Math.sqrt(dx * dx + dy * dy) < MIN_POI_SPACING;
    });
    if (tooClose) continue;

    positions.push(candidate);
  }

  return positions;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a contextual street name like "Oak St" or "Harbor Ave".
 */
function generateStreetName(rng: SeededRandom, usedPrefixes: Set<string>): string {
  const available = STREET_NAME_PREFIXES.filter((p) => !usedPrefixes.has(p));
  const prefix = available.length > 0 ? rng.pick(available) : rng.pick(STREET_NAME_PREFIXES);
  usedPrefixes.add(prefix);
  const type = rng.pick(STREET_TYPE_SUFFIXES);
  return `${prefix} ${type}`;
}

/**
 * Auto-generate POIs for a newly placed district.
 *
 * Uses contextual street-name-based naming (CITY-416) for commercial POIs
 * (e.g. "Oak St Cafe") and static name pools for institutional POIs
 * (e.g. "Memorial Hospital").
 *
 * @param districtType - The type of district being placed
 * @param polygon - The district polygon vertices
 * @param _districtName - Name of the district (reserved for future use)
 * @returns Array of POI objects ready to be added via addPOI / bulk create
 */
export function generatePOIsForDistrict(
  districtType: DistrictType,
  polygon: Point[],
  _districtName: string
): POI[] {
  const templates = DISTRICT_POI_TEMPLATES[districtType];
  if (!templates || templates.length === 0) return [];

  const countRange = POI_COUNT_RANGE[districtType] ?? [2, 3];

  // Derive a seed from the district polygon centroid for determinism when
  // the same position is used. Uses the same pattern as districtGenerator.
  const centroid = polygon.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  centroid.x /= polygon.length;
  centroid.y /= polygon.length;
  const seed = Math.floor(centroid.x * 1000 + centroid.y * 7919);
  const rng = new SeededRandom(seed);

  // Determine how many POIs to generate
  const count = rng.intRange(countRange[0], countRange[1] + 1);

  // Shuffle templates and take `count` of them
  const shuffled = rng.shuffle(templates);
  const selected = shuffled.slice(0, count);

  // Generate spread-out positions inside the polygon
  const positions = generateSpreadPositions(polygon, count, rng);

  // Build POI objects with contextual naming (CITY-416)
  const usedNames = new Set<string>();
  const usedStreetPrefixes = new Set<string>();
  const pois: POI[] = [];
  for (let i = 0; i < Math.min(selected.length, positions.length); i++) {
    const template = selected[i];

    let name: string;
    if (template.suffixes) {
      // Contextual naming: "[street name] [suffix]"
      const streetName = generateStreetName(rng, usedStreetPrefixes);
      const suffix = rng.pick(template.suffixes);
      name = `${streetName} ${suffix}`;
    } else if (template.namePool) {
      // Institutional naming: pick from static pool, avoiding duplicates
      const available = template.namePool.filter((n) => !usedNames.has(n));
      if (available.length === 0) continue;
      name = rng.pick(available);
    } else {
      continue;
    }
    usedNames.add(name);

    pois.push({
      id: generateId("poi"),
      name,
      type: template.type,
      position: positions[i],
    });
  }

  return pois;
}
