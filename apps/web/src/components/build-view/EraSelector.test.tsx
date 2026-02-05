import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  EraSelector,
  ERAS,
  DEFAULT_ERA_YEAR,
  HISTORIC_THRESHOLD_YEAR,
  canBeHistoric,
  getEraByYear,
  getEraIndexByYear,
  sliderValueToEraYear,
  eraYearToSliderValue,
} from "./EraSelector";

describe("EraSelector", () => {
  describe("rendering", () => {
    it("renders era selector with default value", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} />);

      expect(screen.getByTestId("era-selector")).toBeInTheDocument();
      expect(screen.getByTestId("era-slider")).toBeInTheDocument();
      expect(screen.getByTestId("era-label")).toHaveTextContent("Contemporary");
    });

    it("renders correct label for Medieval era", () => {
      const onChange = vi.fn();
      render(<EraSelector value={1200} onChange={onChange} />);

      expect(screen.getByTestId("era-label")).toHaveTextContent("Medieval");
    });

    it("renders correct label for Streetcar Era", () => {
      const onChange = vi.fn();
      render(<EraSelector value={1900} onChange={onChange} />);

      expect(screen.getByTestId("era-label")).toHaveTextContent("Streetcar Era");
    });

    it("renders description in non-compact mode", () => {
      const onChange = vi.fn();
      render(<EraSelector value={1900} onChange={onChange} />);

      expect(screen.getByText("Turn of the Century")).toBeInTheDocument();
    });

    it("hides description in compact mode", () => {
      const onChange = vi.fn();
      render(<EraSelector value={1900} onChange={onChange} compact />);

      expect(screen.queryByText("Turn of the Century")).not.toBeInTheDocument();
    });
  });

  describe("slider interaction without warning", () => {
    it("calls onChange directly when showChangeWarning is false", () => {
      const onChange = vi.fn();
      render(
        <EraSelector
          value={DEFAULT_ERA_YEAR}
          onChange={onChange}
          showChangeWarning={false}
        />
      );

      const slider = screen.getByTestId("era-slider");
      // Change to index 0 (Medieval 1200)
      fireEvent.change(slider, { target: { value: "0" } });

      expect(onChange).toHaveBeenCalledWith(1200);
    });

    it("updates label when slider changes", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <EraSelector
          value={DEFAULT_ERA_YEAR}
          onChange={onChange}
          showChangeWarning={false}
        />
      );

      // Simulate the parent updating the value
      rerender(
        <EraSelector value={1200} onChange={onChange} showChangeWarning={false} />
      );

      expect(screen.getByTestId("era-label")).toHaveTextContent("Medieval");
    });

    it("disables slider when disabled prop is true", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} disabled />);

      expect(screen.getByTestId("era-slider")).toBeDisabled();
    });
  });

  describe("era change warning dialog", () => {
    it("shows warning dialog when era changes and showChangeWarning is true (default)", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} />);

      const slider = screen.getByTestId("era-slider");
      // Change to index 0 (Medieval 1200)
      fireEvent.change(slider, { target: { value: "0" } });

      // Dialog should appear
      expect(screen.getByTestId("confirmation-dialog")).toBeInTheDocument();
      expect(screen.getByText("Change Era?")).toBeInTheDocument();
      // onChange should NOT have been called yet
      expect(onChange).not.toHaveBeenCalled();
    });

    it("shows current and new era names in dialog message", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} />);

      const slider = screen.getByTestId("era-slider");
      // Change to Medieval 1200
      fireEvent.change(slider, { target: { value: "0" } });

      const dialog = screen.getByTestId("confirmation-dialog");
      expect(dialog.textContent).toContain("Contemporary");
      expect(dialog.textContent).toContain("Medieval");
    });

    it("calls onChange when user confirms era change", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} />);

      const slider = screen.getByTestId("era-slider");
      fireEvent.change(slider, { target: { value: "0" } });

      // Click confirm button
      const confirmButton = screen.getByTestId("dialog-confirm-button");
      fireEvent.click(confirmButton);

      expect(onChange).toHaveBeenCalledWith(1200);
      // Dialog should be closed
      expect(screen.queryByTestId("confirmation-dialog")).not.toBeInTheDocument();
    });

    it("does not call onChange when user cancels era change", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} />);

      const slider = screen.getByTestId("era-slider");
      fireEvent.change(slider, { target: { value: "0" } });

      // Click cancel button
      const cancelButton = screen.getByTestId("dialog-cancel-button");
      fireEvent.click(cancelButton);

      expect(onChange).not.toHaveBeenCalled();
      // Dialog should be closed
      expect(screen.queryByTestId("confirmation-dialog")).not.toBeInTheDocument();
    });

    it("closes dialog when clicking backdrop", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} />);

      const slider = screen.getByTestId("era-slider");
      fireEvent.change(slider, { target: { value: "0" } });

      // Click backdrop (the dialog container itself)
      const dialog = screen.getByTestId("confirmation-dialog");
      fireEvent.click(dialog);

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByTestId("confirmation-dialog")).not.toBeInTheDocument();
    });

    it("closes dialog when pressing Escape", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} />);

      const slider = screen.getByTestId("era-slider");
      fireEvent.change(slider, { target: { value: "0" } });

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByTestId("confirmation-dialog")).not.toBeInTheDocument();
    });

    it("does not show dialog when changing to the same era", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} />);

      const slider = screen.getByTestId("era-slider");
      const currentIndex = getEraIndexByYear(DEFAULT_ERA_YEAR);
      // Change to same index
      fireEvent.change(slider, { target: { value: String(currentIndex) } });

      // No dialog should appear - the component does not call onChange when the index doesn't change
      // because the slider change event is only triggered when the value actually changes
      expect(screen.queryByTestId("confirmation-dialog")).not.toBeInTheDocument();
      // onChange is not called because the slider value didn't actually change
      // (this is expected browser behavior - input events only fire on actual changes)
    });

    it("shows details about street grid changes in dialog", () => {
      const onChange = vi.fn();
      render(<EraSelector value={DEFAULT_ERA_YEAR} onChange={onChange} />);

      const slider = screen.getByTestId("era-slider");
      fireEvent.change(slider, { target: { value: "0" } });

      const dialog = screen.getByTestId("confirmation-dialog");
      expect(dialog.textContent).toContain("street grid");
      expect(dialog.textContent).toContain("Street layout");
    });
  });

  describe("tooltip", () => {
    it("shows tooltip on hover", () => {
      const onChange = vi.fn();
      render(<EraSelector value={1900} onChange={onChange} />);

      // Hover over the slider area
      const slider = screen.getByTestId("era-slider");
      fireEvent.mouseEnter(slider.parentElement!);

      expect(screen.getByTestId("era-tooltip")).toBeInTheDocument();
      // Check that the tooltip contains era characteristics
      expect(screen.getByTestId("era-tooltip").textContent).toContain("Streetcar suburbs");
    });

    it("hides tooltip on mouse leave", () => {
      const onChange = vi.fn();
      render(<EraSelector value={1900} onChange={onChange} />);

      const slider = screen.getByTestId("era-slider");
      fireEvent.mouseEnter(slider.parentElement!);
      expect(screen.getByTestId("era-tooltip")).toBeInTheDocument();

      fireEvent.mouseLeave(slider.parentElement!);
      expect(screen.queryByTestId("era-tooltip")).not.toBeInTheDocument();
    });

    it("does not show tooltip when disabled", () => {
      const onChange = vi.fn();
      render(<EraSelector value={1900} onChange={onChange} disabled />);

      const slider = screen.getByTestId("era-slider");
      fireEvent.mouseEnter(slider.parentElement!);

      expect(screen.queryByTestId("era-tooltip")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has accessible label", () => {
      const onChange = vi.fn();
      render(<EraSelector value={1900} onChange={onChange} />);

      expect(
        screen.getByLabelText(/Era: Streetcar Era \(Turn of the Century\)/i)
      ).toBeInTheDocument();
    });
  });
});

