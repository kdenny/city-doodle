export type NeedLevel = "low" | "medium" | "high" | "critical";

export interface CityNeeds {
  housing: NeedLevel;
  water: NeedLevel;
  power: NeedLevel;
  health: NeedLevel;
}

interface CityNeedsPanelProps {
  needs: CityNeeds;
  onClick?: () => void;
}

const needConfig: { id: keyof CityNeeds; label: string; icon: JSX.Element }[] = [
  {
    id: "housing",
    label: "Housing",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    id: "water",
    label: "Water",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: "power",
    label: "Power",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: "health",
    label: "Health",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
      </svg>
    ),
  },
];

const levelColors: Record<NeedLevel, string> = {
  low: "text-green-500",
  medium: "text-yellow-500",
  high: "text-orange-500",
  critical: "text-red-500",
};

export function CityNeedsPanel({ needs, onClick }: CityNeedsPanelProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg shadow-lg p-2 flex gap-2 hover:bg-gray-50 transition-colors"
      title="City Needs - Click for details"
    >
      {needConfig.map(({ id, label, icon }) => (
        <div
          key={id}
          className={`${levelColors[needs[id]]}`}
          title={`${label}: ${needs[id]}`}
        >
          {icon}
        </div>
      ))}
    </button>
  );
}
