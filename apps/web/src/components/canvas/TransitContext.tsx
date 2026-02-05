/**
 * Context for managing transit data (rail stations, lines, and tracks).
 *
 * Provides methods to add, remove, and update transit stations and lines.
 * Rail stations must be placed inside districts.
 * Handles auto-connection of nearby rail stations on the same line.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import type { Point } from "./layers";
import { pointInPolygon } from "./layers";
import type { RailStationData, TrackSegmentData } from "./layers";
import {
  useTransitNetwork,
  useCreateTransitStation,
  useCreateTransitLine,
  useCreateTransitLineSegment,
  useDeleteTransitStation,
} from "../../api/hooks";
import type {
  TransitStation,
  StationType,
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

/**
 * Result of a rail station placement validation.
 */
export interface RailStationValidation {
  isValid: boolean;
  districtId: string | null;
  districtName: string | null;
  error?: string;
}

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

interface TransitContextValue {
  /** Rail stations data for rendering */
  railStations: RailStationData[];
  /** Track segments data for rendering */
  trackSegments: TrackSegmentData[];
  /** Validate if a position is valid for rail station placement */
  validateRailStationPlacement: (position: Point) => RailStationValidation;
  /** Place a rail station at the given position (returns null if invalid) */
  placeRailStation: (position: Point) => Promise<TransitStation | null>;
  /** Remove a rail station */
  removeRailStation: (stationId: string) => Promise<void>;
  /** Get nearby rail stations that could be auto-connected */
  getNearbyStations: (position: Point, excludeId?: string) => RailStationData[];
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

  // Local state for UI rendering
  const [railStations, setRailStations] = useState<RailStationData[]>([]);
  const [trackSegments, setTrackSegments] = useState<TrackSegmentData[]>([]);

  // API hooks
  const { data: transitNetwork, isLoading: isLoadingNetwork, error: networkError } = useTransitNetwork(
    worldId || "",
    { enabled: !!worldId }
  );
  const createStation = useCreateTransitStation();
  const createLine = useCreateTransitLine();
  const createSegment = useCreateTransitLineSegment();
  const deleteStation = useDeleteTransitStation();

  // Sync API data to local state for rendering
  useEffect(() => {
    if (!transitNetwork) {
      setRailStations([]);
      setTrackSegments([]);
      return;
    }

    // Convert API stations to render data
    const stations: RailStationData[] = transitNetwork.stations
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

    // Convert API segments to track render data
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

    setRailStations(stations);
    setTrackSegments(tracks);
  }, [transitNetwork]);

  /**
   * Validate if a position is valid for rail station placement.
   * Rail stations must be placed inside a district.
   */
  const validateRailStationPlacement = useCallback(
    (position: Point): RailStationValidation => {
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
        error: "Rail stations must be placed inside a district",
      };
    },
    [featuresContext]
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
   * Remove a rail station.
   */
  const removeRailStation = useCallback(
    async (stationId: string): Promise<void> => {
      if (!worldId) return;

      try {
        await deleteStation.mutateAsync({ stationId, worldId });
        toast?.addToast("Station removed", "success");
      } catch (error) {
        console.error("Failed to remove rail station:", error);
        toast?.addToast("Failed to remove station", "error");
      }
    },
    [worldId, deleteStation, toast]
  );

  const isLoading = isLoadingNetwork || createStation.isPending || createLine.isPending;
  const error = networkError || createStation.error || null;

  const value: TransitContextValue = {
    railStations,
    trackSegments,
    validateRailStationPlacement,
    placeRailStation,
    removeRailStation,
    getNearbyStations,
    isLoading,
    error,
  };

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
