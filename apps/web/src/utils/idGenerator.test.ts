import { describe, it, expect } from "vitest";
import { generateId, generateSimpleId } from "./idGenerator";

describe("idGenerator", () => {
  describe("generateId", () => {
    it("should generate an ID with the given prefix", () => {
      const id = generateId("test");
      expect(id).toMatch(/^test-\d+-[a-z0-9]+$/);
    });

    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId("test"));
      }
      expect(ids.size).toBe(100);
    });

    it("should work with various prefixes", () => {
      const prefixes = ["district", "road", "bridge", "seed", "toast", "neighborhood"];
      for (const prefix of prefixes) {
        const id = generateId(prefix);
        expect(id.startsWith(`${prefix}-`)).toBe(true);
      }
    });

    it("should work with compound prefixes", () => {
      const id = generateId("city-limits");
      expect(id).toMatch(/^city-limits-\d+-[a-z0-9]+$/);
    });

    it("should include a timestamp component", () => {
      const before = Date.now();
      const id = generateId("test");
      const after = Date.now();

      const parts = id.split("-");
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("should have a random component of 9 characters", () => {
      const id = generateId("test");
      const parts = id.split("-");
      const randomPart = parts[2];

      expect(randomPart.length).toBe(9);
      expect(randomPart).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe("generateSimpleId", () => {
    it("should generate an ID without prefix", () => {
      const id = generateSimpleId();
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });

    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSimpleId());
      }
      expect(ids.size).toBe(100);
    });
  });
});
