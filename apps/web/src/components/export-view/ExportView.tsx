import { ReactNode, useState, useCallback } from "react";
import { ExportFormatSelector, ExportFormat } from "./ExportFormatSelector";
import { ResolutionSelector, ExportResolution } from "./ResolutionSelector";
import { ExportPreview } from "./ExportPreview";
import { ExportLegend, LegendItem, defaultLegendItems } from "./ExportLegend";
import { useMapCanvasExportOptional, generateExportFilename } from "../canvas";

export interface ExportViewProps {
  children: ReactNode;
  legendItems?: LegendItem[];
  onExport?: (format: ExportFormat, resolution: ExportResolution) => void;
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </svg>
  );
}

export function ExportView({
  children,
  legendItems = defaultLegendItems,
  onExport,
}: ExportViewProps) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [resolution, setResolution] = useState<ExportResolution>("2x");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Get canvas context for export (null if not in provider)
  const canvasExport = useMapCanvasExportOptional();

  const handleExport = useCallback(async () => {
    setExportError(null);

    // If we have canvas context and it's PNG, use it directly
    if (canvasExport?.isReady && format === "png") {
      setIsExporting(true);
      try {
        await canvasExport.exportAsPng({
          resolution,
          filename: generateExportFilename(undefined, resolution),
        });
      } catch (err) {
        setExportError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setIsExporting(false);
      }
      return;
    }

    // Fall back to onExport callback (for GIF or when context not available)
    onExport?.(format, resolution);
  }, [canvasExport, format, resolution, onExport]);

  return (
    <div className="relative w-full h-full bg-gray-50">
      {/* Main content area */}
      <div className="flex h-full">
        {/* Preview section (left/center) */}
        <div className="flex-1 p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Export Preview
          </h2>

          <div className="flex-1 min-h-0">
            <ExportPreview>{children}</ExportPreview>
          </div>
        </div>

        {/* Controls panel (right) */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Export Settings
          </h2>

          <div className="space-y-6 flex-1">
            <ExportFormatSelector format={format} onFormatChange={setFormat} />
            <ResolutionSelector
              resolution={resolution}
              onResolutionChange={setResolution}
            />
          </div>

          {/* Error message */}
          {exportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {exportError}
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`w-full mt-6 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${
              isExporting
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
            aria-label="Download export"
          >
            {isExporting ? (
              <>
                <svg
                  className="w-5 h-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <DownloadIcon className="w-5 h-5" />
                Download {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Legend overlay (bottom-left) */}
      <div className="absolute bottom-6 left-6">
        <ExportLegend items={legendItems} />
      </div>
    </div>
  );
}
