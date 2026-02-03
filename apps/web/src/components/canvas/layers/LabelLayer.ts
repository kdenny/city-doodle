/**
 * Label layer renderer for handwritten-style map labels.
 *
 * Features:
 * - Deterministic placement based on seed
 * - Collision avoidance (labels don't overlap)
 * - Organic variations (slight rotation, jitter)
 * - Priority-based rendering (important labels shown first)
 */

import { Container, Text, TextStyle, Graphics } from "pixi.js";
import type {
  LabelData,
  LabelConfig,
  LabelLayerData,
  LayerVisibility,
} from "./types";

// Default configuration for handwritten labels
const DEFAULT_CONFIG: LabelConfig = {
  fontFamily: '"Caveat", "Patrick Hand", "Comic Sans MS", cursive',
  baseFontSize: 16,
  color: 0x333333,
  outlineColor: 0xffffff,
  outlineWidth: 3,
  maxRotation: 0.05, // ~3 degrees
  jitterAmount: 2, // pixels
};

// Font sizes by label type
const FONT_SIZE_MULTIPLIERS: Record<string, number> = {
  region: 1.8,
  district: 1.4,
  water: 1.2,
  road: 1.0,
  poi: 0.9,
  contour: 0.7,
};

// Colors by label type
const LABEL_COLORS: Record<string, number> = {
  region: 0x2c3e50,
  district: 0x34495e,
  water: 0x2980b9,
  road: 0x7f8c8d,
  poi: 0x27ae60,
  contour: 0x8b7355,
};

