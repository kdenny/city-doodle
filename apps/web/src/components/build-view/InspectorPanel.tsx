/**
 * Inspector panel for viewing and editing selected features.
 *
 * Shows properties of the selected district, road, or POI and allows editing.
 */

import { useState, useCallback, useMemo } from "react";
import { CollapsiblePersonalitySliders } from "./PersonalitySliders";
import type { DistrictPersonality, RoadClass, DistrictType } from "../canvas/layers/types";
import { DEFAULT_DISTRICT_PERSONALITY, DEFAULT_DENSITY_BY_TYPE } from "../canvas/layers/types";
import {
  canBeHistoric,
  getEraByYear,
  DEFAULT_ERA_YEAR,
  HISTORIC_THRESHOLD_YEAR,
} from "./EraSelector";
import { useTransitOptional } from "../canvas/TransitContext";

// Feature types that can be selected
export type SelectableFeatureType = "district" | "road" | "poi" | "neighborhood" | "rail_station" | "subway_station" | null;

export interface SelectedDistrict {
  type: "district";
  id: string;
  name: string;
  districtType: string;
  isHistoric: boolean;
  area?: number;
  population?: number;
  /** Per-district personality settings */
  personality?: DistrictPersonality;
  /** Grid orientation angle in radians */
  gridAngle?: number;
}

export interface SelectedRoad {
  type: "road";
  id: string;
  name?: string;
  roadClass: string;
  length?: number;
}

export interface SelectedPOI {
  type: "poi";
  id: string;
  name: string;
  poiType: string;
}

export interface SelectedNeighborhood {
  type: "neighborhood";
  id: string;
  name: string;
  labelColor?: string;
  accentColor?: string;
}

export interface SelectedRailStation {
  type: "rail_station";
  id: string;
  name: string;
  isTerminus: boolean;
  lineColor?: string;
}

export interface SelectedSubwayStation {
  type: "subway_station";
  id: string;
  name: string;
  isTerminus: boolean;
}

export interface SelectedCityLimits {
  type: "cityLimits";
  id: string;
  name: string;
  established?: number;
}

export type SelectedFeature = SelectedDistrict | SelectedRoad | SelectedPOI | SelectedNeighborhood | SelectedRailStation | SelectedSubwayStation | SelectedCityLimits | null;

interface InspectorPanelProps {
  selection: SelectedFeature;
  onUpdate?: (feature: SelectedFeature) => void;
  onDelete?: (feature: SelectedFeature) => void;
  onClose?: () => void;
  readOnly?: boolean;
}

// District type display names
const DISTRICT_TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  downtown: "Downtown",
  commercial: "Commercial",
  industrial: "Industrial",
  hospital: "Hospital",
  university: "University",
  k12: "School (K-12)",
  park: "Park",
  airport: "Airport",
};

// District types available for selection (ordered by common usage)
const DISTRICT_TYPE_OPTIONS = [
  "residential",
  "commercial",
  "downtown",
  "industrial",
  "park",
  "hospital",
  "university",
  "k12",
  "airport",
] as const;

// Road class display names
const ROAD_CLASS_LABELS: Record<string, string> = {
  highway: "Highway",
  arterial: "Arterial",
  collector: "Collector",
  local: "Local Street",
  trail: "Trail",
};

// POI type display names
const POI_TYPE_LABELS: Record<string, string> = {
  hospital: "Hospital",
  school: "School",
  university: "University",
  park: "Park",
  transit: "Transit Station",
  shopping: "Shopping",
  civic: "Civic",
  industrial: "Industrial",
};

