import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  InspectorPanel,
  useSelection,
  type SelectedDistrict,
  type SelectedRoad,
  type SelectedPOI,
} from "./InspectorPanel";
import { renderHook, act } from "@testing-library/react";

describe("InspectorPanel", () => {
  describe("when nothing is selected", () => {
    it("renders empty state message", () => {
      render(<InspectorPanel selection={null} />);

      expect(screen.getByText("Inspector")).toBeInTheDocument();
      expect(
        screen.getByText("Click on a feature to inspect it")
      ).toBeInTheDocument();
    });
  });

  describe("when a district is selected", () => {
    const mockDistrict: SelectedDistrict = {
      type: "district",
      id: "district-1",
      name: "Downtown",
      districtType: "downtown",
      isHistoric: false,
    };

    it("renders district inspector", () => {
      render(<InspectorPanel selection={mockDistrict} />);

      expect(screen.getByText("District")).toBeInTheDocument();
      expect(screen.getByText("Downtown")).toBeInTheDocument();
    });

    it("shows historic toggle", () => {
      render(<InspectorPanel selection={mockDistrict} />);

      expect(screen.getByText("Historic District")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("calls onUpdate when name changes", () => {
      const onUpdate = vi.fn();
      render(<InspectorPanel selection={mockDistrict} onUpdate={onUpdate} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Downtown" } });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Downtown" })
      );
    });

    it("calls onUpdate when historic is toggled", () => {
      const onUpdate = vi.fn();
      render(<InspectorPanel selection={mockDistrict} onUpdate={onUpdate} />);

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ isHistoric: true })
      );
    });

    it("shows delete button when onDelete provided", () => {
      const onDelete = vi.fn();
      render(<InspectorPanel selection={mockDistrict} onDelete={onDelete} />);

      expect(screen.getByText("Delete District")).toBeInTheDocument();
    });

    it("calls onDelete when delete button clicked", () => {
      const onDelete = vi.fn();
      render(<InspectorPanel selection={mockDistrict} onDelete={onDelete} />);

      fireEvent.click(screen.getByText("Delete District"));

      expect(onDelete).toHaveBeenCalledWith(mockDistrict);
    });
  });

  describe("when a road is selected", () => {
    const mockRoad: SelectedRoad = {
      type: "road",
      id: "road-1",
      name: "Main Street",
      roadClass: "arterial",
    };

    it("renders road inspector", () => {
      render(<InspectorPanel selection={mockRoad} />);

      expect(screen.getByText("Road")).toBeInTheDocument();
      expect(screen.getByText("Arterial")).toBeInTheDocument();
    });

    it("shows road name in input", () => {
      render(<InspectorPanel selection={mockRoad} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("Main Street");
    });

    it("calls onUpdate when name changes", () => {
      const onUpdate = vi.fn();
      render(<InspectorPanel selection={mockRoad} onUpdate={onUpdate} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Oak Avenue" } });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Oak Avenue" })
      );
    });
  });

  describe("when a POI is selected", () => {
    const mockPOI: SelectedPOI = {
      type: "poi",
      id: "poi-1",
      name: "City Hospital",
      poiType: "hospital",
    };

    it("renders POI inspector", () => {
      render(<InspectorPanel selection={mockPOI} />);

      expect(screen.getByText("POI")).toBeInTheDocument();
      expect(screen.getByText("Hospital")).toBeInTheDocument();
    });

    it("shows POI name in input", () => {
      render(<InspectorPanel selection={mockPOI} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("City Hospital");
    });

    it("calls onUpdate when name changes", () => {
      const onUpdate = vi.fn();
      render(<InspectorPanel selection={mockPOI} onUpdate={onUpdate} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "General Hospital" } });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "General Hospital" })
      );
    });
  });

  describe("close button", () => {
    it("shows close button when onClose provided", () => {
      const mockDistrict: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Test",
        districtType: "residential",
        isHistoric: false,
      };
      const onClose = vi.fn();
      render(<InspectorPanel selection={mockDistrict} onClose={onClose} />);

      expect(screen.getByLabelText("Close inspector")).toBeInTheDocument();
    });

    it("calls onClose when close button clicked", () => {
      const mockDistrict: SelectedDistrict = {
        type: "district",
        id: "district-1",
        name: "Test",
        districtType: "residential",
        isHistoric: false,
      };
      const onClose = vi.fn();
      render(<InspectorPanel selection={mockDistrict} onClose={onClose} />);

      fireEvent.click(screen.getByLabelText("Close inspector"));

      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe("useSelection hook", () => {
  it("starts with null selection", () => {
    const { result } = renderHook(() => useSelection());

    expect(result.current.selection).toBeNull();
  });

  it("selects a feature", () => {
    const { result } = renderHook(() => useSelection());
    const feature: SelectedDistrict = {
      type: "district",
      id: "d1",
      name: "Test",
      districtType: "residential",
      isHistoric: false,
    };

    act(() => {
      result.current.selectFeature(feature);
    });

    expect(result.current.selection).toEqual(feature);
  });

  it("clears selection", () => {
    const { result } = renderHook(() => useSelection());
    const feature: SelectedDistrict = {
      type: "district",
      id: "d1",
      name: "Test",
      districtType: "residential",
      isHistoric: false,
    };

    act(() => {
      result.current.selectFeature(feature);
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selection).toBeNull();
  });

  it("replaces previous selection", () => {
    const { result } = renderHook(() => useSelection());
    const feature1: SelectedDistrict = {
      type: "district",
      id: "d1",
      name: "First",
      districtType: "residential",
      isHistoric: false,
    };
    const feature2: SelectedPOI = {
      type: "poi",
      id: "p1",
      name: "Second",
      poiType: "park",
    };

    act(() => {
      result.current.selectFeature(feature1);
    });

    act(() => {
      result.current.selectFeature(feature2);
    });

    expect(result.current.selection).toEqual(feature2);
  });
});
