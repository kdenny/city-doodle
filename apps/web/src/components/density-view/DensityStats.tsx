export interface DensityStatistics {
  totalArea: number;
  population: number;
  density: number;
}

interface DensityStatsProps {
  stats: DensityStatistics;
}

export function DensityStats({ stats }: DensityStatsProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Statistics</h3>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Area</span>
          <span className="font-medium text-gray-900">
            {stats.totalArea.toLocaleString()} sq mi
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Population</span>
          <span className="font-medium text-gray-900">
            {stats.population.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Density</span>
          <span className="font-medium text-gray-900">
            {stats.density.toLocaleString()}/sq mi
          </span>
        </div>
      </div>
    </div>
  );
}

export const defaultDensityStats: DensityStatistics = {
  totalArea: 42,
  population: 125000,
  density: 2976,
};
