import { ReactNode, useState, useCallback } from "react";
import { ViewModeProvider } from "./ViewModeContext";
import { Header } from "./Header";
import { ZoomControls } from "./ZoomControls";
import { HelpButton } from "./HelpButton";

interface EditorShellProps {
  children: ReactNode;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
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
      <div className="h-screen w-screen flex flex-col bg-gray-100">
        <Header />

        {/* Main content area */}
        <main className="flex-1 relative overflow-hidden">
          {/* Canvas/Map area */}
          {children}

          {/* Bottom-right controls */}
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <ZoomControls
              zoom={zoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
            />
            <HelpButton onClick={handleHelp} />
          </div>
        </main>
      </div>
    </ViewModeProvider>
  );
}
