export type ExportResolution = "1x" | "2x" | "4x";

export interface ResolutionSelectorProps {
  resolution: ExportResolution;
  onResolutionChange: (resolution: ExportResolution) => void;
}

const resolutions: { value: ExportResolution; label: string; pixels: string }[] = [
  { value: "1x", label: "Standard", pixels: "1920×1080" },
  { value: "2x", label: "High", pixels: "3840×2160" },
  { value: "4x", label: "Ultra", pixels: "7680×4320" },
];

export function ResolutionSelector({
  resolution,
  onResolutionChange,
}: ResolutionSelectorProps) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Resolution</h4>
      <div className="flex gap-2">
        {resolutions.map(({ value, label, pixels }) => (
          <button
            key={value}
            onClick={() => onResolutionChange(value)}
            className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
              resolution === value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
            aria-label={`${label} resolution`}
          >
            <div className="font-medium text-gray-900">{label}</div>
            <div className="text-xs text-gray-500">{pixels}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
