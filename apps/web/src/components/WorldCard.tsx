/**
 * World card component for the dashboard grid.
 *
 * Displays a clickable card with thumbnail placeholder, world name,
 * last-edited timestamp, stats, and an overflow menu for actions.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { World } from "../api/types";
import { WorldThumbnail } from "./WorldThumbnail";

/** Format a date as a relative "time ago" string */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export interface WorldCardProps {
  world: World;
  /** Stats to display (optional) */
  stats?: { districts?: number; roads?: number; pois?: number };
  onClick: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function WorldCard({
  world,
  stats,
  onClick,
  onRename,
  onDuplicate,
  onDelete,
}: WorldCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(world.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  }, []);

  const handleRenameStart = useCallback(() => {
    setMenuOpen(false);
    setRenameName(world.name);
    setIsRenaming(true);
  }, [world.name]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameName.trim();
    if (trimmed && trimmed !== world.name) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  }, [renameName, world.name, onRename]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleRenameSubmit();
      } else if (e.key === "Escape") {
        setIsRenaming(false);
      }
    },
    [handleRenameSubmit]
  );

  const handleDuplicate = useCallback(() => {
    setMenuOpen(false);
    onDuplicate();
  }, [onDuplicate]);

  const handleDelete = useCallback(() => {
    setMenuOpen(false);
    onDelete();
  }, [onDelete]);

  const statsText = stats
    ? [
        stats.districts != null && `${stats.districts} districts`,
        stats.roads != null && `${stats.roads} roads`,
        stats.pois != null && `${stats.pois} POIs`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div
      onClick={isRenaming ? undefined : onClick}
      className="bg-white rounded-lg shadow overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-blue-200 border border-transparent group"
      data-testid="world-card"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isRenaming) onClick();
      }}
    >
      {/* Thumbnail */}
      <WorldThumbnail worldId={world.id} className="h-36" />

      {/* Card body */}
      <div className="p-3 relative">
        {/* World name */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-base text-gray-900 w-full border border-blue-400 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="rename-input"
          />
        ) : (
          <h3 className="font-semibold text-base text-gray-900 truncate pr-8">
            {world.name}
          </h3>
        )}

        {/* Last edited */}
        <p className="text-xs text-gray-400 mt-0.5">
          Last edited {formatRelativeTime(world.updated_at)}
        </p>

        {/* Stats */}
        {statsText && (
          <p className="text-xs text-gray-500 mt-1">{statsText}</p>
        )}

        {/* Overflow menu button */}
        <div ref={menuRef} className="absolute bottom-3 right-3">
          <button
            onClick={handleMenuClick}
            className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="World actions"
            data-testid="overflow-menu-button"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              className="absolute right-0 bottom-8 w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10"
              data-testid="overflow-menu"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameStart();
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                data-testid="menu-rename"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate();
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                data-testid="menu-duplicate"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Duplicate
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                data-testid="menu-delete"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
