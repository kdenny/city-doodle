import { useState } from "react";

export interface YearChange {
  id: string;
  description: string;
}

export interface ChangesPanelProps {
  changes: YearChange[];
  /** When true, renders as a growth simulation changelog with collapsible body */
  isChangelog?: boolean;
  /** Number of years that were simulated (shown in changelog header) */
  yearsSimulated?: number;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Icon mapping for changelog entry types */
function changeIcon(id: string): string {
  switch (id) {
    case "densified":
      return "building";
    case "expanded":
      return "expand";
    case "roads":
      return "road";
    case "pois":
      return "pin";
    case "none":
      return "dash";
    default:
      return "dot";
  }
}

function ChangeIconBadge({ type }: { type: string }) {
  const icon = changeIcon(type);
  const colorMap: Record<string, string> = {
    building: "bg-purple-100 text-purple-600",
    expand: "bg-blue-100 text-blue-600",
    road: "bg-amber-100 text-amber-600",
    pin: "bg-green-100 text-green-600",
    dash: "bg-gray-100 text-gray-400",
    dot: "bg-gray-100 text-gray-500",
  };
  const colorClass = colorMap[icon] || colorMap.dot;

  const symbolMap: Record<string, string> = {
    building: "\u25A0", // filled square
    expand: "\u25B2",   // triangle up
    road: "\u2550",     // double horizontal line
    pin: "\u2736",      // six-pointed star
    dash: "\u2014",     // em dash
    dot: "\u2022",      // bullet
  };
  const symbol = symbolMap[icon] || symbolMap.dot;

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs flex-shrink-0 ${colorClass}`}
    >
      {symbol}
    </span>
  );
}

export function ChangesPanel({
  changes,
  isChangelog = false,
  yearsSimulated,
}: ChangesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isChangelog) {
    const yearLabel = yearsSimulated && yearsSimulated > 1
      ? `${yearsSimulated} years`
      : "1 year";

    return (
      <div className="bg-white rounded-lg shadow-lg w-64 overflow-hidden">
        {/* Changelog header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-100 hover:bg-green-100 transition-colors"
          aria-expanded={isExpanded}
          aria-controls="growth-changelog-body"
        >
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">
              Growth Changelog
            </span>
          </div>
          <ChevronDownIcon
            className={`w-4 h-4 text-green-600 transition-transform ${
              isExpanded ? "" : "-rotate-90"
            }`}
          />
        </button>

        {/* Collapsible body */}
        {isExpanded && (
          <div id="growth-changelog-body" className="p-4">
            <p className="text-xs text-gray-500 mb-3">
              Simulated {yearLabel} of growth
            </p>

            {changes.length > 0 ? (
              <ul className="space-y-2">
                {changes.map(({ id, description }) => (
                  <li
                    key={id}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <ChangeIconBadge type={id} />
                    <span>{description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No changes this cycle
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default (non-changelog) rendering - unchanged original behavior
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-64">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Changes This Year
      </h3>

      {changes.length > 0 ? (
        <ul className="space-y-2">
          {changes.map(({ id, description }) => (
            <li key={id} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-gray-400 mt-0.5">{"\u2022"}</span>
              <span>{description}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 italic">No changes this year</p>
      )}

      <div className="mt-4 pt-3 border-t">
        <p className="text-xs text-gray-400 italic">View-only mode</p>
      </div>
    </div>
  );
}

export const defaultChanges: YearChange[] = [
  { id: "1", description: "3 new blocks built" },
  { id: "2", description: "Transit line extended" },
  { id: "3", description: "1 park added" },
];
