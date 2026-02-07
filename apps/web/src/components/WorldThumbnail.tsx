/**
 * Mini canvas thumbnail preview for world cards.
 *
 * Renders a simplified bird's-eye SVG of the world showing
 * districts as colored polygons and roads as thin lines.
 * Loads data lazily to avoid blocking dashboard render.
 */

import { useMemo } from "react";
import { useWorldDistricts, useRoadNetwork } from "../api";
import type { District, RoadEdge, RoadNode } from "../api/types";

const DISTRICT_COLORS: Record<string, string> = {
  residential: "#fff3cd",
  downtown: "#d4a5a5",
  commercial: "#aed9e0",
  industrial: "#c9c9c9",
  hospital: "#ffcccb",
  university: "#d4c4fb",
  k12: "#b5ead7",
  park: "#90ee90",
  airport: "#e0e0e0",
};

interface Point {
  x: number;
  y: number;
}

/** Extract polygon points from a district's geometry field */
function getDistrictPoints(district: District): Point[] {
  const geo = district.geometry;
  if (!geo) return [];

  // Handle { points: [{x, y}, ...] } format
  if ("points" in geo && Array.isArray(geo.points)) {
    return geo.points as Point[];
  }

  // Handle { polygon: { points: [...] } } format
  if ("polygon" in geo) {
    const polygon = geo.polygon as { points?: Point[] };
    if (polygon?.points) return polygon.points;
  }

  // Handle GeoJSON-like { coordinates: [[x,y], ...] }
  if ("coordinates" in geo && Array.isArray(geo.coordinates)) {
    const coords = geo.coordinates as number[][];
    if (coords.length > 0 && Array.isArray(coords[0])) {
      // Could be nested (polygon ring)
      const ring = Array.isArray(coords[0][0]) ? (coords[0] as unknown as number[][]) : coords;
      return ring.map(([x, y]) => ({ x, y }));
    }
  }

  return [];
}

/** Convert points to SVG path data */
function pointsToPath(points: Point[]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  return `M${first.x},${first.y} ${rest.map((p) => `L${p.x},${p.y}`).join(" ")} Z`;
}

/** Convert a road edge to an SVG path */
function roadToPath(edge: RoadEdge, nodesMap: Map<string, RoadNode>): string {
  const from = nodesMap.get(edge.from_node_id);
  const to = nodesMap.get(edge.to_node_id);
  if (!from || !to) return "";

  const points: Point[] = [
    { x: from.position.x, y: from.position.y },
    ...(edge.geometry || []).map((p) => ({ x: p.x, y: p.y })),
    { x: to.position.x, y: to.position.y },
  ];

  if (points.length < 2) return "";
  const [first, ...rest] = points;
  return `M${first.x},${first.y} ${rest.map((p) => `L${p.x},${p.y}`).join(" ")}`;
}

/** Compute bounding box with padding */
function computeBounds(allPoints: Point[]): { minX: number; minY: number; width: number; height: number } {
  if (allPoints.length === 0) {
    return { minX: 0, minY: 0, width: 100, height: 100 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: (maxX - minX) + padding * 2,
    height: (maxY - minY) + padding * 2,
  };
}

interface WorldThumbnailProps {
  worldId: string;
  className?: string;
}

export function WorldThumbnail({ worldId, className = "" }: WorldThumbnailProps) {
  const { data: districts, isLoading: districtsLoading } = useWorldDistricts(worldId);
  const { data: roadNetwork, isLoading: roadsLoading } = useRoadNetwork(worldId);

  const isLoading = districtsLoading || roadsLoading;
  const hasData = (districts && districts.length > 0) || (roadNetwork && roadNetwork.edges.length > 0);

  const svgData = useMemo(() => {
    if (!hasData) return null;

    const allPoints: Point[] = [];

    // Collect district points
    const districtPaths: { path: string; color: string }[] = [];
    if (districts) {
      for (const d of districts) {
        const points = getDistrictPoints(d);
        if (points.length >= 3) {
          allPoints.push(...points);
          districtPaths.push({
            path: pointsToPath(points),
            color: DISTRICT_COLORS[d.type] || "#e0e0e0",
          });
        }
      }
    }

    // Collect road points
    const roadPaths: string[] = [];
    if (roadNetwork) {
      const nodesMap = new Map<string, RoadNode>();
      for (const node of roadNetwork.nodes) {
        nodesMap.set(node.id, node);
        allPoints.push({ x: node.position.x, y: node.position.y });
      }
      for (const edge of roadNetwork.edges) {
        const path = roadToPath(edge, nodesMap);
        if (path) roadPaths.push(path);
      }
    }

    const bounds = computeBounds(allPoints);

    return { districtPaths, roadPaths, bounds };
  }, [districts, roadNetwork, hasData]);

  // Loading placeholder
  if (isLoading) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  // No data placeholder
  if (!svgData) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
    );
  }

  const { districtPaths, roadPaths, bounds } = svgData;

  return (
    <div className={`bg-gray-50 ${className}`} data-testid="world-thumbnail">
      <svg
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Districts */}
        {districtPaths.map((d, i) => (
          <path
            key={`d-${i}`}
            d={d.path}
            fill={d.color}
            fillOpacity={0.6}
            stroke="#666666"
            strokeOpacity={0.3}
            strokeWidth={bounds.width * 0.003}
          />
        ))}
        {/* Roads */}
        {roadPaths.map((path, i) => (
          <path
            key={`r-${i}`}
            d={path}
            fill="none"
            stroke="#888888"
            strokeOpacity={0.5}
            strokeWidth={bounds.width * 0.002}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}
