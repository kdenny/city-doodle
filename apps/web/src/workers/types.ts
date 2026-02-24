/**
 * Type definitions for Web Worker message passing.
 *
 * All data crossing the worker boundary must be serializable (no classes,
 * no DOM refs, no PixiJS objects). Only plain objects, arrays, numbers,
 * strings, and booleans.
 *
 * Each computation task is defined as a request/response pair. The main
 * thread sends a WorkerRequest and receives a WorkerResponse.
 */

import type {
  Point,
  Road,
  Bridge,
  District,
  DistrictType,
  WaterFeature,
  TerrainData,
  WaterfrontType,
} from "../components/canvas/layers/types";
import type {
  DistrictGenerationConfig,
  GeneratedDistrict,
} from "../components/canvas/layers/districtGenerator";

// ---------------------------------------------------------------------------
// District Generation
// ---------------------------------------------------------------------------

export interface GenerateDistrictRequest {
  type: "generateDistrict";
  position: { x: number; y: number };
  seedId: string;
  config?: DistrictGenerationConfig;
}

export interface GenerateDistrictResponse {
  type: "generateDistrict";
  result: GeneratedDistrict;
}

// ---------------------------------------------------------------------------
// District Clipping
// ---------------------------------------------------------------------------

export interface ClipDistrictRequest {
  type: "clipDistrict";
  newPolygon: Point[];
  existingDistricts: District[];
  minAreaWorldUnits?: number;
}

export interface ClipDistrictResponse {
  type: "clipDistrict";
  result: {
    clippedPolygon: Point[];
    adjacentDistrictIds: string[];
    wasClipped: boolean;
    tooSmall: boolean;
  };
}

// ---------------------------------------------------------------------------
// Street Grid Regeneration (for clipped polygon)
// ---------------------------------------------------------------------------

export interface RegenerateGridRequest {
  type: "regenerateGrid";
  clippedPolygon: Point[];
  districtId: string;
  districtType: DistrictType;
  position: { x: number; y: number };
  sprawlCompact?: number;
  gridAngle?: number;
  transitOptions?: { transitStations?: Point[]; transitCar?: number };
  adjacentGridOrigin?: Point;
  eraYear?: number;
}

export interface RegenerateGridResponse {
  type: "regenerateGrid";
  result: { roads: Road[]; gridAngle: number };
}

// ---------------------------------------------------------------------------
// Street Grid Regeneration with Angle
// ---------------------------------------------------------------------------

export interface RegenerateGridAngleRequest {
  type: "regenerateGridAngle";
  district: District;
  newGridAngle: number;
  sprawlCompact?: number;
  eraYear?: number;
}

export interface RegenerateGridAngleResponse {
  type: "regenerateGridAngle";
  result: { roads: Road[]; gridAngle: number };
}

// ---------------------------------------------------------------------------
// Inter-District Roads
// ---------------------------------------------------------------------------

export interface InterDistrictRoadsRequest {
  type: "interDistrictRoads";
  newDistrict: District;
  existingDistricts: District[];
  waterFeatures?: WaterFeature[];
  config?: { maxConnectionDistance?: number; avoidWater?: boolean };
  adjacentDistrictIds?: string[];
}

export interface InterDistrictRoadsResponse {
  type: "interDistrictRoads";
  result: {
    roads: Road[];
    connectedDistrictIds: string[];
  };
}

// ---------------------------------------------------------------------------
// Cross-Boundary Connections
// ---------------------------------------------------------------------------

export interface CrossBoundaryRequest {
  type: "crossBoundary";
  newDistrict: District;
  newDistrictRoads: Road[];
  existingDistricts: District[];
  existingRoads: Road[];
  maxGap?: number;
}

export interface CrossBoundaryResponse {
  type: "crossBoundary";
  result: Road[];
}

// ---------------------------------------------------------------------------
// Bridge Detection
// ---------------------------------------------------------------------------

export interface DetectBridgesRequest {
  type: "detectBridges";
  roads: Road[];
  terrainData: TerrainData | null;
  config?: { maxBridgesPerDistrict?: number; minBridgeLength?: number };
}

export interface DetectBridgesResponse {
  type: "detectBridges";
  result: {
    bridges: Bridge[];
    /** Serialized as entries since Maps aren't transferable */
    bridgeCountByDistrict: [string, number][];
  };
}

// ---------------------------------------------------------------------------
// Waterfront Detection
// ---------------------------------------------------------------------------

export interface DetectWaterfrontRequest {
  type: "detectWaterfront";
  roads: Road[];
  terrainData: TerrainData | null;
  config?: {
    waterfrontThreshold?: number;
    boardwalkThreshold?: number;
    minWaterfrontFraction?: number;
    sampleCount?: number;
  };
}

export interface DetectWaterfrontResponse {
  type: "detectWaterfront";
  result: {
    /** Serialized as entries since Maps aren't transferable */
    waterfrontRoads: [string, WaterfrontType][];
    riverfrontCount: number;
    boardwalkCount: number;
  };
}

// ---------------------------------------------------------------------------
// Union Types
// ---------------------------------------------------------------------------

export type WorkerRequest =
  | GenerateDistrictRequest
  | ClipDistrictRequest
  | RegenerateGridRequest
  | RegenerateGridAngleRequest
  | InterDistrictRoadsRequest
  | CrossBoundaryRequest
  | DetectBridgesRequest
  | DetectWaterfrontRequest;

export type WorkerResponse =
  | GenerateDistrictResponse
  | ClipDistrictResponse
  | RegenerateGridResponse
  | RegenerateGridAngleResponse
  | InterDistrictRoadsResponse
  | CrossBoundaryResponse
  | DetectBridgesResponse
  | DetectWaterfrontResponse;

/**
 * Message envelope sent from main thread to worker.
 * Includes a unique ID for correlating responses.
 */
export interface WorkerRequestMessage {
  id: number;
  request: WorkerRequest;
}

/**
 * Message envelope sent from worker to main thread.
 */
export interface WorkerResponseMessage {
  id: number;
  response?: WorkerResponse;
  error?: string;
}
