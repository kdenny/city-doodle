/**
 * Inspector panel for viewing and editing selected features.
 *
 * Shows properties of the selected district, road, or POI and allows editing.
 */

import { useState, useCallback } from "react";
import { CollapsiblePersonalitySliders } from "./PersonalitySliders";
import type { DistrictPersonality } from "../canvas/layers/types";
import { DEFAULT_DISTRICT_PERSONALITY } from "../canvas/layers/types";

// Feature types that can be selected
export type SelectableFeatureType = "district" | "road" | "poi" | null;

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

export type SelectedFeature = SelectedDistrict | SelectedRoad | SelectedPOI | null;

interface InspectorPanelProps {
  selection: SelectedFeature;
  onUpdate?: (feature: SelectedFeature) => void;
  onDelete?: (feature: SelectedFeature) => void;
  onClose?: () => void;
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
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
      {selection.type === "road" && (
        <RoadInspector
          road={selection}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
      {selection.type === "poi" && (
        <POIInspector poi={selection} onUpdate={onUpdate} onDelete={onDelete} />
      )}
    </div>
  );
}

interface DistrictInspectorProps {
  district: SelectedDistrict;
  onUpdate?: (feature: SelectedFeature) => void;
  onDelete?: (feature: SelectedFeature) => void;
}

function DistrictInspector({
  district,
  onUpdate,
  onDelete,
}: DistrictInspectorProps) {
  const [editedName, setEditedName] = useState(district.name);
  const [isHistoric, setIsHistoric] = useState(district.isHistoric);
  const [personality, setPersonality] = useState<DistrictPersonality>(
    district.personality ?? DEFAULT_DISTRICT_PERSONALITY
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setEditedName(newName);
      onUpdate?.({ ...district, name: newName });
    },
    [district, onUpdate]
  );

  const handleHistoricToggle = useCallback(() => {
    const newValue = !isHistoric;
    setIsHistoric(newValue);
    onUpdate?.({ ...district, isHistoric: newValue });
  }, [district, isHistoric, onUpdate]);

  const handlePersonalityChange = useCallback(
    (newPersonality: DistrictPersonality) => {
      setPersonality(newPersonality);
      onUpdate?.({ ...district, personality: newPersonality });
    },
    [district, onUpdate]
  );

  return (
    <div className="space-y-3">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white bg-blue-500 px-2 py-0.5 rounded">
          District
        </span>
        <span className="text-xs text-gray-500">
          {DISTRICT_TYPE_LABELS[district.districtType] || district.districtType}
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
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Historic toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isHistoric}
          onChange={handleHistoricToggle}
          className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        <span className="text-sm text-gray-600">Historic District</span>
        {isHistoric && (
          <span className="text-xs text-amber-600">🏛️</span>
        )}
      </label>

      {/* Personality Sliders */}
      <CollapsiblePersonalitySliders
        values={personality}
        onChange={handlePersonalityChange}
        compact
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
}

function RoadInspector({ road, onUpdate, onDelete }: RoadInspectorProps) {
  const [editedName, setEditedName] = useState(road.name || "");

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setEditedName(newName);
      onUpdate?.({ ...road, name: newName || undefined });
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
        <span className="text-xs text-gray-500">
          {ROAD_CLASS_LABELS[road.roadClass] || road.roadClass}
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
          placeholder="Unnamed road"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
}

function POIInspector({ poi, onUpdate, onDelete }: POIInspectorProps) {
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
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