export function InspectorPanel({
  selection,
  onUpdate,
  onDelete,
  onClose,
  readOnly,
}: InspectorPanelProps) {
  if (!selection) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 w-64">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Inspector</h3>
        <p className="text-sm text-gray-500 italic">
          Click on a feature to inspect it
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Inspector</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Close inspector"
          >
            ×
          </button>
        )}
      </div>

      {selection.type === "district" && (
        <DistrictInspector
          district={selection}
          onUpdate={readOnly ? undefined : onUpdate}
          onDelete={readOnly ? undefined : onDelete}
          readOnly={readOnly}
        />
      )}
      {selection.type === "road" && (
        <RoadInspector
          road={selection}
          onUpdate={readOnly ? undefined : onUpdate}
          onDelete={readOnly ? undefined : onDelete}
          readOnly={readOnly}
        />
      )}
      {selection.type === "poi" && (
        <POIInspector poi={selection} onUpdate={readOnly ? undefined : onUpdate} onDelete={readOnly ? undefined : onDelete} readOnly={readOnly} />
      )}
      {selection.type === "neighborhood" && (
        <NeighborhoodInspector neighborhood={selection} onUpdate={readOnly ? undefined : onUpdate} onDelete={readOnly ? undefined : onDelete} readOnly={readOnly} />
      )}
      {selection.type === "rail_station" && (
        <RailStationInspector station={selection} onDelete={readOnly ? undefined : onDelete} />
      )}
      {selection.type === "subway_station" && (
        <SubwayStationInspector station={selection} onDelete={readOnly ? undefined : onDelete} />
      )}
    </div>
  );
}

interface DistrictInspectorProps {
  district: SelectedDistrict;
  onUpdate?: (feature: SelectedFeature) => void;
  onDelete?: (feature: SelectedFeature) => void;
  readOnly?: boolean;
}

// Density presets for quick selection
const DENSITY_PRESETS = [
  { label: "Sparse", value: 2, description: "Rural/suburban" },
  { label: "Medium", value: 5, description: "Typical suburban" },
  { label: "Dense", value: 8, description: "Urban" },
  { label: "Max", value: 10, description: "Downtown core" },
] as const;

/** Convert radians to degrees */
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Convert degrees to radians */
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Normalize angle to -180 to 180 degrees */
function normalizeAngle(deg: number): number {
  while (deg > 180) deg -= 360;
  while (deg < -180) deg += 360;
  return deg;
}

