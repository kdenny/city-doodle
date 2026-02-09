import { Container, Graphics } from "pixi.js";

interface StationPosition {
  x: number;
  y: number;
  stationType: "rail" | "subway";
}

// Walking distance bands in world units (approximate meters)
// ~5 min walk = 400m, ~10 min = 800m, ~15 min = 1200m
const DISTANCE_BANDS = [
  { radius: 400, color: 0x22c55e, alpha: 0.18, label: "5 min" }, // Green
  { radius: 800, color: 0xeab308, alpha: 0.12, label: "10 min" }, // Yellow
  { radius: 1200, color: 0xf97316, alpha: 0.08, label: "15 min" }, // Orange
];

export { DISTANCE_BANDS };

export class WalkabilityOverlayLayer {
  readonly container: Container;
  private graphics: Graphics;
  private visible: boolean = false;

  constructor() {
    this.container = new Container();
    this.container.label = "walkability-overlay";
    this.container.visible = false;
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.visible = visible;
  }

  update(stations: StationPosition[]): void {
    this.graphics.clear();
    if (!this.visible || stations.length === 0) return;

    // Draw bands from largest to smallest so inner bands render on top
    for (let i = DISTANCE_BANDS.length - 1; i >= 0; i--) {
      const band = DISTANCE_BANDS[i];
      for (const station of stations) {
        this.graphics.circle(station.x, station.y, band.radius);
      }
      this.graphics.fill({ color: band.color, alpha: band.alpha });
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy({ children: true });
  }
}