describe("ERA utility functions", () => {
  describe("canBeHistoric", () => {
    it("returns true for years before 1940", () => {
      expect(canBeHistoric(1200)).toBe(true);
      expect(canBeHistoric(1900)).toBe(true);
      expect(canBeHistoric(1920)).toBe(true);
      expect(canBeHistoric(1939)).toBe(true);
    });

    it("returns false for years >= 1940", () => {
      expect(canBeHistoric(1940)).toBe(false);
      expect(canBeHistoric(1960)).toBe(false);
      expect(canBeHistoric(2024)).toBe(false);
    });

    it("uses correct threshold year constant", () => {
      expect(HISTORIC_THRESHOLD_YEAR).toBe(1940);
    });
  });

  describe("getEraByYear", () => {
    it("returns correct era for valid year", () => {
      const era = getEraByYear(1900);
      expect(era).toBeDefined();
      expect(era?.label).toBe("Streetcar Era");
      expect(era?.description).toBe("Turn of the Century");
    });

    it("returns undefined for invalid year", () => {
      expect(getEraByYear(1999)).toBeUndefined();
    });
  });

  describe("getEraIndexByYear", () => {
    it("returns correct index for valid year", () => {
      expect(getEraIndexByYear(1200)).toBe(0);
      expect(getEraIndexByYear(2024)).toBe(ERAS.length - 1);
    });

    it("returns last index for invalid year", () => {
      expect(getEraIndexByYear(9999)).toBe(ERAS.length - 1);
    });
  });

  describe("sliderValueToEraYear", () => {
    it("maps 0 to earliest era", () => {
      expect(sliderValueToEraYear(0)).toBe(1200);
    });

    it("maps 1 to latest era", () => {
      expect(sliderValueToEraYear(1)).toBe(2024);
    });

    it("maps 0.5 to middle era", () => {
      const middleIndex = Math.round(0.5 * (ERAS.length - 1));
      expect(sliderValueToEraYear(0.5)).toBe(ERAS[middleIndex].year);
    });
  });

  describe("eraYearToSliderValue", () => {
    it("maps earliest era to 0", () => {
      expect(eraYearToSliderValue(1200)).toBe(0);
    });

    it("maps latest era to 1", () => {
      expect(eraYearToSliderValue(2024)).toBe(1);
    });

    it("is inverse of sliderValueToEraYear for valid eras", () => {
      for (let i = 0; i < ERAS.length; i++) {
        const year = ERAS[i].year;
        const sliderValue = eraYearToSliderValue(year);
        const backToYear = sliderValueToEraYear(sliderValue);
        expect(backToYear).toBe(year);
      }
    });
  });
});

