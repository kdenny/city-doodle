/**
 * Web Worker for heavy geometry computations.
 *
 * This worker handles CPU-intensive operations off the main thread:
 * - District geometry generation (polygon + street grid)
 * - District polygon clipping against existing districts
 * - Street grid regeneration (after water clipping or angle changes)
 * - Inter-district road generation
 * - Cross-boundary collector connections
 * - Bridge detection
 * - Waterfront road detection
 *
 * All functions imported here are pure computation (no DOM, no PixiJS).
 * Data is passed as plain serializable objects via structured cloning.
 */

import type {
  WorkerRequestMessage,
  WorkerResponseMessage,
  WorkerResponse,
} from "./types";
import {
  generateDistrictGeometry,
  clipDistrictAgainstExisting,
  regenerateStreetGridForClippedDistrict,
  regenerateStreetGridWithAngle,
} from "../components/canvas/layers/districtGenerator";
import {
  generateInterDistrictRoads,
  generateCrossBoundaryConnections,
} from "../components/canvas/layers/interDistrictRoads";
import { detectBridges } from "../components/canvas/layers/bridgeDetection";
import { detectWaterfrontRoads } from "../components/canvas/layers/waterfrontDetection";

/**
 * Handle incoming computation requests.
 */
function handleRequest(msg: WorkerRequestMessage): WorkerResponseMessage {
  const { id, request } = msg;

  try {
    let response: WorkerResponse;

    switch (request.type) {
      case "generateDistrict": {
        const result = generateDistrictGeometry(
          request.position,
          request.seedId,
          request.config
        );
        response = { type: "generateDistrict", result };
        break;
      }

      case "clipDistrict": {
        const result = clipDistrictAgainstExisting(
          request.newPolygon,
          request.existingDistricts,
          request.minAreaWorldUnits
        );
        response = { type: "clipDistrict", result };
        break;
      }

      case "regenerateGrid": {
        const result = regenerateStreetGridForClippedDistrict(
          request.clippedPolygon,
          request.districtId,
          request.districtType,
          request.position,
          request.sprawlCompact,
          request.gridAngle,
          request.transitOptions,
          request.adjacentGridOrigin,
          request.eraYear
        );
        response = { type: "regenerateGrid", result };
        break;
      }

      case "regenerateGridAngle": {
        const result = regenerateStreetGridWithAngle(
          request.district,
          request.newGridAngle,
          request.sprawlCompact,
          request.eraYear
        );
        response = { type: "regenerateGridAngle", result };
        break;
      }

      case "interDistrictRoads": {
        const result = generateInterDistrictRoads(
          request.newDistrict,
          request.existingDistricts,
          request.waterFeatures ?? [],
          request.config ?? {},
          request.adjacentDistrictIds ?? []
        );
        response = { type: "interDistrictRoads", result };
        break;
      }

      case "crossBoundary": {
        const result = generateCrossBoundaryConnections(
          request.newDistrict,
          request.newDistrictRoads,
          request.existingDistricts,
          request.existingRoads,
          request.maxGap
        );
        response = { type: "crossBoundary", result };
        break;
      }

      case "detectBridges": {
        const result = detectBridges(
          request.roads,
          request.terrainData,
          request.config
        );
        // Serialize the Map to entries since Maps can't cross the worker boundary
        response = {
          type: "detectBridges",
          result: {
            bridges: result.bridges,
            bridgeCountByDistrict: Array.from(result.bridgeCountByDistrict.entries()),
          },
        };
        break;
      }

      case "detectWaterfront": {
        const result = detectWaterfrontRoads(
          request.roads,
          request.terrainData,
          request.config
        );
        // Serialize the Map to entries since Maps can't cross the worker boundary
        response = {
          type: "detectWaterfront",
          result: {
            waterfrontRoads: Array.from(result.waterfrontRoads.entries()),
            riverfrontCount: result.riverfrontCount,
            boardwalkCount: result.boardwalkCount,
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown request type: ${(request as never as { type: string }).type}`);
    }

    return { id, response };
  } catch (err) {
    return {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Listen for messages from the main thread
self.onmessage = (event: MessageEvent<WorkerRequestMessage>) => {
  const result = handleRequest(event.data);
  self.postMessage(result);
};
