"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { formatDateStandard, combineFullName } from "@/lib/helpers";

interface PatientInfo {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  occupation: string | null;
  notes: string | null;
}

interface MedHist {
  allergies: string | null;
  medications: string | null;
  blood_pressure: string | null;
  conditions: any;
  notes: string | null;
}

interface TreatmentRow {
  treatment_date: string;
  procedure: string;
  tooth_number: number | null;
  dentist_name: string | null;
  visit_concern: string | null;
  notes: string | null;
}

interface ClinicInfo {
  clinic_name: string | null;
  address: string | null;
  phone: string | null;
}

export default function PatientPrintPage() {
  const params = useParams();
  const patientId = params?.id as string;

  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [medHist, setMedHist] = useState<MedHist | null>(null);
  const [treatments, setTreatments] = useState<TreatmentRow[]>([]);
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [printedAt] = useState(() => new Date().toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" }));

  useEffect(() => {
    if (!patientId) return;
    async function load() {
      try {
        // Force session restore — new tab may not have auth initialized yet
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Try once more after a short delay (handles race condition on tab open)
          await new Promise((r) => setTimeout(r, 800));
          const { data: { session: session2 } } = await supabase.auth.getSession();
          if (!session2) {
            setLoadError("Not authenticated. Please log in and try again.");
            setLoading(false);
            return;
          }
        }

        const [patRes, medRes, txRes, clinicRes] = await Promise.all([
          supabase.from("patients").select("*").eq("id", patientId).single(),
          supabase.from("patient_medical_histories").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
          supabase.from("treatments").select("treatment_date, procedure, tooth_number, dentist_name, visit_concern, notes")
            .eq("patient_id", patientId).order("treatment_date", { ascending: false }).limit(50),
          supabase.from("clinic_profile").select("clinic_name, address, phone").limit(1),
        ]);

        if (patRes.error) { setLoadError(`Patient not found: ${patRes.error.message}`); setLoading(false); return; }
        if (patRes.data) setPatient(patRes.data as PatientInfo);
        if (medRes.data?.length) setMedHist(medRes.data[0] as MedHist);
        setTreatments((txRes.data ?? []) as TreatmentRow[]);
        if (clinicRes.data?.[0]) setClinic(clinicRes.data[0] as ClinicInfo);
        setLoading(false);
      } catch (err: any) {
        setLoadError(`Unexpected error: ${err?.message ?? "unknown"}`);
        setLoading(false);
      }
    }
    load();
  }, [patientId]);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Preparing document…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-600 text-sm text-center max-w-sm">{loadError}</p>
        <div className="flex gap-2">
          <button onClick={() => window.location.reload()} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg">Retry</button>
          <button onClick={() => window.close()} className="bg-white border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const displayName = patient
    ? combineFullName(patient.first_name, patient.last_name) || patient.full_name
    : "Unknown Patient";

  const age = patient?.birth_date
    ? (() => {
        const b = new Date(patient.birth_date);
        const t = new Date();
        let a = t.getFullYear() - b.getFullYear();
        if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
        return a;
      })()
    : null;

  const conditions: string[] = medHist?.conditions
    ? Object.entries(medHist.conditions).filter(([, v]) => v === true).map(([k]) => k.replace(/_/g, " "))
    : [];

  // Group treatments by date
  const byDate: Record<string, TreatmentRow[]> = {};
  for (const t of treatments) {
    if (!byDate[t.treatment_date]) byDate[t.treatment_date] = [];
    byDate[t.treatment_date].push(t);
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="fixed inset-0 z-[9999] bg-white overflow-auto" id="print-root">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 18mm 16mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          #print-root { position: static !important; overflow: visible !important; }
        }
        body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-[10000]">
        <button
          onClick={() => window.print()}
          className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow hover:bg-slate-700 transition-colors"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-white text-slate-600 border border-slate-200 text-sm px-4 py-2 rounded-lg shadow hover:bg-slate-50 transition-colors"
        >
          Close
        </button>
      </div>

      <div className="max-w-[720px] mx-auto px-6 py-8 text-sm">

        {/* ── Header: Clinic + patient name ──────────────────── */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-slate-200">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{clinic?.clinic_name || "Dental Clinic"}</h1>
            {clinic?.address && <p className="text-xs text-slate-500 mt-0.5">{clinic.address}</p>}
            {clinic?.phone && <p className="text-xs text-slate-500">{clinic.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Patient Record</p>
            <p className="text-xs text-slate-400 mt-0.5">Printed {printedAt}</p>
          </div>
        </div>

        {/* ── Patient info ──────────────────────────────────── */}
        <div className="mb-5">
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Patient Information</h2>
          <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 gap-x-8 gap-y-1.5">
            <InfoRow label="Full name" value={displayName} />
            <InfoRow label="Date of birth" value={patient?.birth_date ? `${formatDateStandard(patient.birth_date.split("T")[0])}${age !== null ? ` (${age} yrs)` : ""}` : "—"} />
            <InfoRow label="Gender" value={patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "—"} />
            <InfoRow label="Phone" value={patient?.phone || "—"} />
            <InfoRow label="Email" value={patient?.email || "—"} />
            <InfoRow label="Occupation" value={patient?.occupation || "—"} />
            {patient?.address && <div className="col-span-2"><InfoRow label="Address" value={patient.address} /></div>}
            {patient?.notes && <div className="col-span-2"><InfoRow label="Notes" value={patient.notes} /></div>}
          </div>
        </div>

        {/* ── Medical history ───────────────────────────────── */}
        {medHist && (
          <div className="mb-5">
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Medical History</h2>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 gap-x-8 gap-y-1.5">
              <InfoRow label="Allergies" value={medHist.allergies || "None reported"} />
              <InfoRow label="Blood pressure" value={medHist.blood_pressure || "—"} />
              {medHist.medications && <div className="col-span-2"><InfoRow label="Medications" value={medHist.medications} /></div>}
              {conditions.length > 0 && (
                <div className="col-span-2">
                  <InfoRow label="Medical conditions" value={conditions.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")} />
                </div>
              )}
              {medHist.notes && <div className="col-span-2"><InfoRow label="Medical notes" value={medHist.notes} /></div>}
            </div>
          </div>
        )}

        {/* ── Treatment history ─────────────────────────────── */}
        <div>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Treatment History{treatments.length > 0 ? ` (${dates.length} visit${dates.length !== 1 ? "s" : ""}, ${treatments.length} procedure${treatments.length !== 1 ? "s" : ""})` : ""}
          </h2>
          {dates.length === 0 ? (
            <p className="text-slate-400 text-xs italic">No treatments on record.</p>
          ) : (
            <div className="space-y-3">
              {dates.map((date) => (
                <div key={date} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">{formatDateStandard(date)}</span>
                    {byDate[date][0]?.dentist_name && (
                      <span className="text-xs text-slate-500">{byDate[date][0].dentist_name}</span>
                    )}
                  </div>
                  {byDate[date][0]?.visit_concern && (
                    <div className="px-3 py-1 bg-violet-50 border-b border-slate-100">
                      <span className="text-xs text-violet-700 italic">Concern: {byDate[date][0].visit_concern}</span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100">
                    {byDate[date].map((tx, i) => (
                      <div key={i} className="px-3 py-1.5 flex items-start gap-3">
                        <span className="text-xs text-slate-800 font-medium flex-1">{tx.procedure}</span>
                        {tx.tooth_number && <span className="text-xs text-slate-400 whitespace-nowrap">Tooth {tx.tooth_number}</span>}
                        {tx.notes && <span className="text-xs text-slate-400 italic flex-1 text-right">{tx.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[10px] text-slate-300">
            Powered by <span className="font-semibold">MOLARIS</span> · BeanStack Studio
          </p>
          <p className="text-[10px] text-slate-300">Confidential — for clinical use only</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="text-xs text-slate-400 font-medium min-w-[90px] flex-shrink-0">{label}:</span>
      <span className="text-xs text-slate-700">{value}</span>
    </div>
  );
}
