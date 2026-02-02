interface PopulationPanelProps {
  population: number;
  growthPercent: number;
}

export function PopulationPanel({ population, growthPercent }: PopulationPanelProps) {
  const isPositive = growthPercent >= 0;
  const formattedPopulation = population.toLocaleString();
  const formattedGrowth = `${isPositive ? "+" : ""}${growthPercent.toFixed(1)}%`;

  return (
    <div className="bg-white rounded-lg shadow-lg px-4 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">
          {formattedPopulation}
        </span>
        <span
          className={`text-sm font-medium ${
            isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {formattedGrowth}
        </span>
      </div>
      <div className="text-xs text-gray-500 uppercase">Population</div>
    </div>
  );
}
