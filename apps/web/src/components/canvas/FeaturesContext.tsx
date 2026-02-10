/**
 * Context for managing features data (districts, roads, POIs).
 *
 * Provides methods to add, remove, and update features. Districts can be
 * added with auto-generated street grids when seeds are placed.
 *
 * When a worldId is provided, districts are persisted to the backend API.
 *
 * ## Street Data Flow (CITY-377, CITY-382, CITY-383 documentation)
 *
 * ### Generation (district placement)
 * 1. `generateDistrictGeometry()` creates the district polygon
 * 2. `generateStreetGrid()` fills the polygon with a rotated grid of H+V streets
 *    - Each street is clipped to the polygon boundary (endpoints on boundary)
 *    - Streets get roadClass "local" or "collector" based on hierarchy rules
 * 3. `generateInterDistrictRoads()` creates arterial/highway links to nearby districts
 * 4. `generateCrossBoundaryConnections()` (CITY-382) bridges collector streets at
 *    shared boundaries between adjacent districts
 * 5. All roads are optimistically added to `featuresState.roads`
 *
 * ### Persistence (dual storage)
 * - **street_grid JSONB**: Serialized to `district.street_grid` field (roads array
 *   with flattened points, gridAngle, personality). This is the authoritative source
 *   for district-internal streets.
 * - **road_network graph**: Roads also saved as nodes+edges via `roadsToGraph()`.
 *   This graph is used for routing and inter-district roads. IDs differ from
 *   street_grid (graph uses API-generated UUIDs, street_grid uses client-generated
 *   temp IDs that get remapped on success).
 *
 * ### Loading (page load / refetch)
 * - **Effect 1** (apiDistricts): Deserializes `street_grid` JSONB back to Road[]
 *   via `roadsFromApiStreetGrid()`. Also backfills streets for legacy districts
 *   with null street_grid (CITY-383).
 * - **Effect 2** (apiRoadNetwork): Loads graph roads via `graphToRoads()`, merges
 *   with street_grid roads (IDs don't overlap, so both are kept).
 *
 * ### Rendering
 * `FeaturesLayer.renderRoads()` draws all roads with class-based styling.
 * See FeaturesLayer.ts header for rendering pipeline details.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import type { District, Neighborhood, CityLimits, Road, POI, FeaturesData, Point, DistrictPersonality, RoadClass, Interchange } from "./layers";
import { DEFAULT_DISTRICT_PERSONALITY, DEFAULT_DENSITY_BY_TYPE } from "./layers/types";
import type { DistrictType } from "./layers/types";
import { detectBridges } from "./layers/bridgeDetection";
import {
  generateDistrictGeometry,
  clipDistrictAgainstExisting,
  regenerateStreetGridForClippedDistrict,
  regenerateStreetGridWithAngle,
  seedIdToDistrictType,
  type DistrictGenerationConfig,
  type GeneratedDistrict,
} from "./layers/districtGenerator";
import type { NamingContext, NearbyContext } from "../../utils/nameGenerator";
import {
  clipAndValidateDistrict,
  clipPolygonToWorldBounds,
  pointInPolygon,
  riverFeatureToWaterFeature,
  type ClipResult,
} from "./layers/polygonUtils";
import { generateInterDistrictRoads, generateCrossBoundaryConnections, generateStationAccessRoad } from "./layers/interDistrictRoads";
import {
  districtRequiresArterialAdjacency,
  generateArterialConnections,
} from "./layers/poiArterialValidator";
import { generatePOIsForDistrict, generatePOIFootprint, generateCampusPaths } from "./layers/poiAutoGenerator";
import { generateParkFeaturesForDistrict } from "./layers/parkGenerator";
import { generateAirportFeaturesForDistrict } from "./layers/airportGenerator";
import { useTerrainOptional } from "./TerrainContext";
import { useTransitOptional } from "./TransitContext";
import { useToastOptional } from "../../contexts";

/** CITY-384: Distance from a point to a line segment. */
function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
}

/**
 * Extended config that includes personality settings for the district.
 */
interface AddDistrictConfig extends DistrictGenerationConfig {
  /** Personality settings to apply to the district */
  personality?: DistrictPersonality;
  /**
   * Explicit seed for random generation.
   * When provided, ensures deterministic results.
   * Same seed + settings = same district geometry.
   */
  seed?: number;
}
import {
  useWorld,
  useWorldDistricts,
  useCreateDistrict,
  useUpdateDistrict,
  useDeleteDistrict,
  useWorldNeighborhoods,
  useCreateNeighborhood,
  useUpdateNeighborhood,
  useDeleteNeighborhood,
  useWorldPOIs,
  useCreatePOI,
  useCreatePOIsBulk,
  useUpdatePOI,
  useDeletePOI,
  useRoadNetwork,
  useCreateRoadNodesBulk,
  useCreateRoadEdgesBulk,
  useUpdateRoadEdge,
  useDeleteRoadEdge,
  useWorldCityLimits,
  useUpsertCityLimits,
  useDeleteCityLimits,
} from "../../api/hooks";
import type {
  District as ApiDistrict,
  DistrictType as ApiDistrictType,
  Neighborhood as ApiNeighborhood,
  POI as ApiPOI,
  RoadNetwork as ApiRoadNetwork,
  RoadNode as ApiRoadNode,
  RoadNodeCreate,
  RoadEdgeCreate,
  RoadEdgeUpdate,
  RoadClass as ApiRoadClass,
} from "../../api/types";

/**
 * Result of adding a district, includes clipping info if water overlap occurred.
 */
export interface AddDistrictResult {
  /** The generated district and roads (null if placement failed) */
  generated: GeneratedDistrict | null;
  /** Whether the district was clipped due to water overlap */
  wasClipped: boolean;
  /** Clipping details if water overlap occurred */
  clipResult?: ClipResult;
  /** Error message if placement failed */
  error?: string;
}

/**
 * Read-only state provided by FeaturesStateContext.
 * Consumers that only read features data should use useFeaturesState()
 * to avoid re-renders when mutation methods are recreated.
 */
export interface FeaturesStateValue {
  /** Current features data */
  features: FeaturesData;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Dispatch methods provided by FeaturesDispatchContext.
 * These are memoized independently from state, so consumers that only
 * call methods (e.g., SelectionWithFeatures) won't re-render on data changes.
 */
export interface FeaturesDispatchValue {
  /** Add a district at a position (generates geometry automatically) */
  addDistrict: (
    position: { x: number; y: number },
    seedId: string,
    config?: AddDistrictConfig
  ) => AddDistrictResult;
  /** Preview district placement to check for water clipping */
  previewDistrictPlacement: (
    position: { x: number; y: number },
    seedId: string,
    config?: AddDistrictConfig
  ) => ClipResult | null;
  /** Add a district with explicit geometry */
  addDistrictWithGeometry: (district: District, roads?: Road[]) => void;
  /** Add a POI */
  addPOI: (poi: POI) => void;
  /** Append roads to local state (does not persist — caller handles API sync). */
  addRoads: (roads: Road[]) => void;
  /** Add interchanges (auto-detected at highway-road crossings) */
  addInterchanges: (interchanges: Interchange[]) => void;
  /** Remove a district by ID */
  removeDistrict: (id: string) => void;
  /** Optimistically remove a road by ID. Persists deletion to API and rolls back on failure. */
  removeRoad: (id: string) => void;
  /** Remove a POI by ID */
  removePOI: (id: string) => void;
  /** Update a POI */
  updatePOI: (id: string, updates: Partial<Omit<POI, "id">>) => void;
  /** Update a district */
  updateDistrict: (id: string, updates: Partial<Omit<District, "id">>) => void;
  /** Optimistically update a road's properties. Persists to API and rolls back on failure. */
  updateRoad: (id: string, updates: Partial<Omit<Road, "id">>) => void;
  /** Add a neighborhood with explicit geometry */
  addNeighborhood: (neighborhood: Neighborhood) => void;
  /** Remove a neighborhood by ID */
  removeNeighborhood: (id: string) => void;
  /** Update a neighborhood */
  updateNeighborhood: (id: string, updates: Partial<Omit<Neighborhood, "id">>) => void;
  /** Set the city limits boundary (only one per world) */
  setCityLimits: (cityLimits: CityLimits) => void;
  /** Remove the city limits boundary */
  removeCityLimits: () => void;
  /** Clear all features */
  clearFeatures: () => void;
  /** Set all features data at once */
  setFeatures: (data: FeaturesData) => void;
}

/** Combined interface for backward compatibility (useFeatures / useFeaturesOptional). */
interface FeaturesContextValue extends FeaturesStateValue, FeaturesDispatchValue {}

const FeaturesStateContext = createContext<FeaturesStateValue | null>(null);
const FeaturesDispatchContext = createContext<FeaturesDispatchValue | null>(null);

// Legacy single context — kept only so old useFeatures/useFeaturesOptional wrappers work.
const FeaturesContext = createContext<FeaturesContextValue | null>(null);

interface FeaturesProviderProps {
  children: ReactNode;
  /** World ID for persisting districts to the backend */
  worldId?: string;
  /** Initial features data */
  initialFeatures?: FeaturesData;
  /** Callback when features change */
  onFeaturesChange?: (features: FeaturesData) => void;
}

const EMPTY_FEATURES: FeaturesData = {
  districts: [],
  roads: [],
  pois: [],
  neighborhoods: [],
  bridges: [],
};

/**
 * Map world-level historic_modern (0-1) to an era_year.
 * 0 = historic preservation (1700), 0.5 = mid-century (1960), 1 = modern (2024).
 */
const ERA_YEAR_STEPS = [1700, 1800, 1850, 1875, 1900, 1920, 1940, 1960, 1980, 2024];
function historicModernToEraYear(historicModern: number): number {
  const idx = Math.round(historicModern * (ERA_YEAR_STEPS.length - 1));
  return ERA_YEAR_STEPS[Math.min(idx, ERA_YEAR_STEPS.length - 1)];
}

/**
 * Build default district personality from world settings.
 * Falls back to DEFAULT_DISTRICT_PERSONALITY for any missing values.
 */
function worldSettingsToPersonality(
  settings: { grid_organic?: number; sprawl_compact?: number; transit_car?: number; historic_modern?: number } | undefined
): DistrictPersonality {
  if (!settings) return DEFAULT_DISTRICT_PERSONALITY;
  return {
    grid_organic: settings.grid_organic ?? DEFAULT_DISTRICT_PERSONALITY.grid_organic,
    sprawl_compact: settings.sprawl_compact ?? DEFAULT_DISTRICT_PERSONALITY.sprawl_compact,
    transit_car: settings.transit_car ?? DEFAULT_DISTRICT_PERSONALITY.transit_car,
    era_year: settings.historic_modern !== undefined
      ? historicModernToEraYear(settings.historic_modern)
      : DEFAULT_DISTRICT_PERSONALITY.era_year,
    density: DEFAULT_DISTRICT_PERSONALITY.density,
  };
}

/**
 * Map frontend district type to API district type.
 * Frontend and API use the same types now.
 */
function toApiDistrictType(frontendType: string): ApiDistrictType {
  // API accepts frontend types directly
  const validTypes: ApiDistrictType[] = [
    "residential", "downtown", "commercial", "industrial",
    "hospital", "university", "k12", "park", "airport"
  ];
  if (validTypes.includes(frontendType as ApiDistrictType)) {
    return frontendType as ApiDistrictType;
  }
  return "commercial"; // Default fallback
}

/**
 * Map API district type back to frontend type.
 * Frontend and API use the same types now.
 */
function fromApiDistrictType(apiType: ApiDistrictType): string {
  // API returns frontend types directly
  return apiType;
}

/**
 * Convert frontend polygon to GeoJSON geometry.
 */
function toGeoJsonGeometry(points: Point[]): Record<string, unknown> {
  // Close the polygon if not already closed
  const coords = points.map((p) => [p.x, p.y]);
  if (
    coords.length > 0 &&
    (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1])
  ) {
    coords.push([coords[0][0], coords[0][1]]);
  }
  return {
    type: "Polygon",
    coordinates: [coords],
  };
}

