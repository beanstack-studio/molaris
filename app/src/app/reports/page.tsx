"use client";

export default function ReportsOverviewPage() {
  return (
    <div className="card">
        <div className="card-header">
          <div className="card-title">Welcome to Reports</div>
        </div>
        <p className="text-slate-600 mb-6">
          Select a report type from the tabs above to analyze clinic performance and financial metrics.
        </p>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900">💳 Payment Reports</h3>
            <p className="text-sm text-blue-700 mt-2">Daily, monthly, and reconciliation reports</p>
          </div>
          
          <div className="rounded-lg bg-purple-50 p-4 border border-purple-200">
            <h3 className="font-semibold text-purple-900">📦 Bulk Payments</h3>
            <p className="text-sm text-purple-700 mt-2">Record and manage multiple payments at once</p>
          </div>
          
          <div className="rounded-lg bg-green-50 p-4 border border-green-200">
            <h3 className="font-semibold text-green-900">👤 Patient Revenue</h3>
            <p className="text-sm text-green-700 mt-2">Revenue analysis by patient and treatment type</p>
          </div>
          
          <div className="rounded-lg bg-indigo-50 p-4 border border-indigo-200">
            <h3 className="font-semibold text-indigo-900">🦷 Treatment Analytics</h3>
            <p className="text-sm text-indigo-700 mt-2">Most common procedures and completion rates</p>
          </div>
          
          <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
            <h3 className="font-semibold text-amber-900">📅 Appointment Reports</h3>
            <p className="text-sm text-amber-700 mt-2">Utilization, no-shows, and scheduling metrics</p>
          </div>
          
          <div className="rounded-lg bg-rose-50 p-4 border border-rose-200">
            <h3 className="font-semibold text-rose-900">📊 Clinic Performance</h3>
            <p className="text-sm text-rose-700 mt-2">Overall KPIs and clinic health metrics</p>
          </div>
        </div>
    </div>
  );
}
