import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  PersonalitySliders,
  DEFAULT_WORLD_SETTINGS,
  SLIDER_CONFIGS,
} from "./PersonalitySliders";
import type { WorldSettings } from "../../api/types";

describe("PersonalitySliders", () => {
  const defaultSettings: WorldSettings = {
    grid_organic: 0.5,
    sprawl_compact: 0.5,
    historic_modern: 0.5,
    transit_car: 0.5,
  };

  it("renders all four sliders", () => {
    render(
      <PersonalitySliders settings={defaultSettings} onChange={vi.fn()} />
    );

    // Check all slider labels are present
    expect(screen.getByText("Grid")).toBeInTheDocument();
    expect(screen.getByText("Organic")).toBeInTheDocument();
    expect(screen.getByText("Sprawl")).toBeInTheDocument();
    expect(screen.getByText("Compact")).toBeInTheDocument();
    expect(screen.getByText("Historic")).toBeInTheDocument();
    expect(screen.getByText("Modern")).toBeInTheDocument();
    expect(screen.getByText("Transit")).toBeInTheDocument();
    expect(screen.getByText("Car")).toBeInTheDocument();
  });

  it("renders the title", () => {
    render(
      <PersonalitySliders settings={defaultSettings} onChange={vi.fn()} />
    );

    expect(screen.getByText("City Personality")).toBeInTheDocument();
  });

  it("displays current value percentages", () => {
    const settings: WorldSettings = {
      grid_organic: 0.3,
      sprawl_compact: 0.7,
      historic_modern: 0,
      transit_car: 1,
    };

    render(<PersonalitySliders settings={settings} onChange={vi.fn()} />);

    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("calls onChange when slider value changes", () => {
    const onChange = vi.fn();
    render(
      <PersonalitySliders settings={defaultSettings} onChange={onChange} />
    );

    const sliders = screen.getAllByRole("slider");
    // Change the first slider (grid_organic)
    fireEvent.change(sliders[0], { target: { value: "75" } });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultSettings,
      grid_organic: 0.75,
    });
  });

  it("calls onChange with correct key for each slider", () => {
    const onChange = vi.fn();
    render(
      <PersonalitySliders settings={defaultSettings} onChange={onChange} />
    );

    const sliders = screen.getAllByRole("slider");

    // Change grid_organic
    fireEvent.change(sliders[0], { target: { value: "20" } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultSettings,
      grid_organic: 0.2,
    });

    // Change sprawl_compact
    fireEvent.change(sliders[1], { target: { value: "80" } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultSettings,
      sprawl_compact: 0.8,
    });

    // Change historic_modern
    fireEvent.change(sliders[2], { target: { value: "0" } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultSettings,
      historic_modern: 0,
    });

    // Change transit_car
    fireEvent.change(sliders[3], { target: { value: "100" } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultSettings,
      transit_car: 1,
    });
  });

  it("disables all sliders when disabled prop is true", () => {
    render(
      <PersonalitySliders
        settings={defaultSettings}
        onChange={vi.fn()}
        disabled={true}
      />
    );

    const sliders = screen.getAllByRole("slider");
    sliders.forEach((slider) => {
      expect(slider).toBeDisabled();
    });
  });

  it("enables all sliders when disabled prop is false", () => {
    render(
      <PersonalitySliders
        settings={defaultSettings}
        onChange={vi.fn()}
        disabled={false}
      />
    );

    const sliders = screen.getAllByRole("slider");
    sliders.forEach((slider) => {
      expect(slider).not.toBeDisabled();
    });
  });

  it("applies custom className", () => {
    const { container } = render(
      <PersonalitySliders
        settings={defaultSettings}
        onChange={vi.fn()}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("has accessible labels for all sliders", () => {
    render(
      <PersonalitySliders settings={defaultSettings} onChange={vi.fn()} />
    );

    expect(screen.getByLabelText("Grid to Organic")).toBeInTheDocument();
    expect(screen.getByLabelText("Sprawl to Compact")).toBeInTheDocument();
    expect(screen.getByLabelText("Historic to Modern")).toBeInTheDocument();
    expect(screen.getByLabelText("Transit to Car")).toBeInTheDocument();
  });

  it("shows tooltips on slider containers", () => {
    render(
      <PersonalitySliders settings={defaultSettings} onChange={vi.fn()} />
    );

    // Check that each slider group has a tooltip
    SLIDER_CONFIGS.forEach((config) => {
      const tooltip = screen.getByTitle(config.tooltip);
      expect(tooltip).toBeInTheDocument();
    });
  });
});

describe("DEFAULT_WORLD_SETTINGS", () => {
  it("has all sliders at 0.5", () => {
    expect(DEFAULT_WORLD_SETTINGS.grid_organic).toBe(0.5);
    expect(DEFAULT_WORLD_SETTINGS.sprawl_compact).toBe(0.5);
    expect(DEFAULT_WORLD_SETTINGS.historic_modern).toBe(0.5);
    expect(DEFAULT_WORLD_SETTINGS.transit_car).toBe(0.5);
  });
});

describe("SLIDER_CONFIGS", () => {
  it("has four slider configurations", () => {
    expect(SLIDER_CONFIGS).toHaveLength(4);
  });

  it("has valid keys for all sliders", () => {
    const validKeys: (keyof WorldSettings)[] = [
      "grid_organic",
      "sprawl_compact",
      "historic_modern",
      "transit_car",
    ];

    SLIDER_CONFIGS.forEach((config) => {
      expect(validKeys).toContain(config.key);
    });
  });
});
