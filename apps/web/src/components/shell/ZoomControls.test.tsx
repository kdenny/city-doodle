import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ZoomControls } from "./ZoomControls";

describe("ZoomControls", () => {
  it("displays current zoom percentage", () => {
    render(<ZoomControls zoom={1} onZoomIn={vi.fn()} onZoomOut={vi.fn()} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("displays zoom percentage rounded", () => {
    render(<ZoomControls zoom={1.333} onZoomIn={vi.fn()} onZoomOut={vi.fn()} />);
    expect(screen.getByText("133%")).toBeInTheDocument();
  });

  it("calls onZoomIn when zoom in button clicked", () => {
    const onZoomIn = vi.fn();
    render(<ZoomControls zoom={1} onZoomIn={onZoomIn} onZoomOut={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
  });

  it("calls onZoomOut when zoom out button clicked", () => {
    const onZoomOut = vi.fn();
    render(<ZoomControls zoom={1} onZoomIn={vi.fn()} onZoomOut={onZoomOut} />);
    fireEvent.click(screen.getByLabelText("Zoom out"));
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  it("disables zoom in at max zoom", () => {
    render(
      <ZoomControls zoom={4} maxZoom={4} onZoomIn={vi.fn()} onZoomOut={vi.fn()} />
    );
    expect(screen.getByLabelText("Zoom in")).toBeDisabled();
  });

  it("disables zoom out at min zoom", () => {
    render(
      <ZoomControls
        zoom={0.25}
        minZoom={0.25}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Zoom out")).toBeDisabled();
  });

  it("enables both buttons when zoom is in valid range", () => {
    render(<ZoomControls zoom={1} onZoomIn={vi.fn()} onZoomOut={vi.fn()} />);
    expect(screen.getByLabelText("Zoom in")).not.toBeDisabled();
    expect(screen.getByLabelText("Zoom out")).not.toBeDisabled();
  });
});
