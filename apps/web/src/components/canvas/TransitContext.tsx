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
import { pointInPolygon, toSubwayStationData } from "./layers";
import type { RailStationData, TrackSegmentData, SubwayStationData, SubwayTunnelData } from "./layers";
import {
  useTransitNetwork,
  useCreateTransitStation,
  useCreateTransitLine,
  useCreateTransitLineSegment,
  useDeleteTransitStation,
  useUpdateTransitLine,
} from "../../api/hooks";
import type {
  TransitStation,
  TransitNetwork,
  TransitLine,
  StationType,
  LineType,
} from "../../api/types";
import { useFeaturesOptional } from "./FeaturesContext";
import { useToastOptional } from "../../contexts";

// Auto-connection distance for nearby stations (in world units)
const AUTO_CONNECT_DISTANCE = 200;

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
 * Generate a unique station name based on the district.
 */
function generateStationName(districtName: string, stationCount: number): string {
  if (stationCount === 0) {
    return `${districtName} Station`;
  }
  return `${districtName} Station ${stationCount + 1}`;
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
  /** Validate if a position is valid for rail station placement */
  validateRailStationPlacement: (position: Point) => StationValidation;
  /** Validate if a position is valid for subway station placement */
  validateSubwayStationPlacement: (position: Point) => StationValidation;
  /** Place a rail station at the given position (returns null if invalid) */
  placeRailStation: (position: Point) => Promise<TransitStation | null>;
  /** Place a subway station at the given position (returns null if invalid) */
  placeSubwayStation: (position: Point) => Promise<TransitStation | null>;
  /** Remove a rail station */
  removeRailStation: (stationId: string) => Promise<void>;
  /** Remove a subway station */
  removeSubwayStation: (stationId: string) => Promise<void>;
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
  const updateLine = useUpdateTransitLine();

  // Sync API data to local state for rendering
  useEffect(() => {
    if (!transitNetwork) {
      setRailStations([]);
      setTrackSegments([]);
      setSubwayStations([]);
      setSubwayTunnels([]);
      return;
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
        };
      });

    // Convert API subway stations to render data
    const subwayStationsData: SubwayStationData[] = transitNetwork.stations
      .filter((s) => s.station_type === "subway")
      .map(toSubwayStationData);

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
    async (position: Point): Promise<TransitStation | null> => {
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

      // Count existing stations in this district for naming
      const districtStations = railStations.filter((s) => {
        // Check if station is in the same district by position check
        const districtValidation = validateRailStationPlacement(s.position);
        return districtValidation.districtId === validation.districtId;
      });

      const stationName = generateStationName(
        validation.districtName || "Rail",
        districtStations.length
      );

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

        toast?.addToast(`Created ${stationName}`, "success");

        // Auto-connect to nearby stations
        const nearbyStations = getNearbyStations(position);
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
            const lineIndex =
              (transitNetwork?.lines.filter((l) => l.line_type === "rail").length || 0) %
              RAIL_LINE_COLORS.length;
            const lineColor = RAIL_LINE_COLORS[lineIndex];

            const line = await createLine.mutateAsync({
              worldId,
              data: {
                line_type: "rail",
                name: `Rail Line ${(transitNetwork?.lines.filter((l) => l.line_type === "rail").length || 0) + 1}`,
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

            // Get the current segment count for ordering
            const existingLine = transitNetwork?.lines.find((l) => l.id === lineId);
            const segmentOrder = existingLine?.segments.length || 0;

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
      getNearbyStations,
      transitNetwork,
      createStation,
      createLine,
      createSegment,
      toast,
    ]
  );

  /**
   * Place a subway station at the given position.
   * Validates placement, creates the station, and auto-connects to nearby subway stations.
   * Subway lines are underground and NOT visible on the map surface.
   */
  const placeSubwayStation = useCallback(
    async (position: Point): Promise<TransitStation | null> => {
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

      // Count existing subway stations in this district for naming
      const districtStations = subwayStations.filter((s) => {
        const districtValidation = validateSubwayStationPlacement(s.position);
        return districtValidation.districtId === validation.districtId;
      });

      const stationName = generateStationName(
        validation.districtName || "Metro",
        districtStations.length
      );

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

        toast?.addToast(`Created ${stationName}`, "success");

        // Auto-connect to nearby subway stations
        const nearbyStations = getNearbySubwayStations(position);
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
            const lineIndex =
              (transitNetwork?.lines.filter((l) => l.line_type === "subway").length || 0) %
              SUBWAY_LINE_COLORS.length;
            const lineColor = SUBWAY_LINE_COLORS[lineIndex];

            const line = await createLine.mutateAsync({
              worldId,
              data: {
                line_type: "subway",
                name: `Subway Line ${(transitNetwork?.lines.filter((l) => l.line_type === "subway").length || 0) + 1}`,
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

            // Get the current segment count for ordering
            const existingLine = transitNetwork?.lines.find((l) => l.id === lineId);
            const segmentOrder = existingLine?.segments.length || 0;

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
      subwayStations,
      getNearbySubwayStations,
      transitNetwork,
      createStation,
      createLine,
      createSegment,
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
        // Get the current segment count for ordering
        const existingLine = transitNetwork?.lines.find((l) => l.id === lineId);
        const segmentOrder = existingLine?.segments.length || 0;

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
    getNearbySubwayStations,
    // Raw network data for panels
    transitNetwork: transitNetworkValue,
    // Highlighting (CITY-195)
    highlightedLineId,
    setHighlightedLineId,
    getStationIdsForLine,
    getSegmentIdsForLine,
    // Manual line drawing
    createLine: createLineManual,
    createLineSegment,
    updateLine: updateLineMethod,
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
    getNearbySubwayStations,
    transitNetworkValue,
    highlightedLineId,
    setHighlightedLineId,
    getStationIdsForLine,
    getSegmentIdsForLine,
    createLineManual,
    createLineSegment,
    updateLineMethod,
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
