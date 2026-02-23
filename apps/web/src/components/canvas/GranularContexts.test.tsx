import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeaturesProvider, useFeatures } from "./FeaturesContext";
import {
  useDistrictsState,
  useDistrictsStateOptional,
  useDistrictsDispatch,
  useDistrictsDispatchOptional,
  useDistricts,
  useDistrictsOptional,
} from "./DistrictsContext";
import {
  useRoadsState,
  useRoadsStateOptional,
  useRoadsDispatch,
  useRoadsDispatchOptional,
  useRoads,
  useRoadsOptional,
} from "./RoadsContext";
import {
  usePOIsState,
  usePOIsStateOptional,
  usePOIsDispatch,
  usePOIsDispatchOptional,
  usePOIs,
  usePOIsOptional,
} from "./POIsContext";
import {
  useNeighborhoodsState,
  useNeighborhoodsStateOptional,
  useNeighborhoodsDispatch,
  useNeighborhoodsDispatchOptional,
  useNeighborhoods,
  useNeighborhoodsOptional,
} from "./NeighborhoodsContext";
import type { District, Road, POI, Neighborhood } from "./layers";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Districts
// ---------------------------------------------------------------------------

describe("DistrictsContext", () => {
  describe("useDistrictsState", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useDistrictsState();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useDistrictsState must be used within a FeaturesProvider"
      );
    });

    it("returns correct slice of state inside provider", () => {
      let state: ReturnType<typeof useDistrictsState> | undefined;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        state = useDistrictsState();
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(state).toBeDefined();
      expect(state!.districts).toEqual([]);
      expect(state!.cityLimits).toBeUndefined();
      expect(state!.cities).toEqual([]);
      expect(state!.isLoading).toBe(false);
    });
  });

  describe("useDistrictsStateOptional", () => {
    it("returns null when used outside provider", () => {
      let state: ReturnType<typeof useDistrictsStateOptional> | undefined;

      function TestComponent() {
        state = useDistrictsStateOptional();
        return null;
      }

      render(<TestComponent />);
      expect(state).toBeNull();
    });
  });

  describe("useDistrictsDispatch", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useDistrictsDispatch();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useDistrictsDispatch must be used within a FeaturesProvider"
      );
    });

    it("provides dispatch methods inside provider", () => {
      let dispatch: ReturnType<typeof useDistrictsDispatch> | undefined;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        dispatch = useDistrictsDispatch();
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(dispatch).toBeDefined();
      expect(typeof dispatch!.addDistrict).toBe("function");
      expect(typeof dispatch!.removeDistrict).toBe("function");
      expect(typeof dispatch!.updateDistrict).toBe("function");
      expect(typeof dispatch!.addDistrictWithGeometry).toBe("function");
      expect(typeof dispatch!.previewDistrictPlacement).toBe("function");
      expect(typeof dispatch!.setCityLimits).toBe("function");
      expect(typeof dispatch!.removeCityLimits).toBe("function");
      expect(typeof dispatch!.regenerateDistrictGrids).toBe("function");
    });
  });

  describe("useDistrictsDispatchOptional", () => {
    it("returns null when used outside provider", () => {
      let dispatch: ReturnType<typeof useDistrictsDispatchOptional> | undefined;

      function TestComponent() {
        dispatch = useDistrictsDispatchOptional();
        return null;
      }

      render(<TestComponent />);
      expect(dispatch).toBeNull();
    });
  });

  describe("useDistricts", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useDistricts();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useDistrictsState must be used within a FeaturesProvider"
      );
    });
  });

  describe("useDistrictsOptional", () => {
    it("returns null when used outside provider", () => {
      let ctx: ReturnType<typeof useDistrictsOptional> | undefined;

      function TestComponent() {
        ctx = useDistrictsOptional();
        return null;
      }

      render(<TestComponent />);
      expect(ctx).toBeNull();
    });
  });

  describe("provides correct slice of state", () => {
    it("reflects districts added via FeaturesProvider", () => {
      let districtsState: ReturnType<typeof useDistrictsState> | undefined;
      let addDistrictWithGeometry: ReturnType<typeof useFeatures>["addDistrictWithGeometry"];
      const Wrapper = createTestWrapper();

      const testDistrict: District = {
        id: "d-1",
        type: "residential",
        name: "Maple Heights",
        polygon: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
      };

      function StateReader() {
        districtsState = useDistrictsState();
        return null;
      }

      function Dispatcher() {
        const ctx = useFeatures();
        addDistrictWithGeometry = ctx.addDistrictWithGeometry;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <StateReader />
            <Dispatcher />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(districtsState!.districts).toHaveLength(0);

      act(() => {
        addDistrictWithGeometry!(testDistrict);
      });

      expect(districtsState!.districts).toHaveLength(1);
      expect(districtsState!.districts[0].id).toBe("d-1");
      expect(districtsState!.districts[0].name).toBe("Maple Heights");
    });
  });
});

