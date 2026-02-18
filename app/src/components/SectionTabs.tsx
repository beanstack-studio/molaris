/**
 * SectionTabs - Standardized internal navigation tabs
 * Used for Reports and Settings sub-sections
 * Provides consistent styling and active tab highlighting
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface Tab {
  label: string;
  href: string;
  disabled?: boolean;
}

interface SectionTabsProps {
  tabs: Tab[];
  children: React.ReactNode;
}

export function SectionTabs({ tabs, children }: SectionTabsProps) {
  const pathname = usePathname();

  return (
    <div className="spacing-vertical-lg">
      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1 flex-wrap">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.endsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                } ${tab.disabled ? "opacity-50 pointer-events-none" : ""}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="card">{children}</div>
    </div>
  );
}
