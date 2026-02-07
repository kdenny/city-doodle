/**
 * Dashboard page - shows user's worlds with smart hero, sort controls,
 * world grid using WorldCard, and empty/onboarding state.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWorlds, useDeleteWorld, useUpdateWorld, useCreateWorld } from "../api";
import { useAuth } from "../contexts";
import { CreateWorldModal } from "../components/CreateWorldModal";
import { WorldCard } from "../components/WorldCard";
import { ConfirmationDialog } from "../components/build-view/ConfirmationDialog";
import type { World } from "../api/types";

type SortOption = "last_edited" | "name" | "newest";

const SORT_LABELS: Record<SortOption, string> = {
  last_edited: "Last edited",
  name: "Name",
  newest: "Newest",
};

function sortWorlds(worlds: World[], sortBy: SortOption): World[] {
  return [...worlds].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "last_edited":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
}

export function WorldsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("last_edited");
  const [deleteTarget, setDeleteTarget] = useState<World | null>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const { data: worlds, isLoading, error } = useWorlds();
  const deleteWorld = useDeleteWorld();
  const updateWorld = useUpdateWorld();
  const createWorld = useCreateWorld();

  const sortedWorlds = useMemo(
    () => (worlds ? sortWorlds(worlds, sortBy) : []),
    [worlds, sortBy]
  );

  const mostRecentWorld = useMemo(() => {
    if (!worlds || worlds.length === 0) return null;
    return [...worlds].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [worlds]);

  const handleWorldCreated = (worldId: string) => {
    setShowCreateModal(false);
    navigate(`/worlds/${worldId}`);
  };

  const handleRename = async (worldId: string, newName: string) => {
    try {
      await updateWorld.mutateAsync({ worldId, data: { name: newName } });
    } catch {
      // Error handled by mutation
    }
  };

  const handleDuplicate = async (world: World) => {
    try {
      const newWorld = await createWorld.mutateAsync({
        name: `${world.name} (copy)`,
        seed: world.seed,
        settings: world.settings,
      });
      navigate(`/worlds/${newWorld.id}`);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWorld.mutateAsync(deleteTarget.id);
    } catch {
      // Error handled by mutation
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading worlds...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load worlds</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasWorlds = sortedWorlds.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6" data-testid="dashboard-header">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-gray-900" style={{ fontFamily: "'Caveat', cursive" }}>
            City Doodle
          </span>
          <span className="text-xs text-gray-400 hidden sm:inline">a lo-fi city builder</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden sm:inline">{user?.email}</span>
          <button
            onClick={() => logout()}
            className="text-sm text-gray-500 hover:text-gray-700"
            data-testid="sign-out-button"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Smart Hero - only when user has worlds */}
      {hasWorlds && mostRecentWorld && (
        <div className="bg-blue-50 border-b border-blue-100" data-testid="smart-hero">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Continue working on {mostRecentWorld.name}?
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Last edited {new Date(mostRecentWorld.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/worlds/${mostRecentWorld.id}`)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                data-testid="continue-button"
              >
                Open {mostRecentWorld.name} &rarr;
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                data-testid="new-world-hero-button"
              >
                + New World
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {hasWorlds ? (
          <>
            {/* Toolbar Row */}
            <div className="flex items-center justify-between mb-4" data-testid="toolbar">
              <span className="text-sm font-medium text-gray-700">
                Your worlds ({sortedWorlds.length})
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 text-gray-600 bg-white"
                data-testid="sort-select"
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* World Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="world-grid">
              {sortedWorlds.map((world) => (
                <WorldCard
                  key={world.id}
                  world={world}
                  onClick={() => navigate(`/worlds/${world.id}`)}
                  onRename={(newName) => handleRename(world.id, newName)}
                  onDuplicate={() => handleDuplicate(world)}
                  onDelete={() => setDeleteTarget(world)}
                />
              ))}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="text-center py-16" data-testid="empty-state">
            {/* Hand-drawn city sketch placeholder */}
            <svg
              className="mx-auto w-32 h-32 text-gray-300 mb-6"
              fill="none"
              viewBox="0 0 120 120"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <rect x="10" y="50" width="20" height="40" rx="2" />
              <rect x="35" y="30" width="15" height="60" rx="2" />
              <rect x="55" y="45" width="20" height="45" rx="2" />
              <rect x="80" y="35" width="18" height="55" rx="2" />
              <line x1="5" y1="90" x2="115" y2="90" strokeWidth={2} />
              <path d="M25 50 L25 40 L35 45 L35 50" />
              <circle cx="90" cy="25" r="8" />
            </svg>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Create your first city
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Start building a lo-fi city simulation. Place seeds, grow districts, and watch your city come to life.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              data-testid="get-started-button"
            >
              Get Started
            </button>

            {/* Tip cards */}
            <div className="mt-12 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto">
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <div className="text-2xl mb-2">🌱</div>
                <h3 className="font-medium text-gray-900 text-sm">Drop Seeds</h3>
                <p className="text-xs text-gray-500 mt-1">Place district seeds and watch them grow into neighborhoods</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <div className="text-2xl mb-2">🛤️</div>
                <h3 className="font-medium text-gray-900 text-sm">Roads Connect</h3>
                <p className="text-xs text-gray-500 mt-1">Streets automatically generate to connect your districts</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <div className="text-2xl mb-2">📤</div>
                <h3 className="font-medium text-gray-900 text-sm">Export & Share</h3>
                <p className="text-xs text-gray-500 mt-1">Export your city as PNG or share with friends</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateWorldModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleWorldCreated}
        />
      )}

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        message="This world and all its data will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
