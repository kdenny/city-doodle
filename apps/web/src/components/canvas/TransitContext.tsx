/**
 * Context for managing transit data (rail and subway stations, lines, and tracks).
 *
 * Provides methods to add, remove, and update transit stations and lines.
 * Both rail and subway stations must be placed inside districts.
 * Handles auto-connection of nearby stations on the same line.
 *
 * Key differences between rail and subway:
 * - Rail: Visible tracks on map surface (railroad ties, parallel rails)
 * - Subway: Underground lines NOT visible on surface (only stations visible)
 *           In transit view, subway lines shown as dashed/dotted lines
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import type { Point } from "./layers";
import { pointInPolygon, toSubwayStationData, generateStationAccessRoad } from "./layers";
import type { RailStationData, TrackSegmentData, SubwayStationData, SubwayTunnelData } from "./layers";
import {
  useTransitNetwork,
  useCreateTransitStation,
  useCreateTransitLine,
  useCreateTransitLineSegment,
  useDeleteTransitStation,
  useDeleteTransitLine,
  useUpdateTransitLine,
  useUpdateTransitStation,
} from "../../api/hooks";
import type {
  TransitStation,
  TransitNetwork,
  TransitLine,
  StationType,
  LineType,
} from "../../api/types";
import { useFeaturesOptional } from "./FeaturesContext";
import { generateTransitPOIs } from "./layers/poiAutoGenerator";
import { useToastOptional } from "../../contexts";

// Auto-connection distance for nearby stations (in world units)
const AUTO_CONNECT_DISTANCE = 200;

// Distance threshold for detecting co-located cross-type transfer stations
const TRANSFER_STATION_DISTANCE = 60;

// Minimum distance between stations of the same type to prevent duplicates
export const MINIMUM_STATION_DISTANCE = 30;

// Default colors for rail lines
const RAIL_LINE_COLORS = [
  "#B22222", // Firebrick Red
  "#2E8B57", // Sea Green
  "#4169E1", // Royal Blue
  "#DAA520", // Goldenrod
  "#8B4513", // Saddle Brown
  "#663399", // Rebecca Purple
];

// Default colors for subway lines (more vibrant metro colors)
const SUBWAY_LINE_COLORS = [
  "#0066CC", // Blue (like NYC A/C/E)
  "#FF6600", // Orange (like NYC B/D/F/M)
  "#00933C", // Green (like NYC 4/5/6)
  "#FCCC0A", // Yellow (like NYC N/Q/R/W)
  "#EE352E", // Red (like NYC 1/2/3)
  "#A626AA", // Purple (like NYC 7)
  "#6CBE45", // Lime (like NYC G)
  "#996633", // Brown (like NYC J/Z)
];

/**
 * Find the first unused color from a palette, given existing line colors.
 * Falls back to cycling with an offset if all colors are taken.
 */
function nextUnusedColor(palette: string[], usedColors: Set<string>): string {
  for (const color of palette) {
    if (!usedColors.has(color)) return color;
  }
  // All colors used; cycle from the start (unavoidable with more lines than colors)
  return palette[usedColors.size % palette.length];
}

/**
 * Find the smallest N where "{prefix} {N}" is not already taken.
 */
function nextUnusedName(prefix: string, usedNames: Set<string>): string {
  for (let n = 1; ; n++) {
    const name = `${prefix} ${n}`;
    if (!usedNames.has(name)) return name;
  }
}

/**
 * Result of a station placement validation.
 */
export interface StationValidation {
  isValid: boolean;
  districtId: string | null;
  districtName: string | null;
  error?: string;
}

/**
 * Result of a rail station placement validation.
 * @deprecated Use StationValidation instead
 */
export interface RailStationValidation {
  isValid: boolean;
  districtId: string | null;
  districtName: string | null;
  error?: string;
}

// Re-export SubwayTunnelData from layers for convenience
export type { SubwayTunnelData } from "./layers";

/**
 * Calculate the centroid of a polygon from its points.
 */
function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Get a directional suffix (North, South, East, West, etc.) based on
 * the station's position relative to the district centroid.
 */
function getDirectionalSuffix(
  position: Point,
  centroid: Point
): string {
  const dx = position.x - centroid.x;
  const dy = position.y - centroid.y;
  // Note: in screen coords y increases downward, so positive dy = South
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // If very close to centroid, no suffix
  if (absDx < 1 && absDy < 1) return "";

  // Use a threshold ratio to determine cardinal vs ordinal
  const ratio = absDx / (absDy + 0.001);

  if (ratio > 2) {
    // Strongly horizontal
    return dx > 0 ? "East" : "West";
  } else if (ratio < 0.5) {
    // Strongly vertical
    return dy > 0 ? "South" : "North";
  } else {
    // Diagonal
    const ns = dy > 0 ? "South" : "North";
    const ew = dx > 0 ? "East" : "West";
    return `${ns}${ew}`;
  }
}

/**
 * Context for naming a station based on nearby features.
 */
interface StationNameContext {
  districtName: string;
  position: Point;
  districtPolygonPoints: Point[];
  existingNames: string[];
  nearbyRoads: { name?: string; line: { points: Point[] } }[];
  nearbyNeighborhoods: { name: string; polygon: { points: Point[] } }[];
  nearbyPOIs: { name: string; position: Point }[];
}

// Prefix/suffix lists for random fallback station names
const STATION_NAME_PREFIXES = [
  "Grand", "Central", "Union", "Metro", "Harbor", "Market", "Park", "River",
  "Lake", "Meadow", "Oak", "Pine", "Elm", "Cedar", "Maple", "Summit",
  "Valley", "Bridge", "Bayside", "Midtown", "Uptown", "Civic", "Liberty",
  "Commerce", "Heritage",
];

