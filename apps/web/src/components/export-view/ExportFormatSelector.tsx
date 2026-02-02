export type ExportFormat = "png" | "gif";

export interface ExportFormatSelectorProps {
  format: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
}

const formats: { value: ExportFormat; label: string; description: string }[] = [
  { value: "png", label: "PNG", description: "High-quality static image" },
  { value: "gif", label: "GIF", description: "Animated timelapse" },
];

export function ExportFormatSelector({
  format,
  onFormatChange,
}: ExportFormatSelectorProps) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Format</h4>
      <div className="space-y-2">
        {formats.map(({ value, label, description }) => (
          <label
            key={value}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              format === value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="format"
              value={value}
              checked={format === value}
              onChange={() => onFormatChange(value)}
              className="text-blue-500 focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">{label}</div>
              <div className="text-sm text-gray-500">{description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
