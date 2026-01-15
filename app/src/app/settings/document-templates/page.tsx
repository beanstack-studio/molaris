"use client";

export default function DocumentTemplatesSettingsPage() {
  return (
    <>
      <div className="p-4">
        <div className="grid gap-4">
          <div className="rounded-2xl border bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Document Templates</h2>
            <p className="text-slate-600 mb-6">
              Manage your certificate and receipt templates, including logo support.
            </p>
            
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-8 text-center">
              <p className="text-slate-600 font-medium">Coming Soon</p>
              <p className="text-sm text-slate-500 mt-2">We'll connect this to your document_templates table and add logo support.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
