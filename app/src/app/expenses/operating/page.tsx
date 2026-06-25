"use client";

export default function OperatingPage() {
  return (
    <div className="spacing-vertical-lg">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Operating Expenses</h2>
          <span className="badge badge-secondary">Coming soon</span>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Log and categorize day-to-day clinic operating expenses.
          Operating expense tracking is coming in a future update.
        </p>
        <div className="flex flex-col gap-3 mt-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">Daily expense log</div>
              <div className="text-xs text-slate-400">Record petty cash, office supplies, and miscellaneous costs</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">Expense reports</div>
              <div className="text-xs text-slate-400">Monthly and yearly summaries with category breakdown</div>
            </div>
          </div>
        </div>
        <p className="hint-text mt-3">Operating expense tracking is coming in a future update.</p>
      </div>
    </div>
  );
}
