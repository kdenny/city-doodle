/**
 * Era selector component for choosing the architectural era of a district.
 *
 * Replaces the 0-1 Historic↔Modern slider with a year-based selection
 * that shows era names instead of numbers.
 */

import { useCallback, useState } from "react";

/**
 * Represents a historical era with its year value and display characteristics.
 */
export interface Era {
  /** The year value (used internally for generation params) */
  year: number;
  /** Display label shown in the UI */
  label: string;
  /** Detailed description shown in tooltips */
  description: string;
  /** Characteristics of architecture from this era */
  characteristics: string[];
}

/**
 * Ordered list of available eras from oldest to newest.
 * Years are selected based on distinct architectural periods.
 */
export const ERAS: Era[] = [
  {
    year: 1200,
    label: "Medieval",
    description: "12th Century",
    characteristics: [
      "Narrow winding streets",
      "Dense irregular blocks",
      "Stone and timber construction",
    ],
  },
  {
    year: 1300,
    label: "Medieval",
    description: "13th Century",
    characteristics: [
      "Fortified centers",
      "Market squares",
      "Guild halls",
    ],
  },
  {
    year: 1400,
    label: "Medieval",
    description: "14th Century",
    characteristics: [
      "Gothic architecture",
      "Cathedral districts",
      "Expanded trade routes",
    ],
  },
  {
    year: 1500,
    label: "Renaissance",
    description: "15th Century",
    characteristics: [
      "Classical influences",
      "Planned piazzas",
      "Formal gardens",
    ],
  },
  {
    year: 1600,
    label: "Colonial",
    description: "17th Century",
    characteristics: [
      "Grid-oriented planning",
      "Central squares",
      "Colonial architecture",
    ],
  },
  {
    year: 1700,
    label: "Georgian",
    description: "18th Century",
    characteristics: [
      "Symmetrical facades",
      "Brick construction",
      "Wide avenues",
    ],
  },
  {
    year: 1800,
    label: "Early Industrial",
    description: "Early 19th Century",
    characteristics: [
      "Factory districts",
      "Row houses",
      "Canal-side development",
    ],
  },
  {
    year: 1850,
    label: "Victorian",
    description: "Mid-19th Century",
    characteristics: [
      "Ornate facades",
      "Rail-oriented growth",
      "Dense urban cores",
    ],
  },
  {
    year: 1875,
    label: "Late Victorian",
    description: "Gilded Age",
    characteristics: [
      "Brownstones",
      "Horse-drawn transit",
      "Mixed-use blocks",
    ],
  },
  {
    year: 1900,
    label: "Streetcar Era",
    description: "Turn of the Century",
    characteristics: [
      "Streetcar suburbs",
      "Small lot development",
      "Corner stores",
    ],
  },
  {
    year: 1920,
    label: "Jazz Age",
    description: "Roaring Twenties",
    characteristics: [
      "Art Deco buildings",
      "Apartment blocks",
      "Early automobile influence",
    ],
  },
  {
    year: 1940,
    label: "Mid-Century",
    description: "Post-War Era",
    characteristics: [
      "Garden suburbs",
      "Early highways",
      "Modernist architecture",
    ],
  },
  {
    year: 1960,
    label: "Car Suburbs",
    description: "1960s",
    characteristics: [
      "Suburban sprawl",
      "Shopping centers",
      "Cul-de-sacs",
    ],
  },
  {
    year: 1980,
    label: "Late Suburban",
    description: "1980s",
    characteristics: [
      "Strip malls",
      "Office parks",
      "Highway interchange development",
    ],
  },
  {
    year: 2024,
    label: "Contemporary",
    description: "Present Day",
    characteristics: [
      "Mixed-use development",
      "Transit-oriented design",
      "Sustainable construction",
    ],
  },
];

/**
 * The threshold year for enabling the "Historic District" flag.
 * Districts from eras before this year can be marked as historic.
 */
export const HISTORIC_THRESHOLD_YEAR = 1940;

/**
 * Default era for new districts (Contemporary).
 */
export const DEFAULT_ERA_YEAR = 2024;

/**
 * Find an era by its year value.
 */
export function getEraByYear(year: number): Era | undefined {
  return ERAS.find((era) => era.year === year);
}

/**
 * Get the index of an era in the ERAS array by year.
 */
export function getEraIndexByYear(year: number): number {
  const index = ERAS.findIndex((era) => era.year === year);
  return index === -1 ? ERAS.length - 1 : index;
}

/**
 * Check if a year qualifies for historic district status.
 */
export function canBeHistoric(year: number): boolean {
  return year < HISTORIC_THRESHOLD_YEAR;
}

/**
 * Convert a 0-1 slider value to the closest era year (for migration).
 */
export function sliderValueToEraYear(value: number): number {
  // Map 0-1 to index in ERAS array
  const index = Math.round(value * (ERAS.length - 1));
  return ERAS[index].year;
}

/**
 * Convert an era year to a 0-1 slider value (for compatibility with existing system).
 */
export function eraYearToSliderValue(year: number): number {
  const index = getEraIndexByYear(year);
  return index / (ERAS.length - 1);
}

interface EraSelectorProps {
  /** Current era year value */
  value: number;
  /** Callback when era changes */
  onChange: (year: number) => void;
  /** Optional: compact mode for smaller display */
  compact?: boolean;
  /** Optional: disable the selector */
  disabled?: boolean;
}

export function EraSelector({
  value,
  onChange,
  compact = false,
  disabled = false,
}: EraSelectorProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const currentIndex = getEraIndexByYear(value);
  const currentEra = ERAS[currentIndex];

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const index = parseInt(e.target.value, 10);
      onChange(ERAS[index].year);
    },
    [onChange]
  );

  const handleMouseEnter = useCallback(() => {
    setIsTooltipVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  return (
    <div
      className={compact ? "space-y-0.5" : "space-y-1"}
      data-testid="era-selector"
    >
      <div className="flex justify-between items-center">
        <span
          className={`font-medium ${
            compact ? "text-xs text-gray-500" : "text-xs text-gray-600"
          }`}
        >
          Era
        </span>
        <span
          className={`font-medium ${
            compact ? "text-xs text-gray-500" : "text-xs text-gray-600"
          }`}
          data-testid="era-label"
        >
          {currentEra.label}
        </span>
      </div>
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <input
          type="range"
          min="0"
          max={ERAS.length - 1}
          step="1"
          value={currentIndex}
          onChange={handleSliderChange}
          disabled={disabled}
          className={`
            w-full cursor-pointer
            accent-amber-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${compact ? "h-1" : "h-2"}
          `}
          aria-label={`Era: ${currentEra.label} (${currentEra.description})`}
          data-testid="era-slider"
        />
        {/* Tooltip */}
        {isTooltipVisible && !disabled && (
          <div
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
                       bg-gray-800 text-white text-xs rounded-lg p-2 w-48 z-10 shadow-lg"
            data-testid="era-tooltip"
          >
            <p className="font-semibold">{currentEra.label}</p>
            <p className="text-gray-300">{currentEra.description}</p>
            <ul className="mt-1 text-gray-300">
              {currentEra.characteristics.map((char, i) => (
                <li key={i} className="text-xs">
                  - {char}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {!compact && (
        <p className="text-xs text-gray-400 text-center">
          {currentEra.description}
        </p>
      )}
    </div>
  );
}
