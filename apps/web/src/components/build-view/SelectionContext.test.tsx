import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  SelectionProvider,
  useSelectionContext,
  useSelectionContextOptional,
  type SelectedDistrict,
  type SelectedRoad,
  type SelectedPOI,
} from "./SelectionContext";
import { ReactNode } from "react";

describe("SelectionContext", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SelectionProvider>{children}</SelectionProvider>
  );

  describe("useSelectionContext", () => {
    it("throws when used outside of SelectionProvider", () => {
      // Suppress console.error for expected error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useSelectionContext());
      }).toThrow("useSelectionContext must be used within a SelectionProvider");

      consoleSpy.mockRestore();
    });

    it("provides initial null selection", () => {
      const { result } = renderHook(() => useSelectionContext(), { wrapper });
      expect(result.current.selection).toBeNull();
    });
  });

  describe("useSelectionContextOptional", () => {
    it("returns null when used outside of SelectionProvider", () => {
      const { result } = renderHook(() => useSelectionContextOptional());
      expect(result.current).toBeNull();
    });

    it("returns context value when inside SelectionProvider", () => {
      const { result } = renderHook(() => useSelectionContextOptional(), {
        wrapper,
      });
      expect(result.current).not.toBeNull();
      expect(result.current?.selection).toBeNull();
    });
  });

  describe("selectFeature", () => {
    it("selects a district", () => {
      const { result } = renderHook(() => useSelectionContext(), { wrapper });

      const district: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Downtown",
        districtType: "downtown",
        isHistoric: false,
      };

      act(() => {
        result.current.selectFeature(district);
      });

      expect(result.current.selection).toEqual(district);
    });

    it("selects a road", () => {
      const { result } = renderHook(() => useSelectionContext(), { wrapper });

      const road: SelectedRoad = {
        type: "road",
        id: "road-1",
        name: "Main Street",
        roadClass: "arterial",
      };

      act(() => {
        result.current.selectFeature(road);
      });

      expect(result.current.selection).toEqual(road);
    });

    it("selects a POI", () => {
      const { result } = renderHook(() => useSelectionContext(), { wrapper });

      const poi: SelectedPOI = {
        type: "poi",
        id: "poi-1",
        name: "City Hall",
        poiType: "civic",
      };

      act(() => {
        result.current.selectFeature(poi);
      });

      expect(result.current.selection).toEqual(poi);
    });

    it("replaces previous selection", () => {
      const { result } = renderHook(() => useSelectionContext(), { wrapper });

      const district: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Downtown",
        districtType: "downtown",
        isHistoric: false,
      };

      const poi: SelectedPOI = {
        type: "poi",
        id: "poi-1",
        name: "City Hall",
        poiType: "civic",
      };

      act(() => {
        result.current.selectFeature(district);
      });

      act(() => {
        result.current.selectFeature(poi);
      });

      expect(result.current.selection).toEqual(poi);
    });

    it("calls onSelect callback when selecting", () => {
      const onSelect = vi.fn();
      const customWrapper = ({ children }: { children: ReactNode }) => (
        <SelectionProvider onSelect={onSelect}>{children}</SelectionProvider>
      );

      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: customWrapper,
      });

      const district: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Downtown",
        districtType: "downtown",
        isHistoric: false,
      };

      act(() => {
        result.current.selectFeature(district);
      });

      expect(onSelect).toHaveBeenCalledWith(district);
    });
  });

  describe("clearSelection", () => {
    it("clears the selection", () => {
      const { result } = renderHook(() => useSelectionContext(), { wrapper });

      const district: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Downtown",
        districtType: "downtown",
        isHistoric: false,
      };

      act(() => {
        result.current.selectFeature(district);
      });

      expect(result.current.selection).not.toBeNull();

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selection).toBeNull();
    });

    it("calls onSelect callback with null when clearing", () => {
      const onSelect = vi.fn();
      const customWrapper = ({ children }: { children: ReactNode }) => (
        <SelectionProvider onSelect={onSelect}>{children}</SelectionProvider>
      );

      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: customWrapper,
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("updateSelection", () => {
    it("updates the selection with new properties", () => {
      const { result } = renderHook(() => useSelectionContext(), { wrapper });

      const district: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Downtown",
        districtType: "downtown",
        isHistoric: false,
      };

      act(() => {
        result.current.selectFeature(district);
      });

      const updatedDistrict: SelectedDistrict = {
        ...district,
        name: "Historic Downtown",
        isHistoric: true,
      };

      act(() => {
        result.current.updateSelection(updatedDistrict);
      });

      expect(result.current.selection).toEqual(updatedDistrict);
    });

    it("calls onUpdate callback when updating", () => {
      const onUpdate = vi.fn();
      const customWrapper = ({ children }: { children: ReactNode }) => (
        <SelectionProvider onUpdate={onUpdate}>{children}</SelectionProvider>
      );

      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: customWrapper,
      });

      const district: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Downtown",
        districtType: "downtown",
        isHistoric: false,
      };

      act(() => {
        result.current.updateSelection(district);
      });

      expect(onUpdate).toHaveBeenCalledWith(district);
    });
  });

  describe("deleteSelection", () => {
    it("clears the selection when deleting", () => {
      const { result } = renderHook(() => useSelectionContext(), { wrapper });

      const district: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Downtown",
        districtType: "downtown",
        isHistoric: false,
      };

      act(() => {
        result.current.selectFeature(district);
      });

      expect(result.current.selection).not.toBeNull();

      act(() => {
        result.current.deleteSelection();
      });

      expect(result.current.selection).toBeNull();
    });

    it("calls onDelete callback with the deleted feature", () => {
      const onDelete = vi.fn();
      const customWrapper = ({ children }: { children: ReactNode }) => (
        <SelectionProvider onDelete={onDelete}>{children}</SelectionProvider>
      );

      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: customWrapper,
      });

      const district: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Downtown",
        districtType: "downtown",
        isHistoric: false,
      };

      act(() => {
        result.current.selectFeature(district);
      });

      act(() => {
        result.current.deleteSelection();
      });

      expect(onDelete).toHaveBeenCalledWith(district);
    });

    it("does not call onDelete when nothing is selected", () => {
      const onDelete = vi.fn();
      const customWrapper = ({ children }: { children: ReactNode }) => (
        <SelectionProvider onDelete={onDelete}>{children}</SelectionProvider>
      );

      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: customWrapper,
      });

      act(() => {
        result.current.deleteSelection();
      });

      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
