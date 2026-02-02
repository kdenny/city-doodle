import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TransitView } from "./TransitView";
import { TransitLine } from "./TransitLinesPanel";

const mockLines: TransitLine[] = [
  { id: "red", name: "Red Line", color: "#DC2626", stations: 10, miles: 5.5 },
  { id: "blue", name: "Blue Line", color: "#2563EB", stations: 8, miles: 4.2 },
];

describe("TransitView", () => {
  it("renders children", () => {
    render(
      <TransitView>
        <div data-testid="content">Map Content</div>
      </TransitView>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders transit lines panel", () => {
    render(
      <TransitView lines={mockLines}>
        <div>Content</div>
      </TransitView>
    );
    expect(screen.getByText("Transit Lines")).toBeInTheDocument();
  });

  it("displays transit line names", () => {
    render(
      <TransitView lines={mockLines}>
        <div>Content</div>
      </TransitView>
    );
    expect(screen.getByText("Red Line")).toBeInTheDocument();
    expect(screen.getByText("Blue Line")).toBeInTheDocument();
  });

  it("displays station and mile counts", () => {
    render(
      <TransitView lines={mockLines}>
        <div>Content</div>
      </TransitView>
    );
    expect(screen.getByText("10 stations · 5.5 mi")).toBeInTheDocument();
    expect(screen.getByText("8 stations · 4.2 mi")).toBeInTheDocument();
  });

  it("displays total statistics", () => {
    render(
      <TransitView lines={mockLines}>
        <div>Content</div>
      </TransitView>
    );
    expect(screen.getByText("Total Stations")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument(); // 10 + 8
    expect(screen.getByText("Miles of Track")).toBeInTheDocument();
    expect(screen.getByText("9.7")).toBeInTheDocument(); // 5.5 + 4.2
  });

  it("calls onLineClick when a line is clicked", () => {
    const onLineClick = vi.fn();
    render(
      <TransitView lines={mockLines} onLineClick={onLineClick}>
        <div>Content</div>
      </TransitView>
    );

    fireEvent.click(screen.getByText("Red Line"));
    expect(onLineClick).toHaveBeenCalledWith(mockLines[0]);
  });

  it("does not render build tools", () => {
    render(
      <TransitView>
        <div>Content</div>
      </TransitView>
    );
    // Build tools should not be present in Transit View
    expect(screen.queryByLabelText("Pan")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Zone")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Build")).not.toBeInTheDocument();
  });
});
