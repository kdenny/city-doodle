/**
 * Web Worker client for offloading heavy computations.
 *
 * Provides a promise-based API: `const result = await runInWorker('generateDistrict', input)`
 *
 * ## Architecture
 * - Uses Vite's native Web Worker support (`new URL('./worker.ts', import.meta.url)`)
 * - Single worker instance is lazily created on first call
 * - Messages are correlated via incrementing IDs
 * - Graceful fallback: if Web Workers are unavailable, computations run on the main thread
 *
 * ## Serialization
 * All data passed to/from the worker must be serializable via structured cloning.
 * No class instances, DOM elements, or PixiJS objects. Only plain data types.
 */

import type {
  WorkerRequest,
  WorkerResponse,
  WorkerRequestMessage,
  WorkerResponseMessage,
  GenerateDistrictRequest,
  GenerateDistrictResponse,
  ClipDistrictRequest,
  ClipDistrictResponse,
  RegenerateGridRequest,
  RegenerateGridResponse,
  RegenerateGridAngleRequest,
  RegenerateGridAngleResponse,
  InterDistrictRoadsRequest,
  InterDistrictRoadsResponse,
  CrossBoundaryRequest,
  CrossBoundaryResponse,
  DetectBridgesRequest,
  DetectBridgesResponse,
  DetectWaterfrontRequest,
  DetectWaterfrontResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Type mapping: request type string -> response type
// ---------------------------------------------------------------------------

type RequestTypeMap = {
  generateDistrict: { request: GenerateDistrictRequest; response: GenerateDistrictResponse };
  clipDistrict: { request: ClipDistrictRequest; response: ClipDistrictResponse };
  regenerateGrid: { request: RegenerateGridRequest; response: RegenerateGridResponse };
  regenerateGridAngle: { request: RegenerateGridAngleRequest; response: RegenerateGridAngleResponse };
  interDistrictRoads: { request: InterDistrictRoadsRequest; response: InterDistrictRoadsResponse };
  crossBoundary: { request: CrossBoundaryRequest; response: CrossBoundaryResponse };
  detectBridges: { request: DetectBridgesRequest; response: DetectBridgesResponse };
  detectWaterfront: { request: DetectWaterfrontRequest; response: DetectWaterfrontResponse };
};

type RequestType = keyof RequestTypeMap;

// ---------------------------------------------------------------------------
// Worker manager
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let messageId = 0;
const pendingRequests = new Map<number, {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
}>();

/** Whether we should fall back to main-thread execution */
let useFallback = false;

/**
 * Get or create the shared worker instance.
 * Returns null if Web Workers are not available.
 */
function getWorker(): Worker | null {
  if (useFallback) return null;

  if (worker) return worker;

  try {
    // Vite's native Web Worker support: the URL constructor tells Vite to bundle
    // the worker as a separate chunk with its own dependency tree.
    worker = new Worker(
      new URL("./computationWorker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
      const { id, response, error } = event.data;
      const pending = pendingRequests.get(id);
      if (!pending) return;

      pendingRequests.delete(id);

      if (error) {
        pending.reject(new Error(error));
      } else if (response) {
        pending.resolve(response);
      } else {
        pending.reject(new Error("Worker returned empty response"));
      }
    };

    worker.onerror = (event) => {
      console.warn(
        "CITY-235: Web Worker error, falling back to main thread",
        event.message
      );
      // Reject all pending requests so they can retry on main thread
      for (const [id, pending] of pendingRequests) {
        pending.reject(new Error(`Worker error: ${event.message}`));
        pendingRequests.delete(id);
      }
      useFallback = true;
      worker = null;
    };

    return worker;
  } catch (err) {
    console.warn(
      "CITY-235: Web Workers not available, using main thread fallback",
      err
    );
    useFallback = true;
    return null;
  }
}

/**
 * Execute a computation in the Web Worker.
 *
 * @returns Promise that resolves with the worker's response
 */
function sendToWorker(request: WorkerRequest): Promise<WorkerResponse> {
  const w = getWorker();

  if (!w) {
    // Fallback: run on main thread
    return runOnMainThread(request);
  }

  return new Promise<WorkerResponse>((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, { resolve, reject });

    const message: WorkerRequestMessage = { id, request };
    w.postMessage(message);
  });
}

// ---------------------------------------------------------------------------
// Main-thread fallback
// ---------------------------------------------------------------------------

/**
 * Fallback: run computation on the main thread when workers are unavailable.
 * Lazy-imports the computation modules to keep the same code paths.
 */
async function runOnMainThread(request: WorkerRequest): Promise<WorkerResponse> {
  switch (request.type) {
    case "generateDistrict": {
      const { generateDistrictGeometry } = await import(
        "../components/canvas/layers/districtGenerator"
      );
      const result = generateDistrictGeometry(
        request.position,
        request.seedId,
        request.config
      );
      return { type: "generateDistrict", result };
    }

    case "clipDistrict": {
      const { clipDistrictAgainstExisting } = await import(
        "../components/canvas/layers/districtGenerator"
      );
      const result = clipDistrictAgainstExisting(
        request.newPolygon,
        request.existingDistricts,
        request.minAreaWorldUnits
      );
      return { type: "clipDistrict", result };
    }

    case "regenerateGrid": {
      const { regenerateStreetGridForClippedDistrict } = await import(
        "../components/canvas/layers/districtGenerator"
      );
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
      return { type: "regenerateGrid", result };
    }

    case "regenerateGridAngle": {
      const { regenerateStreetGridWithAngle } = await import(
        "../components/canvas/layers/districtGenerator"
      );
      const result = regenerateStreetGridWithAngle(
        request.district,
        request.newGridAngle,
        request.sprawlCompact,
        request.eraYear
      );
      return { type: "regenerateGridAngle", result };
    }

    case "interDistrictRoads": {
      const { generateInterDistrictRoads } = await import(
        "../components/canvas/layers/interDistrictRoads"
      );
      const result = generateInterDistrictRoads(
        request.newDistrict,
        request.existingDistricts,
        request.waterFeatures ?? [],
        request.config ?? {},
        request.adjacentDistrictIds ?? []
      );
      return { type: "interDistrictRoads", result };
    }

    case "crossBoundary": {
      const { generateCrossBoundaryConnections } = await import(
        "../components/canvas/layers/interDistrictRoads"
      );
      const result = generateCrossBoundaryConnections(
        request.newDistrict,
        request.newDistrictRoads,
        request.existingDistricts,
        request.existingRoads,
        request.maxGap
      );
      return { type: "crossBoundary", result };
    }

    case "detectBridges": {
      const { detectBridges } = await import(
        "../components/canvas/layers/bridgeDetection"
      );
      const result = detectBridges(
        request.roads,
        request.terrainData,
        request.config
      );
      return {
        type: "detectBridges",
        result: {
          bridges: result.bridges,
          bridgeCountByDistrict: Array.from(
            result.bridgeCountByDistrict.entries()
          ),
        },
      };
    }

    case "detectWaterfront": {
      const { detectWaterfrontRoads } = await import(
        "../components/canvas/layers/waterfrontDetection"
      );
      const result = detectWaterfrontRoads(
        request.roads,
        request.terrainData,
        request.config
      );
      return {
        type: "detectWaterfront",
        result: {
          waterfrontRoads: Array.from(result.waterfrontRoads.entries()),
          riverfrontCount: result.riverfrontCount,
          boardwalkCount: result.boardwalkCount,
        },
      };
    }

    default:
      throw new Error(`Unknown request type: ${(request as never as { type: string }).type}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a computation in the Web Worker (or on the main thread as fallback).
 *
 * Usage:
 * ```ts
 * const response = await runInWorker("generateDistrict", {
 *   type: "generateDistrict",
 *   position: { x: 100, y: 200 },
 *   seedId: "residential",
 * });
 * // response.result is GeneratedDistrict
 * ```
 *
 * @param _type - The computation type (for type inference)
 * @param request - The full request payload (must include `type` field matching)
 * @returns Promise resolving to the typed response
 */
export async function runInWorker<T extends RequestType>(
  _type: T,
  request: RequestTypeMap[T]["request"]
): Promise<RequestTypeMap[T]["response"]> {
  const response = await sendToWorker(request);
  return response as RequestTypeMap[T]["response"];
}

/**
 * Terminate the worker and clean up resources.
 * Call this on app unmount if needed.
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  // Reject any pending requests
  for (const [id, pending] of pendingRequests) {
    pending.reject(new Error("Worker terminated"));
    pendingRequests.delete(id);
  }
}

/**
 * Check if the worker is currently active (not in fallback mode).
 */
export function isWorkerActive(): boolean {
  return !useFallback && (worker !== null || typeof Worker !== "undefined");
}