function DistrictInspector({
  district,
  onUpdate,
  onDelete,
  readOnly,
}: DistrictInspectorProps) {
  // Get transit context to determine if transit stations exist
  const transitContext = useTransitOptional();
  const hasTransitStations =
    (transitContext?.railStations.length ?? 0) +
      (transitContext?.subwayStations.length ?? 0) >
    0;

  const [editedName, setEditedName] = useState(district.name);
  const [editedDistrictType, setEditedDistrictType] = useState<DistrictType>(
    district.districtType as DistrictType
  );
  const [isHistoric, setIsHistoric] = useState(district.isHistoric);
  const [personality, setPersonality] = useState<DistrictPersonality>(
    district.personality ?? DEFAULT_DISTRICT_PERSONALITY
  );
  // Grid angle in degrees for easier editing
  const [gridAngleDeg, setGridAngleDeg] = useState(
    district.gridAngle !== undefined ? radToDeg(district.gridAngle) : 0
  );

  // Get the type-specific default density
  const typeDefault = DEFAULT_DENSITY_BY_TYPE[district.districtType as DistrictType] ?? 5;
  const currentDensity = personality.density ?? typeDefault;

  // Check if the current era allows historic designation
  const eraYear = personality.era_year ?? DEFAULT_ERA_YEAR;
  const canMarkHistoric = canBeHistoric(eraYear);
  const currentEra = getEraByYear(eraYear);

  // Auto-disable historic flag if era is changed to a non-historic era
  useMemo(() => {
    if (!canMarkHistoric && isHistoric) {
      setIsHistoric(false);
      onUpdate?.({ ...district, isHistoric: false, personality });
    }
  }, [canMarkHistoric, isHistoric, district, onUpdate, personality]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setEditedName(newName);
      onUpdate?.({ ...district, name: newName });
    },
    [district, onUpdate]
  );

  const handleDensityChange = useCallback(
    (newDensity: number) => {
      const newPersonality = { ...personality, density: newDensity };
      setPersonality(newPersonality);
      onUpdate?.({ ...district, personality: newPersonality });
    },
    [district, personality, onUpdate]
  );

  const handleDistrictTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newType = e.target.value as DistrictType;
      setEditedDistrictType(newType);
      onUpdate?.({ ...district, districtType: newType });
    },
    [district, onUpdate]
  );

  const handleGridAngleChange = useCallback(
    (newAngleDeg: number) => {
      // Normalize to -180 to 180
      const normalized = normalizeAngle(newAngleDeg);
      setGridAngleDeg(normalized);
      const newAngleRad = degToRad(normalized);
      onUpdate?.({ ...district, gridAngle: newAngleRad });
    },
    [district, onUpdate]
  );

  const handleHistoricToggle = useCallback(() => {
    if (!canMarkHistoric) return;
    const newValue = !isHistoric;
    setIsHistoric(newValue);
    onUpdate?.({ ...district, isHistoric: newValue });
  }, [district, isHistoric, onUpdate, canMarkHistoric]);

  const handlePersonalityChange = useCallback(
    (newPersonality: DistrictPersonality) => {
      setPersonality(newPersonality);
      // If era changes to non-historic, auto-disable historic flag
      const newCanMarkHistoric = canBeHistoric(
        newPersonality.era_year ?? DEFAULT_ERA_YEAR
      );
      if (!newCanMarkHistoric && isHistoric) {
        setIsHistoric(false);
        onUpdate?.({
          ...district,
          personality: newPersonality,
          isHistoric: false,
        });
      } else {
        onUpdate?.({ ...district, personality: newPersonality });
      }
    },
    [district, onUpdate, isHistoric]
  );

  return (
    <div className="space-y-3">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white bg-blue-500 px-2 py-0.5 rounded">
          District
        </span>
      </div>

      {/* District type selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Type
        </label>
        <select
          value={editedDistrictType}
          onChange={handleDistrictTypeChange}
          disabled={readOnly}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="district-type-select"
        >
          {DISTRICT_TYPE_OPTIONS.map((districtType) => (
            <option key={districtType} value={districtType}>
              {DISTRICT_TYPE_LABELS[districtType] || districtType}
            </option>
          ))}
        </select>
      </div>

      {/* Name field */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Name
        </label>
        <input
          type="text"
          value={editedName}
          onChange={handleNameChange}
          disabled={readOnly}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Density slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-600">
            Density
          </label>
          <span className="text-xs text-gray-500">
            {currentDensity} / 10
            {currentDensity === typeDefault && " (default)"}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={currentDensity}
          onChange={(e) => handleDensityChange(Number(e.target.value))}
          disabled={readOnly}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="density-slider"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>Sparse</span>
          <span>Dense</span>
        </div>
        {/* Density presets */}
        <div className="flex gap-1 mt-2">
          {DENSITY_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleDensityChange(preset.value)}
              title={preset.description}
              className={`flex-1 px-1 py-0.5 text-xs rounded border transition-colors ${
                currentDensity === preset.value
                  ? "bg-blue-100 border-blue-400 text-blue-700"
                  : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {/* Type default indicator */}
        {currentDensity !== typeDefault && (
          <button
            onClick={() => handleDensityChange(typeDefault)}
            className="w-full mt-1 text-xs text-blue-600 hover:text-blue-800"
          >
            Reset to type default ({typeDefault})
          </button>
        )}
      </div>

      {/* Grid Orientation (CITY-151) */}
      {district.districtType !== "park" && district.districtType !== "airport" && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600">
              Grid Angle
            </label>
            <span className="text-xs text-gray-500">
              {Math.round(gridAngleDeg)}°
            </span>
          </div>
          <input
            type="range"
            min={-45}
            max={45}
            step={1}
            value={gridAngleDeg}
            onChange={(e) => handleGridAngleChange(Number(e.target.value))}
            disabled={readOnly}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="grid-angle-slider"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>-45°</span>
            <span>0°</span>
            <span>+45°</span>
          </div>
          {/* Quick angle presets */}
          <div className="flex gap-1 mt-2">
            {[
              { label: "-15°", value: -15 },
              { label: "0°", value: 0 },
              { label: "+15°", value: 15 },
              { label: "+45°", value: 45 },
            ].map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleGridAngleChange(preset.value)}
                className={`flex-1 px-1 py-0.5 text-xs rounded border transition-colors ${
                  Math.round(gridAngleDeg) === preset.value
                    ? "bg-blue-100 border-blue-400 text-blue-700"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Regenerates street grid with new orientation
          </p>
        </div>
      )}

      {/* Historic toggle with era-based validation */}
      <div className="relative group">
        <label
          className={`flex items-center gap-2 ${
            canMarkHistoric ? "cursor-pointer" : "cursor-not-allowed opacity-60"
          }`}
        >
          <input
            type="checkbox"
            checked={isHistoric}
            onChange={handleHistoricToggle}
            disabled={!canMarkHistoric || readOnly}
            className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
            data-testid="historic-checkbox"
          />
          <span className="text-sm text-gray-600">Historic District</span>
          {isHistoric && <span className="text-xs text-amber-600">🏛️</span>}
        </label>
        {/* Tooltip explaining why historic is disabled */}
        {!canMarkHistoric && (
          <div
            className="absolute left-0 bottom-full mb-1 hidden group-hover:block
                       bg-gray-800 text-white text-xs rounded px-2 py-1 w-48 z-10"
            data-testid="historic-disabled-tooltip"
          >
            Historic designation is only available for eras before{" "}
            {HISTORIC_THRESHOLD_YEAR}. Current era:{" "}
            {currentEra?.label ?? "Unknown"} ({eraYear})
          </div>
        )}
      </div>

      {/* Personality Sliders */}
      <CollapsiblePersonalitySliders
        values={personality}
        onChange={handlePersonalityChange}
        compact
        isHistoric={isHistoric}
        hasTransitStations={hasTransitStations}
      />

      {/* Stats */}
      {(district.area || district.population) && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Statistics</p>
          {district.area && (
            <p className="text-sm text-gray-700">
              Area: {formatArea(district.area)}
            </p>
          )}
          {district.population && (
            <p className="text-sm text-gray-700">
              Population: {district.population.toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(district)}
          className="w-full mt-2 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
        >
          Delete District
        </button>
      )}
    </div>
  );
}

interface RoadInspectorProps {
  road: SelectedRoad;
  onUpdate?: (feature: SelectedFeature) => void;
  onDelete?: (feature: SelectedFeature) => void;
  readOnly?: boolean;
}

// Road classes available for selection
const ROAD_CLASS_OPTIONS: RoadClass[] = ["highway", "arterial", "collector", "local", "trail"];

function RoadInspector({ road, onUpdate, onDelete, readOnly }: RoadInspectorProps) {
  const [editedName, setEditedName] = useState(road.name || "");
  const [editedRoadClass, setEditedRoadClass] = useState<RoadClass>(road.roadClass as RoadClass);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setEditedName(newName);
      onUpdate?.({ ...road, name: newName || undefined });
    },
    [road, onUpdate]
  );

  const handleRoadClassChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newClass = e.target.value as RoadClass;
      setEditedRoadClass(newClass);
      onUpdate?.({ ...road, roadClass: newClass });
    },
    [road, onUpdate]
  );

  return (
    <div className="space-y-3">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white bg-gray-600 px-2 py-0.5 rounded">
          Road
        </span>
      </div>

      {/* Road class selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Classification
        </label>
        <select
          value={editedRoadClass}
          onChange={handleRoadClassChange}
          disabled={readOnly}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {ROAD_CLASS_OPTIONS.map((roadClass) => (
            <option key={roadClass} value={roadClass}>
              {ROAD_CLASS_LABELS[roadClass] || roadClass}
            </option>
          ))}
        </select>
      </div>

      {/* Name field */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Name
        </label>
        <input
          type="text"
          value={editedName}
          onChange={handleNameChange}
          placeholder="Unnamed road"
          disabled={readOnly}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Stats */}
      {road.length && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Statistics</p>
          <p className="text-sm text-gray-700">
            Length: {formatLength(road.length)}
          </p>
        </div>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(road)}
          className="w-full mt-2 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
        >
          Delete Road
        </button>
      )}
    </div>
  );
}

