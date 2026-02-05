import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { EditorShell } from "./EditorShell";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe("EditorShell", () => {
  it("renders header with title", () => {
    renderWithProviders(
      <EditorShell>
        <div>Content</div>
      </EditorShell>
    );
    expect(screen.getByText("City Doodle")).toBeInTheDocument();
  });

  it("renders children", () => {
    renderWithProviders(
      <EditorShell>
        <div data-testid="content">Map Content</div>
      </EditorShell>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders view mode tabs", () => {
    renderWithProviders(
      <EditorShell>
        <div>Content</div>
      </EditorShell>
    );
    // Use role=button to target navigation tabs specifically (not palette headers)
    expect(screen.getByRole("button", { name: "Transit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Density" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timelapse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("renders zoom controls", () => {
    renderWithProviders(
      <EditorShell>
        <div>Content</div>
      </EditorShell>
    );
    expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders help button", () => {
    renderWithProviders(
      <EditorShell>
        <div>Content</div>
      </EditorShell>
    );
    expect(screen.getByLabelText("Help")).toBeInTheDocument();
  });

  it("switches view modes when tabs are clicked", () => {
    renderWithProviders(
      <EditorShell>
        <div>Content</div>
      </EditorShell>
    );

    // Initially shows "Build" in subtitle
    expect(screen.getByText("Build")).toBeInTheDocument();

    // Click Transit tab (use role=button to target nav tab)
    fireEvent.click(screen.getByRole("button", { name: "Transit" }));
    expect(screen.getByText("Transit View")).toBeInTheDocument();

    // Should show exit button
    expect(screen.getByText("Exit Transit View")).toBeInTheDocument();
  });

  it("calls onZoomChange when zooming", () => {
    const onZoomChange = vi.fn();
    renderWithProviders(
      <EditorShell onZoomChange={onZoomChange}>
        <div>Content</div>
      </EditorShell>
    );

    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(onZoomChange).toHaveBeenCalledWith(1.25);
  });
});
