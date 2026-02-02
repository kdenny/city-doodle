import { Link } from "react-router-dom";
import { useViewMode, ViewMode } from "./ViewModeContext";

const viewModeTabs: { mode: ViewMode; label: string }[] = [
  { mode: "transit", label: "Transit" },
  { mode: "density", label: "Density" },
  { mode: "timelapse", label: "Timelapse" },
  { mode: "export", label: "Export" },
];

export function Header() {
  const { viewMode, setViewMode, viewModeLabel } = useViewMode();

  return (
    <header className="h-12 bg-gray-800 text-white flex items-center px-4 shrink-0 justify-between">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-bold text-lg">
          City Doodle
        </Link>
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

      {/* Exit Button */}
      {viewMode !== "build" && (
        <button
          onClick={() => setViewMode("build")}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          Exit {viewModeLabel}
        </button>
      )}
      {viewMode === "build" && <div className="w-24" />}
    </header>
  );
}
