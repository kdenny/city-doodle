import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TransitView } from "./TransitView";
import { TransitLine } from "./TransitLinesPanel";
import { ViewModeProvider } from "../shell/ViewModeContext";

const mockLines: TransitLine[] = [
  { id: "red", name: "Red Line", color: "#DC2626", stations: 10, miles: 5.5, lineType: "subway" },
  { id: "blue", name: "Blue Line", color: "#2563EB", stations: 8, miles: 4.2, lineType: "rail" },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(<ViewModeProvider>{ui}</ViewModeProvider>);
}

describe("TransitView", () => {
  it("renders children", () => {
    renderWithProviders(
      <TransitView>
        <div data-testid="content">Map Content</div>
      </TransitView>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders transit lines panel", () => {
    renderWithProviders(
      <TransitView lines={mockLines}>
        <div>Content</div>
      </TransitView>
    );
    expect(screen.getByText("Transit Lines")).toBeInTheDocument();
  });

  it("displays transit line names", () => {
    renderWithProviders(
      <TransitView lines={mockLines}>
        <div>Content</div>
      </TransitView>
    );
    expect(screen.getByText("Red Line")).toBeInTheDocument();
    expect(screen.getByText("Blue Line")).toBeInTheDocument();
  });

  it("displays station and mile counts", () => {
    renderWithProviders(
      <TransitView lines={mockLines}>
        <div>Content</div>
      </TransitView>
    );
    expect(screen.getByText("10 stations · 5.5 mi")).toBeInTheDocument();
    expect(screen.getByText("8 stations · 4.2 mi")).toBeInTheDocument();
  });

  it("displays summary statistics in header", () => {
    renderWithProviders(
      <TransitView lines={mockLines}>
        <div>Content</div>
      </TransitView>
    );
    expect(screen.getByText("2 lines")).toBeInTheDocument();
    expect(screen.getByText("18 stations")).toBeInTheDocument();
    expect(screen.getByText("9.7 mi")).toBeInTheDocument();
  });

  it("calls onLineClick when a line is clicked", () => {
    const onLineClick = vi.fn();
    renderWithProviders(
      <TransitView lines={mockLines} onLineClick={onLineClick}>
        <div>Content</div>
      </TransitView>
    );

    fireEvent.click(screen.getByText("Red Line"));
    expect(onLineClick).toHaveBeenCalledWith(mockLines[0]);
  });

  it("does not render build tools", () => {
    renderWithProviders(
      <TransitView>
        <div>Content</div>
      </TransitView>
    );
    // Build tools should not be present in Transit View
    expect(screen.queryByLabelText("Pan")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Zone")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Build")).not.toBeInTheDocument();
  });

  it("shows station placement buttons in empty state", () => {
    renderWithProviders(
      <TransitView>
        <div>Content</div>
      </TransitView>
    );
    expect(screen.getByText("Subway")).toBeInTheDocument();
    expect(screen.getByText("Rail")).toBeInTheDocument();
    expect(screen.getByText("Draw New Line")).toBeInTheDocument();
  });
});
