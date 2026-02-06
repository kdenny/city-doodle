/**
 * Modal showing detailed city needs analysis.
 * Shows district balance, infrastructure gaps, and suggested next steps.
 */

import { useMemo } from "react";
import { useFeaturesOptional } from "../canvas";
import type { DistrictType } from "../canvas/layers/types";
import type { CityNeeds, NeedLevel } from "./CityNeedsPanel";

interface CityNeedsModalProps {
  needs: CityNeeds;
  onClose: () => void;
}

// District type display info
const DISTRICT_INFO: Record<
  DistrictType,
  { label: string; color: string; category: "residential" | "commercial" | "civic" | "industrial" | "recreation" }
> = {
  residential: { label: "Residential", color: "#4ade80", category: "residential" },
  downtown: { label: "Downtown", color: "#60a5fa", category: "commercial" },
  commercial: { label: "Commercial", color: "#f97316", category: "commercial" },
  industrial: { label: "Industrial", color: "#a3a3a3", category: "industrial" },
  hospital: { label: "Hospital", color: "#f43f5e", category: "civic" },
  university: { label: "University", color: "#8b5cf6", category: "civic" },
  k12: { label: "K-12 School", color: "#eab308", category: "civic" },
  park: { label: "Park", color: "#22c55e", category: "recreation" },
  airport: { label: "Airport", color: "#71717a", category: "industrial" },
};

const NEED_LEVEL_INFO: Record<NeedLevel, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-green-600", bgColor: "bg-green-100" },
  medium: { label: "Medium", color: "text-yellow-600", bgColor: "bg-yellow-100" },
  high: { label: "High", color: "text-orange-600", bgColor: "bg-orange-100" },
  critical: { label: "Critical", color: "text-red-600", bgColor: "bg-red-100" },
};

// Ideal ratios for a balanced city (approximate)
const IDEAL_RATIOS = {
  residential: 0.4,
  commercial: 0.25,
  civic: 0.15,
  industrial: 0.1,
  recreation: 0.1,
};

export function CityNeedsModal({ needs, onClose }: CityNeedsModalProps) {
  const featuresContext = useFeaturesOptional();
  const districts = featuresContext?.features.districts ?? [];

  // Calculate district type counts
  const districtCounts = useMemo(() => {
    const counts: Record<DistrictType, number> = {
      residential: 0,
      downtown: 0,
      commercial: 0,
      industrial: 0,
      hospital: 0,
      university: 0,
      k12: 0,
      park: 0,
      airport: 0,
    };
    for (const district of districts) {
      counts[district.type]++;
    }
    return counts;
  }, [districts]);

  // Calculate category ratios
  const categoryRatios = useMemo(() => {
    const total = districts.length || 1;
    const categoryCounts = {
      residential: districtCounts.residential,
      commercial: districtCounts.downtown + districtCounts.commercial,
      civic: districtCounts.hospital + districtCounts.university + districtCounts.k12,
      industrial: districtCounts.industrial + districtCounts.airport,
      recreation: districtCounts.park,
    };
    return {
      residential: categoryCounts.residential / total,
      commercial: categoryCounts.commercial / total,
      civic: categoryCounts.civic / total,
      industrial: categoryCounts.industrial / total,
      recreation: categoryCounts.recreation / total,
    };
  }, [districts.length, districtCounts]);

  // Generate suggestions based on current state
  const suggestions = useMemo(() => {
    const items: { priority: "high" | "medium" | "low"; text: string }[] = [];

    if (districts.length === 0) {
      items.push({ priority: "high", text: "Start by placing a residential district" });
      return items;
    }

    // Check category balance
    if (categoryRatios.residential < IDEAL_RATIOS.residential * 0.5) {
      items.push({ priority: "high", text: "Add more residential districts for housing" });
    }
    if (categoryRatios.commercial < IDEAL_RATIOS.commercial * 0.5 && districts.length >= 2) {
      items.push({ priority: "medium", text: "Consider adding commercial or downtown districts for jobs" });
    }
    if (categoryRatios.civic === 0 && districts.length >= 3) {
      items.push({ priority: "medium", text: "Add civic facilities like schools or hospitals" });
    }
    if (categoryRatios.recreation === 0 && districts.length >= 4) {
      items.push({ priority: "low", text: "Parks improve quality of life for residents" });
    }

    // Check specific needs
    if (needs.housing === "critical" || needs.housing === "high") {
      items.push({ priority: "high", text: "Housing demand is high - add residential districts" });
    }
    if (needs.health === "critical" || needs.health === "high") {
      items.push({ priority: "high", text: "Healthcare access is limited - add a hospital" });
    }

    if (items.length === 0) {
      items.push({ priority: "low", text: "Your city is well-balanced! Keep growing." });
    }

    return items;
  }, [districts.length, categoryRatios, needs]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">City Needs</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Current Needs Status */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">
              Current Status
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(needs) as [keyof CityNeeds, NeedLevel][]).map(([key, level]) => (
                <div
                  key={key}
                  className={`${NEED_LEVEL_INFO[level].bgColor} rounded-lg p-3`}
                >
                  <div className="text-sm font-medium text-gray-700 capitalize">{key}</div>
                  <div className={`text-lg font-semibold ${NEED_LEVEL_INFO[level].color}`}>
                    {NEED_LEVEL_INFO[level].label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* District Balance */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">
              District Balance
            </h3>
            {districts.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No districts placed yet</p>
            ) : (
              <div className="space-y-2">
                {(Object.entries(districtCounts) as [DistrictType, number][])
                  .filter(([, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: DISTRICT_INFO[type].color }}
                      />
                      <span className="text-sm text-gray-700 flex-1">
                        {DISTRICT_INFO[type].label}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                      <span className="text-sm text-gray-500 w-12 text-right">
                        {Math.round((count / districts.length) * 100)}%
                      </span>
                    </div>
                  ))}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3" />
                    <span className="text-sm font-medium text-gray-700 flex-1">Total</span>
                    <span className="text-sm font-medium text-gray-900">{districts.length}</span>
                    <span className="text-sm text-gray-500 w-12 text-right">100%</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Suggestions */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">
              Suggestions
            </h3>
            <ul className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      suggestion.priority === "high"
                        ? "bg-red-500"
                        : suggestion.priority === "medium"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                  />
                  <span className="text-gray-600">{suggestion.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
