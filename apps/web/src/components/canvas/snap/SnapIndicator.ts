/**
 * Visual snap indicator using PixiJS.
 *
 * Renders a crosshair or highlight at the snap point location
 * to provide visual feedback during interaction.
 */

import { Container, Graphics } from "pixi.js";
import type { SnapPoint, SnapPointType } from "./types";

// Colors for different snap point types
const SNAP_COLORS: Record<SnapPointType, number> = {
  vertex: 0x2563eb, // Blue
  midpoint: 0x16a34a, // Green
  intersection: 0xdc2626, // Red
  nearest: 0x9333ea, // Purple
};

// Default indicator configuration
const DEFAULT_SIZE = 12;
const DEFAULT_STROKE_WIDTH = 2;

export interface SnapIndicatorConfig {
  /** Size of the indicator (diameter) */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Whether to show a crosshair */
  showCrosshair?: boolean;
  /** Whether to animate the indicator */
  animated?: boolean;
}

export class SnapIndicator {
  private container: Container;
  private graphics: Graphics;
  private config: Required<SnapIndicatorConfig>;
  private currentSnapPoint: SnapPoint | null = null;
  private animationFrame: number = 0;
  private animationId: number | null = null;

  constructor(config: SnapIndicatorConfig = {}) {
    this.config = {
      size: config.size ?? DEFAULT_SIZE,
      strokeWidth: config.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      showCrosshair: config.showCrosshair ?? true,
      animated: config.animated ?? true,
    };

    this.container = new Container();
    this.container.label = "snap-indicator";
    this.container.visible = false;

    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  /**
   * Gets the container to add to the scene.
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Updates the indicator to show a snap point.
   */
  show(snapPoint: SnapPoint): void {
    this.currentSnapPoint = snapPoint;
    this.container.visible = true;
    this.container.position.set(snapPoint.x, snapPoint.y);
    this.draw();

    if (this.config.animated && !this.animationId) {
      this.startAnimation();
    }
  }

  /**
   * Hides the indicator.
   */
  hide(): void {
    this.currentSnapPoint = null;
    this.container.visible = false;
    this.stopAnimation();
  }

  /**
   * Updates configuration.
   */
  setConfig(config: Partial<SnapIndicatorConfig>): void {
    Object.assign(this.config, config);
    if (this.currentSnapPoint) {
      this.draw();
    }
  }

  /**
   * Destroys the indicator and releases resources.
   */
  destroy(): void {
    this.stopAnimation();
    this.container.destroy({ children: true });
  }

  private draw(): void {
    if (!this.currentSnapPoint) return;

    const { size, strokeWidth, showCrosshair } = this.config;
    const color = SNAP_COLORS[this.currentSnapPoint.type];
    const halfSize = size / 2;

    // Calculate pulse effect
    const pulse = this.config.animated
      ? 1 + 0.15 * Math.sin(this.animationFrame * 0.1)
      : 1;
    const currentSize = halfSize * pulse;

    this.graphics.clear();

    // Draw outer circle
    this.graphics.setStrokeStyle({ width: strokeWidth, color });
    this.graphics.circle(0, 0, currentSize);
    this.graphics.stroke();

    // Draw center dot
    this.graphics.circle(0, 0, strokeWidth);
    this.graphics.fill({ color });

    // Draw crosshair if enabled
    if (showCrosshair) {
      const crossSize = currentSize + 4;
      this.graphics.moveTo(-crossSize, 0);
      this.graphics.lineTo(-currentSize - 2, 0);
      this.graphics.moveTo(currentSize + 2, 0);
      this.graphics.lineTo(crossSize, 0);
      this.graphics.moveTo(0, -crossSize);
      this.graphics.lineTo(0, -currentSize - 2);
      this.graphics.moveTo(0, currentSize + 2);
      this.graphics.lineTo(0, crossSize);
      this.graphics.stroke();
    }
  }

  private startAnimation(): void {
    const animate = () => {
      this.animationFrame++;
      this.draw();
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  }

  private stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.animationFrame = 0;
  }
}
