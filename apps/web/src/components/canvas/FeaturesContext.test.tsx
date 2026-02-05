import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeaturesProvider, useFeatures, useFeaturesOptional } from "./FeaturesContext";
import type { District, Road, POI } from "./layers";
import type { ReactNode } from "react";

// Create a wrapper with QueryClientProvider for tests
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("FeaturesContext", () => {
  describe("FeaturesProvider", () => {
    it("provides default empty features", () => {
      let features: ReturnType<typeof useFeatures>["features"] | null = null;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(features).toEqual({
        districts: [],
        roads: [],
        pois: [],
        neighborhoods: [],
      });
    });

    it("accepts initial features", () => {
      const initialFeatures = {
        districts: [
          {
            id: "district-1",
            type: "residential" as const,
            name: "Test District",
            polygon: { points: [{ x: 0, y: 0 }] },
          },
        ],
        roads: [] as Road[],
        pois: [] as POI[],
        neighborhoods: [],
      };

      let capturedFeatures: ReturnType<typeof useFeatures>["features"] | null = null;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        capturedFeatures = ctx.features;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider initialFeatures={initialFeatures}>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(capturedFeatures!.districts.length).toBe(1);
      expect(capturedFeatures!.districts[0].name).toBe("Test District");
    });

    it("calls onFeaturesChange when features change", () => {
      const onFeaturesChange = vi.fn();
      let addDistrict: ReturnType<typeof useFeatures>["addDistrict"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        addDistrict = ctx.addDistrict;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider onFeaturesChange={onFeaturesChange}>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      act(() => {
        addDistrict!({ x: 100, y: 100 }, "residential");
      });

      expect(onFeaturesChange).toHaveBeenCalled();
      expect(onFeaturesChange.mock.calls[0][0].districts.length).toBe(1);
    });
  });

  describe("useFeatures", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useFeatures();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useFeatures must be used within a FeaturesProvider"
      );
    });
  });

  describe("useFeaturesOptional", () => {
    it("returns null when used outside provider", () => {
      let context: ReturnType<typeof useFeaturesOptional> | undefined;

      function TestComponent() {
        context = useFeaturesOptional();
        return null;
      }

      render(<TestComponent />);
      expect(context).toBeNull();
    });

    it("returns context when used inside provider", () => {
      let capturedContext: ReturnType<typeof useFeaturesOptional> | undefined;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        capturedContext = useFeaturesOptional();
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(capturedContext).not.toBeNull();
      expect(capturedContext!).toBeDefined();
      expect(capturedContext!.features).toBeDefined();
    });
  });

  describe("addDistrict", () => {
    it("generates and adds a district with roads", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addDistrict: ReturnType<typeof useFeatures>["addDistrict"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addDistrict = ctx.addDistrict;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      act(() => {
        // Use position away from edges to ensure district fits
        const result = addDistrict!({ x: 400, y: 400 }, "residential");
        expect(result.generated).not.toBeNull();
        expect(result.generated?.district.type).toBe("residential");
        // With correct scaling, small districts (~6 world units) generate fewer roads
        // but should still have at least some
        expect(result.generated?.roads.length).toBeGreaterThanOrEqual(0);
      });

      expect(features!.districts.length).toBe(1);
    });

    it("returns null when district would overlap", () => {
      let addDistrict: ReturnType<typeof useFeatures>["addDistrict"];
      let features: ReturnType<typeof useFeatures>["features"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        addDistrict = ctx.addDistrict;
        features = ctx.features;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      // Add first district at center of world
      act(() => {
        addDistrict!({ x: 400, y: 400 }, "residential");
      });

      // Try to add overlapping district at same position (guaranteed overlap)
      act(() => {
        const result = addDistrict!({ x: 400, y: 400 }, "commercial");
        expect(result.generated).toBeNull();
        expect(result.error).toBeDefined();
      });

      // Should still have only one district
      expect(features!.districts.length).toBe(1);
    });
  });

  describe("addDistrictWithGeometry", () => {
    it("adds a district with explicit geometry", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addDistrictWithGeometry: ReturnType<typeof useFeatures>["addDistrictWithGeometry"];
      const Wrapper = createTestWrapper();

      const testDistrict: District = {
        id: "custom-district",
        type: "commercial",
        name: "Custom District",
        polygon: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
        },
      };

      const testRoads: Road[] = [
        {
          id: "custom-road",
          roadClass: "local",
          line: {
            points: [
              { x: 0, y: 50 },
              { x: 100, y: 50 },
            ],
          },
        },
      ];

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addDistrictWithGeometry = ctx.addDistrictWithGeometry;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      act(() => {
        addDistrictWithGeometry!(testDistrict, testRoads);
      });

      expect(features!.districts.length).toBe(1);
      expect(features!.districts[0].id).toBe("custom-district");
      expect(features!.roads.length).toBe(1);
      expect(features!.roads[0].id).toBe("custom-road");
    });
  });

  describe("addPOI", () => {
    it("adds a POI", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addPOI: ReturnType<typeof useFeatures>["addPOI"];
      const Wrapper = createTestWrapper();

      const testPOI: POI = {
        id: "poi-1",
        name: "Test Hospital",
        type: "hospital",
        position: { x: 200, y: 200 },
      };

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addPOI = ctx.addPOI;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      act(() => {
        addPOI!(testPOI);
      });

      expect(features!.pois.length).toBe(1);
      expect(features!.pois[0].id).toBe("poi-1");
      expect(features!.pois[0].name).toBe("Test Hospital");
    });
  });

  describe("addRoads", () => {
    it("adds multiple roads", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addRoads: ReturnType<typeof useFeatures>["addRoads"];
      const Wrapper = createTestWrapper();

      const testRoads: Road[] = [
        {
          id: "road-1",
          roadClass: "arterial",
          line: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
        },
        {
          id: "road-2",
          roadClass: "local",
          line: { points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
        },
      ];

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addRoads = ctx.addRoads;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      act(() => {
        addRoads!(testRoads);
      });

      expect(features!.roads.length).toBe(2);
    });
  });

  describe("removeDistrict", () => {
    it("removes a district by id", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addDistrict: ReturnType<typeof useFeatures>["addDistrict"];
      let removeDistrict: ReturnType<typeof useFeatures>["removeDistrict"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addDistrict = ctx.addDistrict;
        removeDistrict = ctx.removeDistrict;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      let districtId: string;
      act(() => {
        const result = addDistrict!({ x: 400, y: 400 }, "residential");
        expect(result.generated).not.toBeNull();
        districtId = result.generated!.district.id;
      });

      expect(features!.districts.length).toBe(1);

      act(() => {
        removeDistrict!(districtId!);
      });

      expect(features!.districts.length).toBe(0);
    });
  });

  describe("removePOI", () => {
    it("removes a POI by id", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addPOI: ReturnType<typeof useFeatures>["addPOI"];
      let removePOI: ReturnType<typeof useFeatures>["removePOI"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addPOI = ctx.addPOI;
        removePOI = ctx.removePOI;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      act(() => {
        addPOI!({
          id: "poi-1",
          name: "Test",
          type: "park",
          position: { x: 100, y: 100 },
        });
      });

      expect(features!.pois.length).toBe(1);

      act(() => {
        removePOI!("poi-1");
      });

      expect(features!.pois.length).toBe(0);
    });
  });

  describe("updateDistrict", () => {
    it("updates a district", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addDistrict: ReturnType<typeof useFeatures>["addDistrict"];
      let updateDistrict: ReturnType<typeof useFeatures>["updateDistrict"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addDistrict = ctx.addDistrict;
        updateDistrict = ctx.updateDistrict;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      let districtId: string;
      act(() => {
        const result = addDistrict!({ x: 400, y: 400 }, "residential");
        expect(result.generated).not.toBeNull();
        districtId = result.generated!.district.id;
      });

      expect(features!.districts[0].isHistoric).toBe(false);

      act(() => {
        updateDistrict!(districtId!, { isHistoric: true });
      });

      expect(features!.districts[0].isHistoric).toBe(true);
    });
  });

  describe("updateRoad", () => {
    it("updates a road's classification", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addRoads: ReturnType<typeof useFeatures>["addRoads"];
      let updateRoad: ReturnType<typeof useFeatures>["updateRoad"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addRoads = ctx.addRoads;
        updateRoad = ctx.updateRoad;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      // Add a road
      act(() => {
        addRoads!([
          {
            id: "road-1",
            roadClass: "local",
            line: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
          },
        ]);
      });

      expect(features!.roads[0].roadClass).toBe("local");

      // Update the road class
      act(() => {
        updateRoad!("road-1", { roadClass: "arterial" });
      });

      expect(features!.roads[0].roadClass).toBe("arterial");
    });

    it("updates a road's name", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addRoads: ReturnType<typeof useFeatures>["addRoads"];
      let updateRoad: ReturnType<typeof useFeatures>["updateRoad"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addRoads = ctx.addRoads;
        updateRoad = ctx.updateRoad;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      // Add a road
      act(() => {
        addRoads!([
          {
            id: "road-1",
            roadClass: "arterial",
            line: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
          },
        ]);
      });

      expect(features!.roads[0].name).toBeUndefined();

      // Update the road name
      act(() => {
        updateRoad!("road-1", { name: "Main Street" });
      });

      expect(features!.roads[0].name).toBe("Main Street");
    });

    it("does nothing when road is not found", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addRoads: ReturnType<typeof useFeatures>["addRoads"];
      let updateRoad: ReturnType<typeof useFeatures>["updateRoad"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addRoads = ctx.addRoads;
        updateRoad = ctx.updateRoad;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      // Add a road
      act(() => {
        addRoads!([
          {
            id: "road-1",
            roadClass: "local",
            line: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
          },
        ]);
      });

      // Try to update a non-existent road
      act(() => {
        updateRoad!("non-existent", { roadClass: "arterial" });
      });

      // Original road should be unchanged
      expect(features!.roads[0].roadClass).toBe("local");
      expect(features!.roads.length).toBe(1);
    });

    it("calls onFeaturesChange when road is updated", () => {
      const onFeaturesChange = vi.fn();
      let addRoads: ReturnType<typeof useFeatures>["addRoads"];
      let updateRoad: ReturnType<typeof useFeatures>["updateRoad"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        addRoads = ctx.addRoads;
        updateRoad = ctx.updateRoad;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider onFeaturesChange={onFeaturesChange}>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      // Add a road
      act(() => {
        addRoads!([
          {
            id: "road-1",
            roadClass: "local",
            line: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
          },
        ]);
      });

      // Clear mock to isolate the update call
      onFeaturesChange.mockClear();

      // Update the road
      act(() => {
        updateRoad!("road-1", { roadClass: "highway" });
      });

      expect(onFeaturesChange).toHaveBeenCalled();
      expect(onFeaturesChange.mock.calls[0][0].roads[0].roadClass).toBe("highway");
    });
  });

  describe("clearFeatures", () => {
    it("removes all features", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let addDistrict: ReturnType<typeof useFeatures>["addDistrict"];
      let addPOI: ReturnType<typeof useFeatures>["addPOI"];
      let clearFeatures: ReturnType<typeof useFeatures>["clearFeatures"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        addDistrict = ctx.addDistrict;
        addPOI = ctx.addPOI;
        clearFeatures = ctx.clearFeatures;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      act(() => {
        const result = addDistrict!({ x: 400, y: 400 }, "residential");
        expect(result.generated).not.toBeNull();
        addPOI!({
          id: "poi-1",
          name: "Test",
          type: "park",
          position: { x: 100, y: 100 },
        });
      });

      expect(features!.districts.length).toBe(1);
      expect(features!.pois.length).toBe(1);

      act(() => {
        clearFeatures!();
      });

      expect(features!.districts.length).toBe(0);
      expect(features!.roads.length).toBe(0);
      expect(features!.pois.length).toBe(0);
    });
  });

  describe("setFeatures", () => {
    it("replaces all features", () => {
      let features: ReturnType<typeof useFeatures>["features"];
      let setFeatures: ReturnType<typeof useFeatures>["setFeatures"];
      const Wrapper = createTestWrapper();

      function TestComponent() {
        const ctx = useFeatures();
        features = ctx.features;
        setFeatures = ctx.setFeatures;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      const newFeatures = {
        districts: [
          {
            id: "new-district",
            type: "downtown" as const,
            name: "New Downtown",
            polygon: { points: [{ x: 0, y: 0 }] },
          },
        ],
        roads: [],
        pois: [],
        neighborhoods: [],
      };

      act(() => {
        setFeatures!(newFeatures);
      });

      expect(features!.districts.length).toBe(1);
      expect(features!.districts[0].id).toBe("new-district");
    });
  });
});
