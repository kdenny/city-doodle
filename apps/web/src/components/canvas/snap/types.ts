/**
 * Types for the snap-to-geometry engine.
 */

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Types of snap points that can be detected.
 */
export type SnapPointType =
  | "vertex" // Exact vertex on geometry
  | "midpoint" // Midpoint of an edge
  | "intersection" // Intersection of two lines
  | "nearest"; // Nearest point on an edge

/**
 * A snap point with its location and metadata.
 */
export interface SnapPoint {
  /** X coordinate in world space */
  x: number;
  /** Y coordinate in world space */
  y: number;
  /** Type of snap point */
  type: SnapPointType;
  /** ID of the geometry this snap point belongs to */
  geometryId: string;
  /** Type of geometry (e.g., "coastline", "river", "road", "district") */
  geometryType: string;
  /** Distance from the query point (in world units) */
  distance: number;
}

/**
 * A line segment for snap calculations.
 */
export interface SnapLineSegment {
  p1: Point;
  p2: Point;
  geometryId: string;
  geometryType: string;
}

/**
 * Configuration for snap behavior.
 */
export interface SnapConfig {
  /** Maximum distance (in world units) to snap from cursor */
  threshold: number;
  /** Enable snapping to vertices */
  snapToVertex: boolean;
  /** Enable snapping to edge midpoints */
  snapToMidpoint: boolean;
  /** Enable snapping to nearest point on edge */
  snapToNearest: boolean;
  /** Enable snapping to intersections */
  snapToIntersection: boolean;
  /** Geometry types to snap to (empty = all types) */
  geometryTypes?: string[];
}

/**
 * Default snap configuration.
 */
export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  threshold: 20,
  snapToVertex: true,
  snapToMidpoint: true,
  snapToNearest: true,
  snapToIntersection: true,
};

/**
 * Result of a snap query.
 */
export interface SnapResult {
  /** The snap point, or null if no snap was found */
  snapPoint: SnapPoint | null;
  /** All candidate snap points within threshold (sorted by distance) */
  candidates: SnapPoint[];
}

/**
 * Interface for geometry providers that can supply snappable geometry.
 */
export interface SnapGeometryProvider {
  /** Get all line segments for snap calculation */
  getLineSegments(): SnapLineSegment[];
  /** Get the bounding box of all geometry */
  getBoundingBox(): BoundingBox | null;
}
