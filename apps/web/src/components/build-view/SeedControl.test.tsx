import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SeedControl,
  generateRandomSeed,
  seedToHash,
  hashToSeed,
} from "./SeedControl";

describe("SeedControl", () => {
  const mockOnSeedChange = vi.fn();

  beforeEach(() => {
    mockOnSeedChange.mockClear();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe("seedToHash", () => {
    it("converts a seed to a 6-character hash", () => {
      const hash = seedToHash(12345);
      expect(hash).toHaveLength(6);
      expect(/^[0-9A-Z]+$/.test(hash)).toBe(true);
    });

    it("produces consistent hashes for the same seed", () => {
      const hash1 = seedToHash(12345);
      const hash2 = seedToHash(12345);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different seeds", () => {
      const hash1 = seedToHash(12345);
      const hash2 = seedToHash(54321);
      expect(hash1).not.toBe(hash2);
    });

    it("handles zero", () => {
      const hash = seedToHash(0);
      expect(hash).toHaveLength(6);
    });

    it("handles large numbers", () => {
      const hash = seedToHash(4294967295);
      expect(hash).toHaveLength(6);
    });
  });

  describe("hashToSeed", () => {
    it("converts a hash back to a seed", () => {
      const originalSeed = 12345;
      const hash = seedToHash(originalSeed);
      const recoveredSeed = hashToSeed(hash);

      // Note: Due to truncation in seedToHash, the recovered seed may differ
      // but the round-trip through the hash should be consistent
      expect(recoveredSeed).not.toBeNull();
      expect(seedToHash(recoveredSeed!)).toBe(hash);
    });

    it("handles lowercase input", () => {
      const seed = hashToSeed("abc123");
      expect(seed).not.toBeNull();
    });

    it("handles uppercase input", () => {
      const seed = hashToSeed("ABC123");
      expect(seed).not.toBeNull();
    });

    it("returns null for invalid input", () => {
      expect(hashToSeed("")).toBeNull();
      expect(hashToSeed("invalid!")).toBeNull();
      expect(hashToSeed("too_long_123456789")).toBeNull();
    });
  });

  describe("generateRandomSeed", () => {
    it("generates a number within valid range", () => {
      const seed = generateRandomSeed();
      expect(typeof seed).toBe("number");
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(4294967296);
    });

    it("generates different values on subsequent calls", () => {
      const seeds = new Set<number>();
      for (let i = 0; i < 10; i++) {
        seeds.add(generateRandomSeed());
      }
      // Should have generated at least some different values
      expect(seeds.size).toBeGreaterThan(1);
    });
  });

  describe("SeedControl component", () => {
    it("renders the seed hash", () => {
      const seed = 12345;
      render(
        <SeedControl seed={seed} onSeedChange={mockOnSeedChange} />
      );

      expect(screen.getByTestId("seed-display")).toHaveTextContent(
        seedToHash(seed)
      );
    });

    it("calls onSeedChange when shuffle button is clicked", () => {
      render(
        <SeedControl seed={12345} onSeedChange={mockOnSeedChange} />
      );

      const shuffleButton = screen.getByTestId("seed-shuffle-button");
      fireEvent.click(shuffleButton);

      expect(mockOnSeedChange).toHaveBeenCalledTimes(1);
      expect(typeof mockOnSeedChange.mock.calls[0][0]).toBe("number");
    });

    it("copies seed to clipboard when copy button is clicked", () => {
      const seed = 12345;
      render(
        <SeedControl seed={seed} onSeedChange={mockOnSeedChange} />
      );

      const copyButton = screen.getByTestId("seed-copy-button");
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        seedToHash(seed)
      );
    });

    it("allows editing the seed value", () => {
      render(
        <SeedControl seed={12345} onSeedChange={mockOnSeedChange} />
      );

      // Click on display to start editing
      const display = screen.getByTestId("seed-display");
      fireEvent.click(display);

      // Type a new value and press Enter
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "ABC123" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(mockOnSeedChange).toHaveBeenCalled();
    });

    it("renders in compact mode", () => {
      render(
        <SeedControl seed={12345} onSeedChange={mockOnSeedChange} compact />
      );

      // In compact mode, the help text should not be visible
      expect(screen.queryByText("Same seed = same result")).not.toBeInTheDocument();
    });

    it("is disabled when disabled prop is true", () => {
      render(
        <SeedControl seed={12345} onSeedChange={mockOnSeedChange} disabled />
      );

      const shuffleButton = screen.getByTestId("seed-shuffle-button");
      expect(shuffleButton).toBeDisabled();

      fireEvent.click(shuffleButton);
      expect(mockOnSeedChange).not.toHaveBeenCalled();
    });

    it("displays custom label", () => {
      render(
        <SeedControl
          seed={12345}
          onSeedChange={mockOnSeedChange}
          label="Custom Label"
        />
      );

      expect(screen.getByText("Custom Label")).toBeInTheDocument();
    });
  });
});
