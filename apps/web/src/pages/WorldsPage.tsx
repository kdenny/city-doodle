/**
 * World list page - shows user's worlds with create/delete functionality.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorlds, useDeleteWorld } from "../api";
import { CreateWorldModal } from "../components/CreateWorldModal";

export function WorldsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: worlds, isLoading, error } = useWorlds();
  const deleteWorld = useDeleteWorld();

  const handleDelete = async (worldId: string, worldName: string) => {
    if (!confirm(`Delete "${worldName}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(worldId);
    try {
      await deleteWorld.mutateAsync(worldId);
    } catch {
      // Error handled by mutation
    } finally {
      setDeletingId(null);
    }
  };

  const handleWorldCreated = (worldId: string) => {
    setShowCreateModal(false);
    navigate(`/worlds/${worldId}`);
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Worlds</h1>
            <p className="mt-1 text-gray-600">
              Create and manage your city simulations
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            New World
          </button>
        </div>

        {worlds && worlds.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">You don't have any worlds yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-blue-600 hover:underline"
            >
              Create your first world
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {worlds?.map((world) => (
              <div
                key={world.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">
                    {world.name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Created {new Date(world.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Seed: {world.seed}
                  </p>
                </div>
                <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                  <Link
                    to={`/worlds/${world.id}`}
                    className="text-blue-600 hover:underline text-sm font-medium"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => handleDelete(world.id, world.name)}
                    disabled={deletingId === world.id}
                    className="text-red-600 hover:underline text-sm disabled:opacity-50"
                  >
                    {deletingId === world.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}


      </div>

      {showCreateModal && (
        <CreateWorldModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleWorldCreated}
        />
      )}
    </div>
  );
}