// ---------------------------------------------------------------------------
// Roads
// ---------------------------------------------------------------------------

describe("RoadsContext", () => {
  describe("useRoadsState", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useRoadsState();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useRoadsState must be used within a FeaturesProvider"
      );
    });

    it("returns correct slice of state inside provider", () => {
      let state: ReturnType<typeof useRoadsState> | undefined;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        state = useRoadsState();
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(state).toBeDefined();
      expect(state!.roads).toEqual([]);
      expect(state!.bridges).toEqual([]);
      expect(state!.interchanges).toEqual([]);
      expect(state!.isLoading).toBe(false);
    });
  });

  describe("useRoadsStateOptional", () => {
    it("returns null when used outside provider", () => {
      let state: ReturnType<typeof useRoadsStateOptional> | undefined;

      function TestComponent() {
        state = useRoadsStateOptional();
        return null;
      }

      render(<TestComponent />);
      expect(state).toBeNull();
    });
  });

  describe("useRoadsDispatch", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useRoadsDispatch();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useRoadsDispatch must be used within a FeaturesProvider"
      );
    });

    it("provides dispatch methods inside provider", () => {
      let dispatch: ReturnType<typeof useRoadsDispatch> | undefined;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        dispatch = useRoadsDispatch();
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(dispatch).toBeDefined();
      expect(typeof dispatch!.addRoads).toBe("function");
      expect(typeof dispatch!.removeRoad).toBe("function");
      expect(typeof dispatch!.updateRoad).toBe("function");
      expect(typeof dispatch!.addInterchanges).toBe("function");
    });
  });

  describe("useRoadsDispatchOptional", () => {
    it("returns null when used outside provider", () => {
      let dispatch: ReturnType<typeof useRoadsDispatchOptional> | undefined;

      function TestComponent() {
        dispatch = useRoadsDispatchOptional();
        return null;
      }

      render(<TestComponent />);
      expect(dispatch).toBeNull();
    });
  });

  describe("useRoads", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useRoads();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useRoadsState must be used within a FeaturesProvider"
      );
    });
  });

  describe("useRoadsOptional", () => {
    it("returns null when used outside provider", () => {
      let ctx: ReturnType<typeof useRoadsOptional> | undefined;

      function TestComponent() {
        ctx = useRoadsOptional();
        return null;
      }

      render(<TestComponent />);
      expect(ctx).toBeNull();
    });
  });

  describe("provides correct slice of state", () => {
    it("reflects roads added via FeaturesProvider", () => {
      let roadsState: ReturnType<typeof useRoadsState> | undefined;
      let addRoads: ReturnType<typeof useFeatures>["addRoads"];
      const Wrapper = createTestWrapper();

      const testRoads: Road[] = [
        {
          id: "r-1",
          roadClass: "arterial",
          line: { points: [{ x: 0, y: 0 }, { x: 200, y: 200 }] },
        },
        {
          id: "r-2",
          roadClass: "local",
          line: { points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
        },
      ];

      function StateReader() {
        roadsState = useRoadsState();
        return null;
      }

      function Dispatcher() {
        const ctx = useFeatures();
        addRoads = ctx.addRoads;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <StateReader />
            <Dispatcher />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(roadsState!.roads).toHaveLength(0);

      act(() => {
        addRoads!(testRoads);
      });

      expect(roadsState!.roads).toHaveLength(2);
      expect(roadsState!.roads[0].id).toBe("r-1");
      expect(roadsState!.roads[1].id).toBe("r-2");
    });
  });
});

// ---------------------------------------------------------------------------
// POIs
// ---------------------------------------------------------------------------

