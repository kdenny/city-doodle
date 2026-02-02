/**
 * Core geometry types used across the application
 */

export interface Point {
  x: number
  y: number
}

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface TileCoord {
  row: number
  col: number
}
