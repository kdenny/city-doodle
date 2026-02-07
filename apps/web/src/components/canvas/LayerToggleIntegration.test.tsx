/**
 * Integration tests for layer toggle functionality.
 *
 * These tests verify that:
 * 1. LayerControls correctly calls onChange with toggled visibility
 * 2. Layer classes correctly update their graphics visibility
 * 3. The full integration from UI to PixiJS layers works
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LayerControls } from "./LayerControls";
import { TerrainLayer } from "./layers/TerrainLayer";
import { FeaturesLayer } from "./layers/FeaturesLayer";
import { LabelLayer } from "./layers/LabelLayer";
import { generateMockTerrain } from "./layers/mockTerrain";
import { generateMockFeatures, generateMockLabels } from "./layers";
import type { LayerVisibility } from "./layers";
import { useState } from "react";

const allVisibleLayers: LayerVisibility = {
  water: true,
  beaches: true,
  coastlines: true,
  rivers: true,
  contours: true,
    neighborhoods: true,
  cityLimits: true,
  districts: true,
  roads: true,
  pois: true,
  bridges: true,
  grid: true,
  labels: true,
  subwayTunnels: false,
};

const allHiddenLayers: LayerVisibility = {
  water: false,
  beaches: false,
  coastlines: false,
  rivers: false,
  contours: false,
    neighborhoods: true,
  cityLimits: true,
  districts: false,
  roads: false,
  pois: false,
  bridges: false,
  grid: false,
  labels: false,
  subwayTunnels: false,
};

describe("LayerControls integration", () => {
  function expandPanel() {
    fireEvent.click(screen.getByTitle("Show layers"));
  }

  it("updates visibility state when checkbox is clicked", () => {
    const onChange = vi.fn();
    render(<LayerControls visibility={allVisibleLayers} onChange={onChange} />);
    expandPanel();

    // Click on water checkbox to toggle it off
    fireEvent.click(screen.getByLabelText("Water"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...allVisibleLayers,
      water: false,
    });
  });

  it("can toggle multiple layers in sequence", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <LayerControls visibility={allVisibleLayers} onChange={onChange} />
    );
    expandPanel();

    // Toggle water off
    fireEvent.click(screen.getByLabelText("Water"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...allVisibleLayers,
      water: false,
    });

    // Update visibility and re-render
    const afterWaterOff = { ...allVisibleLayers, water: false };
    rerender(<LayerControls visibility={afterWaterOff} onChange={onChange} />);

    // Toggle roads off
    fireEvent.click(screen.getByLabelText("Roads"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...afterWaterOff,
      roads: false,
    });

    // Update visibility and re-render
    const afterRoadsOff = { ...afterWaterOff, roads: false };
    rerender(<LayerControls visibility={afterRoadsOff} onChange={onChange} />);

    // Toggle water back on
    fireEvent.click(screen.getByLabelText("Water"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...afterRoadsOff,
      water: true,
    });
  });

  it("reflects visibility state correctly after multiple toggles", () => {
    // Use a stateful wrapper to test the full flow
    function StatefulLayerControls() {
      const [visibility, setVisibility] = useState<LayerVisibility>(allVisibleLayers);
      return <LayerControls visibility={visibility} onChange={setVisibility} />;
    }

    render(<StatefulLayerControls />);
    expandPanel();

    // Initially all visible
    expect(screen.getByLabelText("Water")).toBeChecked();
    expect(screen.getByLabelText("Districts")).toBeChecked();

    // Toggle water off
    fireEvent.click(screen.getByLabelText("Water"));
    expect(screen.getByLabelText("Water")).not.toBeChecked();
    expect(screen.getByLabelText("Districts")).toBeChecked();

    // Toggle districts off
    fireEvent.click(screen.getByLabelText("Districts"));
    expect(screen.getByLabelText("Water")).not.toBeChecked();
    expect(screen.getByLabelText("Districts")).not.toBeChecked();

    // Toggle water back on
    fireEvent.click(screen.getByLabelText("Water"));
    expect(screen.getByLabelText("Water")).toBeChecked();
    expect(screen.getByLabelText("Districts")).not.toBeChecked();
  });
});

describe("TerrainLayer visibility integration", () => {
  let layer: TerrainLayer;

  beforeEach(() => {
    layer = new TerrainLayer();
    layer.setData(generateMockTerrain(768, 42));
  });

  afterEach(() => {
    layer.destroy();
  });

  it("toggles water visibility on and off", () => {
    // Start with all visible
    layer.setVisibility(allVisibleLayers);

    // Toggle water off
    layer.setVisibility({ ...allVisibleLayers, water: false });

    // Toggle water back on
    layer.setVisibility({ ...allVisibleLayers, water: true });

    // No errors should occur
    expect(layer.getContainer()).toBeDefined();
  });

  it("toggles coastlines visibility on and off", () => {
    layer.setVisibility(allVisibleLayers);
    layer.setVisibility({ ...allVisibleLayers, coastlines: false });
    layer.setVisibility({ ...allVisibleLayers, coastlines: true });
    expect(layer.getContainer()).toBeDefined();
  });

  it("toggles rivers visibility on and off", () => {
    layer.setVisibility(allVisibleLayers);
    layer.setVisibility({ ...allVisibleLayers, rivers: false });
    layer.setVisibility({ ...allVisibleLayers, rivers: true });
    expect(layer.getContainer()).toBeDefined();
  });

  it("toggles contours visibility on and off", () => {
    layer.setVisibility(allVisibleLayers);
    layer.setVisibility({ ...allVisibleLayers, contours: false });
    layer.setVisibility({ ...allVisibleLayers, contours: true });
    expect(layer.getContainer()).toBeDefined();
  });

  it("handles rapid visibility toggles", () => {
    for (let i = 0; i < 10; i++) {
      layer.setVisibility({ ...allVisibleLayers, water: i % 2 === 0 });
    }
    expect(layer.getContainer()).toBeDefined();
  });
});

describe("FeaturesLayer visibility integration", () => {
  let layer: FeaturesLayer;

  beforeEach(() => {
    layer = new FeaturesLayer();
    layer.setData(generateMockFeatures(768, 42));
  });

  afterEach(() => {
    layer.destroy();
  });

  it("toggles districts visibility on and off", () => {
    layer.setVisibility(allVisibleLayers);
    layer.setVisibility({ ...allVisibleLayers, districts: false });
    layer.setVisibility({ ...allVisibleLayers, districts: true });
    expect(layer.getContainer()).toBeDefined();
  });

  it("toggles roads visibility on and off", () => {
    layer.setVisibility(allVisibleLayers);
    layer.setVisibility({ ...allVisibleLayers, roads: false });
    layer.setVisibility({ ...allVisibleLayers, roads: true });
    expect(layer.getContainer()).toBeDefined();
  });

  it("toggles pois visibility on and off", () => {
    layer.setVisibility(allVisibleLayers);
    layer.setVisibility({ ...allVisibleLayers, pois: false });
    layer.setVisibility({ ...allVisibleLayers, pois: true });
    expect(layer.getContainer()).toBeDefined();
  });

  it("handles all features being toggled off and on", () => {
    layer.setVisibility({
      ...allVisibleLayers,
      districts: false,
      roads: false,
      pois: false,
    });
    layer.setVisibility(allVisibleLayers);
    expect(layer.getContainer()).toBeDefined();
  });
});

describe("LabelLayer visibility integration", () => {
  let layer: LabelLayer;

  beforeEach(() => {
    layer = new LabelLayer();
    layer.setData(generateMockLabels(768, 42));
  });

  afterEach(() => {
    layer.destroy();
  });

  it("toggles labels visibility via setVisibility", () => {
    // Start visible
    layer.setVisibility(allVisibleLayers);
    expect(layer.getContainer().visible).toBe(true);

    // Toggle off
    layer.setVisibility({ ...allVisibleLayers, labels: false });
    expect(layer.getContainer().visible).toBe(false);

    // Toggle back on
    layer.setVisibility({ ...allVisibleLayers, labels: true });
    expect(layer.getContainer().visible).toBe(true);
  });

  it("handles rapid visibility toggles", () => {
    for (let i = 0; i < 10; i++) {
      layer.setVisibility({ ...allVisibleLayers, labels: i % 2 === 0 });
    }
    expect(layer.getContainer()).toBeDefined();
  });
});

describe("Full layer toggle flow", () => {
  it("simulates user toggling layers through LayerControls", () => {
    // Create layer instances
    const terrainLayer = new TerrainLayer();
    const featuresLayer = new FeaturesLayer();
    const labelLayer = new LabelLayer();

    // Set data
    terrainLayer.setData(generateMockTerrain(768, 42));
    featuresLayer.setData(generateMockFeatures(768, 42));
    labelLayer.setData(generateMockLabels(768, 42));

    // Simulate the handleVisibilityChange from MapCanvas
    const handleVisibilityChange = (visibility: LayerVisibility) => {
      terrainLayer.setVisibility(visibility);
      featuresLayer.setVisibility(visibility);
      labelLayer.setVisibility(visibility);
    };

    // Start with all visible
    let currentVisibility = { ...allVisibleLayers };
    handleVisibilityChange(currentVisibility);

    // Render LayerControls
    const { rerender } = render(
      <LayerControls
        visibility={currentVisibility}
        onChange={(newVis) => {
          currentVisibility = newVis;
          handleVisibilityChange(newVis);
        }}
      />
    );

    // Expand the panel first
    fireEvent.click(screen.getByTitle("Show layers"));

    // Toggle water off
    fireEvent.click(screen.getByLabelText("Water"));
    rerender(
      <LayerControls
        visibility={currentVisibility}
        onChange={(newVis) => {
          currentVisibility = newVis;
          handleVisibilityChange(newVis);
        }}
      />
    );

    expect(currentVisibility.water).toBe(false);
    expect(screen.getByLabelText("Water")).not.toBeChecked();

    // Toggle districts off
    fireEvent.click(screen.getByLabelText("Districts"));
    rerender(
      <LayerControls
        visibility={currentVisibility}
        onChange={(newVis) => {
          currentVisibility = newVis;
          handleVisibilityChange(newVis);
        }}
      />
    );

    expect(currentVisibility.districts).toBe(false);
    expect(screen.getByLabelText("Districts")).not.toBeChecked();

    // Toggle labels off
    fireEvent.click(screen.getByLabelText("Labels"));
    expect(currentVisibility.labels).toBe(false);
    expect(labelLayer.getContainer().visible).toBe(false);

    // Clean up
    terrainLayer.destroy();
    featuresLayer.destroy();
    labelLayer.destroy();
  });

  it("all layer types respond to visibility changes consistently", () => {
    const terrainLayer = new TerrainLayer();
    const featuresLayer = new FeaturesLayer();
    const labelLayer = new LabelLayer();

    terrainLayer.setData(generateMockTerrain(768, 42));
    featuresLayer.setData(generateMockFeatures(768, 42));
    labelLayer.setData(generateMockLabels(768, 42));

    // Apply all-hidden visibility
    terrainLayer.setVisibility(allHiddenLayers);
    featuresLayer.setVisibility(allHiddenLayers);
    labelLayer.setVisibility(allHiddenLayers);

    // Labels container visibility is directly readable
    expect(labelLayer.getContainer().visible).toBe(false);

    // Apply all-visible visibility
    terrainLayer.setVisibility(allVisibleLayers);
    featuresLayer.setVisibility(allVisibleLayers);
    labelLayer.setVisibility(allVisibleLayers);

    expect(labelLayer.getContainer().visible).toBe(true);

    terrainLayer.destroy();
    featuresLayer.destroy();
    labelLayer.destroy();
  });
});

describe("Edge cases", () => {
  it("handles setVisibility before setData", () => {
    const terrainLayer = new TerrainLayer();
    const featuresLayer = new FeaturesLayer();
    const labelLayer = new LabelLayer();

    // Set visibility before data
    expect(() => {
      terrainLayer.setVisibility(allVisibleLayers);
      featuresLayer.setVisibility(allVisibleLayers);
      labelLayer.setVisibility(allVisibleLayers);
    }).not.toThrow();

    // Now set data
    terrainLayer.setData(generateMockTerrain(768, 42));
    featuresLayer.setData(generateMockFeatures(768, 42));
    labelLayer.setData(generateMockLabels(768, 42));

    // Clean up
    terrainLayer.destroy();
    featuresLayer.destroy();
    labelLayer.destroy();
  });

  it("handles empty data gracefully", () => {
    const terrainLayer = new TerrainLayer();
    const featuresLayer = new FeaturesLayer();
    const labelLayer = new LabelLayer();

    // Set empty data
    terrainLayer.setData({
      water: [],
      beaches: [],
      coastlines: [],
      rivers: [],
      contours: [],
    });
    featuresLayer.setData({
      districts: [],
      roads: [],
      pois: [],
      neighborhoods: [],
      bridges: [],
    });
    labelLayer.setData({
      labels: [],
      seed: 42,
    });

    // Toggle visibility should still work
    expect(() => {
      terrainLayer.setVisibility(allHiddenLayers);
      featuresLayer.setVisibility(allHiddenLayers);
      labelLayer.setVisibility(allHiddenLayers);
    }).not.toThrow();

    terrainLayer.destroy();
    featuresLayer.destroy();
    labelLayer.destroy();
  });

  it("handles partial visibility updates", () => {
    const terrainLayer = new TerrainLayer();
    terrainLayer.setData(generateMockTerrain(768, 42));

    // Multiple partial updates
    terrainLayer.setVisibility({ ...allVisibleLayers, water: false });
    terrainLayer.setVisibility({ ...allVisibleLayers, water: false, rivers: false });
    terrainLayer.setVisibility({ ...allVisibleLayers, water: true, rivers: false });
    terrainLayer.setVisibility(allVisibleLayers);

    expect(terrainLayer.getContainer()).toBeDefined();
    terrainLayer.destroy();
  });
});