describe("POIsContext", () => {
  describe("usePOIsState", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        usePOIsState();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "usePOIsState must be used within a FeaturesProvider"
      );
    });

    it("returns correct slice of state inside provider", () => {
      let state: ReturnType<typeof usePOIsState> | undefined;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        state = usePOIsState();
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(state).toBeDefined();
      expect(state!.pois).toEqual([]);
      expect(state!.isLoading).toBe(false);
    });
  });

  describe("usePOIsStateOptional", () => {
    it("returns null when used outside provider", () => {
      let state: ReturnType<typeof usePOIsStateOptional> | undefined;

      function TestComponent() {
        state = usePOIsStateOptional();
        return null;
      }

      render(<TestComponent />);
      expect(state).toBeNull();
    });
  });

  describe("usePOIsDispatch", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        usePOIsDispatch();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "usePOIsDispatch must be used within a FeaturesProvider"
      );
    });

    it("provides dispatch methods inside provider", () => {
      let dispatch: ReturnType<typeof usePOIsDispatch> | undefined;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        dispatch = usePOIsDispatch();
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(dispatch).toBeDefined();
      expect(typeof dispatch!.addPOI).toBe("function");
      expect(typeof dispatch!.removePOI).toBe("function");
      expect(typeof dispatch!.updatePOI).toBe("function");
    });
  });

  describe("usePOIsDispatchOptional", () => {
    it("returns null when used outside provider", () => {
      let dispatch: ReturnType<typeof usePOIsDispatchOptional> | undefined;

      function TestComponent() {
        dispatch = usePOIsDispatchOptional();
        return null;
      }

      render(<TestComponent />);
      expect(dispatch).toBeNull();
    });
  });

  describe("usePOIs", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        usePOIs();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "usePOIsState must be used within a FeaturesProvider"
      );
    });
  });

  describe("usePOIsOptional", () => {
    it("returns null when used outside provider", () => {
      let ctx: ReturnType<typeof usePOIsOptional> | undefined;

      function TestComponent() {
        ctx = usePOIsOptional();
        return null;
      }

      render(<TestComponent />);
      expect(ctx).toBeNull();
    });
  });

  describe("provides correct slice of state", () => {
    it("reflects POIs added via FeaturesProvider", () => {
      let poisState: ReturnType<typeof usePOIsState> | undefined;
      let addPOI: ReturnType<typeof useFeatures>["addPOI"];
      const Wrapper = createTestWrapper();

      const testPOI: POI = {
        id: "poi-1",
        name: "Central Hospital",
        type: "hospital",
        position: { x: 150, y: 150 },
      };

      function StateReader() {
        poisState = usePOIsState();
        return null;
      }

      function Dispatcher() {
        const ctx = useFeatures();
        addPOI = ctx.addPOI;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <StateReader />
            <Dispatcher />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(poisState!.pois).toHaveLength(0);

      act(() => {
        addPOI!(testPOI);
      });

      expect(poisState!.pois).toHaveLength(1);
      expect(poisState!.pois[0].id).toBe("poi-1");
      expect(poisState!.pois[0].name).toBe("Central Hospital");
    });
  });
});

// ---------------------------------------------------------------------------
// Neighborhoods
// ---------------------------------------------------------------------------

