"use client";

export default function BillsPage() {
  return (
    <div className="spacing-vertical-lg">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Bills</h2>
          <span className="badge badge-secondary">Coming soon</span>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Track recurring clinic bills such as utilities, subscriptions, and supplier invoices.
          Bills management is coming in a future update.
        </p>
        <div className="flex flex-col gap-3 mt-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">Recurring bills</div>
              <div className="text-xs text-slate-400">Electricity, water, internet, and other utilities</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path strokeLinecap="round" d="M3 10h18" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">Supplier invoices</div>
              <div className="text-xs text-slate-400">Dental supplies, equipment, and materials</div>
            </div>
          </div>
        </div>
        <p className="hint-text mt-3">Bills tracking is coming in a future update.</p>
      </div>
    </div>
  );
}
