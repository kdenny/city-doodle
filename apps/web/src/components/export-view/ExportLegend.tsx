export interface LegendItem {
  id: string;
  label: string;
  color: string;
  category: "land-use" | "transit" | "infrastructure";
}

export interface ExportLegendProps {
  items?: LegendItem[];
}

export const defaultLegendItems: LegendItem[] = [
  { id: "high-density", label: "High Density", color: "#F472B6", category: "land-use" },
  { id: "medium-density", label: "Medium Density", color: "#FDBA74", category: "land-use" },
  { id: "residential", label: "Residential", color: "#86EFAC", category: "land-use" },
  { id: "commercial", label: "Commercial", color: "#C4B5FD", category: "land-use" },
  { id: "parks", label: "Parks", color: "#4ADE80", category: "land-use" },
  { id: "water", label: "Water", color: "#60A5FA", category: "land-use" },
  { id: "transit-red", label: "Red Line", color: "#DC2626", category: "transit" },
  { id: "transit-blue", label: "Blue Line", color: "#2563EB", category: "transit" },
  { id: "roads", label: "Roads", color: "#9CA3AF", category: "infrastructure" },
];

const categoryLabels: Record<LegendItem["category"], string> = {
  "land-use": "Land Use",
  "transit": "Transit",
  "infrastructure": "Infrastructure",
};

export function ExportLegend({ items = defaultLegendItems }: ExportLegendProps) {
  const categories = ["land-use", "transit", "infrastructure"] as const;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Legend</h3>

      <div className="space-y-4">
        {categories.map((category) => {
          const categoryItems = items.filter((item) => item.category === category);
          if (categoryItems.length === 0) return null;

          return (
            <div key={category}>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                {categoryLabels[category]}
              </h4>
              <div className="space-y-1">
                {categoryItems.map(({ id, label, color }) => (
                  <div key={id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t">
        <p className="text-xs text-gray-400">
          Generated with City Doodle
        </p>
      </div>
    </div>
  );
}
