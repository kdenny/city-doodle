/**
 * Seeds layer renderer for placed seeds on the canvas.
 *
 * Renders seeds that have been placed by the user with their
 * corresponding icons/markers and handles preview positioning.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { SeedCategory } from "../../palette/types";

/**
 * A placed seed for rendering.
 */
export interface PlacedSeedData {
  id: string;
  seedId: string;
  category: SeedCategory;
  icon: string;
  label: string;
  position: { x: number; y: number };
}

/**
 * Preview seed data for showing placement preview.
 */
export interface PreviewSeedData {
  seedId: string;
  category: SeedCategory;
  icon: string;
  position: { x: number; y: number };
}

// Colors for different seed categories
const CATEGORY_COLORS: Record<SeedCategory, number> = {
  district: 0x4a90d9, // Blue
  poi: 0x7cb342, // Green
  transit: 0xf5a623, // Orange
};

// Background colors (lighter versions)
const CATEGORY_BG_COLORS: Record<SeedCategory, number> = {
  district: 0xe3f2fd, // Light blue
  poi: 0xf1f8e9, // Light green
  transit: 0xfff3e0, // Light orange
};

export class SeedsLayer {
  private container: Container;
  private seedsContainer: Container;
  private previewContainer: Container;
  private seedGraphics: Map<string, Container> = new Map();
  private previewGraphics: Graphics | null = null;
  private previewText: Text | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = "seeds";

    // Container for placed seeds
    this.seedsContainer = new Container();
    this.seedsContainer.label = "placed-seeds";
    this.container.addChild(this.seedsContainer);

    // Container for preview (on top)
    this.previewContainer = new Container();
    this.previewContainer.label = "seed-preview";
    this.container.addChild(this.previewContainer);
  }

  getContainer(): Container {
    return this.container;
  }

  /**
   * Set the placed seeds to render.
   */
  setSeeds(seeds: PlacedSeedData[]): void {
    // Track which seeds we've seen
    const seenIds = new Set<string>();

    for (const seed of seeds) {
      seenIds.add(seed.id);

      // Update existing or create new
      if (this.seedGraphics.has(seed.id)) {
        this.updateSeedGraphics(seed);
      } else {
        this.createSeedGraphics(seed);
      }
    }

    // Remove seeds that are no longer present
    for (const [id, graphics] of this.seedGraphics.entries()) {
      if (!seenIds.has(id)) {
        this.seedsContainer.removeChild(graphics);
        graphics.destroy({ children: true });
        this.seedGraphics.delete(id);
      }
    }
  }

  /**
   * Set or clear the preview seed.
   */
  setPreview(preview: PreviewSeedData | null): void {
    // Clear existing preview
    if (this.previewGraphics) {
      this.previewContainer.removeChild(this.previewGraphics);
      this.previewGraphics.destroy();
      this.previewGraphics = null;
    }
    if (this.previewText) {
      this.previewContainer.removeChild(this.previewText);
      this.previewText.destroy();
      this.previewText = null;
    }

    if (!preview) return;

    // Create preview graphics (semi-transparent)
    const { position, category, icon } = preview;
    const color = CATEGORY_COLORS[category];
    const bgColor = CATEGORY_BG_COLORS[category];

    // Create container for this preview
    this.previewGraphics = new Graphics();

    // Draw marker background (pulsing effect would need animation)
    this.previewGraphics.circle(position.x, position.y, 20);
    this.previewGraphics.fill({ color: bgColor, alpha: 0.5 });

    // Draw marker border
    this.previewGraphics.setStrokeStyle({ width: 2, color, alpha: 0.7 });
    this.previewGraphics.circle(position.x, position.y, 20);
    this.previewGraphics.stroke();

    // Dashed inner circle to indicate placement point
    this.previewGraphics.setStrokeStyle({ width: 1, color, alpha: 0.5 });
    this.previewGraphics.circle(position.x, position.y, 8);
    this.previewGraphics.stroke();

    this.previewContainer.addChild(this.previewGraphics);

    // Add icon text
    const style = new TextStyle({
      fontSize: 16,
      fill: color,
    });
    this.previewText = new Text({ text: icon, style });
    this.previewText.anchor.set(0.5, 0.5);
    this.previewText.position.set(position.x, position.y);
    this.previewText.alpha = 0.8;
    this.previewContainer.addChild(this.previewText);
  }

  private createSeedGraphics(seed: PlacedSeedData): void {
    const { id, position, category, icon, label } = seed;
    const color = CATEGORY_COLORS[category];
    const bgColor = CATEGORY_BG_COLORS[category];

    // Create container for this seed
    const seedContainer = new Container();
    seedContainer.label = `seed-${id}`;

    // Draw marker background
    const bg = new Graphics();
    bg.circle(position.x, position.y, 18);
    bg.fill({ color: bgColor, alpha: 0.9 });
    seedContainer.addChild(bg);

    // Draw marker border
    const border = new Graphics();
    border.setStrokeStyle({ width: 2, color });
    border.circle(position.x, position.y, 18);
    border.stroke();
    seedContainer.addChild(border);

    // Add icon
    const iconStyle = new TextStyle({
      fontSize: 14,
      fill: color,
    });
    const iconText = new Text({ text: icon, style: iconStyle });
    iconText.anchor.set(0.5, 0.5);
    iconText.position.set(position.x, position.y);
    seedContainer.addChild(iconText);

    // Add label below
    const labelStyle = new TextStyle({
      fontSize: 10,
      fill: 0x333333,
      fontWeight: "500",
    });
    const labelText = new Text({ text: label, style: labelStyle });
    labelText.anchor.set(0.5, 0);
    labelText.position.set(position.x, position.y + 22);
    seedContainer.addChild(labelText);

    this.seedsContainer.addChild(seedContainer);
    this.seedGraphics.set(id, seedContainer);
  }

  private updateSeedGraphics(seed: PlacedSeedData): void {
    // For now, just recreate the graphics
    // A more efficient approach would update positions directly
    const existing = this.seedGraphics.get(seed.id);
    if (existing) {
      this.seedsContainer.removeChild(existing);
      existing.destroy({ children: true });
      this.seedGraphics.delete(seed.id);
    }
    this.createSeedGraphics(seed);
  }

  /**
   * Set visibility of the seeds layer.
   */
  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.seedGraphics.clear();
  }
}
