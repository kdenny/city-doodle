import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LayerControls } from "./LayerControls";
import type { LayerVisibility } from "./layers";

const defaultVisibility: LayerVisibility = {
  water: true,
  coastlines: true,
  rivers: true,
  contours: true,
  grid: true,
};

describe("LayerControls", () => {
  it("renders all layer checkboxes", () => {
    render(
      <LayerControls visibility={defaultVisibility} onChange={vi.fn()} />
    );
    expect(screen.getByLabelText("Water")).toBeInTheDocument();
    expect(screen.getByLabelText("Coastlines")).toBeInTheDocument();
    expect(screen.getByLabelText("Rivers")).toBeInTheDocument();
    expect(screen.getByLabelText("Contours")).toBeInTheDocument();
    expect(screen.getByLabelText("Grid")).toBeInTheDocument();
  });

  it("displays checkboxes as checked when visible", () => {
    render(
      <LayerControls visibility={defaultVisibility} onChange={vi.fn()} />
    );
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
    expect(screen.getByLabelText("Water")).not.toBeChecked();
    expect(screen.getByLabelText("Grid")).not.toBeChecked();
  });

  it("calls onChange with toggled layer when checkbox clicked", () => {
    const onChange = vi.fn();
    render(<LayerControls visibility={defaultVisibility} onChange={onChange} />);

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

    fireEvent.click(screen.getByLabelText("Rivers"));

    expect(onChange).toHaveBeenCalledWith({
      ...defaultVisibility,
      rivers: true,
    });
  });

  it("renders the Layers heading", () => {
    render(
      <LayerControls visibility={defaultVisibility} onChange={vi.fn()} />
    );
    expect(screen.getByText("Layers")).toBeInTheDocument();
  });
});
