const BANDS = [
  { label: "5 min walk", color: "#22C55E" },
  { label: "10 min walk", color: "#EAB308" },
  { label: "15 min walk", color: "#F97316" },
];

export function WalkabilityLegend() {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3 text-sm">
      <div className="font-semibold text-gray-700 mb-2">Transit Walkability</div>
      <div className="space-y-1.5">
        {BANDS.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full border border-gray-300"
              style={{ backgroundColor: color, opacity: 0.6 }}
            />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
