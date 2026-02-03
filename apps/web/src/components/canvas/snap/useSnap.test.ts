import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSnap } from "./useSnap";
import type { SnapLineSegment, SnapGeometryProvider } from "./types";

describe("useSnap", () => {
  describe("initialization", () => {
    it("starts with null result", () => {
      const { result } = renderHook(() => useSnap());
      expect(result.current.result).toBeNull();
      expect(result.current.snapPoint).toBeNull();
      expect(result.current.isSnapping).toBe(false);
    });

    it("starts enabled by default", () => {
      const { result } = renderHook(() => useSnap());
      expect(result.current.enabled).toBe(true);
    });

    it("respects initial enabled state", () => {
      const { result } = renderHook(() => useSnap({ enabled: false }));
      expect(result.current.enabled).toBe(false);
    });

    it("accepts initial config", () => {
      const { result } = renderHook(() =>
        useSnap({ config: { threshold: 50 } })
      );
      expect(result.current.engine.getConfig().threshold).toBe(50);
    });
  });

  describe("querySnap", () => {
    it("returns empty result when no geometry", () => {
      const { result } = renderHook(() => useSnap());

      let queryResult;
      act(() => {
        queryResult = result.current.querySnap(100, 100);
      });

      expect(queryResult!.snapPoint).toBeNull();
      expect(result.current.result?.snapPoint).toBeNull();
    });

    it("returns snap point when geometry present", () => {
      const { result } = renderHook(() => useSnap());

      const segment: SnapLineSegment = {
        p1: { x: 0, y: 100 },
        p2: { x: 200, y: 100 },
        geometryId: "line1",
        geometryType: "test",
      };

      act(() => {
        result.current.insertSegments([segment]);
      });

      let queryResult;
      act(() => {
        queryResult = result.current.querySnap(100, 100);
      });

      expect(queryResult!.snapPoint).not.toBeNull();
      expect(result.current.snapPoint).not.toBeNull();
      expect(result.current.isSnapping).toBe(true);
    });

    it("returns empty when disabled", () => {
      const { result } = renderHook(() => useSnap({ enabled: false }));

      const segment: SnapLineSegment = {
        p1: { x: 0, y: 100 },
        p2: { x: 200, y: 100 },
        geometryId: "line1",
        geometryType: "test",
      };

      act(() => {
        result.current.insertSegments([segment]);
      });

      let queryResult;
      act(() => {
        queryResult = result.current.querySnap(100, 100);
      });

      expect(queryResult!.snapPoint).toBeNull();
    });
  });

  describe("setEnabled", () => {
    it("toggles enabled state", () => {
      const { result } = renderHook(() => useSnap());

      expect(result.current.enabled).toBe(true);

      act(() => {
        result.current.setEnabled(false);
      });

      expect(result.current.enabled).toBe(false);
    });
  });

  describe("setConfig", () => {
    it("updates snap configuration", () => {
      const { result } = renderHook(() => useSnap());

      act(() => {
        result.current.setConfig({ threshold: 100, snapToVertex: false });
      });

      expect(result.current.engine.getConfig().threshold).toBe(100);
      expect(result.current.engine.getConfig().snapToVertex).toBe(false);
    });
  });

  describe("clearSnap", () => {
    it("clears the snap result", () => {
      const { result } = renderHook(() => useSnap());

      const segment: SnapLineSegment = {
        p1: { x: 0, y: 100 },
        p2: { x: 200, y: 100 },
        geometryId: "line1",
        geometryType: "test",
      };

      act(() => {
        result.current.insertSegments([segment]);
        result.current.querySnap(100, 100);
      });

      expect(result.current.snapPoint).not.toBeNull();

      act(() => {
        result.current.clearSnap();
      });

      expect(result.current.snapPoint).toBeNull();
      expect(result.current.result).toBeNull();
    });
  });

  describe("providers", () => {
    it("registers and uses a provider", () => {
      const { result } = renderHook(() => useSnap());

      const provider: SnapGeometryProvider = {
        getLineSegments: () => [
          {
            p1: { x: 0, y: 0 },
            p2: { x: 100, y: 0 },
            geometryId: "provider-line",
            geometryType: "test",
          },
        ],
        getBoundingBox: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 0 }),
      };

      act(() => {
        result.current.registerProvider(provider);
      });

      let queryResult;
      act(() => {
        queryResult = result.current.querySnap(50, 5);
      });

      expect(queryResult!.snapPoint).not.toBeNull();
    });

    it("unregisters a provider", () => {
      const { result } = renderHook(() => useSnap());

      const provider: SnapGeometryProvider = {
        getLineSegments: () => [
          {
            p1: { x: 0, y: 0 },
            p2: { x: 100, y: 0 },
            geometryId: "provider-line",
            geometryType: "test",
          },
        ],
        getBoundingBox: () => null,
      };

      act(() => {
        result.current.registerProvider(provider);
        result.current.unregisterProvider(provider);
      });

      let queryResult;
      act(() => {
        queryResult = result.current.querySnap(50, 5);
      });

      expect(queryResult!.snapPoint).toBeNull();
    });
  });

  describe("index management", () => {
    it("clears the index", () => {
      const { result } = renderHook(() => useSnap());

      act(() => {
        result.current.insertSegments([
          {
            p1: { x: 0, y: 0 },
            p2: { x: 100, y: 0 },
            geometryId: "seg",
            geometryType: "test",
          },
        ]);
      });

      act(() => {
        result.current.clearIndex();
      });

      let queryResult;
      act(() => {
        queryResult = result.current.querySnap(50, 5);
      });

      expect(queryResult!.snapPoint).toBeNull();
      // result is cleared to null when clearIndex is called
      expect(result.current.snapPoint).toBeNull();
    });
  });
});
