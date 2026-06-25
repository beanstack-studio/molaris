"use client";

export default function PayrollPage() {
  return (
    <div className="spacing-vertical-lg">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Payroll</h2>
          <span className="badge badge-secondary">Coming soon</span>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Track and manage salary runs, deductions, and payouts for your dentists and staff.
          Payroll management is coming in a future update.
        </p>
        <div className="flex flex-col gap-3 mt-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">Automated payroll runs</div>
              <div className="text-xs text-slate-400">Calculate and process salaries based on schedules</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M9 14l2 2 4-4M5 12a7 7 0 1 1 14 0 7 7 0 0 1-14 0" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">Deductions &amp; contributions</div>
              <div className="text-xs text-slate-400">SSS, PhilHealth, Pag-IBIG, and withholding tax</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M9 17v-2a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v2M3 17v-2a4 4 0 0 1 4-4h0" />
                <circle cx="9" cy="7" r="2" /><circle cx="17" cy="7" r="2" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">Per-staff salary history</div>
              <div className="text-xs text-slate-400">Full audit trail of all payroll transactions</div>
            </div>
          </div>
        </div>
        <p className="hint-text mt-3">Payroll is coming in a future update.</p>
      </div>
    </div>
  );
}
