"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PatientTabs from "@/components/PatientTabs";
import type { Patient, MedHist } from "@/lib/types";
import { combineFullName } from "@/lib/helpers";

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-700">{label}</span>
      {textarea ? (
        <textarea
          className="min-h-[88px] rounded-lg border px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="h-10 rounded-lg border px-3"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [med, setMed] = useState<MedHist | null>(null);
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [bp, setBp] = useState("");
  const [medNotes, setMedNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const p = await supabase.from("patients").select("*").eq("id", id).single();
    if (p.error) {
      setErr(p.error.message);
      setLoading(false);
      return;
    }
    setPatient(p.data as Patient);

    const m = await supabase
      .from("patient_medical_histories")
      .select("id, allergies, medications, blood_pressure, notes, conditions")
      .eq("patient_id", id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!m.error && m.data?.length) {
      const row = m.data[0] as MedHist;
      setMed(row);
      setAllergies(row.allergies ?? "");
      setMedications(row.medications ?? "");
      setBp(row.blood_pressure ?? "");
      setMedNotes(row.notes ?? "");
    } else {
      setMed(null);
      setAllergies("");
      setMedications("");
      setBp("");
      setMedNotes("");
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveMedical() {
    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const payload = {
      patient_id: id,
      allergies: allergies.trim() || null,
      medications: medications.trim() || null,
      blood_pressure: bp.trim() || null,
      notes: medNotes.trim() || null,
      conditions: {},
      updated_by: userId,
    };

    const res = med?.id
      ? await supabase.from("patient_medical_histories").update(payload).eq("id", med.id)
      : await supabase.from("patient_medical_histories").insert(payload);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    await loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <img src="/loading.gif" alt="Loading" className="h-12 w-12" />
          <div className="text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return <div className="min-h-screen p-6 text-red-600">Patient not found.</div>;
  }

  const displayFullName = combineFullName(patient.first_name, patient.last_name) || patient.full_name || "";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">{displayFullName}</div>
          <button className="btn btn-secondary" onClick={() => router.push("/patients")}>
            Back
          </button>
        </div>

        {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        <div className="app-section-body">
          <PatientTabs activeTab="Medical" />
          {/* Content */}
            <div className="p-4">
              <div className="grid gap-3">
                <Field label="Allergies" value={allergies} onChange={setAllergies} />
                <Field label="Medications" value={medications} onChange={setMedications} />
                <Field label="Blood pressure" value={bp} onChange={setBp} placeholder="e.g., 120/80" />
                <Field label="Notes" value={medNotes} onChange={setMedNotes} textarea />
                <div className="flex justify-end">
                  <button
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={busy}
                    onClick={saveMedical}
                  >
                    {busy ? "Saving…" : "Save medical history"}
                  </button>
                </div>
              </div>
            </div>
        </div>
      </div>
    </main>
  );
}
