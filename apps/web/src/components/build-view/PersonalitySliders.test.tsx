import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  PersonalitySliders,
  CollapsiblePersonalitySliders,
} from "./PersonalitySliders";
import type { DistrictPersonality } from "../canvas/layers/types";
import { DEFAULT_DISTRICT_PERSONALITY } from "../canvas/layers/types";

describe("PersonalitySliders", () => {
  const defaultValues: DistrictPersonality = {
    grid_organic: 0.5,
    sprawl_compact: 0.5,
    historic_modern: 0.5,
    transit_car: 0.5,
  };

  describe("rendering", () => {
    it("renders all four sliders", () => {
      const onChange = vi.fn();
      render(<PersonalitySliders values={defaultValues} onChange={onChange} />);

      expect(screen.getByTestId("personality-sliders")).toBeInTheDocument();
      expect(screen.getByTestId("slider-grid_organic")).toBeInTheDocument();
      expect(screen.getByTestId("slider-sprawl_compact")).toBeInTheDocument();
      expect(screen.getByTestId("slider-historic_modern")).toBeInTheDocument();
      expect(screen.getByTestId("slider-transit_car")).toBeInTheDocument();
    });

    it("renders slider labels", () => {
      const onChange = vi.fn();
      render(<PersonalitySliders values={defaultValues} onChange={onChange} />);

      // Check left labels
      expect(screen.getByText("Grid")).toBeInTheDocument();
      expect(screen.getByText("Sprawl")).toBeInTheDocument();
      expect(screen.getByText("Historic")).toBeInTheDocument();
      expect(screen.getByText("Transit")).toBeInTheDocument();

      // Check right labels
      expect(screen.getByText("Organic")).toBeInTheDocument();
      expect(screen.getByText("Compact")).toBeInTheDocument();
      expect(screen.getByText("Modern")).toBeInTheDocument();
      expect(screen.getByText("Car")).toBeInTheDocument();
    });

    it("renders descriptions in non-compact mode", () => {
      const onChange = vi.fn();
      render(<PersonalitySliders values={defaultValues} onChange={onChange} />);

      expect(screen.getByText("Street pattern style")).toBeInTheDocument();
      expect(screen.getByText("Block size and density")).toBeInTheDocument();
      expect(screen.getByText("Redevelopment tendency")).toBeInTheDocument();
      expect(
        screen.getByText("Road width and transit access")
      ).toBeInTheDocument();
    });

    it("hides descriptions in compact mode", () => {
      const onChange = vi.fn();
      render(
        <PersonalitySliders
          values={defaultValues}
          onChange={onChange}
          compact
        />
      );

      expect(
        screen.queryByText("Street pattern style")
      ).not.toBeInTheDocument();
    });
  });

  describe("slider values", () => {
    it("displays correct initial values", () => {
      const customValues: DistrictPersonality = {
        grid_organic: 0.2,
        sprawl_compact: 0.8,
        historic_modern: 0.1,
        transit_car: 0.9,
      };
      const onChange = vi.fn();
      render(
        <PersonalitySliders values={customValues} onChange={onChange} />
      );

      const gridSlider = screen.getByTestId(
        "slider-grid_organic"
      ) as HTMLInputElement;
      const sprawlSlider = screen.getByTestId(
        "slider-sprawl_compact"
      ) as HTMLInputElement;
      const historicSlider = screen.getByTestId(
        "slider-historic_modern"
      ) as HTMLInputElement;
      const transitSlider = screen.getByTestId(
        "slider-transit_car"
      ) as HTMLInputElement;

      expect(gridSlider.value).toBe("0.2");
      expect(sprawlSlider.value).toBe("0.8");
      expect(historicSlider.value).toBe("0.1");
      expect(transitSlider.value).toBe("0.9");
    });

    it("calls onChange with updated values when slider changes", () => {
      const onChange = vi.fn();
      render(<PersonalitySliders values={defaultValues} onChange={onChange} />);

      const gridSlider = screen.getByTestId("slider-grid_organic");
      fireEvent.change(gridSlider, { target: { value: "0.7" } });

      expect(onChange).toHaveBeenCalledWith({
        ...defaultValues,
        grid_organic: 0.7,
      });
    });

    it("preserves other values when one slider changes", () => {
      const onChange = vi.fn();
      const customValues: DistrictPersonality = {
        grid_organic: 0.3,
        sprawl_compact: 0.6,
        historic_modern: 0.4,
        transit_car: 0.8,
      };
      render(
        <PersonalitySliders values={customValues} onChange={onChange} />
      );

      const sprawlSlider = screen.getByTestId("slider-sprawl_compact");
      fireEvent.change(sprawlSlider, { target: { value: "0.9" } });

      expect(onChange).toHaveBeenCalledWith({
        grid_organic: 0.3,
        sprawl_compact: 0.9,
        historic_modern: 0.4,
        transit_car: 0.8,
      });
    });
  });

  describe("disabled state", () => {
    it("disables all sliders when disabled prop is true", () => {
      const onChange = vi.fn();
      render(
        <PersonalitySliders values={defaultValues} onChange={onChange} disabled />
      );

      const sliders = screen.getAllByRole("slider");
      sliders.forEach((slider) => {
        expect(slider).toBeDisabled();
      });
    });
  });

  describe("accessibility", () => {
    it("has accessible labels on all sliders", () => {
      const onChange = vi.fn();
      render(<PersonalitySliders values={defaultValues} onChange={onChange} />);

      expect(
        screen.getByLabelText(/Grid to Organic: Street pattern style/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Sprawl to Compact: Block size and density/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Historic to Modern: Redevelopment tendency/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(
          /Transit to Car: Road width and transit access/i
        )
      ).toBeInTheDocument();
    });
  });
});

describe("CollapsiblePersonalitySliders", () => {
  const defaultValues: DistrictPersonality = DEFAULT_DISTRICT_PERSONALITY;

  it("starts collapsed by default", () => {
    const onChange = vi.fn();
    render(
      <CollapsiblePersonalitySliders
        values={defaultValues}
        onChange={onChange}
      />
    );

    expect(
      screen.queryByTestId("personality-sliders")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Personality Settings")).toBeInTheDocument();
  });

  it("starts expanded when defaultExpanded is true", () => {
    const onChange = vi.fn();
    render(
      <CollapsiblePersonalitySliders
        values={defaultValues}
        onChange={onChange}
        defaultExpanded
      />
    );

    expect(screen.getByTestId("personality-sliders")).toBeInTheDocument();
  });

  it("expands when header is clicked", () => {
    const onChange = vi.fn();
    render(
      <CollapsiblePersonalitySliders
        values={defaultValues}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText("Personality Settings"));

    expect(screen.getByTestId("personality-sliders")).toBeInTheDocument();
  });

  it("collapses when header is clicked again", () => {
    const onChange = vi.fn();
    render(
      <CollapsiblePersonalitySliders
        values={defaultValues}
        onChange={onChange}
        defaultExpanded
      />
    );

    fireEvent.click(screen.getByText("Personality Settings"));

    expect(
      screen.queryByTestId("personality-sliders")
    ).not.toBeInTheDocument();
  });

  it("toggles aria-expanded attribute", () => {
    const onChange = vi.fn();
    render(
      <CollapsiblePersonalitySliders
        values={defaultValues}
        onChange={onChange}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
