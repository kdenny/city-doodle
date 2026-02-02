import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DensityView } from "./DensityView";
import { landUseCategories } from "./LandUseLegend";

describe("DensityView", () => {
  it("renders children", () => {
    render(
      <DensityView>
        <div data-testid="content">Map Content</div>
      </DensityView>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders land use legend", () => {
    render(
      <DensityView>
        <div>Content</div>
      </DensityView>
    );
    expect(screen.getByText("Land Use")).toBeInTheDocument();
  });

  it("displays all land use categories", () => {
    render(
      <DensityView>
        <div>Content</div>
      </DensityView>
    );
    landUseCategories.forEach(({ label }) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("displays land use descriptions", () => {
    render(
      <DensityView>
        <div>Content</div>
      </DensityView>
    );
    expect(screen.getByText("Downtown core")).toBeInTheDocument();
    expect(screen.getByText("Mixed use")).toBeInTheDocument();
    expect(screen.getByText("Housing areas")).toBeInTheDocument();
  });

  it("renders statistics panel with default values", () => {
    render(
      <DensityView>
        <div>Content</div>
      </DensityView>
    );
    expect(screen.getByText("Statistics")).toBeInTheDocument();
    expect(screen.getByText("Total Area")).toBeInTheDocument();
    expect(screen.getByText("Population")).toBeInTheDocument();
    expect(screen.getByText("Density")).toBeInTheDocument();
  });

  it("renders statistics panel with custom values", () => {
    render(
      <DensityView stats={{ totalArea: 100, population: 500000, density: 5000 }}>
        <div>Content</div>
      </DensityView>
    );
    expect(screen.getByText("100 sq mi")).toBeInTheDocument();
    expect(screen.getByText("500,000")).toBeInTheDocument();
    expect(screen.getByText("5,000/sq mi")).toBeInTheDocument();
  });

  it("displays read-only notice", () => {
    render(
      <DensityView>
        <div>Content</div>
      </DensityView>
    );
    expect(screen.getByText("Read-only analysis view")).toBeInTheDocument();
  });

  it("does not render build tools", () => {
    render(
      <DensityView>
        <div>Content</div>
      </DensityView>
    );
    expect(screen.queryByLabelText("Pan")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Zone")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Build")).not.toBeInTheDocument();
  });
});
