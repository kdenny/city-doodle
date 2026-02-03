import { render, screen, renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  MapCanvasProvider,
  useMapCanvasExport,
  useMapCanvasExportOptional,
} from "./MapCanvasContext";

describe("MapCanvasContext", () => {
  describe("useMapCanvasExport", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for expected error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useMapCanvasExport());
      }).toThrow("useMapCanvasExport must be used within a MapCanvasProvider");

      consoleSpy.mockRestore();
    });

    it("returns context value when used inside provider", () => {
      const { result } = renderHook(() => useMapCanvasExport(), {
        wrapper: MapCanvasProvider,
      });

      expect(result.current.isReady).toBe(false);
      expect(typeof result.current.registerCanvas).toBe("function");
      expect(typeof result.current.exportAsPng).toBe("function");
      expect(typeof result.current.captureAsPng).toBe("function");
    });
  });

  describe("useMapCanvasExportOptional", () => {
    it("returns null when used outside provider", () => {
      const { result } = renderHook(() => useMapCanvasExportOptional());

      expect(result.current).toBeNull();
    });

    it("returns context value when used inside provider", () => {
      const { result } = renderHook(() => useMapCanvasExportOptional(), {
        wrapper: MapCanvasProvider,
      });

      expect(result.current).not.toBeNull();
      expect(result.current?.isReady).toBe(false);
    });
  });

  describe("MapCanvasProvider", () => {
    it("renders children", () => {
      render(
        <MapCanvasProvider>
          <div data-testid="child">Test Child</div>
        </MapCanvasProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("updates isReady when canvas is registered", () => {
      const { result } = renderHook(() => useMapCanvasExport(), {
        wrapper: MapCanvasProvider,
      });

      expect(result.current.isReady).toBe(false);

      const mockHandle = {
        exportAsPng: vi.fn(),
        captureAsPng: vi.fn(),
        isReady: true,
      };

      act(() => {
        result.current.registerCanvas(mockHandle);
      });

      expect(result.current.isReady).toBe(true);
    });

    it("updates isReady to false when canvas is unregistered", () => {
      const { result } = renderHook(() => useMapCanvasExport(), {
        wrapper: MapCanvasProvider,
      });

      const mockHandle = {
        exportAsPng: vi.fn(),
        captureAsPng: vi.fn(),
        isReady: true,
      };

      act(() => {
        result.current.registerCanvas(mockHandle);
      });

      expect(result.current.isReady).toBe(true);

      act(() => {
        result.current.registerCanvas(null);
      });

      expect(result.current.isReady).toBe(false);
    });

    it("exportAsPng throws when canvas not ready", async () => {
      const { result } = renderHook(() => useMapCanvasExport(), {
        wrapper: MapCanvasProvider,
      });

      await expect(
        result.current.exportAsPng({ resolution: "1x" })
      ).rejects.toThrow("Canvas not ready for export");
    });

    it("captureAsPng throws when canvas not ready", async () => {
      const { result } = renderHook(() => useMapCanvasExport(), {
        wrapper: MapCanvasProvider,
      });

      await expect(
        result.current.captureAsPng({ resolution: "1x" })
      ).rejects.toThrow("Canvas not ready for export");
    });

    it("exportAsPng calls registered handle", async () => {
      const { result } = renderHook(() => useMapCanvasExport(), {
        wrapper: MapCanvasProvider,
      });

      const mockExport = vi.fn().mockResolvedValue(undefined);
      const mockHandle = {
        exportAsPng: mockExport,
        captureAsPng: vi.fn(),
        isReady: true,
      };

      act(() => {
        result.current.registerCanvas(mockHandle);
      });

      await result.current.exportAsPng({ resolution: "2x" });

      expect(mockExport).toHaveBeenCalledWith({ resolution: "2x" });
    });

    it("captureAsPng calls registered handle", async () => {
      const { result } = renderHook(() => useMapCanvasExport(), {
        wrapper: MapCanvasProvider,
      });

      const mockCapture = vi.fn().mockResolvedValue({
        blob: new Blob(),
        dataUrl: "data:image/png;base64,test",
        width: 1920,
        height: 1080,
      });
      const mockHandle = {
        exportAsPng: vi.fn(),
        captureAsPng: mockCapture,
        isReady: true,
      };

      act(() => {
        result.current.registerCanvas(mockHandle);
      });

      const res = await result.current.captureAsPng({ resolution: "4x" });

      expect(mockCapture).toHaveBeenCalledWith({ resolution: "4x" });
      expect(res.width).toBe(1920);
      expect(res.height).toBe(1080);
    });
  });
});
