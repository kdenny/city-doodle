/**
 * Context for providing world data to shell components.
 *
 * This context allows components like Header to access the current world
 * and show settings panels.
 */

import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { World, useWorld } from "../../api";

interface WorldContextValue {
  /** The current world (if loaded) */
  world: World | undefined;
  /** Whether the world is loading */
  isLoading: boolean;
  /** Whether the settings panel is open */
  isSettingsOpen: boolean;
  /** Open the settings panel */
  openSettings: () => void;
  /** Close the settings panel */
  closeSettings: () => void;
}

const WorldContext = createContext<WorldContextValue | null>(null);

interface WorldProviderProps {
  children: ReactNode;
  worldId?: string;
}

export function WorldProvider({ children, worldId }: WorldProviderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { data: world, isLoading } = useWorld(worldId ?? "", {
    enabled: !!worldId,
  });

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  return (
    <WorldContext.Provider
      value={{
        world,
        isLoading,
        isSettingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </WorldContext.Provider>
  );
}

export function useWorldContext(): WorldContextValue {
  const context = useContext(WorldContext);
  if (!context) {
    throw new Error("useWorldContext must be used within a WorldProvider");
  }
  return context;
}

/**
 * Hook for components that optionally use WorldContext.
 * Returns null if not within a provider.
 */
export function useOptionalWorldContext(): WorldContextValue | null {
  return useContext(WorldContext);
}