interface POIInspectorProps {
  poi: SelectedPOI;
  onUpdate?: (feature: SelectedFeature) => void;
  onDelete?: (feature: SelectedFeature) => void;
  readOnly?: boolean;
}

function POIInspector({ poi, onUpdate, onDelete, readOnly }: POIInspectorProps) {
  const [editedName, setEditedName] = useState(poi.name);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setEditedName(newName);
      onUpdate?.({ ...poi, name: newName });
    },
    [poi, onUpdate]
  );

  return (
    <div className="space-y-3">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white bg-green-600 px-2 py-0.5 rounded">
          POI
        </span>
        <span className="text-xs text-gray-500">
          {POI_TYPE_LABELS[poi.poiType] || poi.poiType}
        </span>
      </div>

      {/* Name field */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Name
        </label>
        <input
          type="text"
          value={editedName}
          onChange={handleNameChange}
          disabled={readOnly}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(poi)}
          className="w-full mt-2 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
        >
          Delete POI
        </button>
      )}
    </div>
  );
}

interface NeighborhoodInspectorProps {
  neighborhood: SelectedNeighborhood;
  onUpdate?: (feature: SelectedFeature) => void;
  onDelete?: (feature: SelectedFeature) => void;
  readOnly?: boolean;
}

function NeighborhoodInspector({ neighborhood, onUpdate, onDelete, readOnly }: NeighborhoodInspectorProps) {
  const [editedName, setEditedName] = useState(neighborhood.name);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setEditedName(newName);
      onUpdate?.({ ...neighborhood, name: newName });
    },
    [neighborhood, onUpdate]
  );

  return (
    <div className="space-y-3">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white bg-purple-500 px-2 py-0.5 rounded">
          Neighborhood
        </span>
      </div>

      {/* Name field */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Name
        </label>
        <input
          type="text"
          value={editedName}
          onChange={handleNameChange}
          disabled={readOnly}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(neighborhood)}
          className="w-full mt-2 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
        >
          Delete Neighborhood
        </button>
      )}
    </div>
  );
}

