import { ReactNode, useCallback } from "react";
import { ViewModeProvider, useViewMode, ViewMode } from "./ViewModeContext";
import { ZoomProvider, useZoom } from "./ZoomContext";
import { Header } from "./Header";
import { ZoomControls } from "./ZoomControls";
import { HelpButton } from "./HelpButton";
import { PlacementPalette, PlacementProvider } from "../palette";
import { MapCanvasProvider } from "../canvas";
import { ExportView } from "../export-view";
import { TimelapseView } from "../timelapse-view";
import { DensityView } from "../density-view";
import { TransitView } from "../transit-view";
import { BuildView } from "../build-view";

interface EditorShellProps {
  children: ReactNode;
  worldId?: string;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

// Helper to render the appropriate view wrapper based on viewMode
function ViewWrapper({
  viewMode,
  children,
}: {
  viewMode: ViewMode;
  children: ReactNode;
}) {
  switch (viewMode) {
    case "export":
      return <ExportView>{children}</ExportView>;
    case "timelapse":
      return <TimelapseView>{children}</TimelapseView>;
    case "density":
      return <DensityView>{children}</DensityView>;
    case "transit":
      return <TransitView>{children}</TransitView>;
    case "build":
    default:
      return <BuildView>{children}</BuildView>;
  }
}

// Inner component that can access the ViewMode and Zoom contexts
function EditorShellContent({
  children,
  onHelp,
}: {
  children: ReactNode;
  onHelp: () => void;
}) {
  const { viewMode } = useViewMode();
  const { zoom, zoomIn, zoomOut } = useZoom();
  const showPalette = viewMode === "build";
  const showZoomControls = viewMode !== "export"; // Export view has its own controls

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100">
      <Header />

      {/* Main content area */}
      <main className="flex-1 relative overflow-hidden">
        {/* View-specific wrapper with canvas */}
        <ViewWrapper viewMode={viewMode}>{children}</ViewWrapper>

        {/* Left side: Placement palette (only in build mode) */}
        {showPalette && (
          <div className="absolute top-4 left-4 z-10">
            <PlacementPalette />
          </div>
        )}

        {/* Bottom-right controls (not shown in export view) */}
        {showZoomControls && (
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
            <HelpButton onClick={onHelp} />
          </div>
        )}
      </main>
    </div>
  );
}

export function EditorShell({
  children,
  initialZoom = 1,
  onZoomChange,
}: EditorShellProps) {
  const handleHelp = useCallback(() => {
    // TODO: Open help modal
    console.log("Help clicked");
  }, []);

  return (
    <ViewModeProvider>
      <ZoomProvider initialZoom={initialZoom} onZoomChange={onZoomChange}>
        <PlacementProvider>
          <MapCanvasProvider>
            <EditorShellContent onHelp={handleHelp}>
              {children}
            </EditorShellContent>
          </MapCanvasProvider>
        </PlacementProvider>
      </ZoomProvider>
    </ViewModeProvider>
  );
}
