/**
 * CITY-528: Warning modal shown when deleting a station would orphan other stations.
 *
 * Informs the user that the station is a middle station on a line, and that
 * deleting it would disconnect other stations. Suggests removing connecting
 * track segments first.
 */

interface StationDeleteWarningModalProps {
  /** Name of the station the user tried to delete */
  stationName: string;
  /** Names of stations that would become orphaned */
  orphanedStations: string[];
  /** Names of transit lines affected */
  affectedLines: string[];
  /** Close the modal */
  onClose: () => void;
}

export function StationDeleteWarningModal({
  stationName,
  orphanedStations,
  affectedLines,
  onClose,
}: StationDeleteWarningModalProps) {
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
          {/* Warning header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Cannot Safely Delete {stationName}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                This station is in the middle of a transit line. Deleting it
                would break the line and disconnect other stations.
              </p>
            </div>
          </div>

          {/* Orphaned stations */}
          {orphanedStations.length > 0 && (
            <div className="mb-4 bg-amber-50 rounded-md p-3">
              <p className="text-sm font-medium text-amber-800 mb-1">
                Would disconnect:
              </p>
              <ul className="text-sm text-amber-700 space-y-0.5">
                {orphanedStations.map((name) => (
                  <li key={name} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Affected lines */}
          {affectedLines.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500">
                Affected line{affectedLines.length > 1 ? "s" : ""}:{" "}
                {affectedLines.join(", ")}
              </p>
            </div>
          )}

          {/* Suggestion */}
          <p className="text-sm text-gray-600 mb-6">
            Remove the connecting track segments first, or delete the affected
            line entirely.
          </p>

          {/* OK button */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
