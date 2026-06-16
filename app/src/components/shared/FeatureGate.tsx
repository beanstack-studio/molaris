"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useFeatureGate } from "@/contexts/ClinicContext";

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  /** Custom message shown in the upgrade card. */
  message?: string;
  /** Custom CTA label. Defaults to "Upgrade →" */
  ctaLabel?: string;
  /** Custom CTA href. Defaults to /settings/billing */
  ctaHref?: string;
}

/**
 * Wraps gated content. Shows an upgrade / access-denied card when the
 * current user lacks access (insufficient plan or role).
 */
export function FeatureGate({
  feature,
  children,
  message,
  ctaLabel = "Upgrade →",
  ctaHref = "/settings/billing",
}: FeatureGateProps) {
  const hasAccess = useFeatureGate(feature);

  if (hasAccess) return <>{children}</>;

  const isAdminGate = ["plan_billing", "manage_team", "edit_clinic_profile", "edit_catalog"].includes(feature);

  return (
    <div className="card text-center py-12">
      <div className="text-2xl mb-3" aria-hidden="true">🔒</div>
      <div className="card-title mb-1">
        {isAdminGate ? "Admin access required" : "Pro plan required"}
      </div>
      <div className="text-muted mb-4 max-w-sm mx-auto">
        {message ?? (
          isAdminGate
            ? "This section is only available to clinic admins."
            : "This feature requires a Pro plan. Upgrade to unlock billing, reports, document generation, ortho, and more."
        )}
      </div>
      {!isAdminGate && (
        <Link href={ctaHref} className="save-btn inline-flex items-center gap-1">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
