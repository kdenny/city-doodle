import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScaleBar } from "./ScaleBar";

describe("ScaleBar", () => {
  it("renders with default props", () => {
    render(<ScaleBar />);

    // Should show mile markers
    expect(screen.getByText("0mi")).toBeInTheDocument();
    expect(screen.getByText("5mi")).toBeInTheDocument();
    expect(screen.getByText("10mi")).toBeInTheDocument();
    expect(screen.getByText("15mi")).toBeInTheDocument();
  });

  it("respects maxMiles prop", () => {
    render(<ScaleBar maxMiles={10} />);

    expect(screen.getByText("0mi")).toBeInTheDocument();
    expect(screen.getByText("5mi")).toBeInTheDocument();
    expect(screen.getByText("10mi")).toBeInTheDocument();
    expect(screen.queryByText("15mi")).not.toBeInTheDocument();
  });

  it("displays block size when provided", () => {
    render(<ScaleBar blockSizeMeters={100} />);

    // Should show block size in both feet and meters
    expect(screen.getByText(/Block:/)).toBeInTheDocument();
    expect(screen.getByText(/100m/)).toBeInTheDocument();
    expect(screen.getByText(/328ft/)).toBeInTheDocument();
  });

  it("displays metric units when useMetric is true", () => {
    render(<ScaleBar useMetric />);

    // Should show km markers instead of mi
    expect(screen.getByText("0km")).toBeInTheDocument();
    expect(screen.getByText("5km")).toBeInTheDocument();
    // Should not show mile markers
    expect(screen.queryByText("5mi")).not.toBeInTheDocument();
  });

  it("displays block size in metric mode", () => {
    render(<ScaleBar blockSizeMeters={100} useMetric />);

    // Should show block size in meters only
    expect(screen.getByText("Block: 100m")).toBeInTheDocument();
  });

  it("adjusts scale based on zoom level", () => {
    // At zoom 2, effective max should be halved
    render(<ScaleBar maxMiles={10} zoom={2} />);

    // With zoom=2 and maxMiles=10, effective is 5
    // So we should see 0mi and 5mi but not 10mi
    expect(screen.getByText("0mi")).toBeInTheDocument();
    expect(screen.getByText("5mi")).toBeInTheDocument();
    expect(screen.queryByText("10mi")).not.toBeInTheDocument();
  });

  it("has correct styling container", () => {
    const { container } = render(<ScaleBar />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("bg-white/90");
    expect(wrapper).toHaveClass("backdrop-blur-sm");
    expect(wrapper).toHaveClass("rounded");
  });
});
