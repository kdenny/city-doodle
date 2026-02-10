/**
 * CITY-567: Right-click context menu for roads.
 *
 * Shows a floating menu with:
 * - Road name header
 * - "Change class" submenu (highway, arterial, collector, local, trail)
 * - "Rename" option (inline prompt)
 * - "Delete" option
 *
 * Closes when clicking outside or pressing Escape.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { RoadClass } from "../canvas/layers/types";

const ROAD_CLASS_LABELS: Record<RoadClass, string> = {
  highway: "Highway",
  arterial: "Arterial",
  collector: "Collector",
  local: "Local",
  trail: "Trail",
};

const ROAD_CLASSES: RoadClass[] = ["highway", "arterial", "collector", "local", "trail"];

interface RoadContextMenuProps {
  /** Screen x position */
  x: number;
  /** Screen y position */
  y: number;
  /** Current road name */
  roadName?: string;
  /** Current road class */
  roadClass: string;
  /** Called when the user changes the road class */
  onChangeClass: (newClass: RoadClass) => void;
  /** Called when the user renames the road */
  onRename: (newName: string) => void;
  /** Called when the user deletes the road */
  onDelete: () => void;
  /** Called when the menu should close */
  onClose: () => void;
}

export function RoadContextMenu({
  x,
  y,
  roadName,
  roadClass,
  onChangeClass,
  onRename,
  onDelete,
  onClose,
}: RoadContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showClassSubmenu, setShowClassSubmenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(roadName || "");
  const renameInputRef = useRef<HTMLInputElement>(null);

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
        if (isRenaming) {
          setIsRenaming(false);
        } else {
          onClose();
        }
      }
    },
    [onClose, isRenaming]
  );

  useEffect(() => {
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

  // Focus rename input when it appears
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== roadName) {
      onRename(trimmed);
    }
    setIsRenaming(false);
    onClose();
  };

  const displayName = roadName || "Unnamed Road";
  const classLabel = ROAD_CLASS_LABELS[roadClass as RoadClass] || roadClass;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]"
      style={{ left: x, top: y }}
    >
      {/* Road name header */}
      <div className="px-3 py-1.5 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-900 truncate">
          {displayName}
        </div>
        <div className="text-xs text-gray-500">{classLabel}</div>
      </div>

      {/* Rename option */}
      {isRenaming ? (
        <div className="px-3 py-1.5">
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRenameSubmit();
              }
              e.stopPropagation();
            }}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
            placeholder="Road name"
          />
        </div>
      ) : (
        <button
          onClick={() => setIsRenaming(true)}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Rename...
        </button>
      )}

      {/* Change class submenu */}
      <div
        className="relative"
        onMouseEnter={() => setShowClassSubmenu(true)}
        onMouseLeave={() => setShowClassSubmenu(false)}
      >
        <button className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex justify-between items-center">
          Change Class
          <span className="text-xs text-gray-400 ml-2">&rsaquo;</span>
        </button>

        {showClassSubmenu && (
          <div className="absolute left-full top-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px] -mt-1 ml-0.5">
            {ROAD_CLASSES.map((cls) => (
              <button
                key={cls}
                onClick={() => {
                  onChangeClass(cls);
                  onClose();
                }}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  cls === roadClass
                    ? "text-blue-600 bg-blue-50 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {ROAD_CLASS_LABELS[cls]}
                {cls === roadClass && (
                  <span className="ml-2 text-xs text-blue-400">current</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 my-0.5" />

      {/* Delete option */}
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        Delete Road
      </button>
    </div>
  );
}
