import { ReactNode, useState, useCallback } from "react";
import { ViewModeProvider, useViewMode } from "./ViewModeContext";
import { Header } from "./Header";
import { ZoomControls } from "./ZoomControls";
import { HelpButton } from "./HelpButton";
import { PlacementPalette, PlacementProvider } from "../palette";

interface EditorShellProps {
  children: ReactNode;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

// Inner component that can access the ViewMode context
function EditorShellContent({
  children,
  zoom,
  onZoomIn,
  onZoomOut,
  onHelp,
}: {
  children: ReactNode;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onHelp: () => void;
}) {
  const { viewMode } = useViewMode();
  const showPalette = viewMode === "build";

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100">
      <Header />

      {/* Main content area */}
      <main className="flex-1 relative overflow-hidden">
        {/* Canvas/Map area */}
        {children}

        {/* Left side: Placement palette (only in build mode) */}
        {showPalette && (
          <div className="absolute top-4 left-4 z-10">
            <PlacementPalette />
          </div>
        )}

        {/* Bottom-right controls */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
          <ZoomControls zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
          <HelpButton onClick={onHelp} />
        </div>
      </main>
    </div>
  );
}

export function EditorShell({
  children,
  initialZoom = 1,
  onZoomChange,
}: EditorShellProps) {
  const [zoom, setZoom] = useState(initialZoom);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.min(prev * 1.25, 4);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev / 1.25, 0.25);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleHelp = useCallback(() => {
    // TODO: Open help modal
    console.log("Help clicked");
  }, []);

  return (
    <ViewModeProvider>
      <PlacementProvider>
        <EditorShellContent
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onHelp={handleHelp}
        >
          {children}
        </EditorShellContent>
      </PlacementProvider>
    </ViewModeProvider>
  );
}