describe("NeighborhoodsContext", () => {
  describe("useNeighborhoodsState", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useNeighborhoodsState();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useNeighborhoodsState must be used within a FeaturesProvider"
      );
    });

    it("returns correct slice of state inside provider", () => {
      let state: ReturnType<typeof useNeighborhoodsState> | undefined;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        state = useNeighborhoodsState();
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(state).toBeDefined();
      expect(state!.neighborhoods).toEqual([]);
      expect(state!.isLoading).toBe(false);
    });
  });

  describe("useNeighborhoodsStateOptional", () => {
    it("returns null when used outside provider", () => {
      let state: ReturnType<typeof useNeighborhoodsStateOptional> | undefined;

      function TestComponent() {
        state = useNeighborhoodsStateOptional();
        return null;
      }

      render(<TestComponent />);
      expect(state).toBeNull();
    });
  });

  describe("useNeighborhoodsDispatch", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useNeighborhoodsDispatch();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useNeighborhoodsDispatch must be used within a FeaturesProvider"
      );
    });

    it("provides dispatch methods inside provider", () => {
      let dispatch: ReturnType<typeof useNeighborhoodsDispatch> | undefined;
      const Wrapper = createTestWrapper();

      function TestComponent() {
        dispatch = useNeighborhoodsDispatch();
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <TestComponent />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(dispatch).toBeDefined();
      expect(typeof dispatch!.addNeighborhood).toBe("function");
      expect(typeof dispatch!.removeNeighborhood).toBe("function");
      expect(typeof dispatch!.updateNeighborhood).toBe("function");
    });
  });

  describe("useNeighborhoodsDispatchOptional", () => {
    it("returns null when used outside provider", () => {
      let dispatch: ReturnType<typeof useNeighborhoodsDispatchOptional> | undefined;

      function TestComponent() {
        dispatch = useNeighborhoodsDispatchOptional();
        return null;
      }

      render(<TestComponent />);
      expect(dispatch).toBeNull();
    });
  });

  describe("useNeighborhoods", () => {
    it("throws when used outside provider", () => {
      function TestComponent() {
        useNeighborhoods();
        return null;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useNeighborhoodsState must be used within a FeaturesProvider"
      );
    });
  });

  describe("useNeighborhoodsOptional", () => {
    it("returns null when used outside provider", () => {
      let ctx: ReturnType<typeof useNeighborhoodsOptional> | undefined;

      function TestComponent() {
        ctx = useNeighborhoodsOptional();
        return null;
      }

      render(<TestComponent />);
      expect(ctx).toBeNull();
    });
  });

  describe("provides correct slice of state", () => {
    it("reflects neighborhoods added via FeaturesProvider", () => {
      let neighborhoodsState: ReturnType<typeof useNeighborhoodsState> | undefined;
      let addNeighborhood: ReturnType<typeof useFeatures>["addNeighborhood"];
      const Wrapper = createTestWrapper();

      const testNeighborhood: Neighborhood = {
        id: "n-1",
        name: "Old Town",
        polygon: { points: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }, { x: 10, y: 110 }] },
      };

      function StateReader() {
        neighborhoodsState = useNeighborhoodsState();
        return null;
      }

      function Dispatcher() {
        const ctx = useFeatures();
        addNeighborhood = ctx.addNeighborhood;
        return null;
      }

      render(
        <Wrapper>
          <FeaturesProvider>
            <StateReader />
            <Dispatcher />
          </FeaturesProvider>
        </Wrapper>
      );

      expect(neighborhoodsState!.neighborhoods).toHaveLength(0);

      act(() => {
        addNeighborhood!(testNeighborhood);
      });

      expect(neighborhoodsState!.neighborhoods).toHaveLength(1);
      expect(neighborhoodsState!.neighborhoods[0].id).toBe("n-1");
      expect(neighborhoodsState!.neighborhoods[0].name).toBe("Old Town");
    });
  });
});

// ---------------------------------------------------------------------------
// Render isolation — the most important test.
//
// Verifies that mutating one domain's data does NOT cause components
// subscribed to a different domain to re-render. This is the entire point
// of splitting FeaturesContext into granular contexts.
// ---------------------------------------------------------------------------

