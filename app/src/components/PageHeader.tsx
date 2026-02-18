/**
 * PageHeader - Standardized page header with title, subtitle, and action button(s)
 * Provides consistent styling matching the Patients page pattern
 */

import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
  };
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="info-box">
      <div className="info-box-header">
        <div>
          <div className="info-box-title">{title}</div>
          {subtitle && <div className="text-sm text-slate-500 mt-1">{subtitle}</div>}
        </div>
        {action && (
          <button
            className={action.className || "btn-primary-dark"}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
