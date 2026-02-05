/**
 * Modal for creating a new world.
 */

import { useState, useCallback, FormEvent } from "react";
import { useCreateWorld } from "../api";
import { generateCityName, generateCityNameSuggestions } from "../utils";

interface CreateWorldModalProps {
  onClose: () => void;
  onCreated: (worldId: string) => void;
}

export function CreateWorldModal({ onClose, onCreated }: CreateWorldModalProps) {
  // Generate initial name based on current timestamp for uniqueness
  const [name, setName] = useState(() => generateCityName({ seed: Date.now() }));
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleGenerateNew = useCallback(() => {
    const newSuggestions = generateCityNameSuggestions(5, Date.now());
    setSuggestions(newSuggestions);
    setShowSuggestions(true);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setName(suggestion);
    setShowSuggestions(false);
  }, []);

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
                City Name
              </label>
              <div className="flex gap-2">
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Awesome City"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleGenerateNew}
                  className="px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  title="Generate new name suggestions"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
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
