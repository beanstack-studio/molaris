"use client";

export default function DocumentTemplatesSettingsPage() {
  return (
    <>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Document Templates</div>
            </div>
            <p className="text-slate-600 mb-6">
              Manage your certificate and receipt templates, including logo support.
            </p>
            
            <div className="empty-state">
              <p className="text-slate-600 font-medium">Coming Soon</p>
              <p className="empty-state-hint">We'll connect this to your document_templates table and add logo support.</p>
            </div>
          </div>
    </>
  );
}
