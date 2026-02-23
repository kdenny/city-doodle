/**
 * CITY-595: Terrain loading skeleton and error overlays.
 *
 * Displayed on top of the canvas while terrain is generating (pending/generating)
 * or when terrain generation has failed.
 */

import { useState, useEffect } from "react";

// ============================================================================
// Terrain Status Derivation
// ============================================================================

export type TerrainOverlayStatus = "loading" | "ready" | "failed" | null;

/**
 * Derive the aggregate terrain overlay status from tile data.
 *
 * - If any tile has terrain_status 'failed', the overlay shows the error state.
 * - If any tile has 'pending' or 'generating', the overlay shows the loading state.
 * - If all tiles are 'ready' (or have features), the overlay is hidden.
 * - If no tiles exist yet, show loading.
 */
export function deriveTerrainOverlayStatus(
  tiles: Array<{ terrain_status?: string; terrain_error?: string | null }> | undefined
): { status: TerrainOverlayStatus; errorMessage: string | null; failedTileId: string | null } {
  if (!tiles || tiles.length === 0) {
    return { status: "loading", errorMessage: null, failedTileId: null };
  }

  // Check for any failed tile
  const failedTile = (tiles as Array<{ terrain_status?: string; terrain_error?: string | null; id?: string }>).find(
    (t) => t.terrain_status === "failed"
  );
  if (failedTile) {
    return {
      status: "failed",
      errorMessage: failedTile.terrain_error || "Terrain generation failed",
      failedTileId: failedTile.id ?? null,
    };
  }

  // Check if all tiles have terrain ready
  const allReady = tiles.every(
    (t) =>
      t.terrain_status === "ready" ||
      // Fallback for legacy tiles without terrain_status
      (t as Record<string, unknown>).features &&
      typeof (t as Record<string, unknown>).features === "object" &&
      "type" in ((t as Record<string, unknown>).features as Record<string, unknown>)
  );

  if (allReady) {
    return { status: "ready", errorMessage: null, failedTileId: null };
  }

  // Some tiles are still pending/generating
  return { status: "loading", errorMessage: null, failedTileId: null };
}

// ============================================================================
// Loading Overlay
// ============================================================================

interface TerrainLoadingOverlayProps {
  visible: boolean;
}

/**
 * Shimmer/skeleton overlay displayed while terrain is generating.
 * Uses a gradient animation to convey a "scanning the landscape" feel.
 */
export function TerrainLoadingOverlay({ visible }: TerrainLoadingOverlayProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 terrain-shimmer opacity-30" />

      {/* Status indicator */}
      <div className="relative bg-white/90 backdrop-blur-sm rounded-lg px-5 py-3 shadow-md border border-gray-200 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-sm text-gray-600 font-medium">
            Generating terrain<span className="inline-block w-4 text-left">{dots}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error Overlay
// ============================================================================

interface TerrainErrorOverlayProps {
  visible: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  isRetrying: boolean;
}

/**
 * Error overlay displayed when terrain generation fails.
 * Includes the error message and a retry button.
 */
export function TerrainErrorOverlay({
  visible,
  errorMessage,
  onRetry,
  isRetrying,
}: TerrainErrorOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-gray-100/50" />

      {/* Error card */}
      <div className="relative bg-white rounded-lg px-6 py-5 shadow-lg border border-red-200 max-w-sm mx-4">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* Error icon */}
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Terrain generation failed
            </h3>
            {errorMessage && (
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                {errorMessage}
              </p>
            )}
          </div>

          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 disabled:bg-gray-400 rounded-md transition-colors"
          >
            {isRetrying ? (
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Retrying...
              </span>
            ) : (
              "Retry"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Fade-in wrapper for terrain content
// ============================================================================

interface TerrainFadeInProps {
  show: boolean;
  children: React.ReactNode;
}

/**
 * Wrapper that applies a CSS opacity transition when terrain data arrives.
 * The canvas container fades from transparent to opaque.
 */
export function TerrainFadeIn({ show, children }: TerrainFadeInProps) {
  return (
    <div
      className="w-full h-full transition-opacity duration-500 ease-in-out"
      style={{ opacity: show ? 1 : 0 }}
    >
      {children}
    </div>
  );
}
