import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorldCard } from "./WorldCard";
import type { World } from "../api/types";

// Mock WorldThumbnail to avoid API calls in unit tests
vi.mock("./WorldThumbnail", () => ({
  WorldThumbnail: ({ className }: { className?: string }) => (
    <div data-testid="world-thumbnail-mock" className={className} />
  ),
}));

const mockWorld: World = {
  id: "world-1",
  user_id: "user-1",
  name: "Test City",
  seed: 12345,
  settings: {
    geographic_setting: "coastal",
    grid_organic: 0.5,
    sprawl_compact: 0.5,
    historic_modern: 0.5,
    transit_car: 0.5,
    block_size_meters: 150,
    district_size_meters: 3200,
    beach_enabled: true,
    beach_width_multiplier: 1.0,
  },
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
};

describe("WorldCard", () => {
  let defaultProps: {
    world: World;
    stats: { districts: number; roads: number; pois: number };
    onClick: ReturnType<typeof vi.fn>;
    onRename: ReturnType<typeof vi.fn>;
    onDuplicate: ReturnType<typeof vi.fn>;
    onDelete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    defaultProps = {
      world: mockWorld,
      stats: { districts: 5, roads: 32, pois: 18 },
      onClick: vi.fn(),
      onRename: vi.fn(),
      onDuplicate: vi.fn(),
      onDelete: vi.fn(),
    };
  });

  it("renders world name and stats", () => {
    render(<WorldCard {...defaultProps} />);
    expect(screen.getByText("Test City")).toBeTruthy();
    expect(screen.getByText("5 districts · 32 roads · 18 POIs")).toBeTruthy();
  });

  it("shows relative last-edited time", () => {
    render(<WorldCard {...defaultProps} />);
    expect(screen.getByText(/Last edited 2h ago/)).toBeTruthy();
  });

  it("calls onClick when card is clicked", () => {
    render(<WorldCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("world-card"));
    expect(defaultProps.onClick).toHaveBeenCalledOnce();
  });

  it("opens overflow menu on three-dot click without navigating", () => {
    const onClick = vi.fn();
    render(<WorldCard {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByTestId("overflow-menu-button"));
    expect(screen.getByTestId("overflow-menu")).toBeTruthy();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows rename, duplicate, delete in overflow menu", () => {
    render(<WorldCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("overflow-menu-button"));
    expect(screen.getByTestId("menu-rename")).toBeTruthy();
    expect(screen.getByTestId("menu-duplicate")).toBeTruthy();
    expect(screen.getByTestId("menu-delete")).toBeTruthy();
  });

  it("calls onDuplicate when duplicate is clicked", () => {
    render(<WorldCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("overflow-menu-button"));
    fireEvent.click(screen.getByTestId("menu-duplicate"));
    expect(defaultProps.onDuplicate).toHaveBeenCalledOnce();
  });

  it("calls onDelete when delete is clicked", () => {
    render(<WorldCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("overflow-menu-button"));
    fireEvent.click(screen.getByTestId("menu-delete"));
    expect(defaultProps.onDelete).toHaveBeenCalledOnce();
  });

  it("enters rename mode and submits on Enter", () => {
    render(<WorldCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("overflow-menu-button"));
    fireEvent.click(screen.getByTestId("menu-rename"));

    const input = screen.getByTestId("rename-input") as HTMLInputElement;
    expect(input.value).toBe("Test City");

    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(defaultProps.onRename).toHaveBeenCalledWith("New Name");
  });

  it("cancels rename on Escape", () => {
    render(<WorldCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("overflow-menu-button"));
    fireEvent.click(screen.getByTestId("menu-rename"));

    const input = screen.getByTestId("rename-input");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(defaultProps.onRename).not.toHaveBeenCalled();
    expect(screen.getByText("Test City")).toBeTruthy();
  });

  it("renders without stats", () => {
    render(<WorldCard {...defaultProps} stats={undefined} />);
    expect(screen.getByText("Test City")).toBeTruthy();
  });
});
