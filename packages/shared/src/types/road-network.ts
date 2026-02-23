/**
 * Road network graph types - nodes (intersections) and edges (road segments)
 *
 * The road network is stored as a graph where:
 * - Nodes represent intersections or endpoints
 * - Edges represent road segments connecting nodes
 */

import type { Point } from './geometry'

/**
 * Road class determines visual styling and routing priority
 */
export type RoadClass =
  | 'highway'      // Major highways, fastest travel
  | 'arterial'     // Main city roads, high capacity
  | 'collector'    // Connect local roads to arterials
  | 'local'        // Neighborhood streets
  | 'trail'        // Trails, paths, service roads

/**
 * CITY-181: Waterfront road type for roads adjacent to water features.
 * - "riverfront_drive": Road running along a river, lake, or ocean waterfront.
 * - "boardwalk": Pedestrian path adjacent to a beach.
 */
export type WaterfrontType = 'riverfront_drive' | 'boardwalk'

/**
 * Node types for special intersection handling
 */
export type NodeType =
  | 'intersection'  // Standard road intersection
  | 'endpoint'      // Dead end or road terminus
  | 'roundabout'    // Traffic circle
  | 'interchange'   // Highway interchange

/**
 * A node in the road network graph (intersection or endpoint)
 */
export interface RoadNode {
  id: string
  /** World this node belongs to */
  world_id: string
  /** Position in world coordinates */
  position: Point
  /** Type of intersection */
  node_type: NodeType
  /** Connected edge IDs for quick traversal */
  connected_edges: string[]
  /** Optional name for major intersections */
  name?: string
  /** Timestamp */
  created_at: string
  updated_at: string
}

/**
 * An edge in the road network graph (road segment)
 */
export interface RoadEdge {
  id: string
  /** World this edge belongs to */
  world_id: string
  /** Starting node ID */
  from_node_id: string
  /** Ending node ID */
  to_node_id: string
  /** Road classification */
  road_class: RoadClass
  /** Geometry - intermediate points for curved roads */
  geometry: Point[]
  /** Calculated length in meters */
  length_meters: number
  /** Speed limit in km/h (for routing) */
  speed_limit?: number
  /** Optional street name */
  name?: string
  /** Whether this is a one-way road */
  is_one_way: boolean
  /** Number of lanes (affects capacity) */
  lanes: number
  /** District ID this road belongs to (if any) */
  district_id?: string
  /** CITY-181: Waterfront designation (null = not waterfront) */
  waterfront_type?: WaterfrontType
  /** Timestamp */
  created_at: string
  updated_at: string
}

/**
 * Complete road network for a world
 */
export interface RoadNetwork {
  world_id: string
  nodes: RoadNode[]
  edges: RoadEdge[]
}

/**
 * Request to create a new road node
 */
export interface RoadNodeCreate {
  world_id: string
  position: Point
  node_type: NodeType
  name?: string
}

/**
 * Request to create a new road edge
 */
export interface RoadEdgeCreate {
  world_id: string
  from_node_id: string
  to_node_id: string
  road_class: RoadClass
  geometry?: Point[]
  speed_limit?: number
  name?: string
  is_one_way?: boolean
  lanes?: number
  district_id?: string
  waterfront_type?: WaterfrontType
}

/**
 * Request to update a road node
 */
export interface RoadNodeUpdate {
  position?: Point
  node_type?: NodeType
  name?: string
}

/**
 * Request to update a road edge
 */
export interface RoadEdgeUpdate {
  road_class?: RoadClass
  geometry?: Point[]
  speed_limit?: number
  name?: string
  is_one_way?: boolean
  lanes?: number
  waterfront_type?: WaterfrontType
}

/**
 * Defaults for road properties by class
 */
export const ROAD_CLASS_DEFAULTS: Record<RoadClass, { speed_limit: number; lanes: number }> = {
  highway: { speed_limit: 100, lanes: 4 },
  arterial: { speed_limit: 60, lanes: 4 },
  collector: { speed_limit: 50, lanes: 2 },
  local: { speed_limit: 40, lanes: 2 },
  trail: { speed_limit: 20, lanes: 1 },
}

/**
 * Visual styling hints for road rendering
 */
export const ROAD_CLASS_STYLES: Record<RoadClass, { width: number; color: string }> = {
  highway: { width: 12, color: '#FFD700' },
  arterial: { width: 8, color: '#FFA500' },
  collector: { width: 5, color: '#FFFFFF' },
  local: { width: 3, color: '#CCCCCC' },
  trail: { width: 2, color: '#999999' },
}
