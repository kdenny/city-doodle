export type LandUseType =
  | "high_density"
  | "medium_density"
  | "residential"
  | "commercial"
  | "parks"
  | "water";

export interface LandUseCategory {
  type: LandUseType;
  label: string;
  color: string;
  description: string;
}

export const landUseCategories: LandUseCategory[] = [
  { type: "high_density", label: "High Density", color: "#F472B6", description: "Downtown core" },
  { type: "medium_density", label: "Medium Density", color: "#FDBA74", description: "Mixed use" },
  { type: "residential", label: "Residential", color: "#86EFAC", description: "Housing areas" },
  { type: "commercial", label: "Commercial", color: "#C4B5FD", description: "Business districts" },
  { type: "parks", label: "Parks", color: "#4ADE80", description: "Green spaces" },
  { type: "water", label: "Water", color: "#60A5FA", description: "Harbor & coast" },
];

export function LandUseLegend() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-56">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Land Use</h3>

      <div className="space-y-2">
        {landUseCategories.map(({ type, label, color, description }) => (
          <div key={type} className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded shrink-0"
              style={{ backgroundColor: color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{label}</div>
              <div className="text-xs text-gray-500">{description}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t">
        <p className="text-xs text-gray-400 italic">Read-only analysis view</p>
      </div>
    </div>
  );
}
