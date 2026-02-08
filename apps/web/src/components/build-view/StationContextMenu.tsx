/**
 * CITY-528: Right-click context menu for transit stations.
 *
 * Shows a floating menu with the station name and a "Delete Station" option.
 * Closes when clicking outside or pressing Escape.
 */

import { useEffect, useRef, useCallback } from "react";

interface StationContextMenuProps {
  /** Screen x position */
  x: number;
  /** Screen y position */
  y: number;
  /** Name of the station */
  stationName: string;
  /** Type of station (rail or subway) */
  stationType: "rail" | "subway";
  /** Called when user clicks "Delete Station" */
  onDelete: () => void;
  /** Called when the menu should close (click outside, Escape) */
  onClose: () => void;
}

export function StationContextMenu({
  x,
  y,
  stationName,
  stationType,
  onDelete,
  onClose,
}: StationContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    // Use a timeout to avoid the initial right-click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {/* Station name header */}
      <div className="px-3 py-1.5 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-900 truncate">
          {stationName}
        </div>
        <div className="text-xs text-gray-500">
          {stationType === "subway" ? "Subway" : "Rail"} Station
        </div>
      </div>

      {/* Delete option */}
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        Delete Station
      </button>
    </div>
  );
}