const STATION_NAME_SUFFIXES = [
  "Square", "Center", "Plaza", "Crossing", "Junction", "Heights", "Hill",
  "Park", "Gardens", "Commons", "Point", "Landing", "Terrace", "Gate", "Row",
];

/**
 * Calculate the minimum distance from a point to a polyline (series of line segments).
 */
function pointToPolylineDistance(point: Point, polyline: Point[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return distance(point, polyline[0]);

  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let dist: number;
    if (lenSq === 0) {
      // Degenerate segment (both endpoints are the same)
      dist = distance(point, a);
    } else {
      // Project point onto the line segment, clamped to [0, 1]
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
      const proj = { x: a.x + t * dx, y: a.y + t * dy };
      dist = distance(point, proj);
    }

    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

/**
 * Find the name of the nearest named road within maxDistance of the given position.
 */
function findNearestNamedRoad(
  position: Point,
  roads: { name?: string; line: { points: Point[] } }[],
  maxDistance: number
): string | null {
  let bestName: string | null = null;
  let bestDist = maxDistance;

  for (const road of roads) {
    if (!road.name) continue;
    const dist = pointToPolylineDistance(position, road.line.points);
    if (dist < bestDist) {
      bestDist = dist;
      bestName = road.name;
    }
  }

  return bestName;
}

/**
 * Find the name of the neighborhood whose polygon contains the given position.
 */
function findContainingNeighborhood(
  position: Point,
  neighborhoods: { name: string; polygon: { points: Point[] } }[]
): string | null {
  for (const neighborhood of neighborhoods) {
    if (pointInPolygon(position, neighborhood.polygon.points)) {
      return neighborhood.name;
    }
  }
  return null;
}

/**
 * Find the name of the nearest POI within maxDistance of the given position.
 */
function findNearestPOI(
  position: Point,
  pois: { name: string; position: Point }[],
  maxDistance: number
): string | null {
  let bestName: string | null = null;
  let bestDist = maxDistance;

  for (const poi of pois) {
    const dist = distance(position, poi.position);
    if (dist < bestDist) {
      bestDist = dist;
      bestName = poi.name;
    }
  }

  return bestName;
}

/**
 * Generate a unique station name based on the district, position, nearby features,
 * and existing names.
 *
 * CITY-527: Context-aware naming strategy (priority order):
 * 1. District base name (if no station in district yet uses it): "{DistrictName} Station"
 * 2. District directional (if only 1 station uses district name): "{DistrictName} {Direction}"
 *    At most 2 stations per district can use district-based names.
 * 3. Nearby street name: closest named road within ~100 world units -> "{RoadName} Station"
 * 4. Nearby neighborhood: containing neighborhood -> "{NeighborhoodName} Station"
 * 5. Nearby POI: closest named POI within ~80 world units -> "{POIName} Station"
 * 6. Random prefix/suffix combination as fallback
 */
function generateStationName(ctx: StationNameContext): string {
  const {
    districtName,
    position,
    districtPolygonPoints,
    existingNames,
    nearbyRoads,
    nearbyNeighborhoods,
    nearbyPOIs,
  } = ctx;
  const namesSet = new Set(existingNames);

  // Count how many existing stations in this district have names starting with the district name
  const districtNameCount = existingNames.filter(
    (n) => n.startsWith(districtName)
  ).length;

  // 1. District base name (if no station in district uses it yet)
  if (districtNameCount === 0) {
    const baseName = `${districtName} Station`;
    if (!namesSet.has(baseName)) {
      return baseName;
    }
  }

  // 2. District directional (if only 1 station uses district name, allow 1 directional)
  if (districtNameCount < 2) {
    const centroid = polygonCentroid(districtPolygonPoints);
    const suffix = getDirectionalSuffix(position, centroid);
    if (suffix) {
      const directionalName = `${districtName} ${suffix}`;
      if (!namesSet.has(directionalName)) {
        return directionalName;
      }
    }
  }

  // 3. Nearby street name
  const roadName = findNearestNamedRoad(position, nearbyRoads, 100);
  if (roadName) {
    const streetStationName = `${roadName} Station`;
    if (!namesSet.has(streetStationName)) {
      return streetStationName;
    }
  }

  // 4. Nearby neighborhood
  const neighborhoodName = findContainingNeighborhood(position, nearbyNeighborhoods);
  if (neighborhoodName) {
    const neighborhoodStationName = `${neighborhoodName} Station`;
    if (!namesSet.has(neighborhoodStationName)) {
      return neighborhoodStationName;
    }
  }

  // 5. Nearby POI
  const poiName = findNearestPOI(position, nearbyPOIs, 80);
  if (poiName) {
    const poiStationName = `${poiName} Station`;
    if (!namesSet.has(poiStationName)) {
      return poiStationName;
    }
  }

  // 6. Random prefix/suffix fallback
  // Use a deterministic-ish approach: try combinations in order, skip any that collide
  for (const prefix of STATION_NAME_PREFIXES) {
    for (const suffix of STATION_NAME_SUFFIXES) {
      const candidateName = `${prefix} ${suffix}`;
      if (!namesSet.has(candidateName)) {
        return candidateName;
      }
    }
  }

  // Extremely unlikely fallback: numbered station
  let counter = 1;
  while (namesSet.has(`Station ${counter}`)) {
    counter++;
  }
  return `Station ${counter}`;
}

/**
 * Calculate distance between two points.
 */
function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * CITY-360: Get the next order_in_line value for a line's segments.
 * Uses Math.max of existing orders instead of segments.length to avoid
 * collisions when segments have been deleted (leaving gaps in ordering).
 */
function nextSegmentOrder(segments: { order_in_line: number }[]): number {
  if (segments.length === 0) return 0;
  return Math.max(...segments.map((s) => s.order_in_line)) + 1;
}

/**
 * Properties for creating a new transit line manually.
 */
export interface CreateLineParams {
  name: string;
  color: string;
  type: LineType;
}

interface TransitContextValue {
  /** Rail stations data for rendering */
  railStations: RailStationData[];
  /** Track segments data for rendering */
  trackSegments: TrackSegmentData[];
  /** Subway stations data for rendering */
  subwayStations: SubwayStationData[];
  /** Subway tunnel segments for rendering (shown in transit view as dashed lines) */
  subwayTunnels: SubwayTunnelData[];
  /** Raw transit network data for panels/stats (includes lines with segments) */
  transitNetwork: TransitNetwork | null;
  /** Currently highlighted line ID (for visual emphasis on map) */
  highlightedLineId: string | null;
  /** Set the highlighted line ID */
  setHighlightedLineId: (lineId: string | null) => void;
  /** Get station IDs that belong to a specific line */
  getStationIdsForLine: (lineId: string) => string[];
  /** Get segment IDs that belong to a specific line */
  getSegmentIdsForLine: (lineId: string) => string[];
  /** CITY-376: Get lines that serve a given station */
  getLinesForStation: (stationId: string) => { id: string; name: string; color: string; lineType: string }[];
  /** Validate if a position is valid for rail station placement */
  validateRailStationPlacement: (position: Point) => StationValidation;
  /** Validate if a position is valid for subway station placement */
  validateSubwayStationPlacement: (position: Point) => StationValidation;
  /** Place a rail station at the given position (returns null if invalid) */
  placeRailStation: (position: Point, options?: { skipAutoConnect?: boolean }) => Promise<TransitStation | null>;
  /** Place a subway station at the given position (returns null if invalid) */
  placeSubwayStation: (position: Point, options?: { skipAutoConnect?: boolean }) => Promise<TransitStation | null>;
  /** Remove a rail station */
  removeRailStation: (stationId: string) => Promise<void>;
  /** Remove a subway station */
  removeSubwayStation: (stationId: string) => Promise<void>;
  /** Rename a station (rail or subway) */
  renameStation: (stationId: string, newName: string) => Promise<boolean>;
  moveStation: (stationId: string, stationType: "rail" | "subway", position: Point) => Promise<boolean>;
  /** Get nearby rail stations that could be auto-connected */
  getNearbyStations: (position: Point, excludeId?: string) => RailStationData[];
  /** Get nearby subway stations that could be auto-connected */
  getNearbySubwayStations: (position: Point, excludeId?: string) => SubwayStationData[];
  /** Create a new transit line manually */
  createLine: (params: CreateLineParams) => Promise<TransitLine | null>;
  /** Create a segment connecting two stations on a line */
  createLineSegment: (
    lineId: string,
    fromStationId: string,
    toStationId: string,
    isUnderground?: boolean
  ) => Promise<boolean>;
  /** Update a transit line (name, color) */
  updateLine: (lineId: string, updates: { name?: string; color?: string }) => Promise<boolean>;
  /** Delete a transit line and all its segments */
  deleteLine: (lineId: string) => Promise<boolean>;
  /** Get the count of existing lines */
  lineCount: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

const TransitContext = createContext<TransitContextValue | null>(null);

interface TransitProviderProps {
  children: ReactNode;
  /** World ID for persisting transit data to the backend */
  worldId?: string;
}

export function TransitProvider({ children, worldId }: TransitProviderProps) {
  const featuresContext = useFeaturesOptional();
  const toast = useToastOptional();

  // Local state for UI rendering - Rail
  const [railStations, setRailStations] = useState<RailStationData[]>([]);
  const [trackSegments, setTrackSegments] = useState<TrackSegmentData[]>([]);

  // Highlighted line state (for visual emphasis when line is selected in panel)
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null);

  // Local state for UI rendering - Subway
  const [subwayStations, setSubwayStations] = useState<SubwayStationData[]>([]);
  const [subwayTunnels, setSubwayTunnels] = useState<SubwayTunnelData[]>([]);

  // API hooks
  const { data: transitNetwork, isLoading: isLoadingNetwork, error: networkError } = useTransitNetwork(
    worldId || "",
    { enabled: !!worldId }
  );
  const createStation = useCreateTransitStation();
  const createLine = useCreateTransitLine();
  const createSegment = useCreateTransitLineSegment();
  const deleteStation = useDeleteTransitStation();
  const deleteLineMutation = useDeleteTransitLine();
  const updateLine = useUpdateTransitLine();
  const updateStation = useUpdateTransitStation();

  // Sync API data to local state for rendering
  useEffect(() => {
    if (!transitNetwork) {
      setRailStations([]);
      setTrackSegments([]);
      setSubwayStations([]);
      setSubwayTunnels([]);
      return;
    }

    // Compute hub stations: stations served by 2+ distinct lines
    const stationLineCount = new Map<string, number>();
    for (const line of transitNetwork.lines) {
      const stationIds = new Set<string>();
      for (const seg of line.segments) {
        stationIds.add(seg.from_station_id);
        stationIds.add(seg.to_station_id);
      }
      for (const stationId of stationIds) {
        stationLineCount.set(stationId, (stationLineCount.get(stationId) || 0) + 1);
      }
    }

    // Convert API rail stations to render data
    const railStationsData: RailStationData[] = transitNetwork.stations
      .filter((s) => s.station_type === "rail")
      .map((s) => {
        // Find the line this station belongs to for color
        let lineColor: string | undefined;
        for (const line of transitNetwork.lines) {
          for (const seg of line.segments) {
            if (seg.from_station_id === s.id || seg.to_station_id === s.id) {
              lineColor = line.color;
              break;
            }
          }
          if (lineColor) break;
        }
        return {
          id: s.id,
          name: s.name,
          position: { x: s.position_x, y: s.position_y },
          isTerminus: s.is_terminus,
          lineColor,
          isHub: (stationLineCount.get(s.id) || 0) >= 2,
        };
      });

    // Convert API subway stations to render data
    const subwayStationsData: SubwayStationData[] = transitNetwork.stations
      .filter((s) => s.station_type === "subway")
      .map((s) => ({
        ...toSubwayStationData(s),
        isHub: (stationLineCount.get(s.id) || 0) >= 2,
      }));

    // Convert API segments to track render data (for rail)
    const tracks: TrackSegmentData[] = [];
    for (const line of transitNetwork.lines) {
      if (line.line_type !== "rail") continue;
      for (const seg of line.segments) {
        const fromStation = transitNetwork.stations.find((s) => s.id === seg.from_station_id);
        const toStation = transitNetwork.stations.find((s) => s.id === seg.to_station_id);
        if (fromStation && toStation) {
          tracks.push({
            id: seg.id,
            fromStation: { x: fromStation.position_x, y: fromStation.position_y },
            toStation: { x: toStation.position_x, y: toStation.position_y },
            lineColor: line.color,
            geometry: seg.geometry,
            isUnderground: seg.is_underground,
          });
        }
      }
    }

    // Convert API segments to subway tunnel render data
    const tunnels: SubwayTunnelData[] = [];
    for (const line of transitNetwork.lines) {
      if (line.line_type !== "subway") continue;
      for (const seg of line.segments) {
        const fromStation = transitNetwork.stations.find((s) => s.id === seg.from_station_id);
        const toStation = transitNetwork.stations.find((s) => s.id === seg.to_station_id);
        if (fromStation && toStation) {
          tunnels.push({
            id: seg.id,
            fromStation: { x: fromStation.position_x, y: fromStation.position_y },
            toStation: { x: toStation.position_x, y: toStation.position_y },
            lineColor: line.color,
            geometry: seg.geometry,
          });
        }
      }
    }

    setRailStations(railStationsData);
    setTrackSegments(tracks);
    setSubwayStations(subwayStationsData);
    setSubwayTunnels(tunnels);
  }, [transitNetwork]);

  /**
   * CITY-428: Generate transit-oriented POIs near a newly placed station
   * and add them to the features context.
   */
  const generateTransitPOIsForStation = useCallback(
    (position: Point, stationName: string, districtId: string) => {
      if (!featuresContext) return;

      const district = featuresContext.features.districts.find(
        (d) => d.id === districtId
      );
      if (!district) return;

      const newPOIs = generateTransitPOIs(
        position,
        stationName,
        district.polygon.points,
        featuresContext.features.pois
      );

      for (const poi of newPOIs) {
        featuresContext.addPOI(poi);
      }
    },
    [featuresContext]
  );

  /**
   * Validate if a position is valid for station placement (shared logic for rail and subway).
   * Stations must be placed inside a district.
   */
  const validateStationPlacement = useCallback(
    (position: Point, stationType: "rail" | "subway"): StationValidation => {
      if (!featuresContext) {
        return {
          isValid: false,
          districtId: null,
          districtName: null,
          error: "Features context not available",
        };
      }

      const districts = featuresContext.features.districts;
      for (const district of districts) {
        if (pointInPolygon(position, district.polygon.points)) {
          return {
            isValid: true,
            districtId: district.id,
            districtName: district.name,
          };
        }
      }

      return {
        isValid: false,
        districtId: null,
        districtName: null,
        error: `${stationType === "rail" ? "Rail" : "Subway"} stations must be placed inside a district`,
      };
    },
    [featuresContext]
  );

  /**
   * Validate if a position is valid for rail station placement.
   * Rail stations must be placed inside a district.
   */
  const validateRailStationPlacement = useCallback(
    (position: Point): StationValidation => validateStationPlacement(position, "rail"),
    [validateStationPlacement]
  );

  /**
   * Validate if a position is valid for subway station placement.
   * Subway stations must be placed inside a district.
   */
  const validateSubwayStationPlacement = useCallback(
    (position: Point): StationValidation => validateStationPlacement(position, "subway"),
    [validateStationPlacement]
  );

  /**
   * Get nearby rail stations that could be auto-connected.
   */
  const getNearbyStations = useCallback(
    (position: Point, excludeId?: string): RailStationData[] => {
      return railStations.filter((station) => {
        if (station.id === excludeId) return false;
        return distance(position, station.position) <= AUTO_CONNECT_DISTANCE;
      });
    },
    [railStations]
  );

  /**
   * Get nearby subway stations that could be auto-connected.
   */
  const getNearbySubwayStations = useCallback(
    (position: Point, excludeId?: string): SubwayStationData[] => {
      return subwayStations.filter((station) => {
        if (station.id === excludeId) return false;
        return distance(position, station.position) <= AUTO_CONNECT_DISTANCE;
      });
    },
    [subwayStations]
  );

  /**
   * Place a rail station at the given position.
   * Validates placement, creates the station, and auto-connects to nearby stations.
   */
  const placeRailStation = useCallback(
    async (position: Point, options?: { skipAutoConnect?: boolean }): Promise<TransitStation | null> => {
      if (!worldId) {
        toast?.addToast("Cannot place station: No world selected", "error");
        return null;
      }

      // Validate placement
      const validation = validateRailStationPlacement(position);
      if (!validation.isValid || !validation.districtId) {
        toast?.addToast(validation.error || "Invalid placement location", "error");
        return null;
      }

      // CITY-358: Prevent duplicate station at the same position
      const tooCloseRail = railStations.find(
        (s) => distance(position, s.position) < MINIMUM_STATION_DISTANCE
      );
      if (tooCloseRail) {
        toast?.addToast(`Too close to existing station "${tooCloseRail.name}"`, "error");
        return null;
      }

      // Check for nearby subway station to create a transfer station
      const candidateSubways = subwayStations.filter(
        (s) => distance(position, s.position) <= TRANSFER_STATION_DISTANCE
      );
      const nearbySubway = candidateSubways.length > 0
        ? candidateSubways.reduce((a, b) =>
            distance(position, a.position) < distance(position, b.position) ? a : b
          )
        : undefined;

      let stationName: string;
      if (nearbySubway) {
        // Use the same name as the nearby subway station for transfer pairing
        stationName = nearbySubway.name;
      } else {
        // Collect existing station names in this district for uniqueness
        const districtStationNames = railStations
          .filter((s) => {
            const districtValidation = validateRailStationPlacement(s.position);
            return districtValidation.districtId === validation.districtId;
          })
          .map((s) => s.name);
        // Also include subway station names in the same district to avoid cross-type collisions
        const districtSubwayNames = subwayStations
          .filter((s) => {
            const districtValidation = validateSubwayStationPlacement(s.position);
            return districtValidation.districtId === validation.districtId;
          })
          .map((s) => s.name);
        const allDistrictNames = [...districtStationNames, ...districtSubwayNames];
        // Find district polygon for centroid calculation
        const district = featuresContext?.features.districts.find(
          (d) => d.id === validation.districtId
        );
        // CITY-527: Gather nearby features for context-aware naming
        const nearbyRoads = featuresContext?.features.roads ?? [];
        const nearbyNeighborhoods = featuresContext?.features.neighborhoods ?? [];
        const nearbyPOIs = featuresContext?.features.pois ?? [];
        stationName = generateStationName({
          districtName: validation.districtName || "Rail",
          position,
          districtPolygonPoints: district?.polygon.points ?? [],
          existingNames: allDistrictNames,
          nearbyRoads,
          nearbyNeighborhoods,
          nearbyPOIs,
        });
      }

      try {
        // Create the station
        const station = await createStation.mutateAsync({
          worldId,
          data: {
            district_id: validation.districtId,
            station_type: "rail" as StationType,
            name: stationName,
            position_x: position.x,
            position_y: position.y,
            is_terminus: false,
          },
        });

        // CITY-430: Generate access road from station to nearest street grid road
        if (featuresContext && validation.districtId) {
          const districtRoads = featuresContext.features.roads.filter(
            (r) => r.districtId === validation.districtId
          );
          const accessRoad = generateStationAccessRoad(
            position,
            districtRoads,
            validation.districtId
          );
          if (accessRoad) {
            featuresContext.addRoads([accessRoad]);
          }
        }

        if (!options?.skipAutoConnect) {
          if (nearbySubway) {
            toast?.addToast(`Created transfer station "${stationName}" (rail ↔ subway)`, "success");
          } else {
            toast?.addToast(`Created ${stationName}`, "success");
          }
        }

        // CITY-428: Generate transit-oriented POIs near the new station
        generateTransitPOIsForStation(position, stationName, validation.districtId);

        // Auto-connect to nearby stations (CITY-394: skip when creating during line drawing)
        const nearbyStations = !options?.skipAutoConnect ? getNearbyStations(position) : [];
        if (nearbyStations.length > 0) {
          // Find or create a rail line
          let lineId: string | null = null;

          // Check if any nearby station is already on a line
          if (transitNetwork) {
            for (const nearby of nearbyStations) {
              for (const line of transitNetwork.lines) {
                if (line.line_type !== "rail") continue;
                for (const seg of line.segments) {
                  if (
                    seg.from_station_id === nearby.id ||
                    seg.to_station_id === nearby.id
                  ) {
                    lineId = line.id;
                    break;
                  }
                }
                if (lineId) break;
              }
              if (lineId) break;
            }
          }

          // If no existing line, create a new one
          if (!lineId) {
            const existingRailLines = transitNetwork?.lines.filter((l) => l.line_type === "rail") || [];
            const usedColors = new Set(existingRailLines.map((l) => l.color));
            const usedNames = new Set(existingRailLines.map((l) => l.name));
            const lineColor = nextUnusedColor(RAIL_LINE_COLORS, usedColors);
            const lineName = nextUnusedName("Rail Line", usedNames);

            const line = await createLine.mutateAsync({
              worldId,
              data: {
                line_type: "rail",
                name: lineName,
                color: lineColor,
                is_auto_generated: true,
              },
            });
            lineId = line.id;
          }

          // Connect to the nearest station
          if (lineId && nearbyStations.length > 0) {
            const nearest = nearbyStations.reduce((a, b) =>
              distance(position, a.position) < distance(position, b.position) ? a : b
            );

            // CITY-360: Use max order instead of length to avoid gaps
            const existingLine = transitNetwork?.lines.find((l) => l.id === lineId);
            const segmentOrder = nextSegmentOrder(existingLine?.segments || []);

            await createSegment.mutateAsync({
              lineId,
              worldId,
              data: {
                from_station_id: nearest.id,
                to_station_id: station.id,
                geometry: [],
                is_underground: false,
                order_in_line: segmentOrder,
              },
            });

            toast?.addToast(`Connected to ${nearest.name}`, "info");
          }
        }

        return station;
      } catch (error) {
        console.error("Failed to create rail station:", error);
        toast?.addToast("Failed to create rail station", "error");
        return null;
      }
    },
    [
      worldId,
      validateRailStationPlacement,
      railStations,
      subwayStations,
      getNearbyStations,
      transitNetwork,
      createStation,
      createLine,
      createSegment,
      featuresContext,
      generateTransitPOIsForStation,
      toast,
    ]
  );

  /**
   * Place a subway station at the given position.
   * Validates placement, creates the station, and auto-connects to nearby subway stations.
   * Subway lines are underground and NOT visible on the map surface.
   */
  const placeSubwayStation = useCallback(
    async (position: Point, options?: { skipAutoConnect?: boolean }): Promise<TransitStation | null> => {
      if (!worldId) {
        toast?.addToast("Cannot place station: No world selected", "error");
        return null;
      }

      // Validate placement
      const validation = validateSubwayStationPlacement(position);
      if (!validation.isValid || !validation.districtId) {
        toast?.addToast(validation.error || "Invalid placement location", "error");
        return null;
      }

      // CITY-358: Prevent duplicate station at the same position
      const tooCloseSubway = subwayStations.find(
        (s) => distance(position, s.position) < MINIMUM_STATION_DISTANCE
      );
      if (tooCloseSubway) {
        toast?.addToast(`Too close to existing station "${tooCloseSubway.name}"`, "error");
        return null;
      }

      // Check for nearby rail station to create a transfer station
      const candidateRails = railStations.filter(
        (s) => distance(position, s.position) <= TRANSFER_STATION_DISTANCE
      );
      const nearbyRail = candidateRails.length > 0
        ? candidateRails.reduce((a, b) =>
            distance(position, a.position) < distance(position, b.position) ? a : b
          )
        : undefined;

      let stationName: string;
      if (nearbyRail) {
        // Use the same name as the nearby rail station for transfer pairing
        stationName = nearbyRail.name;
      } else {
        // Collect existing station names in this district for uniqueness
        const districtSubwayNames = subwayStations
          .filter((s) => {
            const districtValidation = validateSubwayStationPlacement(s.position);
            return districtValidation.districtId === validation.districtId;
          })
          .map((s) => s.name);
        // Also include rail station names in the same district to avoid cross-type collisions
        const districtRailNames = railStations
          .filter((s) => {
            const districtValidation = validateRailStationPlacement(s.position);
            return districtValidation.districtId === validation.districtId;
          })
          .map((s) => s.name);
        const allDistrictNames = [...districtSubwayNames, ...districtRailNames];
        // Find district polygon for centroid calculation
        const district = featuresContext?.features.districts.find(
          (d) => d.id === validation.districtId
        );
        // CITY-527: Gather nearby features for context-aware naming
        const nearbyRoads = featuresContext?.features.roads ?? [];
        const nearbyNeighborhoods = featuresContext?.features.neighborhoods ?? [];
        const nearbyPOIs = featuresContext?.features.pois ?? [];
        stationName = generateStationName({
          districtName: validation.districtName || "Metro",
          position,
          districtPolygonPoints: district?.polygon.points ?? [],
          existingNames: allDistrictNames,
          nearbyRoads,
          nearbyNeighborhoods,
          nearbyPOIs,
        });
      }

      try {
        // Create the station
        const station = await createStation.mutateAsync({
          worldId,
          data: {
            district_id: validation.districtId,
            station_type: "subway" as StationType,
            name: stationName,
            position_x: position.x,
            position_y: position.y,
            is_terminus: false,
          },
        });

        // CITY-430: Generate access road from station to nearest street grid road
        if (featuresContext && validation.districtId) {
          const districtRoads = featuresContext.features.roads.filter(
            (r) => r.districtId === validation.districtId
          );
          const accessRoad = generateStationAccessRoad(
            position,
            districtRoads,
            validation.districtId
          );
          if (accessRoad) {
            featuresContext.addRoads([accessRoad]);
          }
        }

        if (!options?.skipAutoConnect) {
          if (nearbyRail) {
            toast?.addToast(`Created transfer station "${stationName}" (subway ↔ rail)`, "success");
          } else {
            toast?.addToast(`Created ${stationName}`, "success");
          }
        }

        // CITY-428: Generate transit-oriented POIs near the new station
        generateTransitPOIsForStation(position, stationName, validation.districtId);

        // Auto-connect to nearby subway stations (CITY-394: skip when creating during line drawing)
        const nearbyStations = !options?.skipAutoConnect ? getNearbySubwayStations(position) : [];
        if (nearbyStations.length > 0) {
          // Find or create a subway line
          let lineId: string | null = null;

          // Check if any nearby station is already on a subway line
          if (transitNetwork) {
            for (const nearby of nearbyStations) {
              for (const line of transitNetwork.lines) {
                if (line.line_type !== "subway") continue;
                for (const seg of line.segments) {
                  if (
                    seg.from_station_id === nearby.id ||
                    seg.to_station_id === nearby.id
                  ) {
                    lineId = line.id;
                    break;
                  }
                }
                if (lineId) break;
              }
              if (lineId) break;
            }
          }

          // If no existing line, create a new one
          if (!lineId) {
            const existingSubwayLines = transitNetwork?.lines.filter((l) => l.line_type === "subway") || [];
            const usedColors = new Set(existingSubwayLines.map((l) => l.color));
            const usedNames = new Set(existingSubwayLines.map((l) => l.name));
            const lineColor = nextUnusedColor(SUBWAY_LINE_COLORS, usedColors);
            const lineName = nextUnusedName("Subway Line", usedNames);

            const line = await createLine.mutateAsync({
              worldId,
              data: {
                line_type: "subway",
                name: lineName,
                color: lineColor,
                is_auto_generated: true,
              },
            });
            lineId = line.id;
          }

          // Connect to the nearest station
          if (lineId && nearbyStations.length > 0) {
            const nearest = nearbyStations.reduce((a, b) =>
              distance(position, a.position) < distance(position, b.position) ? a : b
            );

            // CITY-360: Use max order instead of length to avoid gaps
            const existingLine = transitNetwork?.lines.find((l) => l.id === lineId);
            const segmentOrder = nextSegmentOrder(existingLine?.segments || []);

            await createSegment.mutateAsync({
              lineId,
              worldId,
              data: {
                from_station_id: nearest.id,
                to_station_id: station.id,
                geometry: [],
                is_underground: true, // Subway tunnels are always underground
                order_in_line: segmentOrder,
              },
            });

            toast?.addToast(`Connected to ${nearest.name}`, "info");
          }
        }

        return station;
      } catch (error) {
        console.error("Failed to create subway station:", error);
        toast?.addToast("Failed to create subway station", "error");
        return null;
      }
    },
    [
      worldId,
      validateSubwayStationPlacement,
      railStations,
      subwayStations,
      getNearbySubwayStations,
      transitNetwork,
      createStation,
      createLine,
      createSegment,
      featuresContext,
      generateTransitPOIsForStation,
      toast,
    ]
  );

  /**
   * Remove a rail station.
   */
  const removeRailStation = useCallback(
    async (stationId: string): Promise<void> => {
      if (!worldId) return;

      try {
        await deleteStation.mutateAsync({ stationId, worldId });
        toast?.addToast("Rail station removed", "success");
      } catch (error) {
        console.error("Failed to remove rail station:", error);
        toast?.addToast("Failed to remove station", "error");
      }
    },
    [worldId, deleteStation, toast]
  );

  /**
   * Remove a subway station.
   */
  const removeSubwayStation = useCallback(
    async (stationId: string): Promise<void> => {
      if (!worldId) return;

      try {
        await deleteStation.mutateAsync({ stationId, worldId });
        toast?.addToast("Subway station removed", "success");
      } catch (error) {
        console.error("Failed to remove subway station:", error);
        toast?.addToast("Failed to remove station", "error");
      }
    },
    [worldId, deleteStation, toast]
  );

  /**
   * CITY-359: Rename a station (rail or subway).
   */
  const renameStation = useCallback(
    async (stationId: string, newName: string): Promise<boolean> => {
      if (!worldId) {
        toast?.addToast("Cannot rename station: No world selected", "error");
        return false;
      }

      const trimmed = newName.trim();
      if (!trimmed) {
        toast?.addToast("Station name cannot be empty", "error");
        return false;
      }

      try {
        await updateStation.mutateAsync({
          stationId,
          data: { name: trimmed },
          worldId,
        });
        toast?.addToast(`Station renamed to "${trimmed}"`, "success");
        return true;
      } catch (error) {
        console.error("Failed to rename station:", error);
        toast?.addToast("Failed to rename station", "error");
        return false;
      }
    },
    [worldId, updateStation, toast]
  );

  const moveStation = useCallback(
    async (stationId: string, stationType: "rail" | "subway", position: Point): Promise<boolean> => {
      if (!worldId) {
        toast?.addToast("Cannot move station: No world selected", "error");
        return false;
      }
      const validation = validateStationPlacement(position, stationType);
      if (!validation.isValid || !validation.districtId) {
        toast?.addToast(validation.error || "Station must be placed inside a district", "error");
        return false;
      }
      try {
        await updateStation.mutateAsync({
          stationId,
          data: { position_x: position.x, position_y: position.y, district_id: validation.districtId },
          worldId,
        });
        return true;
      } catch (error) {
        console.error("Failed to move station:", error);
        toast?.addToast("Failed to move station", "error");
        return false;
      }
    },
    [worldId, updateStation, validateStationPlacement, toast]
  );

  /**
   * Create a new transit line manually (for manual line drawing).
   */
  const createLineManual = useCallback(
    async (params: CreateLineParams): Promise<TransitLine | null> => {
      if (!worldId) {
        toast?.addToast("Cannot create line: No world selected", "error");
        return null;
      }

      try {
        const line = await createLine.mutateAsync({
          worldId,
          data: {
            line_type: params.type,
            name: params.name,
            color: params.color,
            is_auto_generated: false,
          },
        });

        toast?.addToast(`Created ${params.name}`, "success");
        return line;
      } catch (error) {
        console.error("Failed to create transit line:", error);
        toast?.addToast("Failed to create transit line", "error");
        return null;
      }
    },
    [worldId, createLine, toast]
  );

  /**
   * Create a segment connecting two stations on a line (for manual line drawing).
   */
  const createLineSegment = useCallback(
    async (
      lineId: string,
      fromStationId: string,
      toStationId: string,
      isUnderground: boolean = false
    ): Promise<boolean> => {
      if (!worldId) {
        toast?.addToast("Cannot create segment: No world selected", "error");
        return false;
      }

      try {
        // CITY-360: Use max order instead of length to avoid gaps
        const existingLine = transitNetwork?.lines.find((l) => l.id === lineId);
        const segmentOrder = nextSegmentOrder(existingLine?.segments || []);

        await createSegment.mutateAsync({
          lineId,
          worldId,
          data: {
            from_station_id: fromStationId,
            to_station_id: toStationId,
            geometry: [],
            is_underground: isUnderground,
            order_in_line: segmentOrder,
          },
        });

        return true;
      } catch (error) {
        console.error("Failed to create line segment:", error);
        toast?.addToast("Failed to connect stations", "error");
        return false;
      }
    },
    [worldId, transitNetwork, createSegment, toast]
  );

  /**
   * Update a transit line (name, color).
   */
  const updateLineMethod = useCallback(
    async (lineId: string, updates: { name?: string; color?: string }): Promise<boolean> => {
      if (!worldId) {
        toast?.addToast("Cannot update line: No world selected", "error");
        return false;
      }

      // CITY-362: Validate hex color before sending to API
      if (updates.color && !/^#[0-9A-Fa-f]{6}$/.test(updates.color)) {
        toast?.addToast("Invalid color format. Use #RRGGBB.", "error");
        return false;
      }

      try {
        await updateLine.mutateAsync({
          lineId,
          data: updates,
          worldId,
        });

        toast?.addToast("Transit line updated", "success");
        return true;
      } catch (error) {
        console.error("Failed to update transit line:", error);
        toast?.addToast("Failed to update transit line", "error");
        return false;
      }
    },
    [worldId, updateLine, toast]
  );

  /**
   * Delete a transit line and all its segments.
   * Clears highlightedLineId if the deleted line was highlighted.
   */
  const deleteLineMethod = useCallback(
    async (lineId: string): Promise<boolean> => {
      if (!worldId) {
        toast?.addToast("Cannot delete line: No world selected", "error");
        return false;
      }

      try {
        await deleteLineMutation.mutateAsync({ lineId, worldId });

        // Clear stale highlight if the deleted line was highlighted (CITY-291)
        if (highlightedLineId === lineId) {
          setHighlightedLineId(null);
        }

        toast?.addToast("Transit line deleted", "success");
        return true;
      } catch (error) {
        console.error("Failed to delete transit line:", error);
        toast?.addToast("Failed to delete transit line", "error");
        return false;
      }
    },
    [worldId, deleteLineMutation, highlightedLineId, toast]
  );

  /**
   * Get all station IDs that belong to a specific line.
   */
  const getStationIdsForLine = useCallback(
    (lineId: string): string[] => {
      if (!transitNetwork) return [];
      const line = transitNetwork.lines.find((l) => l.id === lineId);
      if (!line) return [];

      const stationIds = new Set<string>();
      for (const segment of line.segments) {
        stationIds.add(segment.from_station_id);
        stationIds.add(segment.to_station_id);
      }
      return Array.from(stationIds);
    },
    [transitNetwork]
  );

  /**
   * Get all segment IDs that belong to a specific line.
   */
  const getSegmentIdsForLine = useCallback(
    (lineId: string): string[] => {
      if (!transitNetwork) return [];
      const line = transitNetwork.lines.find((l) => l.id === lineId);
      if (!line) return [];
      return line.segments.map((s) => s.id);
    },
    [transitNetwork]
  );

  /**
   * CITY-376: Get all transit lines that serve a given station.
   */
  const getLinesForStation = useCallback(
    (stationId: string): { id: string; name: string; color: string; lineType: string }[] => {
      if (!transitNetwork) return [];
      return transitNetwork.lines
        .filter((line) =>
          line.segments.some(
            (seg) => seg.from_station_id === stationId || seg.to_station_id === stationId
          )
        )
        .map((line) => ({
          id: line.id,
          name: line.name,
          color: line.color,
          lineType: line.line_type,
        }));
    },
    [transitNetwork]
  );

  const lineCount = transitNetwork?.lines.length || 0;
  const isLoading = isLoadingNetwork || createStation.isPending || createLine.isPending || updateLine.isPending;
  const error = networkError || createStation.error || null;

  const transitNetworkValue = transitNetwork ?? null;

  const value: TransitContextValue = useMemo(() => ({
    // Rail
    railStations,
    trackSegments,
    validateRailStationPlacement,
    placeRailStation,
    removeRailStation,
    getNearbyStations,
    // Subway
    subwayStations,
    subwayTunnels,
    validateSubwayStationPlacement,
    placeSubwayStation,
    removeSubwayStation,
    renameStation,
    moveStation,
    getNearbySubwayStations,
    // Raw network data for panels
    transitNetwork: transitNetworkValue,
    // Highlighting (CITY-195)
    highlightedLineId,
    setHighlightedLineId,
    getStationIdsForLine,
    getSegmentIdsForLine,
    getLinesForStation,
    // Manual line drawing
    createLine: createLineManual,
    createLineSegment,
    updateLine: updateLineMethod,
    deleteLine: deleteLineMethod,
    lineCount,
    // Loading/Error
    isLoading,
    error,
  }), [
    railStations,
    trackSegments,
    validateRailStationPlacement,
    placeRailStation,
    removeRailStation,
    getNearbyStations,
    subwayStations,
    subwayTunnels,
    validateSubwayStationPlacement,
    placeSubwayStation,
    removeSubwayStation,
    renameStation,
    moveStation,
    getNearbySubwayStations,
    transitNetworkValue,
    highlightedLineId,
    setHighlightedLineId,
    getStationIdsForLine,
    getSegmentIdsForLine,
    getLinesForStation,
    createLineManual,
    createLineSegment,
    updateLineMethod,
    deleteLineMethod,
    lineCount,
    isLoading,
    error,
  ]);

  return (
    <TransitContext.Provider value={value}>{children}</TransitContext.Provider>
  );
}

export function useTransit() {
  const context = useContext(TransitContext);
  if (!context) {
    throw new Error("useTransit must be used within a TransitProvider");
  }
  return context;
}

export function useTransitOptional(): TransitContextValue | null {
  return useContext(TransitContext);
}