/**
 * Convert GeoJSON geometry to frontend polygon points.
 */
function fromGeoJsonGeometry(geometry: Record<string, unknown>): Point[] {
  if (geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) {
    return [];
  }
  const coords = geometry.coordinates[0] as number[][];
  if (!Array.isArray(coords)) return [];
  // Remove the closing point if present
  const points = coords.map((c) => ({ x: c[0], y: c[1] }));
  if (
    points.length > 1 &&
    points[0].x === points[points.length - 1].x &&
    points[0].y === points[points.length - 1].y
  ) {
    points.pop();
  }
  return points;
}

/**
 * Convert API district to frontend district.
 * Restores gridAngle and personality from the persisted street_grid JSONB.
 */
function fromApiDistrict(apiDistrict: ApiDistrict): District {
  const streetGrid = apiDistrict.street_grid as Record<string, unknown> | undefined;

  // Restore park ponds from persisted street_grid (CITY-378)
  let ponds: import("./layers").Polygon[] | undefined;
  if (streetGrid?.ponds && Array.isArray(streetGrid.ponds)) {
    ponds = (streetGrid.ponds as Array<{ points: Array<{ x: number; y: number }> }>).map(
      (p) => ({ points: p.points.map((pt) => ({ x: pt.x, y: pt.y })) })
    );
  }

  return {
    id: apiDistrict.id,
    type: fromApiDistrictType(apiDistrict.type) as District["type"],
    name: apiDistrict.name || `${apiDistrict.type} district`,
    polygon: { points: fromGeoJsonGeometry(apiDistrict.geometry) },
    isHistoric: apiDistrict.historic,
    gridAngle: typeof streetGrid?.gridAngle === "number" ? streetGrid.gridAngle : undefined,
    personality: streetGrid?.personality as District["personality"] | undefined,
    ponds,
    fillColor: apiDistrict.fill_color ?? undefined,
  };
}

/**
 * Extract roads from an API district's persisted street_grid JSON blob.
 *
 * The street_grid field stores the serialized output of `generateStreetGrid`
 * (road IDs, classes, and point arrays). This function deserializes that back
 * into frontend Road objects, falling back to the district's own ID for
 * `districtId` if the stored data predates the districtId field.
 *
 * @param apiDistrict - API district object whose `street_grid` may contain roads
 * @returns Array of Road objects (empty if no street_grid data)
 */
function roadsFromApiStreetGrid(apiDistrict: ApiDistrict): Road[] {
  const streetGrid = apiDistrict.street_grid as Record<string, unknown> | undefined;
  if (!streetGrid?.roads || !Array.isArray(streetGrid.roads)) return [];
  return (streetGrid.roads as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    name: r.name as string | undefined,
    roadClass: (r.roadClass as RoadClass) || "local",
    line: {
      points: (r.points as Array<{ x: number; y: number }>).map((p) => ({
        x: p.x,
        y: p.y,
      })),
    },
    districtId: (r.districtId as string | undefined) || apiDistrict.id,
  }));
}

/**
 * Convert API neighborhood to frontend neighborhood.
 */
function fromApiNeighborhood(apiNeighborhood: ApiNeighborhood): Neighborhood {
  return {
    id: apiNeighborhood.id,
    name: apiNeighborhood.name,
    polygon: { points: fromGeoJsonGeometry(apiNeighborhood.geometry) },
    labelColor: apiNeighborhood.label_color || undefined,
    accentColor: apiNeighborhood.accent_color || undefined,
  };
}

/**
 * Convert an API POI to a frontend POI.
 * Hydrates footprint from type + position since footprints are not stored in the backend.
 */
function fromApiPOI(apiPOI: ApiPOI): POI {
  const type = apiPOI.type as POI["type"];
  const position = {
    x: apiPOI.position_x,
    y: apiPOI.position_y,
  };
  // Use persisted footprint if available, otherwise generate from type+position (CITY-440)
  const footprint = apiPOI.footprint
    ? apiPOI.footprint.map((p) => ({ x: p.x, y: p.y }))
    : generatePOIFootprint(type, position);
  return {
    id: apiPOI.id,
    name: apiPOI.name,
    type,
    position,
    footprint,
  };
}

/**
 * Map frontend road class to API road class.
 */
function toApiRoadClass(frontendClass: RoadClass): ApiRoadClass {
  const mapping: Record<RoadClass, ApiRoadClass> = {
    highway: "highway",
    arterial: "arterial",
    collector: "collector",
    local: "local",
    trail: "trail",
  };
  return mapping[frontendClass] || "local";
}

/**
 * Map API road class to frontend road class.
 */
function fromApiRoadClass(apiClass: ApiRoadClass): RoadClass {
  const mapping: Record<ApiRoadClass, RoadClass> = {
    highway: "highway",
    arterial: "arterial",
    collector: "collector",
    local: "local",
    alley: "trail", // Legacy: treat existing alley records as trails
    trail: "trail",
  };
  return mapping[apiClass] || "local";
}

/**
 * Convert frontend roads to an API-compatible graph of nodes and edges.
 *
 * Builds a node at each unique endpoint position (snapped to 3 decimal places)
 * so that roads sharing an intersection reuse the same node. Each road becomes
 * one edge whose `from_node_id` / `to_node_id` are temporary indices that the
 * caller replaces with real IDs after the bulk-create API call returns.
 *
 * @param roads - Frontend road objects to convert
 * @param worldId - World ID attached to every node and edge
 * @param districtId - Optional district ID attached to every edge
 * @returns Object with `nodes` (unique endpoints) and `edges` (one per road)
 */
function roadsToGraph(
  roads: Road[],
  worldId: string,
  districtId?: string
): { nodes: RoadNodeCreate[]; edges: RoadEdgeCreate[] } {
  const nodes: RoadNodeCreate[] = [];
  const edges: RoadEdgeCreate[] = [];

  // Map to track nodes by position (x,y key -> node index)
  const nodeMap = new Map<string, number>();

  const posKey = (p: Point) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

  for (const road of roads) {
    if (road.line.points.length < 2) continue;

    const firstPoint = road.line.points[0];
    const lastPoint = road.line.points[road.line.points.length - 1];

    // Get or create node for first point
    const firstKey = posKey(firstPoint);
    let fromNodeIndex: number;
    if (nodeMap.has(firstKey)) {
      fromNodeIndex = nodeMap.get(firstKey)!;
    } else {
      fromNodeIndex = nodes.length;
      nodeMap.set(firstKey, fromNodeIndex);
      nodes.push({
        world_id: worldId,
        position: { x: firstPoint.x, y: firstPoint.y },
        node_type: "intersection",
      });
    }

    // Get or create node for last point
    const lastKey = posKey(lastPoint);
    let toNodeIndex: number;
    if (nodeMap.has(lastKey)) {
      toNodeIndex = nodeMap.get(lastKey)!;
    } else {
      toNodeIndex = nodes.length;
      nodeMap.set(lastKey, toNodeIndex);
      nodes.push({
        world_id: worldId,
        position: { x: lastPoint.x, y: lastPoint.y },
        node_type: "intersection",
      });
    }

    // Create edge with intermediate geometry
    const geometry = road.line.points.slice(1, -1).map(p => ({ x: p.x, y: p.y }));
    edges.push({
      world_id: worldId,
      from_node_id: String(fromNodeIndex), // Will be replaced with real IDs after node creation
      to_node_id: String(toNodeIndex),
      road_class: toApiRoadClass(road.roadClass),
      geometry,
      name: road.name,
      district_id: districtId,
    });
  }

  return { nodes, edges };
}

/**
 * Convert an API road network (nodes + edges) back to frontend Road objects.
 *
 * Reconstructs each road's polyline by joining from_node → geometry → to_node.
 * Edges whose from/to node is missing are silently skipped.
 *
 * @param network - API response containing `nodes` and `edges` arrays
 * @returns Array of frontend Road objects (empty if network has no data)
 */
