/**
 * React hook for using the snap-to-geometry engine.
 *
 * Provides a simple interface for finding snap points near the cursor
 * and accessing snap state.
 */

import { useState, useCallback, useRef } from "react";
import { SnapEngine } from "./SnapEngine";
import type {
  SnapConfig,
  SnapResult,
  SnapPoint,
  SnapLineSegment,
  SnapGeometryProvider,
} from "./types";

export interface UseSnapOptions {
  /** Initial snap configuration */
  config?: Partial<SnapConfig>;
  /** Whether snapping is enabled */
  enabled?: boolean;
}

export interface UseSnapResult {
  /** The current snap result (null if no query has been made) */
  result: SnapResult | null;
  /** The current best snap point (convenience accessor) */
  snapPoint: SnapPoint | null;
  /** Whether there is an active snap point */
  isSnapping: boolean;
  /** Whether snapping is enabled */
  enabled: boolean;
  /** Set whether snapping is enabled */
  setEnabled: (enabled: boolean) => void;
  /** Update the snap configuration */
  setConfig: (config: Partial<SnapConfig>) => void;
  /** Query for a snap point at the given cursor position */
  querySnap: (x: number, y: number) => SnapResult;
  /** Clear the current snap result */
  clearSnap: () => void;
  /** Register a geometry provider */
  registerProvider: (provider: SnapGeometryProvider) => void;
  /** Unregister a geometry provider */
  unregisterProvider: (provider: SnapGeometryProvider) => void;
  /** Manually insert line segments */
  insertSegments: (segments: SnapLineSegment[]) => void;
  /** Rebuild the spatial index */
  rebuildIndex: () => void;
  /** Clear the spatial index */
  clearIndex: () => void;
  /** Access to the underlying engine (for advanced use) */
  engine: SnapEngine;
}

export function useSnap(options: UseSnapOptions = {}): UseSnapResult {
  const { config: initialConfig, enabled: initialEnabled = true } = options;

  const engineRef = useRef<SnapEngine | null>(null);
  const [result, setResult] = useState<SnapResult | null>(null);
  const [enabled, setEnabled] = useState(initialEnabled);

  // Initialize engine on first render
  if (!engineRef.current) {
    engineRef.current = new SnapEngine(initialConfig);
  }

  const engine = engineRef.current;

  // Query for snap point
  const querySnap = useCallback(
    (x: number, y: number): SnapResult => {
      if (!enabled) {
        const emptyResult: SnapResult = { snapPoint: null, candidates: [] };
        setResult(emptyResult);
        return emptyResult;
      }

      const snapResult = engine.findSnapPoint(x, y);
      setResult(snapResult);
      return snapResult;
    },
    [engine, enabled]
  );

  // Clear snap result
  const clearSnap = useCallback(() => {
    setResult(null);
  }, []);

  // Update config
  const setConfig = useCallback(
    (newConfig: Partial<SnapConfig>) => {
      engine.setConfig(newConfig);
    },
    [engine]
  );

  // Provider registration
  const registerProvider = useCallback(
    (provider: SnapGeometryProvider) => {
      engine.registerProvider(provider);
    },
    [engine]
  );

  const unregisterProvider = useCallback(
    (provider: SnapGeometryProvider) => {
      engine.unregisterProvider(provider);
    },
    [engine]
  );

  // Segment insertion
  const insertSegments = useCallback(
    (segments: SnapLineSegment[]) => {
      engine.insertSegments(segments);
    },
    [engine]
  );

  // Index management
  const rebuildIndex = useCallback(() => {
    engine.rebuildIndex();
  }, [engine]);

  const clearIndex = useCallback(() => {
    engine.clear();
    setResult(null);
  }, [engine]);

  return {
    result,
    snapPoint: result?.snapPoint ?? null,
    isSnapping: result?.snapPoint != null,
    enabled,
    setEnabled,
    setConfig,
    querySnap,
    clearSnap,
    registerProvider,
    unregisterProvider,
    insertSegments,
    rebuildIndex,
    clearIndex,
    engine,
  };
}
