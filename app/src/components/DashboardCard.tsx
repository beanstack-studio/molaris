/**
 * DashboardCard Component
 * Globalized dashboard metric card with consistent styling
 * 
 * Props:
 * - title: Card label (e.g., "Total Invoiced")
 * - value: Main data display (number, string, or JSX)
 * - icon: Emoji or icon string (e.g., "📋")
 * - subtext: Optional secondary text (e.g., "0 invoices", "This month")
 * - valueClassName: Optional custom styling for the value text
 */

interface DashboardCardProps {
  title: string;
  value: React.ReactNode;
  icon: string;
  subtext?: string;
  valueClassName?: string;
}

export function DashboardCard({
  title,
  value,
  icon,
  subtext,
  valueClassName = "text-3xl font-bold text-slate-900",
}: DashboardCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 mb-2">{title}</p>
          <p className={valueClassName}>{value}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
      {subtext && <p className="text-xs text-slate-600 mt-2">{subtext}</p>}
    </div>
  );
}
