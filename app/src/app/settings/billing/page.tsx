"use client";

import { useClinic } from "@/contexts/ClinicContext";
import { FeatureGate } from "@/components/shared/FeatureGate";

function IconCheck() {
  return (
    <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconXMark() {
  return (
    <svg className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" />
    </svg>
  );
}

const FREE_FEATURES = [
  { label: "Up to 100 patients",            included: true },
  { label: "Appointments calendar",          included: true },
  { label: "Treatment records",              included: true },
  { label: "Dental chart",                   included: true },
  { label: "Medical history",               included: true },
  { label: "1 admin · up to 1 staff",       included: true },
  { label: "Advanced reports & analytics",  included: false },
  { label: "Billing & invoicing",           included: false },
  { label: "Document generation",           included: false },
  { label: "Ortho module",                  included: false },
  { label: "Staff handlers",                included: false },
  { label: "Calendar sync",                 included: false },
];

const PRO_FEATURES = [
  { label: "Unlimited patients",            included: true },
  { label: "Appointments calendar",          included: true },
  { label: "Treatment records",              included: true },
  { label: "Dental chart",                   included: true },
  { label: "Medical history",               included: true },
  { label: "Unlimited admins & staff",      included: true },
  { label: "Advanced reports & analytics",  included: true },
  { label: "Billing & invoicing",           included: true },
  { label: "Document generation",           included: true },
  { label: "Ortho module",                  included: true },
  { label: "Staff handlers",                included: true },
  { label: "Calendar sync",                 included: true },
];

function BillingContent() {
  const { plan, clinicName } = useClinic();
  const isPro = plan === "pro";

  return (
    <div className="spacing-vertical-lg">

      {/* Current plan banner */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Plan &amp; Billing</h2>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isPro ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"}`}>
            {isPro ? "Pro" : "Free"} — current plan
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          {clinicName} is on the <strong>{isPro ? "Pro" : "Free"}</strong> plan.
          {!isPro && (
            <>
              {" "}Upgrade to Pro to unlock the full Molaris experience.{" "}
              <a href="mailto:hello@beanstack.studio" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Contact hello@beanstack.studio to upgrade.
              </a>
            </>
          )}
        </p>
      </div>

      {/* Plan comparison cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Free */}
        <div className={`rounded-xl border-2 p-5 flex flex-col gap-4 transition-colors ${
          !isPro
            ? "border-slate-700 dark:border-slate-300 bg-white dark:bg-slate-900"
            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
        }`}>
          <div className="-mx-5 -mt-5 px-5 pt-5 pb-4 rounded-t-xl bg-slate-100 dark:bg-slate-700/50 mb-1 flex items-end justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Free</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-slate-700 dark:text-slate-200">₱0</span>
                <span className="text-sm text-slate-400 dark:text-slate-500">/month</span>
              </div>
            </div>
            {!isPro && <span className="badge badge-secondary text-xs mb-1">Your plan</span>}
          </div>
          <div className="flex flex-col gap-2.5 flex-1">
            {FREE_FEATURES.map((f) => (
              <div key={f.label} className={`flex items-start gap-2 text-sm ${f.included ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-600"}`}>
                {f.included ? <IconCheck /> : <IconXMark />}
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* Pro */}
        <div className={`rounded-xl border-2 p-5 flex flex-col gap-4 relative transition-colors ${
          isPro
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
            : "border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900"
        }`}>
          {/* Badges */}
          <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-500 text-white px-2.5 py-0.5 rounded-full">
              <IconStar /> Popular
            </span>
            {isPro && <span className="badge badge-info text-xs">Your plan</span>}
          </div>

          <div className="-mx-5 -mt-5 px-5 pt-5 pb-4 rounded-t-xl bg-gradient-to-br from-blue-600 to-indigo-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-200">Pro</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-white">₱499</span>
              <span className="text-sm text-blue-200">/month</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 flex-1">
            {PRO_FEATURES.map((f) => (
              <div key={f.label} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <IconCheck />
                {f.label}
              </div>
            ))}
          </div>

          {!isPro && (
            <a
              href="mailto:hello@beanstack.studio"
              className="mt-auto flex items-center justify-center gap-2 w-full rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact hello@beanstack.studio to upgrade
            </a>
          )}
        </div>
      </div>

    </div>
  );
}

export default function PlanBillingPage() {
  return (
    <FeatureGate feature="plan_billing" message="Plan & Billing is only accessible to clinic admins.">
      <BillingContent />
    </FeatureGate>
  );
}