interface RailStationInspectorProps {
  station: SelectedRailStation;
  onDelete?: (feature: SelectedFeature) => void;
}

function RailStationInspector({ station, onDelete }: RailStationInspectorProps) {
  return (
    <div className="space-y-3">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white bg-orange-500 px-2 py-0.5 rounded">
          Rail Station
        </span>
        {station.isTerminus && (
          <span className="text-xs text-gray-500">Terminus</span>
        )}
      </div>

      {/* Name display */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Name
        </label>
        <p className="text-sm text-gray-700">{station.name}</p>
      </div>

      {/* Line color indicator */}
      {station.lineColor && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">Line Color:</span>
          <span
            className="w-4 h-4 rounded-full border border-gray-300"
            style={{ backgroundColor: station.lineColor }}
          />
        </div>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(station)}
          className="w-full mt-2 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
        >
          Delete Station
        </button>
      )}
    </div>
  );
}

interface SubwayStationInspectorProps {
  station: SelectedSubwayStation;
  onDelete?: (feature: SelectedFeature) => void;
}

function SubwayStationInspector({ station, onDelete }: SubwayStationInspectorProps) {
  return (
    <div className="space-y-3">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white bg-blue-600 px-2 py-0.5 rounded">
          Subway Station
        </span>
        {station.isTerminus && (
          <span className="text-xs text-gray-500">Terminus</span>
        )}
      </div>

      {/* Name display */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Name
        </label>
        <p className="text-sm text-gray-700">{station.name}</p>
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(station)}
          className="w-full mt-2 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
        >
          Delete Station
        </button>
      )}
    </div>
  );
}

// Helper functions
function formatArea(areaInSqUnits: number): string {
  if (areaInSqUnits >= 1_000_000) {
    return `${(areaInSqUnits / 1_000_000).toFixed(1)} sq mi`;
  }
  return `${areaInSqUnits.toLocaleString()} sq ft`;
}

function formatLength(lengthInUnits: number): string {
  if (lengthInUnits >= 5280) {
    return `${(lengthInUnits / 5280).toFixed(1)} mi`;
  }
  return `${lengthInUnits.toLocaleString()} ft`;
}

// Custom hook for managing selection state
export function useSelection() {
  const [selection, setSelection] = useState<SelectedFeature>(null);

  const selectFeature = useCallback((feature: SelectedFeature) => {
    setSelection(feature);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  return {
    selection,
    selectFeature,
    clearSelection,
  };
}
