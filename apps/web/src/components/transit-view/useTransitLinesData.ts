/**
 * Hook to transform transit network data into the format needed by TransitLinesPanel.
 *
 * Calculates:
 * - Station count per line (from segments)
 * - Miles of track per line (from segment geometry)
 */

import { useMemo } from "react";
import type { TransitNetwork, TransitLineWithSegments, TransitStation } from "../../api/types";
import type { TransitLine } from "./TransitLinesPanel";
import { worldUnitsToMiles } from "../canvas/layers";

/**
 * Calculate the length of a segment in world units.
 * Uses geometry points if available, otherwise calculates straight-line distance between stations.
 */
function calculateSegmentLength(
  segment: TransitLineWithSegments["segments"][0],
  stations: TransitStation[]
): number {
  const fromStation = stations.find((s) => s.id === segment.from_station_id);
  const toStation = stations.find((s) => s.id === segment.to_station_id);

  if (!fromStation || !toStation) return 0;

  // If geometry exists, calculate path length through intermediate points
  if (segment.geometry && segment.geometry.length > 0) {
    let length = 0;
    const points = [
      { x: fromStation.position_x, y: fromStation.position_y },
      ...segment.geometry,
      { x: toStation.position_x, y: toStation.position_y },
    ];

    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  // Otherwise, straight-line distance
  const dx = toStation.position_x - fromStation.position_x;
  const dy = toStation.position_y - fromStation.position_y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Detect if a line forms a circular/loop route.
 * A line is circular when the last segment's to_station connects back to the first segment's from_station.
 */
function isCircularLine(line: TransitLineWithSegments): boolean {
  if (line.segments.length < 2) return false;

  const sorted = [...line.segments].sort((a, b) => a.order_in_line - b.order_in_line);
  return sorted[sorted.length - 1].to_station_id === sorted[0].from_station_id;
}

/**
 * Count unique stations on a line from its segments.
 */
function countStationsOnLine(line: TransitLineWithSegments): number {
  const stationIds = new Set<string>();

  for (const segment of line.segments) {
    stationIds.add(segment.from_station_id);
    stationIds.add(segment.to_station_id);
  }

  return stationIds.size;
}

/**
 * Transform a TransitLineWithSegments into the panel's TransitLine format.
 */
function transformLine(
  line: TransitLineWithSegments,
  stations: TransitStation[]
): TransitLine {
  // Calculate total length in world units
  const totalWorldUnits = line.segments.reduce(
    (sum, segment) => sum + calculateSegmentLength(segment, stations),
    0
  );

  return {
    id: line.id,
    name: line.name,
    color: line.color || "#666666",
    stations: countStationsOnLine(line),
    miles: worldUnitsToMiles(totalWorldUnits),
    lineType: line.line_type,
    isCircular: isCircularLine(line),
  };
}

/**
 * Extended TransitLine interface with additional metadata.
 * Currently identical to TransitLine but kept for future expansion.
 */
export type TransitLineWithMetadata = TransitLine;

/**
 * Hook to transform transit network data into panel-ready format.
 *
 * @param transitNetwork - The transit network data from the API
 * @returns Array of TransitLine objects ready for display in the panel
 */
export function useTransitLinesData(
  transitNetwork: TransitNetwork | null | undefined
): TransitLineWithMetadata[] {
  return useMemo(() => {
    if (!transitNetwork) return [];

    return transitNetwork.lines.map((line) =>
      transformLine(line, transitNetwork.stations)
    );
  }, [transitNetwork]);
}

/**
 * Helper to check if a transit network has any lines/stations.
 */
export function hasTransitData(
  transitNetwork: TransitNetwork | null | undefined
): boolean {
  if (!transitNetwork) return false;
  return transitNetwork.lines.length > 0 || transitNetwork.stations.length > 0;
}
