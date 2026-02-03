import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  downloadBlob,
  generateExportFilename,
} from "./useCanvasExport";

describe("useCanvasExport utilities", () => {
  describe("downloadBlob", () => {
    beforeEach(() => {
      // Reset mocks
      vi.restoreAllMocks();
    });

    it("creates and clicks a download link", () => {
      const blob = new Blob(["test"], { type: "image/png" });
      const createObjectURL = vi.fn().mockReturnValue("blob:test-url");
      const revokeObjectURL = vi.fn();
      const appendChild = vi.fn();
      const removeChild = vi.fn();
      const click = vi.fn();

      vi.stubGlobal("URL", {
        createObjectURL,
        revokeObjectURL,
      });

      const mockLink = {
        href: "",
        download: "",
        click,
      };

      vi.spyOn(document, "createElement").mockReturnValue(
        mockLink as unknown as HTMLAnchorElement
      );
      vi.spyOn(document.body, "appendChild").mockImplementation(appendChild);
      vi.spyOn(document.body, "removeChild").mockImplementation(removeChild);

      downloadBlob(blob, "test.png");

      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(mockLink.href).toBe("blob:test-url");
      expect(mockLink.download).toBe("test.png");
      expect(click).toHaveBeenCalled();
      expect(appendChild).toHaveBeenCalled();
      expect(removeChild).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
    });
  });

  describe("generateExportFilename", () => {
    it("generates filename with default name when no world name provided", () => {
      const filename = generateExportFilename();

      expect(filename).toMatch(/^city-doodle-\d{4}-\d{2}-\d{2}\.png$/);
    });

    it("generates filename with world name when provided", () => {
      const filename = generateExportFilename("my-city");

      expect(filename).toMatch(/^my-city-\d{4}-\d{2}-\d{2}\.png$/);
    });

    it("includes resolution in filename when provided", () => {
      const filename = generateExportFilename("my-city", "2x");

      expect(filename).toMatch(/^my-city-2x-\d{4}-\d{2}-\d{2}\.png$/);
    });

    it("generates filename with only resolution when no world name", () => {
      const filename = generateExportFilename(undefined, "4x");

      expect(filename).toMatch(/^city-doodle-4x-\d{4}-\d{2}-\d{2}\.png$/);
    });
  });
});
