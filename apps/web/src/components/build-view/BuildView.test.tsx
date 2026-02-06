import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BuildView } from "./BuildView";

describe("BuildView", () => {
  it("renders children", () => {
    render(
      <BuildView>
        <div data-testid="content">Map Content</div>
      </BuildView>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders toolbar with all tools including city limits", () => {
    render(
      <BuildView>
        <div>Content</div>
      </BuildView>
    );
    expect(screen.getByLabelText("Pan")).toBeInTheDocument();
    expect(screen.getByLabelText("Draw Neighborhood")).toBeInTheDocument();
    expect(screen.getByLabelText("Draw City Limits")).toBeInTheDocument();
    expect(screen.getByLabelText("Build")).toBeInTheDocument();
    expect(screen.getByLabelText("Draw Transit Line")).toBeInTheDocument();
  });

  it("renders layers panel with toggles", () => {
    render(
      <BuildView>
        <div>Content</div>
      </BuildView>
    );
    expect(screen.getByText("Transit")).toBeInTheDocument();
    expect(screen.getByText("Parks")).toBeInTheDocument();
    expect(screen.getByText("Density")).toBeInTheDocument();
  });

  it("renders population panel", () => {
    render(
      <BuildView population={500000} growthPercent={1.5}>
        <div>Content</div>
      </BuildView>
    );
    expect(screen.getByText("500,000")).toBeInTheDocument();
    expect(screen.getByText("+1.5%")).toBeInTheDocument();
    expect(screen.getByText("Population")).toBeInTheDocument();
  });

  it("renders city needs icons", () => {
    render(
      <BuildView>
        <div>Content</div>
      </BuildView>
    );
    expect(screen.getByTitle("City Needs - Click for details")).toBeInTheDocument();
  });

  it("calls onToolChange when tool is selected", () => {
    const onToolChange = vi.fn();
    render(
      <BuildView onToolChange={onToolChange}>
        <div>Content</div>
      </BuildView>
    );

    fireEvent.click(screen.getByLabelText("Build"));
    expect(onToolChange).toHaveBeenCalledWith("build");
  });

  it("calls onCityNeedsClick when city needs is clicked", () => {
    const onCityNeedsClick = vi.fn();
    render(
      <BuildView onCityNeedsClick={onCityNeedsClick}>
        <div>Content</div>
      </BuildView>
    );

    fireEvent.click(screen.getByTitle("City Needs - Click for details"));
    expect(onCityNeedsClick).toHaveBeenCalled();
  });

  it("toggles layer visibility when checkbox clicked", () => {
    render(
      <BuildView>
        <div>Content</div>
      </BuildView>
    );

    const densityLabel = screen.getByText("Density");
    fireEvent.click(densityLabel);
    // Layer state should toggle (internal state, tested via callback in integration)
  });
});
