import { useViewMode, ViewMode } from "./ViewModeContext";
import { useEditLockOptional } from "./EditLockContext";

const viewModeTabs: { mode: ViewMode; label: string }[] = [
  { mode: "transit", label: "Transit" },
  { mode: "density", label: "Density" },
  { mode: "timelapse", label: "Timelapse" },
  { mode: "export", label: "Export" },
];

export function Header({ worldName }: { worldName?: string }) {
  const { viewMode, setViewMode, viewModeLabel } = useViewMode();
  const editLock = useEditLockOptional();

  return (
    <header className="h-12 bg-gray-800 text-white flex items-center px-4 shrink-0 justify-between">
      <div className="flex items-center gap-4">
        <a href="/" className="font-bold text-lg hover:text-gray-200 transition-colors">
          City Doodle
        </a>
        {worldName && (
          <>
            <span className="text-gray-500">/</span>
            <span className="text-gray-200 text-sm font-medium">{worldName}</span>
          </>
        )}
        <span className="text-gray-400 text-sm">{viewModeLabel}</span>
        {viewMode === "build" && editLock?.isEditing && (
          <span className="text-xs text-green-400 font-medium">Editing</span>
        )}
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

      {/* Exit Button / Edit Mode Toggle */}
      {viewMode !== "build" && (
        <button
          onClick={() => setViewMode("build")}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          Exit {viewModeLabel}
        </button>
      )}
      {viewMode === "build" && editLock && (
        <div className="flex items-center gap-2">
          {editLock.lockConflict && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400">
                Locked by {editLock.lockConflict.lockedBy}
              </span>
              <button
                onClick={() => {
                  editLock.dismissConflict();
                  editLock.requestEditMode();
                }}
                className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 rounded transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {!editLock.isEditing && !editLock.lockConflict && (
            <button
              onClick={editLock.requestEditMode}
              disabled={editLock.isAcquiring}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded transition-colors flex items-center gap-1.5"
            >
              {editLock.isAcquiring ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Acquiring...
                </>
              ) : (
                "Edit"
              )}
            </button>
          )}
          {editLock.isEditing && (
            <button
              onClick={editLock.exitEditMode}
              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 rounded transition-colors"
            >
              Done Editing
            </button>
          )}
        </div>
      )}
      {viewMode === "build" && !editLock && <div className="w-24" />}
    </header>
  );
}
