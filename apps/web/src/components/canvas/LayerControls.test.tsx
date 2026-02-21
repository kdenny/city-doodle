import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LayerControls } from "./LayerControls";
import type { LayerVisibility } from "./layers";

const defaultVisibility: LayerVisibility = {
  water: true,
  beaches: true,
  coastlines: true,
  rivers: true,
  contours: true,
  barrierIslands: true,
  tidalFlats: true,
  duneRidges: true,
  inlets: true,
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

describe("LayerControls", () => {
  function expandPanel() {
    // Panel starts collapsed; click the toggle to expand it
    fireEvent.click(screen.getByTitle("Show layers"));
  }

  it("renders collapsed by default with toggle button", () => {
    render(
      <LayerControls visibility={defaultVisibility} onChange={vi.fn()} />
    );
    expect(screen.getByTitle("Show layers")).toBeInTheDocument();
    expect(screen.queryByText("Layers")).not.toBeInTheDocument();
  });

  it("renders all layer checkboxes when expanded", () => {
    render(
      <LayerControls visibility={defaultVisibility} onChange={vi.fn()} />
    );
    expandPanel();
    expect(screen.getByLabelText("Water")).toBeInTheDocument();
    expect(screen.getByLabelText("Coastlines")).toBeInTheDocument();
    expect(screen.getByLabelText("Rivers")).toBeInTheDocument();
    expect(screen.getByLabelText("Contours")).toBeInTheDocument();
    expect(screen.getByLabelText("Neighborhoods")).toBeInTheDocument();
    expect(screen.getByLabelText("Districts")).toBeInTheDocument();
    expect(screen.getByLabelText("Roads")).toBeInTheDocument();
    expect(screen.getByLabelText("POIs")).toBeInTheDocument();
    expect(screen.getByLabelText("Grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Labels")).toBeInTheDocument();
  });

  it("displays checkboxes as checked when visible", () => {
    render(
      <LayerControls visibility={defaultVisibility} onChange={vi.fn()} />
    );
    expandPanel();
    expect(screen.getByLabelText("Water")).toBeChecked();
    expect(screen.getByLabelText("Grid")).toBeChecked();
  });

  it("displays checkboxes as unchecked when not visible", () => {
    const visibility: LayerVisibility = {
      ...defaultVisibility,
      water: false,
      grid: false,
    };
    render(<LayerControls visibility={visibility} onChange={vi.fn()} />);
    expandPanel();
    expect(screen.getByLabelText("Water")).not.toBeChecked();
    expect(screen.getByLabelText("Grid")).not.toBeChecked();
  });

  it("calls onChange with toggled layer when checkbox clicked", () => {
    const onChange = vi.fn();
    render(<LayerControls visibility={defaultVisibility} onChange={onChange} />);
    expandPanel();

    fireEvent.click(screen.getByLabelText("Water"));

    expect(onChange).toHaveBeenCalledWith({
      ...defaultVisibility,
      water: false,
    });
  });

  it("toggles from off to on correctly", () => {
    const visibility: LayerVisibility = {
      ...defaultVisibility,
      rivers: false,
    };
    const onChange = vi.fn();
    render(<LayerControls visibility={visibility} onChange={onChange} />);
    expandPanel();

    fireEvent.click(screen.getByLabelText("Rivers"));

    expect(onChange).toHaveBeenCalledWith({
      ...defaultVisibility,
      rivers: true,
    });
  });

  it("renders the Layers heading when expanded", () => {
    render(
      <LayerControls visibility={defaultVisibility} onChange={vi.fn()} />
    );
    expandPanel();
    expect(screen.getByText("Layers")).toBeInTheDocument();
  });

  it("collapses when hide button is clicked", () => {
    render(
      <LayerControls visibility={defaultVisibility} onChange={vi.fn()} />
    );
    expandPanel();
    expect(screen.getByText("Layers")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Hide layers"));
    expect(screen.queryByText("Layers")).not.toBeInTheDocument();
    expect(screen.getByTitle("Show layers")).toBeInTheDocument();
  });
});
