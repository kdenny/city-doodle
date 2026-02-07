import { createContext, useContext, useState, ReactNode } from "react";

export type ViewMode = "build" | "transit" | "density" | "timelapse" | "export";

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  viewModeLabel: string;
}

const viewModeLabels: Record<ViewMode, string> = {
  build: "Build",
  transit: "Transit View",
  density: "Density View",
  timelapse: "Timelapse",
  export: "Export",
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>("build");

  const value: ViewModeContextValue = {
    viewMode,
    setViewMode,
    viewModeLabel: viewModeLabels[viewMode],
  };

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}

export function useViewModeOptional(): ViewModeContextValue | null {
  return useContext(ViewModeContext);
}
