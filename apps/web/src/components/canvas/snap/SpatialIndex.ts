/**
 * Grid-based spatial index for efficient snap point queries.
 *
 * Divides the world into a grid of cells, with each cell containing
 * references to line segments that intersect it.
 */

import type { SnapLineSegment, BoundingBox, Point } from "./types";

export class SpatialIndex {
  private cellSize: number;
  private cells: Map<string, SnapLineSegment[]>;
  private bounds: BoundingBox | null = null;

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  /**
   * Clears all indexed geometry.
   */
  clear(): void {
    this.cells.clear();
    this.bounds = null;
  }

  /**
   * Gets the cell key for a point.
   */
  private getCellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  /**
   * Gets all cells that a line segment intersects.
   */
  private getSegmentCells(segment: SnapLineSegment): string[] {
    const { p1, p2 } = segment;
    const keys = new Set<string>();

    // Get bounding box of segment
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    // Get cell range
    const startCx = Math.floor(minX / this.cellSize);
    const endCx = Math.floor(maxX / this.cellSize);
    const startCy = Math.floor(minY / this.cellSize);
    const endCy = Math.floor(maxY / this.cellSize);

    // Add all cells in the bounding box
    // For diagonal lines, this may include some cells the line doesn't actually cross,
    // but it's a simple and fast approximation
    for (let cx = startCx; cx <= endCx; cx++) {
      for (let cy = startCy; cy <= endCy; cy++) {
        keys.add(`${cx},${cy}`);
      }
    }

    return Array.from(keys);
  }

  /**
   * Inserts a line segment into the index.
   */
  insert(segment: SnapLineSegment): void {
    const cellKeys = this.getSegmentCells(segment);

    for (const key of cellKeys) {
      if (!this.cells.has(key)) {
        this.cells.set(key, []);
      }
      this.cells.get(key)!.push(segment);
    }

    // Update bounds
    this.updateBounds(segment);
  }

  /**
   * Inserts multiple line segments into the index.
   */
  insertAll(segments: SnapLineSegment[]): void {
    for (const segment of segments) {
      this.insert(segment);
    }
  }

  /**
   * Updates the bounding box to include a segment.
   */
  private updateBounds(segment: SnapLineSegment): void {
    const { p1, p2 } = segment;

    if (!this.bounds) {
      this.bounds = {
        minX: Math.min(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxX: Math.max(p1.x, p2.x),
        maxY: Math.max(p1.y, p2.y),
      };
    } else {
      this.bounds.minX = Math.min(this.bounds.minX, p1.x, p2.x);
      this.bounds.minY = Math.min(this.bounds.minY, p1.y, p2.y);
      this.bounds.maxX = Math.max(this.bounds.maxX, p1.x, p2.x);
      this.bounds.maxY = Math.max(this.bounds.maxY, p1.y, p2.y);
    }
  }

  /**
   * Queries all line segments within a radius of a point.
   */
  query(point: Point, radius: number): SnapLineSegment[] {
    const results: SnapLineSegment[] = [];
    const seen = new Set<SnapLineSegment>();

    // Calculate cell range to check
    const startCx = Math.floor((point.x - radius) / this.cellSize);
    const endCx = Math.floor((point.x + radius) / this.cellSize);
    const startCy = Math.floor((point.y - radius) / this.cellSize);
    const endCy = Math.floor((point.y + radius) / this.cellSize);

    for (let cx = startCx; cx <= endCx; cx++) {
      for (let cy = startCy; cy <= endCy; cy++) {
        const key = `${cx},${cy}`;
        const segments = this.cells.get(key);

        if (segments) {
          for (const segment of segments) {
            if (!seen.has(segment)) {
              seen.add(segment);
              results.push(segment);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Gets the bounding box of all indexed geometry.
   */
  getBounds(): BoundingBox | null {
    return this.bounds;
  }

  /**
   * Gets the number of cells in the index.
   */
  getCellCount(): number {
    return this.cells.size;
  }

  /**
   * Gets the total number of segment references (may include duplicates).
   */
  getSegmentReferenceCount(): number {
    let count = 0;
    for (const segments of this.cells.values()) {
      count += segments.length;
    }
    return count;
  }
}
