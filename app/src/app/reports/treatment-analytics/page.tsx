"use client";

export default function TreatmentAnalyticsReportPage() {
  return (
    <div className="card">
        <div className="card-header">
          <div className="card-title">Treatment Analytics Report</div>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          See which procedures are most common, track completion rates, and analyze treatment success metrics.
        </p>
        <div className="empty-state">
          <p className="text-slate-600 font-medium">Coming Soon</p>
          <p className="empty-state-hint">This report is being developed</p>
        </div>
    </div>
  );
}
