"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useFeatureGate, type ProFeature } from "@/contexts/ClinicContext";

interface FeatureGateProps {
  feature: ProFeature;
  children: ReactNode;
}

/**
 * Wraps gated content behind a Pro plan check.
 * Free plan users see an upgrade prompt card instead of the content.
 * Nav items should NOT be hidden — grey them out with a lock icon instead.
 */
export function FeatureGate({ feature, children }: FeatureGateProps) {
  const hasAccess = useFeatureGate(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="card text-center py-12">
      <div className="text-2xl mb-3" aria-hidden="true">🔒</div>
      <div className="card-title mb-1">Pro plan required</div>
      <div className="text-muted mb-4 max-w-sm mx-auto">
        This feature requires a Pro plan. Upgrade to unlock billing, reports,
        document generation, ortho, and more.
      </div>
      <Link
        href="/settings/clinic-profile"
        className="save-btn inline-flex items-center gap-1"
      >
        Upgrade →
      </Link>
    </div>
  );
}
