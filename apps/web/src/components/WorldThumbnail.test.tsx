import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorldThumbnail } from "./WorldThumbnail";

// Mock the API hooks
vi.mock("../api", () => ({
  useWorldDistricts: vi.fn(),
  useRoadNetwork: vi.fn(),
}));

import { useWorldDistricts, useRoadNetwork } from "../api";

const mockUseWorldDistricts = vi.mocked(useWorldDistricts);
const mockUseRoadNetwork = vi.mocked(useRoadNetwork);

describe("WorldThumbnail", () => {
  it("shows loading spinner while data is loading", () => {
    mockUseWorldDistricts.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useWorldDistricts>);
    mockUseRoadNetwork.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useRoadNetwork>);

    render(<WorldThumbnail worldId="world-1" />);
    // Should not show thumbnail yet
    expect(screen.queryByTestId("world-thumbnail")).toBeNull();
    // Should show spinner (animate-spin class)
    const container = document.querySelector(".animate-spin");
    expect(container).toBeTruthy();
  });

  it("shows placeholder when no data", () => {
    mockUseWorldDistricts.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorldDistricts>);
    mockUseRoadNetwork.mockReturnValue({
      data: { nodes: [], edges: [], world_id: "world-1" },
      isLoading: false,
    } as unknown as ReturnType<typeof useRoadNetwork>);

    render(<WorldThumbnail worldId="world-1" />);
    // Should show map icon placeholder, not thumbnail
    expect(screen.queryByTestId("world-thumbnail")).toBeNull();
  });

  it("renders SVG thumbnail when districts exist", () => {
    mockUseWorldDistricts.mockReturnValue({
      data: [
        {
          id: "d1",
          world_id: "world-1",
          type: "residential",
          geometry: {
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
            ],
          },
          density: 0.5,
          max_height: 10,
          transit_access: false,
          historic: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorldDistricts>);
    mockUseRoadNetwork.mockReturnValue({
      data: { nodes: [], edges: [], world_id: "world-1" },
      isLoading: false,
    } as unknown as ReturnType<typeof useRoadNetwork>);

    render(<WorldThumbnail worldId="world-1" />);
    expect(screen.getByTestId("world-thumbnail")).toBeTruthy();
    // Should contain an SVG element
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
  });
});
