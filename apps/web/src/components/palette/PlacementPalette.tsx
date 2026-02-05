/**
 * Placement palette for selecting and placing seeds.
 */

import { useCallback } from "react";
import { SEED_CATEGORIES, getSeedsByCategory, type SeedType } from "./types";
import { usePlacement } from "./PlacementContext";
import { PersonalitySliders } from "../build-view/PersonalitySliders";
import { DEFAULT_DISTRICT_PERSONALITY } from "../canvas/layers/types";

interface SeedButtonProps {
  seed: SeedType;
  isSelected: boolean;
  onClick: () => void;
}

function SeedButton({ seed, isSelected, onClick }: SeedButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center p-2 rounded-lg
        transition-colors duration-150
        ${
          isSelected
            ? "bg-blue-100 border-2 border-blue-500 text-blue-700"
            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        }
      `}
      title={seed.description}
    >
      <span className="text-xl" role="img" aria-label={seed.label}>
        {seed.icon}
      </span>
      <span className="text-xs mt-1 text-center leading-tight">{seed.label}</span>
    </button>
  );
}

export function PlacementPalette() {
  const {
    selectedSeed,
    selectSeed,
    isPlacing,
    cancelPlacing,
    placementPersonality,
    setPlacementPersonality,
  } = usePlacement();

  const handleSeedClick = useCallback(
    (seed: SeedType) => {
      if (selectedSeed?.id === seed.id) {
        // Clicking the same seed deselects it
        selectSeed(null);
      } else {
        selectSeed(seed);
      }
    },
    [selectedSeed, selectSeed]
  );

  // Check if the selected seed is a district type
  const isDistrictSeed = selectedSeed?.category === "district";

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 w-64">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Place</h3>
        {isPlacing && (
          <button
            onClick={cancelPlacing}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            Cancel (Esc)
          </button>
        )}
      </div>

      {selectedSeed && (
        <div className="mb-3 p-2 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">{selectedSeed.icon}</span>
            <div>
              <div className="text-sm font-medium text-blue-700">
                {selectedSeed.label}
              </div>
              <div className="text-xs text-blue-600">Click on map to place</div>
            </div>
          </div>
        </div>
      )}

      {/* Show personality sliders when a district seed is selected */}
      {isDistrictSeed && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg">
          <h4 className="text-xs font-medium text-gray-600 mb-2">
            District Personality
          </h4>
          <PersonalitySliders
            values={placementPersonality ?? DEFAULT_DISTRICT_PERSONALITY}
            onChange={setPlacementPersonality}
            compact
          />
        </div>
      )}

      <div className="space-y-3">
        {SEED_CATEGORIES.map((category) => {
          const seeds = getSeedsByCategory(category.id);
          return (
            <div key={category.id}>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {category.label}
              </h4>
              <div className="grid grid-cols-3 gap-1.5">
                {seeds.map((seed) => (
                  <SeedButton
                    key={seed.id}
                    seed={seed}
                    isSelected={selectedSeed?.id === seed.id}
                    onClick={() => handleSeedClick(seed)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
