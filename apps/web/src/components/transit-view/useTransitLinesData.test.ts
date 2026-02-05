import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useTransitLinesData, hasTransitData } from "./useTransitLinesData";
import type { TransitNetwork } from "../../api/types";

// World scale: 768 world units = 50 miles
// So 1 world unit = 50/768 miles ≈ 0.0651 miles

const mockTransitNetwork: TransitNetwork = {
  stations: [
    { id: "s1", city_id: "city1", name: "Station A", position_x: 0, position_y: 0, station_type: "subway" },
    { id: "s2", city_id: "city1", name: "Station B", position_x: 100, position_y: 0, station_type: "subway" },
    { id: "s3", city_id: "city1", name: "Station C", position_x: 200, position_y: 0, station_type: "subway" },
    { id: "s4", city_id: "city1", name: "Rail Station 1", position_x: 0, position_y: 100, station_type: "rail" },
    { id: "s5", city_id: "city1", name: "Rail Station 2", position_x: 300, position_y: 100, station_type: "rail" },
  ],
  lines: [
    {
      id: "line1",
      city_id: "city1",
      name: "Red Line",
      color: "#DC2626",
      line_type: "subway",
      segments: [
        { id: "seg1", line_id: "line1", from_station_id: "s1", to_station_id: "s2", sequence_order: 0, geometry: [] },
        { id: "seg2", line_id: "line1", from_station_id: "s2", to_station_id: "s3", sequence_order: 1, geometry: [] },
      ],
    },
    {
      id: "line2",
      city_id: "city1",
      name: "Express Rail",
      color: "#16A34A",
      line_type: "rail",
      segments: [
        { id: "seg3", line_id: "line2", from_station_id: "s4", to_station_id: "s5", sequence_order: 0, geometry: [] },
      ],
    },
  ],
};

describe("useTransitLinesData", () => {
  it("returns empty array when network is null", () => {
    const { result } = renderHook(() => useTransitLinesData(null));
    expect(result.current).toEqual([]);
  });

  it("returns empty array when network is undefined", () => {
    const { result } = renderHook(() => useTransitLinesData(undefined));
    expect(result.current).toEqual([]);
  });

  it("transforms transit lines correctly", () => {
    const { result } = renderHook(() => useTransitLinesData(mockTransitNetwork));

    expect(result.current).toHaveLength(2);

    const redLine = result.current.find((l) => l.id === "line1");
    expect(redLine).toBeDefined();
    expect(redLine?.name).toBe("Red Line");
    expect(redLine?.color).toBe("#DC2626");
    expect(redLine?.lineType).toBe("subway");
    expect(redLine?.stations).toBe(3); // s1, s2, s3

    const railLine = result.current.find((l) => l.id === "line2");
    expect(railLine).toBeDefined();
    expect(railLine?.name).toBe("Express Rail");
    expect(railLine?.lineType).toBe("rail");
    expect(railLine?.stations).toBe(2); // s4, s5
  });

  it("calculates miles from segment lengths", () => {
    const { result } = renderHook(() => useTransitLinesData(mockTransitNetwork));

    // Red Line: 100 + 100 = 200 world units
    // 200 / 768 * 50 = ~13.02 miles
    const redLine = result.current.find((l) => l.id === "line1");
    expect(redLine?.miles).toBeCloseTo(13.02, 1);

    // Rail Line: 300 world units
    // 300 / 768 * 50 = ~19.53 miles
    const railLine = result.current.find((l) => l.id === "line2");
    expect(railLine?.miles).toBeCloseTo(19.53, 1);
  });

  it("calculates path length through geometry points", () => {
    const networkWithGeometry: TransitNetwork = {
      stations: [
        { id: "s1", city_id: "city1", name: "A", position_x: 0, position_y: 0, station_type: "subway" },
        { id: "s2", city_id: "city1", name: "B", position_x: 100, position_y: 0, station_type: "subway" },
      ],
      lines: [
        {
          id: "curved",
          city_id: "city1",
          name: "Curved Line",
          color: "#000",
          line_type: "subway",
          segments: [
            {
              id: "seg",
              line_id: "curved",
              from_station_id: "s1",
              to_station_id: "s2",
              sequence_order: 0,
              // Path goes through (50, 50) making it longer than straight line
              geometry: [{ x: 50, y: 50 }],
            },
          ],
        },
      ],
    };

    const { result } = renderHook(() => useTransitLinesData(networkWithGeometry));
    const line = result.current[0];

    // Straight line would be 100 world units = 6.51 miles
    // Curved path through (50,50) is:
    // (0,0) -> (50,50) = sqrt(2500+2500) = ~70.71 units
    // (50,50) -> (100,0) = sqrt(2500+2500) = ~70.71 units
    // Total = ~141.42 world units = (141.42/768)*50 = ~9.21 miles
    expect(line.miles).toBeCloseTo(9.21, 1);
  });

  it("uses default color when line has no color", () => {
    const networkNoColor: TransitNetwork = {
      stations: [
        { id: "s1", city_id: "city1", name: "A", position_x: 0, position_y: 0, station_type: "subway" },
        { id: "s2", city_id: "city1", name: "B", position_x: 100, position_y: 0, station_type: "subway" },
      ],
      lines: [
        {
          id: "nocolor",
          city_id: "city1",
          name: "No Color Line",
          color: "", // Empty color
          line_type: "subway",
          segments: [],
        },
      ],
    };

    const { result } = renderHook(() => useTransitLinesData(networkNoColor));
    expect(result.current[0].color).toBe("#666666");
  });
});

describe("hasTransitData", () => {
  it("returns false for null", () => {
    expect(hasTransitData(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasTransitData(undefined)).toBe(false);
  });

  it("returns false for empty network", () => {
    expect(hasTransitData({ stations: [], lines: [] })).toBe(false);
  });

  it("returns true when network has stations", () => {
    expect(hasTransitData({
      stations: [{ id: "s1", city_id: "city1", name: "A", position_x: 0, position_y: 0, station_type: "subway" }],
      lines: [],
    })).toBe(true);
  });

  it("returns true when network has lines", () => {
    expect(hasTransitData({
      stations: [],
      lines: [{ id: "l1", city_id: "city1", name: "Line", color: "#000", line_type: "subway", segments: [] }],
    })).toBe(true);
  });
});
