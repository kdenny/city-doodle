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
  /** Optional size override for drag-to-size district preview */
  size?: number;
}

// Colors for different seed categories
const CATEGORY_COLORS: Record<SeedCategory, number> = {
  district: 0x4a90d9, // Blue
  poi: 0x7cb342, // Green
  transit: 0xf5a623, // Orange
  park: 0x2e7d32, // Dark green
  airport: 0x78909c, // Blue-gray
};

// Background colors (lighter versions)
const CATEGORY_BG_COLORS: Record<SeedCategory, number> = {
  district: 0xe3f2fd, // Light blue
  poi: 0xf1f8e9, // Light green
  transit: 0xfff3e0, // Light orange
  park: 0xe8f5e9, // Light green
  airport: 0xeceff1, // Light gray
};

export class SeedsLayer {
  private container: Container;
  private seedsContainer: Container;
  private previewContainer: Container;
  private seedGraphics: Map<string, Container> = new Map();
  /** Reusable preview Graphics — cleared instead of destroyed on each update (CITY-498) */
  private previewGraphics: Graphics | null = null;
  /** Reusable preview Text — repositioned instead of recreated (CITY-498) */
  private previewText: Text | null = null;
  /** Cached TextStyle per category to avoid allocation on every mousemove (CITY-498) */
  private previewTextStyles: Map<SeedCategory, TextStyle> = new Map();

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

  /** Get or create a cached TextStyle for a category (CITY-498) */
  private getPreviewTextStyle(category: SeedCategory): TextStyle {
    let style = this.previewTextStyles.get(category);
    if (!style) {
      style = new TextStyle({ fontSize: 16, fill: CATEGORY_COLORS[category] });
      this.previewTextStyles.set(category, style);
    }
    return style;
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
    if (!preview) {
      // Hide preview objects instead of destroying them (CITY-498)
      if (this.previewGraphics) this.previewGraphics.visible = false;
      if (this.previewText) this.previewText.visible = false;
      return;
    }

    const { position, category, icon } = preview;
    const color = CATEGORY_COLORS[category];
    const bgColor = CATEGORY_BG_COLORS[category];

    // Reuse or lazily create the Graphics object (CITY-498)
    if (!this.previewGraphics) {
      this.previewGraphics = new Graphics();
      this.previewContainer.addChild(this.previewGraphics);
    }
    this.previewGraphics.clear();
    this.previewGraphics.visible = true;

    if (category === "district") {
      // For districts, show a polygon preview representing the district area.
      const size = preview.size ?? 34;
      const baseRadius = size / 2;
      const numPoints = 8;
      const points: { x: number; y: number }[] = [];

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radius = baseRadius * (0.85 + Math.sin(angle * 3) * 0.15);
        points.push({
          x: position.x + Math.cos(angle) * radius,
          y: position.y + Math.sin(angle) * radius,
        });
      }

      // Draw polygon fill
      this.previewGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.previewGraphics.lineTo(points[i].x, points[i].y);
      }
      this.previewGraphics.closePath();
      this.previewGraphics.fill({ color: bgColor, alpha: 0.4 });

      // Draw polygon border
      this.previewGraphics.setStrokeStyle({ width: 2, color, alpha: 0.7 });
      this.previewGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.previewGraphics.lineTo(points[i].x, points[i].y);
      }
      this.previewGraphics.closePath();
      this.previewGraphics.stroke();

      // Draw crosshair at center
      const crossSize = 8;
      this.previewGraphics.setStrokeStyle({ width: 1, color, alpha: 0.8 });
      this.previewGraphics.moveTo(position.x - crossSize, position.y);
      this.previewGraphics.lineTo(position.x + crossSize, position.y);
      this.previewGraphics.stroke();
      this.previewGraphics.moveTo(position.x, position.y - crossSize);
      this.previewGraphics.lineTo(position.x, position.y + crossSize);
      this.previewGraphics.stroke();

      // Draw preview street grid lines within the polygon area
      this.previewGraphics.setStrokeStyle({ width: 1, color: 0xaaaaaa, alpha: 0.3 });
      const gridSpacing = Math.max(6, baseRadius / 3);
      for (let offset = -baseRadius + gridSpacing; offset < baseRadius; offset += gridSpacing) {
        this.previewGraphics.moveTo(position.x - baseRadius * 0.7, position.y + offset);
        this.previewGraphics.lineTo(position.x + baseRadius * 0.7, position.y + offset);
        this.previewGraphics.stroke();
        this.previewGraphics.moveTo(position.x + offset, position.y - baseRadius * 0.7);
        this.previewGraphics.lineTo(position.x + offset, position.y + baseRadius * 0.7);
        this.previewGraphics.stroke();
      }
    } else {
      // For POIs and transit, show the standard circular marker
      this.previewGraphics.circle(position.x, position.y, 20);
      this.previewGraphics.fill({ color: bgColor, alpha: 0.5 });

      this.previewGraphics.setStrokeStyle({ width: 2, color, alpha: 0.7 });
      this.previewGraphics.circle(position.x, position.y, 20);
      this.previewGraphics.stroke();

      this.previewGraphics.setStrokeStyle({ width: 1, color, alpha: 0.5 });
      this.previewGraphics.circle(position.x, position.y, 8);
      this.previewGraphics.stroke();
    }

    // Reuse or lazily create the Text object (CITY-498)
    if (!this.previewText) {
      this.previewText = new Text({ text: icon, style: this.getPreviewTextStyle(category) });
      this.previewText.anchor.set(0.5, 0.5);
      this.previewText.alpha = 0.8;
      this.previewContainer.addChild(this.previewText);
    } else {
      this.previewText.text = icon;
      this.previewText.style = this.getPreviewTextStyle(category);
    }
    this.previewText.position.set(position.x, position.y);
    this.previewText.visible = true;
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

  /**
   * Show a brief red error flash at the given position to indicate
   * placement failure. The flash fades out over ~600ms.
   */
  showPlacementError(position: { x: number; y: number }): void {
    const g = new Graphics();

    // Draw red "X" marker
    const s = 12;
    g.setStrokeStyle({ width: 3, color: 0xe53935, alpha: 1 });
    g.moveTo(position.x - s, position.y - s);
    g.lineTo(position.x + s, position.y + s);
    g.stroke();
    g.moveTo(position.x + s, position.y - s);
    g.lineTo(position.x - s, position.y + s);
    g.stroke();

    // Draw red circle around X
    g.setStrokeStyle({ width: 2, color: 0xe53935, alpha: 0.6 });
    g.circle(position.x, position.y, s * 1.5);
    g.stroke();

    this.previewContainer.addChild(g);

    // Fade out and remove
    let alpha = 1;
    const fadeInterval = setInterval(() => {
      alpha -= 0.05;
      g.alpha = Math.max(0, alpha);
      if (alpha <= 0) {
        clearInterval(fadeInterval);
        this.previewContainer.removeChild(g);
        g.destroy();
      }
    }, 30);
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.seedGraphics.clear();
    this.previewGraphics = null;
    this.previewText = null;
    this.previewTextStyles.clear();
  }
}
