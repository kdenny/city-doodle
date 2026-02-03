/**
 * Geometry provider for terrain features (coastlines, rivers).
 *
 * Converts terrain data structures into snap line segments.
 */

import type {
  SnapGeometryProvider,
  SnapLineSegment,
  BoundingBox,
} from "./types";
import type { TerrainData, Line } from "../layers/types";

export class TerrainSnapProvider implements SnapGeometryProvider {
  private segments: SnapLineSegment[] = [];
  private bounds: BoundingBox | null = null;

  /**
   * Updates the terrain data to extract snap geometry from.
   */
  setData(data: TerrainData | null): void {
    this.segments = [];
    this.bounds = null;

    if (!data) return;

    // Extract coastline segments
    for (const coastline of data.coastlines) {
      this.addLineSegments(coastline.line, coastline.id, "coastline");
    }

    // Extract river segments
    for (const river of data.rivers) {
      this.addLineSegments(river.line, river.id, "river");
    }

    // Calculate bounds
    this.calculateBounds();
  }

  private addLineSegments(line: Line, id: string, type: string): void {
    const points = line.points;
    for (let i = 0; i < points.length - 1; i++) {
      this.segments.push({
        p1: { x: points[i].x, y: points[i].y },
        p2: { x: points[i + 1].x, y: points[i + 1].y },
        geometryId: id,
        geometryType: type,
      });
    }
  }

  private calculateBounds(): void {
    if (this.segments.length === 0) {
      this.bounds = null;
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const segment of this.segments) {
      minX = Math.min(minX, segment.p1.x, segment.p2.x);
      minY = Math.min(minY, segment.p1.y, segment.p2.y);
      maxX = Math.max(maxX, segment.p1.x, segment.p2.x);
      maxY = Math.max(maxY, segment.p1.y, segment.p2.y);
    }

    this.bounds = { minX, minY, maxX, maxY };
  }

  getLineSegments(): SnapLineSegment[] {
    return this.segments;
  }

  getBoundingBox(): BoundingBox | null {
    return this.bounds;
  }
}
