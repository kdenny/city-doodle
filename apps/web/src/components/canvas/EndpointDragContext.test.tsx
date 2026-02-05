import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { EndpointDragProvider, useEndpointDrag } from "./EndpointDragContext";
import type { ReactNode } from "react";

function createWrapper(props?: { onDragComplete?: (result: unknown) => void; onDragCancel?: (roadId: string) => void }) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <EndpointDragProvider {...props}>{children}</EndpointDragProvider>;
  };
}

describe("EndpointDragContext", () => {
  describe("useEndpointDrag", () => {
    it("throws when used outside provider", () => {
      expect(() => {
        renderHook(() => useEndpointDrag());
      }).toThrow("useEndpointDrag must be used within an EndpointDragProvider");
    });

    it("returns initial state", () => {
      const { result } = renderHook(() => useEndpointDrag(), {
        wrapper: createWrapper(),
      });

      expect(result.current.dragState).toBeNull();
      expect(result.current.isDragging).toBe(false);
    });

    it("starts drag correctly", () => {
      const { result } = renderHook(() => useEndpointDrag(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.startDrag("road-1", 0, { x: 100, y: 100 });
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.dragState).toEqual({
        roadId: "road-1",
        endpointIndex: 0,
        originalPosition: { x: 100, y: 100 },
        currentPosition: { x: 100, y: 100 },
        isSnapped: false,
      });
    });

    it("updates drag position", () => {
      const { result } = renderHook(() => useEndpointDrag(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.startDrag("road-1", 1, { x: 0, y: 0 });
      });

      act(() => {
        result.current.updateDrag({ x: 50, y: 50 });
      });

      expect(result.current.dragState?.currentPosition).toEqual({ x: 50, y: 50 });
      expect(result.current.dragState?.isSnapped).toBe(false);
    });

    it("updates drag with snap state", () => {
      const { result } = renderHook(() => useEndpointDrag(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.startDrag("road-1", 0, { x: 0, y: 0 });
      });

      act(() => {
        result.current.updateDrag(
          { x: 75, y: 75 },
          {
            isSnapped: true,
            snapTargetId: "district-1",
            snapDescription: "Snapped to district perimeter",
          }
        );
      });

      expect(result.current.dragState?.currentPosition).toEqual({ x: 75, y: 75 });
      expect(result.current.dragState?.isSnapped).toBe(true);
      expect(result.current.dragState?.snapTargetId).toBe("district-1");
      expect(result.current.dragState?.snapDescription).toBe("Snapped to district perimeter");
    });

    it("completes drag and returns result", () => {
      const onDragComplete = vi.fn();
      const { result } = renderHook(() => useEndpointDrag(), {
        wrapper: createWrapper({ onDragComplete }),
      });

      act(() => {
        result.current.startDrag("road-1", 0, { x: 0, y: 0 });
      });

      act(() => {
        result.current.updateDrag({ x: 100, y: 100 }, { isSnapped: true, snapTargetId: "district-1" });
      });

      let dragResult;
      act(() => {
        dragResult = result.current.completeDrag();
      });

      expect(dragResult).toEqual({
        roadId: "road-1",
        endpointIndex: 0,
        newPosition: { x: 100, y: 100 },
        wasSnapped: true,
        snapTargetId: "district-1",
      });
      expect(result.current.isDragging).toBe(false);
      expect(result.current.dragState).toBeNull();
      expect(onDragComplete).toHaveBeenCalledWith(dragResult);
    });

    it("returns null when completing drag with no active drag", () => {
      const { result } = renderHook(() => useEndpointDrag(), {
        wrapper: createWrapper(),
      });

      let dragResult;
      act(() => {
        dragResult = result.current.completeDrag();
      });

      expect(dragResult).toBeNull();
    });

    it("cancels drag", () => {
      const onDragCancel = vi.fn();
      const { result } = renderHook(() => useEndpointDrag(), {
        wrapper: createWrapper({ onDragCancel }),
      });

      act(() => {
        result.current.startDrag("road-1", 0, { x: 0, y: 0 });
      });

      act(() => {
        result.current.updateDrag({ x: 50, y: 50 });
      });

      act(() => {
        result.current.cancelDrag();
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.dragState).toBeNull();
      expect(onDragCancel).toHaveBeenCalledWith("road-1");
    });

    it("does not call onDragCancel when canceling with no active drag", () => {
      const onDragCancel = vi.fn();
      const { result } = renderHook(() => useEndpointDrag(), {
        wrapper: createWrapper({ onDragCancel }),
      });

      act(() => {
        result.current.cancelDrag();
      });

      expect(onDragCancel).not.toHaveBeenCalled();
    });

    it("preserves original position throughout drag", () => {
      const { result } = renderHook(() => useEndpointDrag(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.startDrag("road-1", 0, { x: 10, y: 20 });
      });

      act(() => {
        result.current.updateDrag({ x: 100, y: 200 });
      });

      act(() => {
        result.current.updateDrag({ x: 150, y: 250 });
      });

      expect(result.current.dragState?.originalPosition).toEqual({ x: 10, y: 20 });
      expect(result.current.dragState?.currentPosition).toEqual({ x: 150, y: 250 });
    });
  });
});
