/**
 * Modal for creating a new world.
 */

import { useState, FormEvent } from "react";
import { useCreateWorld } from "../api";

interface CreateWorldModalProps {
  onClose: () => void;
  onCreated: (worldId: string) => void;
}

export function CreateWorldModal({ onClose, onCreated }: CreateWorldModalProps) {
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createWorld = useCreateWorld();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a world name");
      return;
    }

    try {
      const world = await createWorld.mutateAsync({
        name: name.trim(),
        seed: seed ? parseInt(seed, 10) : undefined,
      });
      onCreated(world.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create world");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Create New World
          </h2>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-3 bg-red-50 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="mb-4">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                World Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome City"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="seed"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Seed (optional)
              </label>
              <input
                id="seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Random if empty"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use the same seed to recreate identical terrain
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createWorld.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {createWorld.isPending ? "Creating..." : "Create World"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
