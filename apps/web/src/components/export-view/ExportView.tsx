import { ReactNode, useState } from "react";
import { ExportFormatSelector, ExportFormat } from "./ExportFormatSelector";
import { ResolutionSelector, ExportResolution } from "./ResolutionSelector";
import { ExportPreview } from "./ExportPreview";
import { ExportLegend, LegendItem, defaultLegendItems } from "./ExportLegend";

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

  const handleExport = () => {
    onExport?.(format, resolution);
  };

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

          {/* Export button */}
          <button
            onClick={handleExport}
            className="w-full mt-6 py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2 font-medium"
            aria-label="Download export"
          >
            <DownloadIcon className="w-5 h-5" />
            Download {format.toUpperCase()}
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
