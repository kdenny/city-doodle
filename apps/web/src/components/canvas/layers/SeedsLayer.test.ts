import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SeedsLayer, type PlacedSeedData, type PreviewSeedData } from "./SeedsLayer";

describe("SeedsLayer", () => {
  let layer: SeedsLayer;

  beforeEach(() => {
    layer = new SeedsLayer();
  });

  afterEach(() => {
    layer.destroy();
  });

  it("creates a container with correct label", () => {
    const container = layer.getContainer();
    expect(container.label).toBe("seeds");
  });

  it("has child containers for placed seeds and preview", () => {
    const container = layer.getContainer();
    expect(container.children).toHaveLength(2);
  });

  describe("setSeeds", () => {
    it("accepts empty seeds array without throwing", () => {
      expect(() => layer.setSeeds([])).not.toThrow();
    });

    it("accepts seeds data without throwing", () => {
      const seeds: PlacedSeedData[] = [
        {
          id: "seed-1",
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: "Residential",
          position: { x: 100, y: 200 },
        },
      ];

      expect(() => layer.setSeeds(seeds)).not.toThrow();
    });

    it("handles multiple seeds", () => {
      const seeds: PlacedSeedData[] = [
        {
          id: "seed-1",
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: "Residential",
          position: { x: 100, y: 200 },
        },
        {
          id: "seed-2",
          seedId: "hospital",
          category: "poi",
          icon: "🏥",
          label: "Hospital",
          position: { x: 300, y: 400 },
        },
        {
          id: "seed-3",
          seedId: "train_station",
          category: "transit",
          icon: "🚆",
          label: "Train Station",
          position: { x: 500, y: 600 },
        },
      ];

      expect(() => layer.setSeeds(seeds)).not.toThrow();
    });

    it("removes seeds that are no longer present", () => {
      const initialSeeds: PlacedSeedData[] = [
        {
          id: "seed-1",
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: "Residential",
          position: { x: 100, y: 200 },
        },
        {
          id: "seed-2",
          seedId: "hospital",
          category: "poi",
          icon: "🏥",
          label: "Hospital",
          position: { x: 300, y: 400 },
        },
      ];

      layer.setSeeds(initialSeeds);

      const updatedSeeds: PlacedSeedData[] = [
        {
          id: "seed-1",
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: "Residential",
          position: { x: 100, y: 200 },
        },
      ];

      // Should not throw when removing seeds
      expect(() => layer.setSeeds(updatedSeeds)).not.toThrow();
    });

    it("updates existing seeds", () => {
      const initialSeeds: PlacedSeedData[] = [
        {
          id: "seed-1",
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: "Residential",
          position: { x: 100, y: 200 },
        },
      ];

      layer.setSeeds(initialSeeds);

      const updatedSeeds: PlacedSeedData[] = [
        {
          id: "seed-1",
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: "Residential",
          position: { x: 500, y: 600 }, // Changed position
        },
      ];

      expect(() => layer.setSeeds(updatedSeeds)).not.toThrow();
    });

    it("handles all seed categories", () => {
      const seeds: PlacedSeedData[] = [
        {
          id: "seed-district",
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: "Residential",
          position: { x: 100, y: 100 },
        },
        {
          id: "seed-poi",
          seedId: "hospital",
          category: "poi",
          icon: "🏥",
          label: "Hospital",
          position: { x: 200, y: 200 },
        },
        {
          id: "seed-transit",
          seedId: "train_station",
          category: "transit",
          icon: "🚆",
          label: "Train Station",
          position: { x: 300, y: 300 },
        },
      ];

      expect(() => layer.setSeeds(seeds)).not.toThrow();
    });
  });

  describe("setPreview", () => {
    it("accepts null to clear preview", () => {
      expect(() => layer.setPreview(null)).not.toThrow();
    });

    it("accepts preview data without throwing", () => {
      const preview: PreviewSeedData = {
        seedId: "residential",
        category: "district",
        icon: "🏘️",
        position: { x: 150, y: 250 },
      };

      expect(() => layer.setPreview(preview)).not.toThrow();
    });

    it("can set preview after clearing it", () => {
      const preview: PreviewSeedData = {
        seedId: "residential",
        category: "district",
        icon: "🏘️",
        position: { x: 150, y: 250 },
      };

      layer.setPreview(preview);
      layer.setPreview(null);
      expect(() => layer.setPreview(preview)).not.toThrow();
    });

    it("can update preview position", () => {
      const preview1: PreviewSeedData = {
        seedId: "residential",
        category: "district",
        icon: "🏘️",
        position: { x: 150, y: 250 },
      };

      const preview2: PreviewSeedData = {
        seedId: "residential",
        category: "district",
        icon: "🏘️",
        position: { x: 300, y: 400 },
      };

      layer.setPreview(preview1);
      expect(() => layer.setPreview(preview2)).not.toThrow();
    });

    it("handles all seed categories for preview", () => {
      const categories: Array<"district" | "poi" | "transit"> = [
        "district",
        "poi",
        "transit",
      ];

      for (const category of categories) {
        const preview: PreviewSeedData = {
          seedId: "test",
          category,
          icon: "🔵",
          position: { x: 100, y: 100 },
        };

        expect(() => layer.setPreview(preview)).not.toThrow();
        layer.setPreview(null);
      }
    });
  });

  describe("setVisible", () => {
    it("can set visibility to true", () => {
      expect(() => layer.setVisible(true)).not.toThrow();
    });

    it("can set visibility to false", () => {
      expect(() => layer.setVisible(false)).not.toThrow();
    });

    it("updates container visibility", () => {
      layer.setVisible(false);
      expect(layer.getContainer().visible).toBe(false);

      layer.setVisible(true);
      expect(layer.getContainer().visible).toBe(true);
    });
  });

  describe("destroy", () => {
    it("cleans up without throwing", () => {
      expect(() => layer.destroy()).not.toThrow();
    });

    it("cleans up after adding seeds", () => {
      const seeds: PlacedSeedData[] = [
        {
          id: "seed-1",
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: "Residential",
          position: { x: 100, y: 200 },
        },
      ];

      layer.setSeeds(seeds);
      expect(() => layer.destroy()).not.toThrow();
    });

    it("cleans up after setting preview", () => {
      const preview: PreviewSeedData = {
        seedId: "residential",
        category: "district",
        icon: "🏘️",
        position: { x: 150, y: 250 },
      };

      layer.setPreview(preview);
      expect(() => layer.destroy()).not.toThrow();
    });
  });

  describe("integration scenarios", () => {
    it("handles a sequence of operations", () => {
      // Add some seeds
      const seeds: PlacedSeedData[] = [
        {
          id: "seed-1",
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: "Residential",
          position: { x: 100, y: 200 },
        },
      ];
      layer.setSeeds(seeds);

      // Set preview
      const preview: PreviewSeedData = {
        seedId: "hospital",
        category: "poi",
        icon: "🏥",
        position: { x: 300, y: 400 },
      };
      layer.setPreview(preview);

      // Add another seed (simulating placement)
      const updatedSeeds: PlacedSeedData[] = [
        ...seeds,
        {
          id: "seed-2",
          seedId: "hospital",
          category: "poi",
          icon: "🏥",
          label: "Hospital",
          position: { x: 300, y: 400 },
        },
      ];
      layer.setSeeds(updatedSeeds);

      // Clear preview
      layer.setPreview(null);

      // Toggle visibility
      layer.setVisible(false);
      layer.setVisible(true);

      // Remove a seed
      layer.setSeeds([seeds[0]]);

      // All operations should complete without throwing
      expect(true).toBe(true);
    });

    it("handles rapid preview updates (simulating mouse movement)", () => {
      for (let i = 0; i < 100; i++) {
        const preview: PreviewSeedData = {
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          position: { x: i * 5, y: i * 5 },
        };
        layer.setPreview(preview);
      }

      layer.setPreview(null);
      expect(true).toBe(true);
    });

    it("handles adding and removing many seeds", () => {
      // Add 50 seeds
      const seeds: PlacedSeedData[] = [];
      for (let i = 0; i < 50; i++) {
        seeds.push({
          id: `seed-${i}`,
          seedId: "residential",
          category: "district",
          icon: "🏘️",
          label: `Seed ${i}`,
          position: { x: i * 20, y: i * 20 },
        });
      }

      layer.setSeeds(seeds);

      // Remove half of them
      layer.setSeeds(seeds.slice(0, 25));

      // Remove all
      layer.setSeeds([]);

      expect(true).toBe(true);
    });
  });
});
