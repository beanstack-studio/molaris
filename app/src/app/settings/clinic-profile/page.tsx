"use client";

export default function ClinicProfileSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Clinic Profile</h2>
        <p className="text-slate-600 mb-6">
          Manage your clinic's name, address, contact details, logo, and default settings.
        </p>
        
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-8 text-center">
          <p className="text-slate-600 font-medium">Coming Soon</p>
          <p className="text-sm text-slate-500 mt-2">We'll wire this up to your clinic settings table and use it for templates and receipts.</p>
        </div>
      </div>
    </div>
  );
}