interface PlacedLabel {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Seeded random number generator for deterministic results.
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /** Returns a number between 0 and 1 */
  next(): number {
    // Simple LCG (Linear Congruential Generator)
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /** Returns a number between min and max */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

export class LabelLayer {
  private container: Container;
  private labelsContainer: Container;
  private debugGraphics: Graphics;
  private config: LabelConfig;
  private data: LabelLayerData | null = null;
  private placedLabels: PlacedLabel[] = [];
  private showDebug = false;

  constructor(config: Partial<LabelConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.container = new Container();
    this.container.label = "labels";

    // Debug graphics (for collision boxes)
    this.debugGraphics = new Graphics();
    this.debugGraphics.visible = false;
    this.container.addChild(this.debugGraphics);

    // Container for actual labels
    this.labelsContainer = new Container();
    this.labelsContainer.label = "label-texts";
    this.container.addChild(this.labelsContainer);
  }

  getContainer(): Container {
    return this.container;
  }

  setData(data: LabelLayerData): void {
    this.data = data;
    this.render();
  }

  setVisibility(visibility: LayerVisibility): void {
    this.container.visible = visibility.labels;
  }

  setDebugMode(enabled: boolean): void {
    this.showDebug = enabled;
    this.debugGraphics.visible = enabled;
  }

  private render(): void {
    if (!this.data) return;

    // Clear existing labels (guard for test environments where methods may not exist)
    if (this.labelsContainer.removeChildren) {
      this.labelsContainer.removeChildren();
    }
    if (this.debugGraphics.clear) {
      this.debugGraphics.clear();
    }
    this.placedLabels = [];

    // Create seeded RNG for deterministic variation
    const rng = new SeededRandom(this.data.seed);

    // Sort labels by priority (higher priority first)
    const sortedLabels = [...this.data.labels].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );

    // Place labels with collision avoidance
    for (const label of sortedLabels) {
      const placed = this.placeLabel(label, rng);
      if (placed) {
        this.placedLabels.push(placed);
      }
    }
  }

  private placeLabel(label: LabelData, rng: SeededRandom): PlacedLabel | null {
    const typeMultiplier = FONT_SIZE_MULTIPLIERS[label.type] ?? 1.0;
    const fontSize =
      (label.fontSize ?? this.config.baseFontSize) * typeMultiplier;
    const color = LABEL_COLORS[label.type] ?? this.config.color;

    // Calculate position with jitter
    const jitterX = rng.range(
      -this.config.jitterAmount,
      this.config.jitterAmount
    );
    const jitterY = rng.range(
      -this.config.jitterAmount,
      this.config.jitterAmount
    );
    const x = label.position.x + jitterX;
    const y = label.position.y + jitterY;

    // Calculate rotation with organic variation
    const baseRotation = label.rotation ?? 0;
    const rotationJitter = rng.range(
      -this.config.maxRotation,
      this.config.maxRotation
    );
    const rotation = baseRotation + rotationJitter;

    // Create text style
    const style = new TextStyle({
      fontFamily: this.config.fontFamily,
      fontSize,
      fill: color,
      stroke: { color: this.config.outlineColor, width: this.config.outlineWidth },
      align: "center",
      fontWeight: label.type === "region" ? "bold" : "normal",
      letterSpacing: label.type === "water" ? 2 : 0,
    });

    // Create text object to measure
    const text = new Text({ text: label.text, style });
    const bounds = text.getBounds();

    // Calculate bounding box (accounting for rotation)
    const cos = Math.abs(Math.cos(rotation));
    const sin = Math.abs(Math.sin(rotation));
    const rotatedWidth = bounds.width * cos + bounds.height * sin;
    const rotatedHeight = bounds.width * sin + bounds.height * cos;

    const labelBounds: PlacedLabel = {
      x: x - rotatedWidth / 2,
      y: y - rotatedHeight / 2,
      width: rotatedWidth,
      height: rotatedHeight,
      rotation,
    };

    // Check for collisions with already-placed labels
    if (this.hasCollision(labelBounds)) {
      text.destroy();
      return null;
    }

    // Apply transformations
    text.anchor.set(0.5, 0.5);
    text.position.set(x, y);
    text.rotation = rotation;

    // Add to container
    this.labelsContainer.addChild(text);

    // Draw debug box if enabled
    if (this.showDebug) {
      this.debugGraphics.setStrokeStyle({ width: 1, color: 0xff0000, alpha: 0.5 });
      this.debugGraphics.rect(
        labelBounds.x,
        labelBounds.y,
        labelBounds.width,
        labelBounds.height
      );
      this.debugGraphics.stroke();
    }

    return labelBounds;
  }

  private hasCollision(newLabel: PlacedLabel): boolean {
    const padding = 4; // Extra padding between labels

    for (const placed of this.placedLabels) {
      // Simple AABB collision check
      if (
        newLabel.x - padding < placed.x + placed.width + padding &&
        newLabel.x + newLabel.width + padding > placed.x - padding &&
        newLabel.y - padding < placed.y + placed.height + padding &&
        newLabel.y + newLabel.height + padding > placed.y - padding
      ) {
        return true;
      }
    }

    return false;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

/**
 * Generate mock label data for testing.
 */
export function generateMockLabels(
  worldSize: number,
  seed: number
): LabelLayerData {
  const rng = new SeededRandom(seed);
  const labels: LabelData[] = [];

  // Generate region label
  labels.push({
    id: "region-1",
    text: "Mapleton Bay",
    type: "region",
    position: { x: worldSize / 2, y: worldSize * 0.15 },
    priority: 100,
  });

  // Generate water labels
  const waterNames = [
    "Crystal Lake",
    "Blue River",
    "Willow Creek",
    "Mirror Pond",
  ];
  for (let i = 0; i < waterNames.length; i++) {
    labels.push({
      id: `water-${i}`,
      text: waterNames[i],
      type: "water",
      position: {
        x: rng.range(worldSize * 0.2, worldSize * 0.8),
        y: rng.range(worldSize * 0.2, worldSize * 0.8),
      },
      rotation: rng.range(-0.2, 0.2),
      priority: 80,
    });
  }

  // Generate district labels
  const districtNames = [
    "Downtown",
    "Harbor District",
    "University Quarter",
    "Industrial Park",
    "Riverside",
    "Old Town",
  ];
  for (let i = 0; i < districtNames.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    labels.push({
      id: `district-${i}`,
      text: districtNames[i],
      type: "district",
      position: {
        x: (col + 0.5) * (worldSize / 3) + rng.range(-20, 20),
        y: (row + 0.5) * (worldSize / 2) + rng.range(-20, 20),
      },
      priority: 60,
    });
  }

  // Generate road labels
  const roadNames = ["Main St", "Oak Ave", "Highway 101", "Elm Blvd"];
  for (let i = 0; i < roadNames.length; i++) {
    labels.push({
      id: `road-${i}`,
      text: roadNames[i],
      type: "road",
      position: {
        x: rng.range(worldSize * 0.1, worldSize * 0.9),
        y: rng.range(worldSize * 0.1, worldSize * 0.9),
      },
      rotation: rng.range(-0.3, 0.3),
      priority: 40,
    });
  }

  // Generate POI labels
  const poiNames = [
    "City Hall",
    "Central Park",
    "Hospital",
    "Train Station",
    "Library",
  ];
  for (let i = 0; i < poiNames.length; i++) {
    labels.push({
      id: `poi-${i}`,
      text: poiNames[i],
      type: "poi",
      position: {
        x: rng.range(worldSize * 0.15, worldSize * 0.85),
        y: rng.range(worldSize * 0.15, worldSize * 0.85),
      },
      priority: 30,
    });
  }

  return { labels, seed };
}