function graphToRoads(network: ApiRoadNetwork): Road[] {
  if (!network.nodes.length || !network.edges.length) {
    return [];
  }

  // Build node lookup map
  const nodeMap = new Map<string, ApiRoadNode>();
  for (const node of network.nodes) {
    nodeMap.set(node.id, node);
  }

  const roads: Road[] = [];

  for (const edge of network.edges) {
    const fromNode = nodeMap.get(edge.from_node_id);
    const toNode = nodeMap.get(edge.to_node_id);
    if (!fromNode || !toNode) continue;

    // Build points array: from_node -> geometry -> to_node
    const points: Point[] = [
      { x: fromNode.position.x, y: fromNode.position.y },
      ...(edge.geometry || []).map(p => ({ x: p.x, y: p.y })),
      { x: toNode.position.x, y: toNode.position.y },
    ];

    roads.push({
      id: edge.id,
      name: edge.name,
      roadClass: fromApiRoadClass(edge.road_class),
      line: { points },
      districtId: edge.district_id || undefined,
    });
  }

  return roads;
}

export function FeaturesProvider({
  children,
  worldId,
  initialFeatures = EMPTY_FEATURES,
  onFeaturesChange,
}: FeaturesProviderProps) {
  const [features, setFeaturesState] = useState<FeaturesData>(initialFeatures);
  const [isInitialized, setIsInitialized] = useState(!worldId);

  // CITY-494: Ref to current features so callbacks can read latest state
  // without closing over `features.xxx` (which forces callback recreation on every update).
  const featuresRef = useRef(features);
  featuresRef.current = features;

  // Get terrain context for water collision detection
  const terrainContext = useTerrainOptional();

  // Get transit context for transit-oriented grid generation (CITY-168)
  const transitContext = useTransitOptional();

  // Get toast context for error notifications
  const toast = useToastOptional();

  // Track pending operations for optimistic updates
  const pendingCreates = useRef<Set<string>>(new Set());

  // CITY-491: Track whether the batched initial load has fired, and which data
  // references were already consumed by the batch so post-init effects skip them.
  const initialLoadDone = useRef(false);
  const lastProcessed = useRef<{
    districts?: unknown;
    neighborhoods?: unknown;
    cityLimits?: unknown;
    pois?: unknown;
    roadNetwork?: unknown;
  }>({});

  // API hooks - only enabled when worldId is provided
  const { data: world } = useWorld(worldId || "", {
    enabled: !!worldId,
  });

  const {
    data: apiDistricts,
    isLoading: isLoadingDistricts,
    error: loadDistrictsError,
  } = useWorldDistricts(worldId || "", {
    enabled: !!worldId,
  });

  const {
    data: apiNeighborhoods,
    isLoading: isLoadingNeighborhoods,
    error: loadNeighborhoodsError,
  } = useWorldNeighborhoods(worldId || "", {
    enabled: !!worldId,
  });

  const createDistrictMutation = useCreateDistrict();
  const updateDistrictMutation = useUpdateDistrict();
  const deleteDistrictMutation = useDeleteDistrict();

  const createNeighborhoodMutation = useCreateNeighborhood();
  const updateNeighborhoodMutation = useUpdateNeighborhood();
  const deleteNeighborhoodMutation = useDeleteNeighborhood();

  // City limits query and mutations (CITY-407)
  const {
    data: apiCityLimits,
  } = useWorldCityLimits(worldId || "", {
    enabled: !!worldId,
  });
  const upsertCityLimitsMutation = useUpsertCityLimits();
  const deleteCityLimitsMutation = useDeleteCityLimits();

  // POI queries and mutations
  const {
    data: apiPOIs,
    isLoading: isLoadingPOIs,
    error: loadPOIsError,
  } = useWorldPOIs(worldId || "", undefined, {
    enabled: !!worldId,
  });

  const createPOIMutation = useCreatePOI();
  const createPOIsBulkMutation = useCreatePOIsBulk();
  const updatePOIMutation = useUpdatePOI();
  const deletePOIMutation = useDeletePOI();

  const {
    data: apiRoadNetwork,
    isLoading: isLoadingRoads,
    error: loadRoadsError,
  } = useRoadNetwork(worldId || "", {
    enabled: !!worldId,
  });

  const createRoadNodesBulkMutation = useCreateRoadNodesBulk();
  const createRoadEdgesBulkMutation = useCreateRoadEdgesBulk();
  const updateRoadEdgeMutation = useUpdateRoadEdge();
  const deleteRoadEdgeMutation = useDeleteRoadEdge();

  // CITY-491: Batch initial load into a single state update.
  // Instead of 5 separate effects each calling setFeaturesState (causing 5 canvas redraws),
  // wait for ALL queries to have data, then do one atomic update.
  useEffect(() => {
    // Skip if already done initial load (post-init updates handled by individual effects below)
    if (initialLoadDone.current) return;

    if (!worldId) {
      setIsInitialized(true);
      initialLoadDone.current = true;
      return;
    }

    // Wait for all required queries to have data
    // City limits is optional (null when none exists), so we check !== undefined
    if (!apiDistricts || !apiNeighborhoods || !apiPOIs || !apiRoadNetwork || apiCityLimits === undefined) {
      return;
    }

    // --- Districts + street grid roads ---
    const loadedDistricts = apiDistricts.map(fromApiDistrict);
    const streetGridRoads = apiDistricts.flatMap(roadsFromApiStreetGrid);

    // CITY-383: Backfill streets for legacy districts that predate the street_grid column.
    const backfilledRoads: Road[] = [];
    for (const apiDistrict of apiDistricts) {
      const districtType = fromApiDistrictType(apiDistrict.type) as District["type"];
      if (districtType === "park" || districtType === "airport") continue;
      if (apiDistrict.street_grid != null) continue;

      const polygon = fromGeoJsonGeometry(apiDistrict.geometry);
      if (polygon.length < 3) continue;

      const centroid = { x: 0, y: 0 };
      for (const p of polygon) { centroid.x += p.x; centroid.y += p.y; }
      centroid.x /= polygon.length;
      centroid.y /= polygon.length;

      const gridResult = regenerateStreetGridForClippedDistrict(
        polygon,
        apiDistrict.id,
        districtType,
        centroid,
        0.5, // default sprawlCompact
        undefined, // gridAngle
        undefined, // transitOptions
        undefined, // adjacentGridOrigin
        undefined // eraYear — legacy districts default to 2024
      );
      backfilledRoads.push(...gridResult.roads);

      // Persist the regenerated street_grid so we don't repeat this on every load
      const streetGridPayload = {
        roads: gridResult.roads.map((r) => ({
          id: r.id,
          name: r.name,
          roadClass: r.roadClass,
          districtId: r.districtId,
          points: r.line.points.map((p) => ({ x: p.x, y: p.y })),
        })),
        gridAngle: gridResult.gridAngle,
      };
      updateDistrictMutation.mutate(
        { districtId: apiDistrict.id, data: { street_grid: streetGridPayload }, worldId },
        { onError: (err) => console.error(`CITY-383: Failed to backfill street_grid for ${apiDistrict.id}:`, err) }
      );
    }

    // --- Neighborhoods ---
    const loadedNeighborhoods = apiNeighborhoods.map(fromApiNeighborhood);

    // --- City limits (optional) ---
    const loadedCityLimits = apiCityLimits
      ? {
          id: String(apiCityLimits.id),
          name: apiCityLimits.name,
          boundary: { points: (apiCityLimits.boundary as { points: { x: number; y: number }[] }).points ?? [] },
          established: apiCityLimits.established ?? undefined,
        }
      : undefined;

    // --- POIs ---
    const loadedPOIs = apiPOIs.map(fromApiPOI);

    // --- Road network (inter-district roads from graph) ---
    const networkRoads = graphToRoads(apiRoadNetwork);
    const networkRoadIds = new Set(networkRoads.map((r) => r.id));

    // Merge street grid roads + backfilled roads + network roads (dedup by ID)
    const allStreetGridRoads = [...streetGridRoads, ...backfilledRoads];
    const mergedRoads = [
      ...allStreetGridRoads.filter((r) => !networkRoadIds.has(r.id)),
      ...networkRoads,
    ];

    // CITY-365: Preserve optimistically added districts that are still pending API confirmation
    const loadedDistrictIds = new Set(loadedDistricts.map((d) => d.id));

    // Single atomic state update
    setFeaturesState((prev) => {
      const pendingDistricts = prev.districts.filter(
        (d) => pendingCreates.current.has(d.id)
      );
      // Keep roads from pending districts and inter-district roads not yet in loaded data
      const pendingRoads = prev.roads.filter((r) => {
        return !r.districtId || (pendingCreates.current.has(r.districtId) && !loadedDistrictIds.has(r.districtId));
      });

      return {
        ...prev,
        districts: [...loadedDistricts, ...pendingDistricts],
        neighborhoods: loadedNeighborhoods,
        cityLimits: loadedCityLimits,
        pois: loadedPOIs,
        roads: [...mergedRoads, ...pendingRoads],
      };
    });

    // Record which data references the batch consumed so post-init effects
    // skip these same references (they fire in the same React commit).
    lastProcessed.current = {
      districts: apiDistricts,
      neighborhoods: apiNeighborhoods,
      cityLimits: apiCityLimits,
      pois: apiPOIs,
      roadNetwork: apiRoadNetwork,
    };

    setIsInitialized(true);
    initialLoadDone.current = true;
  }, [worldId, apiDistricts, apiNeighborhoods, apiCityLimits, apiPOIs, apiRoadNetwork]);

  // Post-init individual update effects for live editing (React Query refetches).
  // Each effect skips data already consumed by the batch (same object reference)
  // to avoid redundant renders when both fire in the same React commit.

  // Districts refetch (post-init)
  useEffect(() => {
    if (!initialLoadDone.current || !worldId || !apiDistricts) return;
    if (apiDistricts === lastProcessed.current.districts) return;
    lastProcessed.current.districts = apiDistricts;

    const loadedDistricts = apiDistricts.map(fromApiDistrict);
    const streetGridRoads = apiDistricts.flatMap(roadsFromApiStreetGrid);
    const loadedDistrictIds = new Set(loadedDistricts.map((d) => d.id));

    setFeaturesState((prev) => {
      const pendingDistricts = prev.districts.filter(
        (d) => pendingCreates.current.has(d.id)
      );
      return {
        ...prev,
        districts: [...loadedDistricts, ...pendingDistricts],
        roads: [...streetGridRoads, ...prev.roads.filter((r) => {
          return !r.districtId || !loadedDistrictIds.has(r.districtId);
        })],
      };
    });
  }, [worldId, apiDistricts]);

  // Neighborhoods refetch (post-init)
  useEffect(() => {
    if (!initialLoadDone.current || !worldId || !apiNeighborhoods) return;
    if (apiNeighborhoods === lastProcessed.current.neighborhoods) return;
    lastProcessed.current.neighborhoods = apiNeighborhoods;

    setFeaturesState((prev) => ({
      ...prev,
      neighborhoods: apiNeighborhoods.map(fromApiNeighborhood),
    }));
  }, [worldId, apiNeighborhoods]);

  // City limits refetch (post-init, CITY-407)
  useEffect(() => {
    if (!initialLoadDone.current || !worldId) return;
    if (apiCityLimits === undefined) return;
    if (apiCityLimits === lastProcessed.current.cityLimits) return;
    lastProcessed.current.cityLimits = apiCityLimits;

    setFeaturesState((prev) => ({
      ...prev,
      cityLimits: apiCityLimits
        ? {
            id: String(apiCityLimits.id),
            name: apiCityLimits.name,
            boundary: { points: (apiCityLimits.boundary as { points: { x: number; y: number }[] }).points ?? [] },
            established: apiCityLimits.established ?? undefined,
          }
        : undefined,
    }));
  }, [worldId, apiCityLimits]);

  // POIs refetch (post-init)
  useEffect(() => {
    if (!initialLoadDone.current || !worldId || !apiPOIs) return;
    if (apiPOIs === lastProcessed.current.pois) return;
    lastProcessed.current.pois = apiPOIs;

    setFeaturesState((prev) => ({
      ...prev,
      pois: apiPOIs.map(fromApiPOI),
    }));
  }, [worldId, apiPOIs]);

  // Road network refetch (post-init)
  useEffect(() => {
    if (!initialLoadDone.current || !worldId || !apiRoadNetwork) return;
    if (apiRoadNetwork === lastProcessed.current.roadNetwork) return;
    lastProcessed.current.roadNetwork = apiRoadNetwork;

    const networkRoads = graphToRoads(apiRoadNetwork);
    const networkRoadIds = new Set(networkRoads.map((r) => r.id));
    setFeaturesState((prev) => ({
      ...prev,
      roads: [
        ...prev.roads.filter((r) => !networkRoadIds.has(r.id)),
        ...networkRoads,
      ],
    }));
  }, [worldId, apiRoadNetwork]);

  // Auto-detect bridges when roads or terrain change (CITY-148)
  useEffect(() => {
    const timer = setTimeout(() => {
      const terrainData = terrainContext?.terrainData ?? null;

      // Get current roads from state
      setFeaturesState((prev) => {
        if (prev.roads.length === 0) {
          // No roads, no bridges
          if (prev.bridges.length === 0) {
            return prev; // No change needed
          }
          return { ...prev, bridges: [] };
        }

        // Detect bridges for all roads
        const { bridges } = detectBridges(prev.roads, terrainData);

        // CITY-493: Bridge IDs are now deterministic (roadId + waterFeatureId + segment),
        // so we can compare IDs directly for a reliable equality check.
        if (bridges.length === prev.bridges.length) {
          const newIds = bridges.map((b) => b.id).sort().join(",");
          const prevIds = prev.bridges.map((b) => b.id).sort().join(",");
          if (newIds === prevIds) {
            return prev; // No change needed
          }
        }

        return { ...prev, bridges };
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [features.roads, terrainContext?.terrainData]);

  // Helper to update features and notify
  const updateFeatures = useCallback(
    (updater: (prev: FeaturesData) => FeaturesData) => {
      setFeaturesState((prev) => {
        const next = updater(prev);
        onFeaturesChange?.(next);
        return next;
      });
    },
    [onFeaturesChange]
  );

  const addDistrict = useCallback(
    (
      position: { x: number; y: number },
      seedId: string,
      config?: AddDistrictConfig
    ): AddDistrictResult => {
      // Extract personality from config; fall back to world settings, then hardcoded defaults
      const personality = config?.personality ?? worldSettingsToPersonality(world?.settings);

      // Use personality settings to configure district generation
      // sprawl_compact affects block size, grid_organic affects street patterns
      // transit_car affects grid orientation toward transit stations (CITY-168)

      // Get transit station positions for transit-oriented grid generation
      const transitStations: { x: number; y: number }[] = [];
      if (transitContext) {
        // Collect all rail and subway station positions
        for (const station of transitContext.railStations) {
          transitStations.push(station.position);
        }
        for (const station of transitContext.subwayStations) {
          transitStations.push(station.position);
        }
      }

      // CITY-380: Build naming context for context-aware park/airport names
      const districtType = seedIdToDistrictType(seedId);
      let namingContext: NamingContext | undefined;

      if (districtType === "airport" || districtType === "park") {
        // Find adjacent districts within a search radius
        const searchRadius = config?.size ? config.size * 0.8 : 50;
        const adjacentDistrictNames: string[] = [];
        const adjacentDistrictTypes: NearbyContext[] = [];
        for (const d of featuresRef.current.districts) {
          // Use centroid distance as a rough proximity check
          const cx = d.polygon.points.reduce((s, p) => s + p.x, 0) / d.polygon.points.length;
          const cy = d.polygon.points.reduce((s, p) => s + p.y, 0) / d.polygon.points.length;
          const dx = cx - position.x;
          const dy = cy - position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < searchRadius) {
            adjacentDistrictNames.push(d.name);
            if (["residential", "downtown", "commercial", "industrial"].includes(d.type)) {
              adjacentDistrictTypes.push(d.type as NearbyContext);
            }
          }
        }

        // Find nearby water features with names
        const waterFeaturesList = terrainContext?.getWaterFeatures() ?? [];
        const nearbyWaterNames: string[] = [];
        for (const wf of waterFeaturesList) {
          if (!wf.name) continue;
          // Check if water feature is near the placement position
          const wcx = wf.polygon.points.reduce((s, p) => s + p.x, 0) / wf.polygon.points.length;
          const wcy = wf.polygon.points.reduce((s, p) => s + p.y, 0) / wf.polygon.points.length;
          const dx = wcx - position.x;
          const dy = wcy - position.y;
          if (Math.sqrt(dx * dx + dy * dy) < searchRadius) {
            nearbyWaterNames.push(wf.name);
          }
        }

        // Also check rivers
        const rivers = terrainContext?.terrainData?.rivers ?? [];
        for (const river of rivers) {
          if (!river.name) continue;
          // Check if any point of the river is near the placement
          for (const pt of river.line.points) {
            const dx = pt.x - position.x;
            const dy = pt.y - position.y;
            if (Math.sqrt(dx * dx + dy * dy) < searchRadius) {
              nearbyWaterNames.push(river.name);
              break;
            }
          }
        }

        namingContext = {
          worldName: world?.name,
          adjacentDistrictNames: adjacentDistrictNames.length > 0 ? adjacentDistrictNames : undefined,
          nearbyWaterNames: nearbyWaterNames.length > 0 ? nearbyWaterNames : undefined,
          adjacentDistrictTypes: adjacentDistrictTypes.length > 0 ? adjacentDistrictTypes : undefined,
        };
      }

      const generationConfig: DistrictGenerationConfig = {
        ...config,
        organicFactor: personality.grid_organic,
        scaleSettings: {
          blockSizeMeters: config?.scaleSettings?.blockSizeMeters ?? world?.settings.block_size_meters ?? 100,
          districtSizeMeters: config?.scaleSettings?.districtSizeMeters ?? world?.settings.district_size_meters ?? 3200,
          sprawlCompact: personality.sprawl_compact,
        },
        // Pass through the explicit seed if provided
        seed: config?.seed,
        // Transit-oriented grid generation (CITY-168)
        transitStations: transitStations.length > 0 ? transitStations : undefined,
        transitCar: personality.transit_car,
        // Era year affects block sizes and historic flag (CITY-225)
        eraYear: personality.era_year,
        // CITY-380: Context-aware naming for parks and airports
        namingContext,
      };

      // CITY-552: Check if seed is placed inside a river
      if (districtType !== "park") {
        const rivers = terrainContext?.getRiverFeatures() ?? [];
        for (const river of rivers) {
          const riverPoly = riverFeatureToWaterFeature(river);
          if (pointInPolygon(position, riverPoly.polygon.points)) {
            return {
              generated: null,
              wasClipped: false,
              error: "Cannot place district in a river",
            };
          }
        }
      }

      // Generate district geometry
      const generated = generateDistrictGeometry(position, seedId, generationConfig);

      // Add personality to the generated district
      generated.district.personality = personality;

      // CITY-537: Clip district polygon to world boundaries
      const clippedToWorld = clipPolygonToWorldBounds(generated.district.polygon.points);
      if (clippedToWorld.length < 3) {
        return {
          generated: null,
          wasClipped: true,
          error: "District is outside the world boundary",
        };
      }
      generated.district.polygon.points = clippedToWorld;

      // CITY-384: Clip against existing districts instead of rejecting overlap
      let adjacentDistrictIds: string[] = [];
      const districtClipResult = clipDistrictAgainstExisting(
        generated.district.polygon.points,
        featuresRef.current.districts,
      );

      if (districtClipResult.wasClipped) {
        if (districtClipResult.tooSmall || districtClipResult.clippedPolygon.length < 3) {
          return {
            generated: null,
            wasClipped: true,
            error: "Not enough space for a new district here",
          };
        }

        // Apply the clipped polygon
        generated.district.polygon.points = districtClipResult.clippedPolygon;
        adjacentDistrictIds = districtClipResult.adjacentDistrictIds;

        // Determine grid angle and origin from adjacent districts for continuity
        let adjacentGridAngle: number | undefined;
        let adjacentGridOrigin: Point | undefined;
        if (adjacentDistrictIds.length > 0) {
          // Pick the grid angle from the neighbor with the longest shared boundary
          let bestNeighborAngle: number | undefined;
          let bestNeighborPoints: Point[] | undefined;
          let longestSharedEdge = 0;

          for (const adjId of adjacentDistrictIds) {
            const adjDistrict = featuresRef.current.districts.find((d) => d.id === adjId);
            if (!adjDistrict || adjDistrict.gridAngle === undefined) continue;

            // Estimate shared boundary length: count clipped polygon points
            // that are close to the adjacent district's boundary
            const adjPoints = adjDistrict.polygon.points;
            let sharedLength = 0;
            for (let i = 0; i < districtClipResult.clippedPolygon.length; i++) {
              const p = districtClipResult.clippedPolygon[i];
              // Check if this point is near any edge of the adjacent district
              for (let j = 0; j < adjPoints.length; j++) {
                const a = adjPoints[j];
                const b = adjPoints[(j + 1) % adjPoints.length];
                const dist = pointToSegmentDistance(p, a, b);
                if (dist < 2) { // Within 2 world units = on the boundary
                  // Approximate: count segment length between consecutive shared points
                  const next = districtClipResult.clippedPolygon[(i + 1) % districtClipResult.clippedPolygon.length];
                  const dx = next.x - p.x;
                  const dy = next.y - p.y;
                  sharedLength += Math.sqrt(dx * dx + dy * dy);
                  break;
                }
              }
            }

            if (sharedLength > longestSharedEdge) {
              longestSharedEdge = sharedLength;
              bestNeighborAngle = adjDistrict.gridAngle;
              bestNeighborPoints = adjPoints;
            }
          }

          adjacentGridAngle = bestNeighborAngle;

          // CITY-384: Use the adjacent district's centroid as grid origin so both
          // districts share the same rotation center and their grid lines align.
          if (bestNeighborPoints && bestNeighborPoints.length > 0) {
            let cx = 0, cy = 0;
            for (const p of bestNeighborPoints) { cx += p.x; cy += p.y; }
            adjacentGridOrigin = { x: cx / bestNeighborPoints.length, y: cy / bestNeighborPoints.length };
          }
        }

        // Regenerate street grid for the clipped polygon with aligned grid angle and origin
        const clippedGridResult = regenerateStreetGridForClippedDistrict(
          districtClipResult.clippedPolygon,
          generated.district.id,
          generated.district.type,
          position,
          personality.sprawl_compact,
          adjacentGridAngle ?? generated.district.gridAngle,
          transitStations.length > 0
            ? { transitStations, transitCar: personality.transit_car }
            : undefined,
          adjacentGridOrigin,
          personality.era_year
        );
        generated.roads = clippedGridResult.roads;
        generated.district.gridAngle = clippedGridResult.gridAngle;
      }

      // Check for water overlap and clip if necessary
      // Spread to avoid mutating the cached terrainData.water array
      const waterFeatures = [...(terrainContext?.getWaterFeatures() ?? [])];

      // CITY-552: Convert rivers to water features for district clipping (parks exempt)
      if (generated.district.type !== "park") {
        const rivers = terrainContext?.getRiverFeatures() ?? [];
        for (const river of rivers) {
          waterFeatures.push(riverFeatureToWaterFeature(river));
        }
      }

      const clipResult = clipAndValidateDistrict(
        generated.district.polygon.points,
        waterFeatures,
        generated.district.type
      );

      // If district is completely in water, reject placement
      if (clipResult.clippedPolygon.length < 3) {
        return {
          generated: null,
          wasClipped: true,
          clipResult,
          error: "District would be completely in water",
        };
      }

      // If clipped area is too small, reject placement
      if (clipResult.tooSmall) {
        return {
          generated: null,
          wasClipped: true,
          clipResult,
          error: "District area after water clipping is too small (minimum 2x2 blocks required)",
        };
      }

      // Apply clipped polygon if water overlap occurred
      if (clipResult.overlapsWater) {
        generated.district.polygon.points = clipResult.clippedPolygon;
        // Regenerate the street grid for the clipped polygon (CITY-142)
        // Pass the existing gridAngle to preserve orientation
        // Include transit options for transit-oriented grids (CITY-168)
        const clippedGridResult = regenerateStreetGridForClippedDistrict(
          clipResult.clippedPolygon,
          generated.district.id,
          generated.district.type,
          position,
          personality.sprawl_compact,
          generated.district.gridAngle,
          transitStations.length > 0
            ? { transitStations, transitCar: personality.transit_car }
            : undefined,
          undefined, // adjacentGridOrigin
          personality.era_year
        );
        generated.roads = clippedGridResult.roads;
        generated.district.gridAngle = clippedGridResult.gridAngle;
      }

      const tempId = generated.district.id;

      // Generate inter-district roads connecting to existing districts (CITY-144)
      // CITY-384: Pass adjacent district IDs so shared-boundary arterials are generated
      const currentFeatures = featuresRef.current;
      const interDistrictResult = generateInterDistrictRoads(
        generated.district,
        currentFeatures.districts,
        waterFeatures,
        { avoidWater: true },
        adjacentDistrictIds
      );

      // Combine internal roads with inter-district roads
      let allRoads = [...generated.roads, ...interDistrictResult.roads];

      // Connect collector streets across adjacent district boundaries (CITY-382)
      // This bridges the gap between independently-generated street grids so that
      // adjacent districts have a connected local road network, not just arterial links.
      const crossBoundaryRoads = generateCrossBoundaryConnections(
        generated.district,
        generated.roads,
        currentFeatures.districts,
        currentFeatures.roads
      );
      if (crossBoundaryRoads.length > 0) {
        allRoads = [...allRoads, ...crossBoundaryRoads];
      }

      // For districts that require arterial adjacency (CITY-149),
      // check if connected to arterials and generate additional connections if needed
      if (districtRequiresArterialAdjacency(generated.district.type)) {
        // Get all existing roads plus the ones we just generated
        const allExistingRoads = [...currentFeatures.roads, ...allRoads];

        const arterialResult = generateArterialConnections(
          generated.district,
          currentFeatures.districts,
          allExistingRoads,
          waterFeatures
        );

        // Add any additional arterial roads that were generated
        if (!arterialResult.wasAlreadyAdjacent && arterialResult.roads.length > 0) {
          allRoads = [...allRoads, ...arterialResult.roads];
        }
      }

      // CITY-430: Generate access roads for any transit stations inside this district
      if (transitContext) {
        const allStationPositions = [
          ...transitContext.railStations.map((s) => s.position),
          ...transitContext.subwayStations.map((s) => s.position),
        ];
        for (const stationPos of allStationPositions) {
          if (pointInPolygon(stationPos, generated.district.polygon.points)) {
            const accessRoad = generateStationAccessRoad(
              stationPos,
              [...generated.roads, ...allRoads],
              generated.district.id
            );
            if (accessRoad) {
              allRoads = [...allRoads, accessRoad];
            }
          }
        }
      }

      // CITY-378: Generate park features (trails, ponds, perimeter roads, connections)
      let parkPonds: import("./layers").Polygon[] = [];
      if (generated.district.type === "park") {
        const parkFeatures = generateParkFeaturesForDistrict(
          generated.district.polygon.points,
          generated.district.id,
          generated.district.name,
          seedId,
          [...currentFeatures.roads, ...allRoads]
        );
        // Add internal trails, perimeter roads, and connection roads
        allRoads = [
          ...allRoads,
          ...parkFeatures.paths,
          ...parkFeatures.perimeterRoads,
          ...parkFeatures.connectionRoads,
        ];
        parkPonds = parkFeatures.ponds;
      }

      // Attach ponds to the district for rendering (CITY-378)
      if (parkPonds.length > 0) {
        generated.district.ponds = parkPonds;
      }

      // CITY-379: Generate airport features (runways, taxiways, access roads)
      if (generated.district.type === "airport") {
        const airportFeatures = generateAirportFeaturesForDistrict(
          generated.district.polygon.points,
          generated.district.id,
          [...currentFeatures.roads, ...allRoads]
        );
        allRoads = [
          ...allRoads,
          ...airportFeatures.runways,
          ...airportFeatures.accessRoads,
        ];
      }

      // Auto-generate POIs matching the district type (CITY-345)
      // Pass district roads for road-adjacent placement (CITY-406) and existing POIs to avoid overlap (CITY-409)
      const { pois: autoGeneratedPOIs, campusPaths } = generatePOIsForDistrict(
        generated.district.type,
        generated.district.polygon.points,
        generated.district.name,
        generated.roads,
        currentFeatures.pois,
        generated.district.id,
      );
      const autoGeneratedPOIIds = new Set(autoGeneratedPOIs.map(p => p.id));

      // Merge campus paths (CITY-441, CITY-442) into the road list
      allRoads = [...allRoads, ...campusPaths];

      // Optimistically add district, roads, and auto-generated POIs to local state
      updateFeatures((prev) => ({
        ...prev,
        districts: [...prev.districts, generated.district],
        roads: [...prev.roads, ...allRoads],
        pois: [...prev.pois, ...autoGeneratedPOIs],
      }));

      // Persist to API if worldId is provided
      if (worldId) {
        pendingCreates.current.add(tempId);

        // Build street_grid payload with roads, gridAngle, personality, and park ponds
        const streetGridPayload: Record<string, unknown> = {
          roads: allRoads.map((r) => ({
            id: r.id,
            name: r.name,
            roadClass: r.roadClass,
            districtId: r.districtId,
            points: r.line.points.map((p) => ({ x: p.x, y: p.y })),
          })),
          gridAngle: generated.district.gridAngle,
          personality: generated.district.personality,
          // CITY-378: Store park pond geometries for rendering
          ...(parkPonds.length > 0 && {
            ponds: parkPonds.map((pond) => ({
              points: pond.points.map((p) => ({ x: p.x, y: p.y })),
            })),
          }),
        };

        createDistrictMutation.mutate(
          {
            worldId,
            data: {
              type: toApiDistrictType(generated.district.type),
              name: generated.district.name,
              geometry: toGeoJsonGeometry(generated.district.polygon.points),
              historic: generated.district.isHistoric || false,
              street_grid: streetGridPayload,
            },
          },
          {
            onSuccess: async (apiDistrict) => {
              // Replace temp ID with real ID from API
              pendingCreates.current.delete(tempId);

              // Get all roads generated for this district
              const districtRoads = allRoads;

              // Track which road IDs belong to this district for state updates
              const districtRoadIds = new Set(allRoads.map(r => r.id));

              // CITY-496: Persist POIs first, then do a single batched state update
              // for all ID replacements (district, roads, POIs) to avoid multiple
              // re-render cascades through context.
              let tempToRealPOIIds: Map<string, string> | null = null;
              if (autoGeneratedPOIs.length > 0) {
                try {
                  const apiPOIs = await new Promise<ApiPOI[]>((resolve, reject) => {
                    createPOIsBulkMutation.mutate(
                      {
                        worldId,
                        data: {
                          pois: autoGeneratedPOIs.map((poi) => ({
                            world_id: worldId,
                            type: poi.type,
                            name: poi.name,
                            position_x: poi.position.x,
                            position_y: poi.position.y,
                            footprint: poi.footprint,
                          })),
                        },
                      },
                      {
                        onSuccess: resolve,
                        onError: reject,
                      }
                    );
                  });

                  tempToRealPOIIds = new Map<string, string>();
                  const tempPOIIdArray = Array.from(autoGeneratedPOIIds);
                  for (let i = 0; i < Math.min(apiPOIs.length, tempPOIIdArray.length); i++) {
                    tempToRealPOIIds.set(tempPOIIdArray[i], apiPOIs[i].id);
                  }
                } catch (poiError) {
                  console.error("Failed to save auto-generated POIs:", poiError);
                  toast?.addToast(
                    "Auto-generated POIs could not be saved. They will appear until refresh.",
                    "warning"
                  );
                }
              }

              // Single state update for all ID replacements
              updateFeatures((prev) => ({
                ...prev,
                districts: prev.districts.map((d) =>
                  d.id === tempId ? { ...d, id: apiDistrict.id } : d
                ),
                roads: prev.roads.map((r) => {
                  if (!districtRoadIds.has(r.id)) return r;
                  const newId = r.id.startsWith(tempId)
                    ? apiDistrict.id + r.id.slice(tempId.length)
                    : r.id;
                  return { ...r, id: newId, districtId: apiDistrict.id };
                }),
                ...(tempToRealPOIIds && {
                  pois: prev.pois.map((p) => {
                    const realId = tempToRealPOIIds!.get(p.id);
                    return realId ? { ...p, id: realId } : p;
                  }),
                }),
              }));

              // Persist roads to API if there are any
              if (districtRoads.length > 0 && worldId) {
                try {
                  // Convert roads to graph model
                  const { nodes, edges } = roadsToGraph(districtRoads, worldId, apiDistrict.id);

                  if (nodes.length > 0) {
                    // Create nodes first to get their IDs
                    const createdNodes = await new Promise<ApiRoadNode[]>((resolve, reject) => {
                      createRoadNodesBulkMutation.mutate(
                        { worldId, data: { nodes } },
                        {
                          onSuccess: resolve,
                          onError: reject,
                        }
                      );
                    });

                    // Map node indices to real IDs
                    const nodeIdMap = new Map<string, string>();
                    for (let i = 0; i < createdNodes.length; i++) {
                      nodeIdMap.set(String(i), createdNodes[i].id);
                    }

                    // Update edge references with real node IDs
                    const edgesWithRealIds: RoadEdgeCreate[] = edges.map((edge) => ({
                      ...edge,
                      from_node_id: nodeIdMap.get(edge.from_node_id) || edge.from_node_id,
                      to_node_id: nodeIdMap.get(edge.to_node_id) || edge.to_node_id,
                    }));

                    // Create edges
                    if (edgesWithRealIds.length > 0) {
                      await new Promise<void>((resolve, reject) => {
                        createRoadEdgesBulkMutation.mutate(
                          { worldId, data: { edges: edgesWithRealIds } },
                          {
                            onSuccess: () => resolve(),
                            onError: reject,
                          }
                        );
                      });
                    }
                  }
                } catch (roadError) {
                  console.error("Failed to save roads:", roadError);
                  // Show a warning toast so users know roads weren't saved
                  toast?.addToast(
                    "Roads for this district could not be saved. They will appear until refresh.",
                    "warning"
                  );
                }
              }
            },
            onError: (error) => {
              // Remove the optimistically added district on error
              pendingCreates.current.delete(tempId);
              // Track which road IDs belong to this district for removal
              const districtRoadIds = new Set(allRoads.map(r => r.id));
              updateFeatures((prev) => ({
                ...prev,
                districts: prev.districts.filter((d) => d.id !== tempId),
                // Remove all roads that were created for this district
                roads: prev.roads.filter((r) => !districtRoadIds.has(r.id)),
                // Remove auto-generated POIs on district creation failure
                pois: prev.pois.filter((p) => !autoGeneratedPOIIds.has(p.id)),
              }));
              console.error("Failed to save district:", error);
              toast?.addToast(
                "Failed to save district. Please try again.",
                "error"
              );
            },
          }
        );
      }

      return {
        generated,
        wasClipped: clipResult.overlapsWater,
        clipResult: clipResult.overlapsWater ? clipResult : undefined,
      };
    },
    [worldId, world, updateFeatures, createDistrictMutation, createPOIsBulkMutation, createRoadNodesBulkMutation, createRoadEdgesBulkMutation, terrainContext, transitContext, toast]
  );

  const previewDistrictPlacement = useCallback(
    (
      position: { x: number; y: number },
      seedId: string,
      config?: AddDistrictConfig
    ): ClipResult | null => {
      const personality = config?.personality ?? worldSettingsToPersonality(world?.settings);

      const generationConfig: DistrictGenerationConfig = {
        ...config,
        organicFactor: personality.grid_organic,
        scaleSettings: {
          blockSizeMeters: config?.scaleSettings?.blockSizeMeters ?? world?.settings.block_size_meters ?? 100,
          districtSizeMeters: config?.scaleSettings?.districtSizeMeters ?? world?.settings.district_size_meters ?? 3200,
          sprawlCompact: personality.sprawl_compact,
        },
        // Era year affects block sizes and historic flag (CITY-225)
        eraYear: personality.era_year,
      };

      // Generate district geometry for preview
      const generated = generateDistrictGeometry(position, seedId, generationConfig);

      // Check for water overlap
      const waterFeatures = terrainContext?.getWaterFeatures() ?? [];
      return clipAndValidateDistrict(
        generated.district.polygon.points,
        waterFeatures,
        generated.district.type
      );
    },
    [world, terrainContext]
  );

  const addDistrictWithGeometry = useCallback(
    (district: District, roads: Road[] = []) => {
      updateFeatures((prev) => ({
        ...prev,
        districts: [...prev.districts, district],
        roads: [...prev.roads, ...roads],
      }));
    },
    [updateFeatures]
  );

  const addPOI = useCallback(
    (poi: POI) => {
      // Update local state immediately for responsiveness
      updateFeatures((prev) => ({
        ...prev,
        pois: [...prev.pois, poi],
      }));

      // Persist to backend if we have a worldId
      if (worldId) {
        createPOIMutation.mutate({
          worldId,
          data: {
            type: poi.type,
            name: poi.name,
            position_x: poi.position.x,
            position_y: poi.position.y,
            footprint: poi.footprint,
          },
        });
      }
    },
    [updateFeatures, worldId, createPOIMutation]
  );

  const addRoads = useCallback(
    (roads: Road[]) => {
      updateFeatures((prev) => ({
        ...prev,
        roads: [...prev.roads, ...roads],
      }));
    },
    [updateFeatures]
  );

  const addInterchanges = useCallback(
    (interchanges: Interchange[]) => {
      updateFeatures((prev) => ({
        ...prev,
        interchanges: [...(prev.interchanges || []), ...interchanges],
      }));
    },
    [updateFeatures]
  );

  const removeDistrict = useCallback(
    (id: string) => {
      // Find the district first
      const districtToRemove = featuresRef.current.districts.find((d) => d.id === id);
      if (!districtToRemove) return;

      // Optimistically remove district, its roads, and its auto-generated POIs from local state
      updateFeatures((prev) => {
        return {
          ...prev,
          districts: prev.districts.filter((d) => d.id !== id),
          roads: prev.roads.filter((r) => r.districtId !== id),
          pois: prev.pois.filter((p) => p.districtId !== id),
        };
      });

      // Delete from API if worldId is provided and not a pending create
      if (worldId && !pendingCreates.current.has(id)) {
        deleteDistrictMutation.mutate(
          { districtId: id, worldId },
          {
            onError: (error) => {
              // Re-add the district on error
              updateFeatures((prev) => ({
                ...prev,
                districts: [...prev.districts, districtToRemove],
              }));
              console.error("Failed to delete district:", error);
              toast?.addToast(
                "Failed to delete district. Please try again.",
                "error"
              );
            },
          }
        );
      }
    },
    [worldId, updateFeatures, deleteDistrictMutation, toast]
  );

  const removeRoad = useCallback(
    (id: string) => {
      // Find the road for potential rollback
      const roadToRemove = featuresRef.current.roads.find((r) => r.id === id);

      // Optimistically remove from local state
      updateFeatures((prev) => ({
        ...prev,
        roads: prev.roads.filter((r) => r.id !== id),
      }));

      // Persist to API if worldId is provided (CITY-249)
      if (worldId && roadToRemove) {
        deleteRoadEdgeMutation.mutate(
          { edgeId: id, worldId },
          {
            onError: (error) => {
              // Re-add the road on error
              updateFeatures((prev) => ({
                ...prev,
                roads: [...prev.roads, roadToRemove],
              }));
              console.error("Failed to delete road:", error);
              toast?.addToast(
                "Failed to delete road. Please try again.",
                "error"
              );
            },
          }
        );
      }
    },
    [worldId, updateFeatures, deleteRoadEdgeMutation, toast]
  );

  const removePOI = useCallback(
    (id: string) => {
      // Find the POI for potential rollback
      const poiToRemove = featuresRef.current.pois.find((p) => p.id === id);

      // Optimistically remove POI and its campus paths from local state
      updateFeatures((prev) => ({
        ...prev,
        pois: prev.pois.filter((p) => p.id !== id),
        roads: prev.roads.filter((r) => !r.id.includes(`${id}-path-`)),
      }));

      // Persist to backend if we have a worldId
      if (worldId && poiToRemove) {
        deletePOIMutation.mutate(
          { poiId: id, worldId },
          {
            onError: (error) => {
              // Re-add the POI on error
              updateFeatures((prev) => ({
                ...prev,
                pois: [...prev.pois, poiToRemove],
              }));
              console.error("Failed to delete POI:", error);
              toast?.addToast(
                "Failed to delete POI. Please try again.",
                "error"
              );
            },
          }
        );
      }
    },
    [worldId, updateFeatures, deletePOIMutation, toast]
  );

  const updatePOI = useCallback(
    (id: string, updates: Partial<Omit<POI, "id">>) => {
      // Find the current POI for rollback
      const currentPOI = featuresRef.current.pois.find((p) => p.id === id);
      if (!currentPOI) return;

      // CITY-472: Regenerate footprint when type or position changes
      const effectiveUpdates = { ...updates };
      if (updates.type !== undefined || updates.position !== undefined) {
        const newType = updates.type ?? currentPOI.type;
        const newPosition = updates.position ?? currentPOI.position;
        effectiveUpdates.footprint = generatePOIFootprint(newType, newPosition) ?? undefined;
      }

      // CITY-441/CITY-442: Regenerate campus paths when footprint changes
      let newCampusPaths: Road[] = [];
      if (effectiveUpdates.footprint && effectiveUpdates.footprint.length >= 3) {
        const newType = updates.type ?? currentPOI.type;
        const newPosition = updates.position ?? currentPOI.position;
        newCampusPaths = generateCampusPaths(effectiveUpdates.footprint, newPosition, newType, id, currentPOI.districtId);
      }

      // Optimistically update local state (remove old campus paths for this POI, add new ones)
      updateFeatures((prev) => ({
        ...prev,
        pois: prev.pois.map((p) =>
          p.id === id ? { ...p, ...effectiveUpdates } : p
        ),
        roads: [
          ...prev.roads.filter((r) => !r.id.includes(`${id}-path-`)),
          ...newCampusPaths,
        ],
      }));

      // Persist to API if worldId is provided
      if (worldId) {
        // Build API update payload from the updates
        const apiUpdate: Record<string, unknown> = {};
        if (updates.name !== undefined) apiUpdate.name = updates.name;
        if (updates.type !== undefined) apiUpdate.type = updates.type;
        if (updates.position !== undefined) {
          apiUpdate.position_x = updates.position.x;
          apiUpdate.position_y = updates.position.y;
        }
        // Persist regenerated footprint when type/position changes (CITY-440)
        if (effectiveUpdates.footprint !== undefined) {
          apiUpdate.footprint = effectiveUpdates.footprint;
        }

        // Only call API if there are fields to update
        if (Object.keys(apiUpdate).length > 0) {
          updatePOIMutation.mutate(
            { poiId: id, data: apiUpdate, worldId },
            {
              onError: (error) => {
                // Rollback to previous state on error
                updateFeatures((prev) => ({
                  ...prev,
                  pois: prev.pois.map((p) =>
                    p.id === id ? currentPOI : p
                  ),
                }));
                console.error("Failed to update POI:", error);
                toast?.addToast(
                  "Failed to update POI. Please try again.",
                  "error"
                );
              },
            }
          );
        }
      }
    },
    [worldId, updateFeatures, updatePOIMutation, toast]
  );

  const updateDistrict = useCallback(
    (id: string, updates: Partial<Omit<District, "id">>) => {
      // Find the current district for rollback
      const currentDistrict = featuresRef.current.districts.find((d) => d.id === id);
      if (!currentDistrict) return;

      // Handle district type changes by updating density defaults and regenerating street grid
      // (CITY-297: block sizes vary by type, so grid must be regenerated)
      const typeChanged = updates.type !== undefined && updates.type !== currentDistrict.type;
      if (typeChanged) {
        const newType = updates.type as DistrictType;
        const newDefaultDensity = DEFAULT_DENSITY_BY_TYPE[newType] ?? 5;

        // Check if the user had manually customized density (differs from current type default)
        const currentTypeDefault = DEFAULT_DENSITY_BY_TYPE[currentDistrict.type as DistrictType] ?? 5;
        const currentDensity = currentDistrict.personality?.density ?? currentTypeDefault;
        const userCustomizedDensity = currentDensity !== currentTypeDefault;

        // Only reset density if user hasn't manually customized it
        const updatedDensity = userCustomizedDensity ? currentDensity : newDefaultDensity;
        const updatedPersonality: DistrictPersonality = {
          ...(currentDistrict.personality ?? DEFAULT_DISTRICT_PERSONALITY),
          ...(updates.personality ?? {}),
          density: updatedDensity,
        };

        // Build updated district to regenerate grid with new type
        const updatedDistrictForGrid: District = {
          ...currentDistrict,
          ...updates,
          type: newType,
          personality: updatedPersonality,
        };

        // Regenerate street grid with new type's block sizes
        const { roads: newRoads, gridAngle: actualAngle } = regenerateStreetGridWithAngle(
          updatedDistrictForGrid,
          currentDistrict.gridAngle ?? 0,
          updatedPersonality.sprawl_compact ?? 0.5,
          updatedPersonality.era_year
        );

        // Update district with new type, personality, and regenerated roads
        updateFeatures((prev) => {
          const otherRoads = prev.roads.filter((r) => !r.id.startsWith(id));
          return {
            ...prev,
            districts: prev.districts.map((d) =>
              d.id === id
                ? { ...d, ...updates, type: newType, personality: updatedPersonality, gridAngle: actualAngle }
                : d
            ),
            roads: [...otherRoads, ...newRoads],
          };
        });

        // Persist to API
        if (worldId && !pendingCreates.current.has(id)) {
          const streetGridPayload: Record<string, unknown> = {
            roads: newRoads.map((r) => ({
              id: r.id,
              name: r.name,
              roadClass: r.roadClass,
              points: r.line.points.map((p) => ({ x: p.x, y: p.y })),
            })),
            gridAngle: actualAngle,
            personality: updatedPersonality,
          };

          const apiUpdate: Record<string, unknown> = {
            type: toApiDistrictType(newType),
            street_grid: streetGridPayload,
          };
          if (updates.name !== undefined) apiUpdate.name = updates.name;
          if (updates.isHistoric !== undefined) apiUpdate.historic = updates.isHistoric;

          updateDistrictMutation.mutate(
            { districtId: id, data: apiUpdate, worldId },
            {
              onError: (error) => {
                // Rollback to previous state on error
                updateFeatures((prev) => ({
                  ...prev,
                  districts: prev.districts.map((d) =>
                    d.id === id ? currentDistrict : d
                  ),
                  roads: prev.roads.filter((r) => !r.id.startsWith(id)),
                }));
                console.error("Failed to update district type:", error);
                toast?.addToast(
                  "Failed to update district type. Please try again.",
                  "error"
                );
              },
            }
          );
        }
        return;
      }

      // Handle gridAngle changes by regenerating street grid
      if (updates.gridAngle !== undefined && updates.gridAngle !== currentDistrict.gridAngle) {
        const { roads: newRoads, gridAngle: actualAngle } = regenerateStreetGridWithAngle(
          currentDistrict,
          updates.gridAngle,
          currentDistrict.personality?.sprawl_compact ?? 0.5,
          currentDistrict.personality?.era_year
        );

        // Update district with new gridAngle and replace its roads
        updateFeatures((prev) => {
          const otherRoads = prev.roads.filter((r) => r.districtId !== id);
          return {
            ...prev,
            districts: prev.districts.map((d) =>
              d.id === id ? { ...d, ...updates, gridAngle: actualAngle } : d
            ),
            roads: [...otherRoads, ...newRoads],
          };
        });

        // Persist the updated street grid to the API
        if (worldId && !pendingCreates.current.has(id)) {
          const updatedDistrict = featuresRef.current.districts.find((d) => d.id === id);
          if (updatedDistrict) {
            const streetGridPayload: Record<string, unknown> = {
              roads: newRoads.map((r) => ({
                id: r.id,
                name: r.name,
                roadClass: r.roadClass,
                districtId: r.districtId,
                points: r.line.points.map((p) => ({ x: p.x, y: p.y })),
              })),
              gridAngle: actualAngle,
              personality: updatedDistrict.personality,
            };
            updateDistrictMutation.mutate(
              { districtId: id, data: { street_grid: streetGridPayload }, worldId },
              {
                onError: (error) => {
                  console.error("Failed to persist street grid update:", error);
                },
              }
            );
          }
        }
        return;
      }

      // Optimistically update local state
      updateFeatures((prev) => ({
        ...prev,
        districts: prev.districts.map((d) =>
          d.id === id ? { ...d, ...updates } : d
        ),
      }));

      // Persist to API if worldId is provided and not a pending create
      if (worldId && !pendingCreates.current.has(id)) {
        // Build API update payload from the updates
        const apiUpdate: Record<string, unknown> = {};
        if (updates.name !== undefined) apiUpdate.name = updates.name;
        if (updates.isHistoric !== undefined) apiUpdate.historic = updates.isHistoric;
        if (updates.type !== undefined) apiUpdate.type = toApiDistrictType(updates.type);
        if (updates.fillColor !== undefined) apiUpdate.fill_color = updates.fillColor || null;

        // Only call API if there are fields to update
        if (Object.keys(apiUpdate).length > 0) {
          updateDistrictMutation.mutate(
            { districtId: id, data: apiUpdate, worldId },
            {
              onError: (error) => {
                // Rollback to previous state on error
                updateFeatures((prev) => ({
                  ...prev,
                  districts: prev.districts.map((d) =>
                    d.id === id ? currentDistrict : d
                  ),
                }));
                console.error("Failed to update district:", error);
                toast?.addToast(
                  "Failed to update district. Please try again.",
                  "error"
                );
              },
            }
          );
        }
      }
    },
    [worldId, updateFeatures, updateDistrictMutation, toast]
  );

  const updateRoad = useCallback(
    (id: string, updates: Partial<Omit<Road, "id">>) => {
      // Find the current road for potential rollback
      const currentRoad = featuresRef.current.roads.find((r) => r.id === id);
      if (!currentRoad) return;

      // Optimistically update local state
      updateFeatures((prev) => ({
        ...prev,
        roads: prev.roads.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      }));

      // Persist to API if worldId is provided (CITY-249)
      if (worldId) {
        const apiUpdate: RoadEdgeUpdate = {};
        if (updates.name !== undefined) apiUpdate.name = updates.name;
        if (updates.roadClass !== undefined) apiUpdate.road_class = toApiRoadClass(updates.roadClass);
        if (updates.line !== undefined) {
          // Geometry stores intermediate points (excluding endpoints)
          apiUpdate.geometry = updates.line.points.slice(1, -1).map(p => ({ x: p.x, y: p.y }));
        }

        if (Object.keys(apiUpdate).length > 0) {
          updateRoadEdgeMutation.mutate(
            { edgeId: id, data: apiUpdate, worldId },
            {
              onError: (error) => {
                // Rollback to previous state on error
                updateFeatures((prev) => ({
                  ...prev,
                  roads: prev.roads.map((r) =>
                    r.id === id ? currentRoad : r
                  ),
                }));
                console.error("Failed to update road:", error);
                toast?.addToast(
                  "Failed to update road. Please try again.",
                  "error"
                );
              },
            }
          );
        }
      }
    },
    [worldId, updateFeatures, updateRoadEdgeMutation, toast]
  );

  const addNeighborhood = useCallback(
    (neighborhood: Neighborhood) => {
      const tempId = neighborhood.id;

      // Optimistically add to local state
      updateFeatures((prev) => ({
        ...prev,
        neighborhoods: [...prev.neighborhoods, neighborhood],
      }));

      // Persist to API if worldId is provided
      if (worldId) {
        pendingCreates.current.add(tempId);

        createNeighborhoodMutation.mutate(
          {
            worldId,
            data: {
              name: neighborhood.name,
              geometry: toGeoJsonGeometry(neighborhood.polygon.points),
              label_color: neighborhood.labelColor,
              accent_color: neighborhood.accentColor,
            },
          },
          {
            onSuccess: (apiNeighborhood) => {
              // Replace temp ID with real ID from API
              pendingCreates.current.delete(tempId);
              updateFeatures((prev) => ({
                ...prev,
                neighborhoods: prev.neighborhoods.map((n) =>
                  n.id === tempId ? { ...n, id: apiNeighborhood.id } : n
                ),
              }));
            },
            onError: (error) => {
              // Remove the optimistically added neighborhood on error
              pendingCreates.current.delete(tempId);
              updateFeatures((prev) => ({
                ...prev,
                neighborhoods: prev.neighborhoods.filter((n) => n.id !== tempId),
              }));
              console.error("Failed to save neighborhood:", error);
            },
          }
        );
      }
    },
    [worldId, updateFeatures, createNeighborhoodMutation]
  );

  const removeNeighborhood = useCallback(
    (id: string) => {
      // Find the neighborhood first
      const neighborhoodToRemove = featuresRef.current.neighborhoods.find((n) => n.id === id);
      if (!neighborhoodToRemove) return;

      // Optimistically remove from local state
      updateFeatures((prev) => ({
        ...prev,
        neighborhoods: prev.neighborhoods.filter((n) => n.id !== id),
      }));

      // Delete from API if worldId is provided and not a pending create
      if (worldId && !pendingCreates.current.has(id)) {
        deleteNeighborhoodMutation.mutate(
          { neighborhoodId: id, worldId },
          {
            onError: (error) => {
              // Re-add the neighborhood on error
              updateFeatures((prev) => ({
                ...prev,
                neighborhoods: [...prev.neighborhoods, neighborhoodToRemove],
              }));
              console.error("Failed to delete neighborhood:", error);
            },
          }
        );
      }
    },
    [worldId, updateFeatures, deleteNeighborhoodMutation]
  );

  const updateNeighborhood = useCallback(
    (id: string, updates: Partial<Omit<Neighborhood, "id">>) => {
      // Find the current neighborhood for rollback
      const currentNeighborhood = featuresRef.current.neighborhoods.find((n) => n.id === id);
      if (!currentNeighborhood) return;

      // Optimistically update local state
      updateFeatures((prev) => ({
        ...prev,
        neighborhoods: prev.neighborhoods.map((n) =>
          n.id === id ? { ...n, ...updates } : n
        ),
      }));

      // Persist to API if worldId is provided and not a pending create
      if (worldId && !pendingCreates.current.has(id)) {
        // Build API update payload from the updates
        const apiUpdate: Record<string, unknown> = {};
        if (updates.name !== undefined) apiUpdate.name = updates.name;
        if (updates.labelColor !== undefined) apiUpdate.label_color = updates.labelColor;
        if (updates.accentColor !== undefined) apiUpdate.accent_color = updates.accentColor;
        if (updates.polygon !== undefined) apiUpdate.geometry = toGeoJsonGeometry(updates.polygon.points);

        // Only call API if there are fields to update
        if (Object.keys(apiUpdate).length > 0) {
          updateNeighborhoodMutation.mutate(
            { neighborhoodId: id, data: apiUpdate, worldId },
            {
              onError: (error) => {
                // Rollback to previous state on error
                updateFeatures((prev) => ({
                  ...prev,
                  neighborhoods: prev.neighborhoods.map((n) =>
                    n.id === id ? currentNeighborhood : n
                  ),
                }));
                console.error("Failed to update neighborhood:", error);
              },
            }
          );
        }
      }
    },
    [worldId, updateFeatures, updateNeighborhoodMutation]
  );

  const setCityLimits = useCallback(
    (cityLimits: CityLimits) => {
      // Only one city limits per world, so this replaces any existing
      updateFeatures((prev) => ({
        ...prev,
        cityLimits,
      }));

      if (worldId) {
        upsertCityLimitsMutation.mutate({
          worldId,
          data: {
            name: cityLimits.name,
            boundary: {
              points: cityLimits.boundary.points.map((p) => ({ x: p.x, y: p.y })),
            },
            established: cityLimits.established,
          },
        });
      }
    },
    [updateFeatures, worldId, upsertCityLimitsMutation]
  );

  const removeCityLimits = useCallback(() => {
    updateFeatures((prev) => ({
      ...prev,
      cityLimits: undefined,
    }));

    if (worldId) {
      deleteCityLimitsMutation.mutate(worldId);
    }
  }, [updateFeatures, worldId, deleteCityLimitsMutation]);

  const clearFeatures = useCallback(() => {
    updateFeatures(() => EMPTY_FEATURES);
  }, [updateFeatures]);

  const setFeatures = useCallback(
    (data: FeaturesData) => {
      updateFeatures(() => data);
    },
    [updateFeatures]
  );

  const isLoading = !isInitialized || (!!worldId && (isLoadingDistricts || isLoadingNeighborhoods || isLoadingPOIs || isLoadingRoads));
  const error = loadDistrictsError || loadNeighborhoodsError || loadPOIsError || loadRoadsError || null;

  // State context — changes whenever features, isLoading, or error change.
  const stateValue: FeaturesStateValue = useMemo(() => ({
    features,
    isLoading,
    error,
  }), [features, isLoading, error]);

  // Dispatch context — only changes when callback identities change (rare).
  const dispatchValue: FeaturesDispatchValue = useMemo(() => ({
    addDistrict,
    previewDistrictPlacement,
    addDistrictWithGeometry,
    addPOI,
    addRoads,
    addInterchanges,
    removeDistrict,
    removeRoad,
    removePOI,
    updatePOI,
    updateDistrict,
    updateRoad,
    addNeighborhood,
    removeNeighborhood,
    updateNeighborhood,
    setCityLimits,
    removeCityLimits,
    clearFeatures,
    setFeatures,
  }), [
    addDistrict,
    previewDistrictPlacement,
    addDistrictWithGeometry,
    addPOI,
    addRoads,
    addInterchanges,
    removeDistrict,
    removeRoad,
    removePOI,
    updatePOI,
    updateDistrict,
    updateRoad,
    addNeighborhood,
    removeNeighborhood,
    updateNeighborhood,
    setCityLimits,
    removeCityLimits,
    clearFeatures,
    setFeatures,
  ]);

  // Combined value for backward-compatible useFeatures/useFeaturesOptional hooks.
  const combinedValue: FeaturesContextValue = useMemo(() => ({
    ...stateValue,
    ...dispatchValue,
  }), [stateValue, dispatchValue]);

  return (
    <FeaturesStateContext.Provider value={stateValue}>
      <FeaturesDispatchContext.Provider value={dispatchValue}>
        <FeaturesContext.Provider value={combinedValue}>
          {children}
        </FeaturesContext.Provider>
      </FeaturesDispatchContext.Provider>
    </FeaturesStateContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Granular hooks (prefer these for new code)
// ---------------------------------------------------------------------------

/**
 * Hook to access read-only features state (features, isLoading, error).
 * Throws if not within a FeaturesProvider.
 * Consumers using this hook will NOT re-render when dispatch methods change.
 */
export function useFeaturesState(): FeaturesStateValue {
  const context = useContext(FeaturesStateContext);
  if (!context) {
    throw new Error("useFeaturesState must be used within a FeaturesProvider");
  }
  return context;
}

/**
 * Optionally access read-only features state.
 * Returns null if not within a FeaturesProvider.
 */
export function useFeaturesStateOptional(): FeaturesStateValue | null {
  return useContext(FeaturesStateContext);
}

/**
 * Hook to access features dispatch methods (add, remove, update).
 * Throws if not within a FeaturesProvider.
 * Consumers using this hook will NOT re-render when features data changes.
 */
export function useFeaturesDispatch(): FeaturesDispatchValue {
  const context = useContext(FeaturesDispatchContext);
  if (!context) {
    throw new Error("useFeaturesDispatch must be used within a FeaturesProvider");
  }
  return context;
}

/**
 * Optionally access features dispatch methods.
 * Returns null if not within a FeaturesProvider.
 */
export function useFeaturesDispatchOptional(): FeaturesDispatchValue | null {
  return useContext(FeaturesDispatchContext);
}

// ---------------------------------------------------------------------------
// Backward-compatible hooks (combine state + dispatch)
// ---------------------------------------------------------------------------

/**
 * Hook to access the full features context (state + dispatch).
 * Throws if not within a FeaturesProvider.
 *
 * Prefer useFeaturesState() or useFeaturesDispatch() in new code for
 * better render performance.
 */
export function useFeatures(): FeaturesContextValue {
  const context = useContext(FeaturesContext);
  if (!context) {
    throw new Error("useFeatures must be used within a FeaturesProvider");
  }
  return context;
}

/**
 * Optionally access the full features context (state + dispatch).
 * Returns null if not within a FeaturesProvider.
 */
export function useFeaturesOptional(): FeaturesContextValue | null {
  return useContext(FeaturesContext);
}
