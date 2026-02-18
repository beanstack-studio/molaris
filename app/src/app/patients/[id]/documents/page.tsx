"use client";

export default function DocumentsPage() {
  return (
    <>
      <div className="p-4">
        <div className="grid gap-4">
          <div className="card">
          <div className="card-header">
            <div className="card-title">Patient Documents</div>
          </div>
          <div className="mt-3">
            <p className="text-slate-600 mb-6">
              Generate and manage patient certificates, receipts, and other documents.
            </p>
            
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-8 text-center">
              <p className="text-slate-600 font-medium">Coming Soon</p>
              <p className="text-sm text-slate-500 mt-2">We're enhancing this feature with better template management and document preview capabilities.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}