describe("ERAS constant", () => {
  it("has correct number of eras", () => {
    expect(ERAS.length).toBe(15);
  });

  it("is sorted by year ascending", () => {
    for (let i = 1; i < ERAS.length; i++) {
      expect(ERAS[i].year).toBeGreaterThan(ERAS[i - 1].year);
    }
  });

  it("includes required eras", () => {
    const years = ERAS.map((e) => e.year);
    // Medieval
    expect(years).toContain(1200);
    expect(years).toContain(1300);
    expect(years).toContain(1400);
    expect(years).toContain(1500);
    // Early Modern
    expect(years).toContain(1600);
    expect(years).toContain(1700);
    // Industrial
    expect(years).toContain(1800);
    expect(years).toContain(1850);
    expect(years).toContain(1875);
    expect(years).toContain(1900);
    // Early 20th century
    expect(years).toContain(1920);
    expect(years).toContain(1940);
    // Mid-century
    expect(years).toContain(1960);
    expect(years).toContain(1980);
    // Present
    expect(years).toContain(2024);
  });

  it("all eras have required properties", () => {
    for (const era of ERAS) {
      expect(era.year).toBeTypeOf("number");
      expect(era.label).toBeTypeOf("string");
      expect(era.label.length).toBeGreaterThan(0);
      expect(era.description).toBeTypeOf("string");
      expect(era.description.length).toBeGreaterThan(0);
      expect(Array.isArray(era.characteristics)).toBe(true);
      expect(era.characteristics.length).toBeGreaterThan(0);
    }
  });
});
