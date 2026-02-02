import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MapCanvas } from "./MapCanvas";

// PixiJS mocks are in test/setup.ts

describe("MapCanvas", () => {
  it("renders loading state initially", () => {
    render(<MapCanvas />);
    expect(screen.getByText("Loading canvas...")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(<MapCanvas className="test-class" />);
    expect(container.firstChild).toHaveClass("test-class");
  });
});
