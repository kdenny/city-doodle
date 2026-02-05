import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  PersonalitySliders,
  CollapsiblePersonalitySliders,
} from "./PersonalitySliders";
import type { DistrictPersonality } from "../canvas/layers/types";
import { DEFAULT_DISTRICT_PERSONALITY } from "../canvas/layers/types";
import { DEFAULT_ERA_YEAR } from "./EraSelector";
import { HISTORIC_SPRAWL_MIN } from "./sliderValidation";

describe("PersonalitySliders", () => {
  const defaultValues: DistrictPersonality = {
    grid_organic: 0.5,
    sprawl_compact: 0.5,
    transit_car: 0.5,
    era_year: DEFAULT_ERA_YEAR,
  };

  describe("rendering", () => {
    it("renders three sliders and era selector", () => {
      const onChange = vi.fn();
      render(<PersonalitySliders values={defaultValues} onChange={onChange} />);

      expect(screen.getByTestId("personality-sliders")).toBeInTheDocument();
      expect(screen.getByTestId("slider-grid_organic")).toBeInTheDocument();
      expect(screen.getByTestId("slider-sprawl_compact")).toBeInTheDocument();
      expect(screen.getByTestId("slider-transit_car")).toBeInTheDocument();
      expect(screen.getByTestId("era-selector")).toBeInTheDocument();
    });

    it("renders slider labels", () => {
      const onChange = vi.fn();
      render(<PersonalitySliders values={defaultValues} onChange={onChange} />);

      // Check left labels
      expect(screen.getByText("Grid")).toBeInTheDocument();
      expect(screen.getByText("Sprawl")).toBeInTheDocument();
      expect(screen.getByText("Transit")).toBeInTheDocument();
      expect(screen.getByText("Era")).toBeInTheDocument();

      // Check right labels
      expect(screen.getByText("Organic")).toBeInTheDocument();
      expect(screen.getByText("Compact")).toBeInTheDocument();
      expect(screen.getByText("Car")).toBeInTheDocument();
      expect(screen.getByText("Contemporary")).toBeInTheDocument();
    });

    it("renders descriptions in non-compact mode", () => {
      const onChange = vi.fn();
      render(<PersonalitySliders values={defaultValues} onChange={onChange} />);

      expect(screen.getByText("Street pattern style")).toBeInTheDocument();
      expect(screen.getByText("Block size and density")).toBeInTheDocument();
      expect(
        screen.getByText("Road width and transit access")
      ).toBeInTheDocument();
      expect(screen.getByText("Present Day")).toBeInTheDocument();
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
        transit_car: 0.9,
        era_year: 1900,
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
      const transitSlider = screen.getByTestId(
        "slider-transit_car"
      ) as HTMLInputElement;

      expect(gridSlider.value).toBe("0.2");
      expect(sprawlSlider.value).toBe("0.8");
      expect(transitSlider.value).toBe("0.9");
      expect(screen.getByTestId("era-label")).toHaveTextContent("Streetcar Era");
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
        transit_car: 0.8,
        era_year: 1920,
      };
      render(
        <PersonalitySliders values={customValues} onChange={onChange} />
      );

      const sprawlSlider = screen.getByTestId("slider-sprawl_compact");
      fireEvent.change(sprawlSlider, { target: { value: "0.9" } });

      expect(onChange).toHaveBeenCalledWith({
        grid_organic: 0.3,
        sprawl_compact: 0.9,
        transit_car: 0.8,
        era_year: 1920,
      });
    });
  });

  describe("disabled state", () => {
    it("disables all sliders and era selector when disabled prop is true", () => {
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

  describe("validation constraints", () => {
    describe("sprawl_compact constraint for pre-1940 eras", () => {
      it("shows constraint marker for historic eras", () => {
        const onChange = vi.fn();
        const historicValues: DistrictPersonality = {
          ...defaultValues,
          era_year: 1900,
        };
        render(
          <PersonalitySliders values={historicValues} onChange={onChange} />
        );

        expect(screen.getByTestId("constraint-marker-sprawl_compact")).toBeInTheDocument();
      });

      it("does not show constraint marker for modern eras", () => {
        const onChange = vi.fn();
        render(<PersonalitySliders values={defaultValues} onChange={onChange} />);

        expect(
          screen.queryByTestId("constraint-marker-sprawl_compact")
        ).not.toBeInTheDocument();
      });

      it("snaps sprawl value to minimum for historic eras", () => {
        const onChange = vi.fn();
        const historicValues: DistrictPersonality = {
          ...defaultValues,
          era_year: 1900,
          sprawl_compact: 0.5,
        };
        render(
          <PersonalitySliders values={historicValues} onChange={onChange} />
        );

        const sprawlSlider = screen.getByTestId("slider-sprawl_compact");
        // Try to set value below minimum
        fireEvent.change(sprawlSlider, { target: { value: "0.1" } });

        // Should snap to minimum
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({
            sprawl_compact: HISTORIC_SPRAWL_MIN,
          })
        );
      });

      it("shows constraint tooltip on hover for constrained sliders", () => {
        const onChange = vi.fn();
        const historicValues: DistrictPersonality = {
          ...defaultValues,
          era_year: 1900,
        };
        render(
          <PersonalitySliders values={historicValues} onChange={onChange} />
        );

        // Find the sprawl slider wrapper and hover
        const sprawlSlider = screen.getByTestId("slider-sprawl_compact");
        fireEvent.mouseEnter(sprawlSlider.closest(".relative")!.parentElement!);

        expect(screen.getByTestId("constraint-tooltip-sprawl_compact")).toBeInTheDocument();
        expect(
          screen.getByTestId("constraint-tooltip-sprawl_compact").textContent
        ).toContain("Historic districts");
      });
    });

    describe("transit_car disabled for historic districts", () => {
      it("disables transit slider when isHistoric is true", () => {
        const onChange = vi.fn();
        render(
          <PersonalitySliders
            values={defaultValues}
            onChange={onChange}
            isHistoric={true}
          />
        );

        const transitSlider = screen.getByTestId("slider-transit_car");
        expect(transitSlider).toBeDisabled();
      });

      it("shows tooltip explaining why transit is disabled for historic", () => {
        const onChange = vi.fn();
        render(
          <PersonalitySliders
            values={defaultValues}
            onChange={onChange}
            isHistoric={true}
          />
        );

        const transitSlider = screen.getByTestId("slider-transit_car");
        fireEvent.mouseEnter(transitSlider.closest(".relative")!.parentElement!);

        expect(screen.getByTestId("constraint-tooltip-transit_car")).toBeInTheDocument();
        expect(
          screen.getByTestId("constraint-tooltip-transit_car").textContent
        ).toContain("Historic Districts");
      });

      it("enables transit slider when isHistoric is false", () => {
        const onChange = vi.fn();
        render(
          <PersonalitySliders
            values={defaultValues}
            onChange={onChange}
            isHistoric={false}
          />
        );

        const transitSlider = screen.getByTestId("slider-transit_car");
        expect(transitSlider).not.toBeDisabled();
      });
    });

    describe("transit_car disabled when no transit stations", () => {
      it("disables transit slider when hasTransitStations is false", () => {
        const onChange = vi.fn();
        render(
          <PersonalitySliders
            values={defaultValues}
            onChange={onChange}
            hasTransitStations={false}
          />
        );

        const transitSlider = screen.getByTestId("slider-transit_car");
        expect(transitSlider).toBeDisabled();
      });

      it("shows tooltip explaining why transit is disabled for no stations", () => {
        const onChange = vi.fn();
        render(
          <PersonalitySliders
            values={defaultValues}
            onChange={onChange}
            hasTransitStations={false}
          />
        );

        const transitSlider = screen.getByTestId("slider-transit_car");
        fireEvent.mouseEnter(transitSlider.closest(".relative")!.parentElement!);

        expect(screen.getByTestId("constraint-tooltip-transit_car")).toBeInTheDocument();
        expect(
          screen.getByTestId("constraint-tooltip-transit_car").textContent
        ).toContain("No transit stations");
      });

      it("enables transit slider when hasTransitStations is true (default)", () => {
        const onChange = vi.fn();
        render(
          <PersonalitySliders values={defaultValues} onChange={onChange} />
        );

        const transitSlider = screen.getByTestId("slider-transit_car");
        expect(transitSlider).not.toBeDisabled();
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
        screen.getByLabelText(
          /Transit to Car: Road width and transit access/i
        )
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Era: Contemporary/i)
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

  it("passes isHistoric prop to PersonalitySliders", () => {
    const onChange = vi.fn();
    render(
      <CollapsiblePersonalitySliders
        values={defaultValues}
        onChange={onChange}
        isHistoric={true}
        defaultExpanded
      />
    );

    // Transit slider should be disabled when isHistoric is true
    const transitSlider = screen.getByTestId("slider-transit_car");
    expect(transitSlider).toBeDisabled();
  });

  it("passes hasTransitStations prop to PersonalitySliders", () => {
    const onChange = vi.fn();
    render(
      <CollapsiblePersonalitySliders
        values={defaultValues}
        onChange={onChange}
        hasTransitStations={false}
        defaultExpanded
      />
    );

    // Transit slider should be disabled when no transit stations
    const transitSlider = screen.getByTestId("slider-transit_car");
    expect(transitSlider).toBeDisabled();
  });
});
