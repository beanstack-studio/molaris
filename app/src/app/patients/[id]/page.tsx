"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  occupation: string | null;
  email: string | null;
  notes: string | null;
};

type MedHist = {
  id: string;
  allergies: string | null;
  medications: string | null;
  blood_pressure: string | null;
  notes: string | null;
  conditions: any;
};

type ChartEntry = {
  id: string;
  tooth_number: number;
  surfaces: string | null;
  finding_code: string;
  notes: string | null;
  recorded_at: string;
};

type Treatment = {
  id: string;
  treatment_date: string;
  procedure: string;
  tooth_number: number | null;
  fee: number;
  notes: string | null;
};

const tabs = ["Info", "Medical", "Chart", "Treatments", "Files", "Documents"] as const;
type Tab = (typeof tabs)[number];

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("Info");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [med, setMed] = useState<MedHist | null>(null);
  const [chart, setChart] = useState<ChartEntry[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Medical form
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [bp, setBp] = useState("");
  const [medNotes, setMedNotes] = useState("");

  // Chart form
  const [tooth, setTooth] = useState("");
  const [surfaces, setSurfaces] = useState("");
  const [finding, setFinding] = useState("");
  const [chartNotes, setChartNotes] = useState("");

  // Treatment form
  const [procDate, setProcDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [procedure, setProcedure] = useState("");
  const [tTooth, setTTooth] = useState("");
  const [fee, setFee] = useState("");
  const [tNotes, setTNotes] = useState("");

  async function loadAll() {
    setLoading(true);
    setErr(null);

    const p = await supabase
      .from("patients")
      .select("id, full_name, phone, birth_date, address, occupation, email, notes")
      .eq("id", id)
      .single();

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
    }

    const c = await supabase
      .from("dental_chart_entries")
      .select("id, tooth_number, surfaces, finding_code, notes, recorded_at")
      .eq("patient_id", id)
      .order("recorded_at", { ascending: false });

    if (!c.error && c.data) setChart(c.data as ChartEntry[]);

    const t = await supabase
      .from("treatments")
      .select("id, treatment_date, procedure, tooth_number, fee, notes")
      .eq("patient_id", id)
      .order("treatment_date", { ascending: false })
      .limit(200);

    if (!t.error && t.data) setTreatments(t.data as Treatment[]);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      conditions: {}, // we’ll add checkboxes later
      updated_by: userId,
    };

    const res = med?.id
      ? await supabase.from("patient_medical_histories").update(payload).eq("id", med.id)
      : await supabase.from("patient_medical_histories").insert(payload);

    setBusy(false);
    if (res.error) return setErr(res.error.message);
    await loadAll();
  }

  async function addChartEntry() {
    const toothNum = Number(tooth);
    if (!toothNum || toothNum < 1) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const res = await supabase.from("dental_chart_entries").insert({
      patient_id: id,
      tooth_number: toothNum,
      surfaces: surfaces.trim() || null,
      finding_code: finding.trim(),
      notes: chartNotes.trim() || null,
      recorded_by: userId,
    });

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setTooth("");
    setSurfaces("");
    setFinding("");
    setChartNotes("");
    await loadAll();
  }

  async function addTreatment() {
    setBusy(true);
    setErr(null);

    const toothNum = tTooth.trim() ? Number(tTooth) : null;
    const feeNum = fee.trim() ? Number(fee) : 0;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const res = await supabase.from("treatments").insert({
      patient_id: id,
      treatment_date: procDate,
      procedure: procedure.trim(),
      tooth_number: toothNum,
      fee: isNaN(feeNum) ? 0 : feeNum,
      notes: tNotes.trim() || null,
      created_by: userId,
      dentist_id: userId,
    });

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setProcedure("");
    setTTooth("");
    setFee("");
    setTNotes("");
    await loadAll();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading…</div>;
  }

  if (!patient) {
    return (
      <div className="min-h-screen p-6">
        <button className="rounded-lg border bg-white px-4 py-2" onClick={() => router.push("/patients")}>
          Back
        </button>
        <p className="mt-4 text-red-600">Patient not found.</p>
        {err ? <p className="mt-2 text-slate-600">{err}</p> : null}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button className="rounded-lg border bg-white px-3 py-1 text-sm" onClick={() => router.push("/patients")}>
              ← Back
            </button>
            <h1 className="mt-2 text-2xl font-semibold">{patient.full_name}</h1>
            <p className="text-sm text-slate-600">
              {patient.phone ?? "No phone"} {patient.birth_date ? `• Born ${patient.birth_date}` : ""}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              className={
                "rounded-lg px-3 py-2 text-sm font-medium border " +
                (tab === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-900")
              }
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {err ? <div className="mt-3 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        {/* Tab content */}
        <div className="mt-4 rounded-xl border bg-white p-4">
          {tab === "Info" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Phone" value={patient.phone ?? "-"} />
              <InfoRow label="Birth date" value={patient.birth_date ?? "-"} />
              <InfoRow label="Address" value={patient.address ?? "-"} />
              <InfoRow label="Email" value={patient.email ?? "-"} />
              <InfoRow label="Occupation" value={patient.occupation ?? "-"} />
              <InfoRow label="Notes" value={patient.notes ?? "-"} />
              <p className="text-sm text-slate-600 sm:col-span-2">
                Next: we’ll add “Edit Patient” here.
              </p>
            </div>
          ) : null}

          {tab === "Medical" ? (
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
          ) : null}

          {tab === "Chart" ? (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Tooth no." value={tooth} onChange={setTooth} placeholder="e.g., 11" />
                <Field label="Surfaces" value={surfaces} onChange={setSurfaces} placeholder="e.g., MOD" />
                <Field label="Finding" value={finding} onChange={setFinding} placeholder="e.g., Caries" />
                <div className="flex items-end">
                  <button
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={busy || finding.trim().length < 2 || !tooth.trim()}
                    onClick={addChartEntry}
                  >
                    {busy ? "Adding…" : "Add entry"}
                  </button>
                </div>
              </div>
              <Field label="Notes" value={chartNotes} onChange={setChartNotes} textarea />

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Tooth</th>
                      <th className="text-left px-3 py-2">Finding</th>
                      <th className="text-left px-3 py-2">Surfaces</th>
                      <th className="text-left px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="px-3 py-2">{new Date(e.recorded_at).toLocaleString()}</td>
                        <td className="px-3 py-2">{e.tooth_number}</td>
                        <td className="px-3 py-2 font-medium">{e.finding_code}</td>
                        <td className="px-3 py-2">{e.surfaces ?? "-"}</td>
                        <td className="px-3 py-2">{e.notes ?? "-"}</td>
                      </tr>
                    ))}
                    {chart.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-slate-600">No chart entries yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "Treatments" ? (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="sm:col-span-1">
                  <Field label="Date" value={procDate} onChange={setProcDate} type="date" />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Procedure" value={procedure} onChange={setProcedure} placeholder="e.g., Extraction" />
                </div>
                <div className="sm:col-span-1">
                  <Field label="Tooth" value={tTooth} onChange={setTTooth} placeholder="optional" />
                </div>
                <div className="sm:col-span-1">
                  <Field label="Fee" value={fee} onChange={setFee} placeholder="0.00" />
                </div>
              </div>
              <Field label="Notes" value={tNotes} onChange={setTNotes} textarea />
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={busy || procedure.trim().length < 2}
                  onClick={addTreatment}
                >
                  {busy ? "Adding…" : "Add treatment"}
                </button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Procedure</th>
                      <th className="text-left px-3 py-2">Tooth</th>
                      <th className="text-left px-3 py-2">Fee</th>
                      <th className="text-left px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatments.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-3 py-2">{t.treatment_date}</td>
                        <td className="px-3 py-2 font-medium">{t.procedure}</td>
                        <td className="px-3 py-2">{t.tooth_number ?? "-"}</td>
                        <td className="px-3 py-2">{Number(t.fee).toFixed(2)}</td>
                        <td className="px-3 py-2">{t.notes ?? "-"}</td>
                      </tr>
                    ))}
                    {treatments.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-slate-600">No treatments yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "Files" ? (
            <div className="text-sm text-slate-600">
              Next: upload X-rays/photos to Supabase Storage and list them here.
            </div>
          ) : null}

          {tab === "Documents" ? (
            <div className="text-sm text-slate-600">
              Next: certificate + receipt templates, generate PDF, save to patient.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      {textarea ? (
        <textarea
          className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[90px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type ?? "text"}
        />
      )}
    </div>
  );
}
