import { Link } from "react-router-dom";
import { useViewMode, ViewMode } from "./ViewModeContext";
import { useOptionalWorldContext } from "./WorldContext";
import { WorldSettingsPanel } from "../settings";

const viewModeTabs: { mode: ViewMode; label: string }[] = [
  { mode: "transit", label: "Transit" },
  { mode: "density", label: "Density" },
  { mode: "timelapse", label: "Timelapse" },
  { mode: "export", label: "Export" },
];

export function Header() {
  const { viewMode, setViewMode, viewModeLabel } = useViewMode();
  const worldContext = useOptionalWorldContext();

  return (
    <>
      <header className="h-12 bg-gray-800 text-white flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-bold text-lg">
            City Doodle
          </Link>
          {worldContext?.world && (
            <span className="text-gray-300 text-sm font-medium">
              {worldContext.world.name}
            </span>
          )}
          <span className="text-gray-400 text-sm">{viewModeLabel}</span>
        </div>

        {/* View Mode Tabs */}
        <nav className="flex items-center gap-1">
          {viewModeTabs.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                viewMode === mode
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right side buttons */}
        <div className="flex items-center gap-2">
          {/* Settings Button (only when world is loaded) */}
          {worldContext?.world && (
            <button
              onClick={worldContext.openSettings}
              className="px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
              aria-label="World Settings"
              title="World Settings"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </button>
          )}

          {/* Exit Button */}
          {viewMode !== "build" && (
            <button
              onClick={() => setViewMode("build")}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Exit {viewModeLabel}
            </button>
          )}
          {viewMode === "build" && !worldContext?.world && <div className="w-24" />}
        </div>
      </header>

      {/* World Settings Panel */}
      {worldContext?.world && worldContext.isSettingsOpen && (
        <WorldSettingsPanel
          world={worldContext.world}
          onClose={worldContext.closeSettings}
        />
      )}
    </>
  );
}