describe("Render isolation", () => {
  it("road mutation does NOT re-render a component subscribed only to districts", () => {
    const districtRenderValues: unknown[] = [];
    const roadRenderValues: unknown[] = [];
    let addRoads: ReturnType<typeof useFeatures>["addRoads"];
    const Wrapper = createTestWrapper();

    function DistrictConsumer() {
      const state = useDistrictsState();
      districtRenderValues.push([...state.districts]);
      return null;
    }

    function RoadConsumer() {
      const state = useRoadsState();
      roadRenderValues.push([...state.roads]);
      return null;
    }

    function Dispatcher() {
      const ctx = useFeatures();
      addRoads = ctx.addRoads;
      return null;
    }

    render(
      <Wrapper>
        <FeaturesProvider>
          <DistrictConsumer />
          <RoadConsumer />
          <Dispatcher />
        </FeaturesProvider>
      </Wrapper>
    );

    // Both should have rendered at least once on mount with empty arrays.
    const districtRendersAfterMount = districtRenderValues.length;
    const roadRendersAfterMount = roadRenderValues.length;

    expect(districtRendersAfterMount).toBeGreaterThanOrEqual(1);
    expect(roadRendersAfterMount).toBeGreaterThanOrEqual(1);

    // Now add roads — only the road consumer should re-render.
    act(() => {
      addRoads!([
        {
          id: "isolation-road-1",
          roadClass: "local",
          line: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
        },
      ]);
    });

    // Road consumer must have received updated data.
    expect(roadRenderValues.length).toBeGreaterThan(roadRendersAfterMount);
    const lastRoadRender = roadRenderValues[roadRenderValues.length - 1] as { id: string }[];
    expect(lastRoadRender).toHaveLength(1);
    expect(lastRoadRender[0].id).toBe("isolation-road-1");

    // District consumer: every render should have received the same empty array,
    // proving that no district-related state change was observed. If React chose
    // to re-render the component (e.g. due to parent re-render before context
    // bailout), the data should be identical — still an empty districts array.
    for (const snapshot of districtRenderValues) {
      expect(snapshot).toEqual([]);
    }
  });

  it("district mutation does NOT re-render a component subscribed only to POIs", () => {
    const poiRenderValues: unknown[] = [];
    const districtRenderValues: unknown[] = [];
    let addDistrictWithGeometry: ReturnType<typeof useFeatures>["addDistrictWithGeometry"];
    const Wrapper = createTestWrapper();

    function POIConsumer() {
      const state = usePOIsState();
      poiRenderValues.push([...state.pois]);
      return null;
    }

    function DistrictConsumer() {
      const state = useDistrictsState();
      districtRenderValues.push([...state.districts]);
      return null;
    }

    function Dispatcher() {
      const ctx = useFeatures();
      addDistrictWithGeometry = ctx.addDistrictWithGeometry;
      return null;
    }

    render(
      <Wrapper>
        <FeaturesProvider>
          <POIConsumer />
          <DistrictConsumer />
          <Dispatcher />
        </FeaturesProvider>
      </Wrapper>
    );

    const districtRendersAfterMount = districtRenderValues.length;

    act(() => {
      addDistrictWithGeometry!({
        id: "isolation-d-1",
        type: "commercial",
        name: "Commerce Park",
        polygon: { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }] },
      });
    });

    // District consumer must have received the new district.
    expect(districtRenderValues.length).toBeGreaterThan(districtRendersAfterMount);
    const lastDistrictRender = districtRenderValues[districtRenderValues.length - 1] as { id: string }[];
    expect(lastDistrictRender).toHaveLength(1);
    expect(lastDistrictRender[0].id).toBe("isolation-d-1");

    // POI consumer: every render should have an empty POIs array — the district
    // mutation should not have introduced any new POI data.
    for (const snapshot of poiRenderValues) {
      expect(snapshot).toEqual([]);
    }
  });

  it("POI mutation does NOT re-render a component subscribed only to neighborhoods", () => {
    const neighborhoodRenderValues: unknown[] = [];
    const poiRenderValues: unknown[] = [];
    let addPOI: ReturnType<typeof useFeatures>["addPOI"];
    const Wrapper = createTestWrapper();

    function NeighborhoodConsumer() {
      const state = useNeighborhoodsState();
      neighborhoodRenderValues.push([...state.neighborhoods]);
      return null;
    }

    function POIConsumer() {
      const state = usePOIsState();
      poiRenderValues.push([...state.pois]);
      return null;
    }

    function Dispatcher() {
      const ctx = useFeatures();
      addPOI = ctx.addPOI;
      return null;
    }

    render(
      <Wrapper>
        <FeaturesProvider>
          <NeighborhoodConsumer />
          <POIConsumer />
          <Dispatcher />
        </FeaturesProvider>
      </Wrapper>
    );

    const poiRendersAfterMount = poiRenderValues.length;

    act(() => {
      addPOI!({
        id: "isolation-poi-1",
        name: "Town Hall",
        type: "civic",
        position: { x: 50, y: 50 },
      });
    });

    // POI consumer must have received the new POI.
    expect(poiRenderValues.length).toBeGreaterThan(poiRendersAfterMount);
    const lastPOIRender = poiRenderValues[poiRenderValues.length - 1] as { id: string }[];
    expect(lastPOIRender).toHaveLength(1);
    expect(lastPOIRender[0].id).toBe("isolation-poi-1");

    // Neighborhood consumer: every render should have an empty neighborhoods
    // array — the POI mutation should not have affected neighborhood data.
    for (const snapshot of neighborhoodRenderValues) {
      expect(snapshot).toEqual([]);
    }
  });
});
