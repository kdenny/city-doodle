import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExportView } from "./ExportView";
import { defaultLegendItems } from "./ExportLegend";

describe("ExportView", () => {
  it("renders children in preview", () => {
    render(
      <ExportView>
        <div data-testid="content">Map Content</div>
      </ExportView>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("displays export preview label", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("displays export settings heading", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    expect(screen.getByText("Export Settings")).toBeInTheDocument();
  });

  it("renders format selector with PNG and GIF options", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    expect(screen.getByText("PNG")).toBeInTheDocument();
    expect(screen.getByText("GIF")).toBeInTheDocument();
    expect(screen.getByText("High-quality static image")).toBeInTheDocument();
    expect(screen.getByText("Animated timelapse")).toBeInTheDocument();
  });

  it("renders resolution selector with all options", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    expect(screen.getByLabelText("Standard resolution")).toBeInTheDocument();
    expect(screen.getByLabelText("High resolution")).toBeInTheDocument();
    expect(screen.getByLabelText("Ultra resolution")).toBeInTheDocument();
    expect(screen.getByText("1920×1080")).toBeInTheDocument();
    expect(screen.getByText("3840×2160")).toBeInTheDocument();
    expect(screen.getByText("7680×4320")).toBeInTheDocument();
  });

  it("renders download button", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    expect(screen.getByLabelText("Download export")).toBeInTheDocument();
    expect(screen.getByText("Download PNG")).toBeInTheDocument();
  });

  it("changes format selection", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    fireEvent.click(screen.getByText("GIF"));
    expect(screen.getByText("Download GIF")).toBeInTheDocument();
  });

  it("calls onExport with selected format and resolution", () => {
    const onExport = vi.fn();
    render(
      <ExportView onExport={onExport}>
        <div>Content</div>
      </ExportView>
    );

    // Change to GIF
    fireEvent.click(screen.getByText("GIF"));
    // Change to Ultra resolution
    fireEvent.click(screen.getByLabelText("Ultra resolution"));

    fireEvent.click(screen.getByLabelText("Download export"));
    expect(onExport).toHaveBeenCalledWith("gif", "4x");
  });

  it("renders legend with all categories", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    expect(screen.getByText("Legend")).toBeInTheDocument();
    expect(screen.getByText("Land Use")).toBeInTheDocument();
    expect(screen.getByText("Transit")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure")).toBeInTheDocument();
  });

  it("renders default legend items", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    defaultLegendItems.forEach(({ label }) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("renders custom legend items", () => {
    const customItems = [
      { id: "custom1", label: "Custom Zone", color: "#FF0000", category: "land-use" as const },
    ];
    render(
      <ExportView legendItems={customItems}>
        <div>Content</div>
      </ExportView>
    );
    expect(screen.getByText("Custom Zone")).toBeInTheDocument();
  });

  it("displays attribution text", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    expect(screen.getByText("Generated with City Doodle")).toBeInTheDocument();
  });

  it("does not render build tools", () => {
    render(
      <ExportView>
        <div>Content</div>
      </ExportView>
    );
    expect(screen.queryByLabelText("Pan")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Zone")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Build")).not.toBeInTheDocument();
  });
});
