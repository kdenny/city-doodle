import { ReactNode } from "react";
import { LandUseLegend } from "./LandUseLegend";
import { WalkabilityLegend } from "./WalkabilityLegend";
import { DensityStats, DensityStatistics, defaultDensityStats } from "./DensityStats";

interface DensityViewProps {
  children: ReactNode;
  stats?: DensityStatistics;
}

export function DensityView({
  children,
  stats = defaultDensityStats,
}: DensityViewProps) {
  return (
    <div className="relative w-full h-full">
      {/* Map content (with density color overlay) */}
      <div className="absolute inset-0 density-view-overlay">
        {children}
      </div>

      {/* Legends (right) */}
      <div className="absolute top-4 right-4 space-y-2">
        <LandUseLegend />
        <WalkabilityLegend />
      </div>

      {/* Statistics panel (bottom-right) */}
      <div className="absolute bottom-4 right-4">
        <DensityStats stats={stats} />
      </div>

      {/* Note: No build tools visible - read-only view */}
      {/* Note: No timelapse controls */}
    </div>
  );
}
