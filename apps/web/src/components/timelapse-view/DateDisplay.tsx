export interface DateDisplayProps {
  date: Date;
  currentYear: number;
  totalYears: number;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function DateDisplay({ date, currentYear, totalYears }: DateDisplayProps) {
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return (
    <div className="text-center">
      <div className="text-2xl font-semibold text-gray-900">
        {month} {year}
      </div>
      <div className="text-sm text-gray-500">
        Year {currentYear} of {totalYears}
      </div>
    </div>
  );
}
