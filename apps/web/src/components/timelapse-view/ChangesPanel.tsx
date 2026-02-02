export interface YearChange {
  id: string;
  description: string;
}

export interface ChangesPanelProps {
  changes: YearChange[];
}

export function ChangesPanel({ changes }: ChangesPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-64">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Changes This Year
      </h3>

      {changes.length > 0 ? (
        <ul className="space-y-2">
          {changes.map(({ id, description }) => (
            <li key={id} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-gray-400 mt-0.5">•</span>
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
