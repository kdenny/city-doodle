/**
 * Hook and utilities for exporting PixiJS canvas as PNG.
 *
 * Provides functionality to capture the current canvas view at various resolutions
 * and download it as a PNG file.
 */

import { Application } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { ExportResolution } from "../export-view/ResolutionSelector";

// Resolution multipliers for export quality
const RESOLUTION_MULTIPLIERS: Record<ExportResolution, number> = {
  "1x": 1,
  "2x": 2,
  "4x": 4,
};

// Base export dimensions (1080p)
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

export interface ExportOptions {
  resolution: ExportResolution;
  filename?: string;
  includeGrid?: boolean;
}

export interface ExportResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Captures the current canvas view as a PNG blob.
 *
 * @param app - The PixiJS Application instance
 * @param viewport - The pixi-viewport Viewport instance
 * @param options - Export options (resolution, filename, etc.)
 * @returns Promise resolving to the export result with blob and dimensions
 */
export async function captureCanvasAsPng(
  app: Application,
  viewport: Viewport,
  options: ExportOptions
): Promise<ExportResult> {
  const multiplier = RESOLUTION_MULTIPLIERS[options.resolution];
  const width = BASE_WIDTH * multiplier;
  const height = BASE_HEIGHT * multiplier;

  // Store original state
  const originalWidth = app.renderer.width;
  const originalHeight = app.renderer.height;
  const originalViewportWidth = viewport.screenWidth;
  const originalViewportHeight = viewport.screenHeight;

  try {
    // Resize renderer to export dimensions
    app.renderer.resize(width, height);

    // Update viewport dimensions
    viewport.resize(width, height);

    // Render the scene
    app.render();

    // Extract canvas as blob
    const canvas = app.canvas as HTMLCanvasElement;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        },
        "image/png",
        1.0
      );
    });

    // Create data URL for preview
    const dataUrl = canvas.toDataURL("image/png");

    return {
      blob,
      dataUrl,
      width,
      height,
    };
  } finally {
    // Restore original state
    app.renderer.resize(originalWidth, originalHeight);
    viewport.resize(originalViewportWidth, originalViewportHeight);
    app.render();
  }
}

/**
 * Downloads a blob as a file.
 *
 * @param blob - The blob to download
 * @param filename - The filename for the download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a filename for the export.
 *
 * @param worldName - Optional world name to include
 * @param resolution - The resolution being exported
 * @returns A filename string
 */
export function generateExportFilename(
  worldName?: string,
  resolution?: ExportResolution
): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const name = worldName || "city-doodle";
  const res = resolution ? `-${resolution}` : "";
  return `${name}${res}-${timestamp}.png`;
}

/**
 * Full export flow: capture and download.
 *
 * @param app - The PixiJS Application instance
 * @param viewport - The pixi-viewport Viewport instance
 * @param options - Export options
 */
export async function exportCanvasAsPng(
  app: Application,
  viewport: Viewport,
  options: ExportOptions
): Promise<void> {
  const result = await captureCanvasAsPng(app, viewport, options);
  const filename =
    options.filename || generateExportFilename(undefined, options.resolution);
  downloadBlob(result.blob, filename);
}
