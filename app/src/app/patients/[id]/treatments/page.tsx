"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type { Treatment, DentistRow, ServicePriceRow, DraftLine, Patient } from "@/lib/types";
import { todayLocalISO, formatDatePH, formatDateTimePH, combineFullName, splitFullName } from "@/lib/helpers";

export default function TreatmentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [serviceMenu, setServiceMenu] = useState<ServicePriceRow[]>([]);

  const [visitDate, setVisitDate] = useState(() => todayLocalISO());
  const [visitDentistId, setVisitDentistId] = useState<string>("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [lineTooth, setLineTooth] = useState("");
  const [txServiceId, setTxServiceId] = useState<string>("");
  const [txServiceName, setTxServiceName] = useState<string>("");
  const [lineNote, setLineNote] = useState("");

  const dentistNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of dentists) m[d.id] = d.full_name;
    return m;
  }, [dentists]);

  const treatmentsByDate = useMemo(() => {
    const map = new Map<string, Treatment[]>();
    for (const t of treatments) {
      const k = t.treatment_date;
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return map;
  }, [treatments]);

  const groupedTreatmentHistory = useMemo(() => {
    const acc: Record<string, Treatment[]> = {};
    for (const t of treatments) {
      const k = t.treatment_date;
      acc[k] = acc[k] ? [...acc[k], t] : [t];
    }
    for (const k of Object.keys(acc)) {
      acc[k] = acc[k].slice().sort((a, b) => {
        const aa = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bb - aa;
      });
    }
    return Object.entries(acc).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [treatments]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr(null);

    // Load patient info
    const p = await supabase.from("patients").select("*").eq("id", id).single();
    if (!p.error && p.data) {
      const patRaw = p.data as any;
      const fallback = splitFullName(patRaw.full_name ?? "");
      const dbFirst = String(patRaw.first_name ?? "").trim();
      const dbLast = String(patRaw.last_name ?? "").trim();
      const firstNameFinal = dbFirst || fallback.first;
      const lastNameFinal = dbLast || fallback.last;

      setPatient({
        id: patRaw.id,
        full_name: patRaw.full_name,
        first_name: firstNameFinal,
        last_name: lastNameFinal,
        phone: patRaw.phone,
        birth_date: patRaw.birth_date,
        address: patRaw.address,
        occupation: patRaw.occupation,
        email: patRaw.email,
        gender: patRaw.gender,
        notes: patRaw.notes,
      });
    }

    const d = await supabase
      .from("dentists")
      .select("id, full_name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });
    setDentists(!d.error && d.data ? (d.data as DentistRow[]) : []);

    const sm = await supabase
      .from("service_prices")
      .select("id, service_name, default_price, item_type, is_active, sort_order, created_at")
      .order("item_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("service_name", { ascending: true });
    setServiceMenu(!sm.error && sm.data ? (sm.data as ServicePriceRow[]) : []);

    const t = await supabase
      .from("treatments")
      .select(
        "id, treatment_date, procedure, tooth_number, notes, dentist_id, dentist_name, service_price_id, created_at"
      )
      .eq("patient_id", id)
      .order("treatment_date", { ascending: false })
      .order("created_at", { ascending: false });
    setTreatments(!t.error && t.data ? (t.data as Treatment[]) : []);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function addDraftLine() {
    setErr(null);

    if (!visitDate) return setErr("Select a visit date first.");
    if (!visitDentistId) return setErr("Select the attending dentist first.");
    if (!txServiceId || !txServiceName.trim()) return setErr("Select a procedure/service.");

    const toothVal = lineTooth.trim() ? Number(lineTooth) : null;

    const next: DraftLine = {
      id: crypto.randomUUID(),
      tooth_number: toothVal,
      service_price_id: txServiceId || null,
      procedure: txServiceName.trim(),
      note: lineNote.trim(),
    };

    setDraftLines((prev) => [next, ...prev]);
    setLineTooth("");
    setTxServiceId("");
    setTxServiceName("");
    setLineNote("");
  }

  async function saveVisit() {
    if (!id) return;
    setErr(null);

    if (!visitDate) return setErr("Select a visit date.");
    if (!visitDentistId) return setErr("Select the attending dentist.");
    if (draftLines.length === 0) return setErr("Add at least one procedure.");

    setBusy(true);

    const dentistName = dentists.find((d) => d.id === visitDentistId)?.full_name || "";

    const payload = draftLines.map((ln) => ({
      patient_id: id,
      treatment_date: visitDate,
      procedure: ln.procedure,
      tooth_number: ln.tooth_number,
      notes: ln.note || null,
      dentist_id: visitDentistId || null,
      dentist_name: dentistName || null,
      service_price_id: ln.service_price_id,
    }));

    const ins = await supabase.from("treatments").insert(payload);

    setBusy(false);
    if (ins.error) return setErr(ins.error.message);

    setDraftLines([]);
    setVisitDate(todayLocalISO());
    setVisitDentistId("");
    await loadData();
  }

  async function deleteTreatment(treatmentId: string) {
    setBusy(true);
    setErr(null);

    const res = await supabase.from("treatments").delete().eq("id", treatmentId);

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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">
            {patient ? combineFullName(patient.first_name, patient.last_name) || patient.full_name || "" : "Patient Treatments"}
          </div>
          <button className="btn btn-secondary" onClick={() => window.history.back()}>
            Back
          </button>
        </div>

        {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        <div className="app-section-body">
          <PatientTabs activeTab="Treatments" />

          <div>
            <div className="grid gap-4">
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold">Add treatment</div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Visit date</span>
                    <input
                      type="date"
                      className="h-10 rounded-lg border px-3"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Dentist</span>
                    <select
                      className="h-10 rounded-lg border bg-white px-3"
                      value={visitDentistId}
                      onChange={(e) => setVisitDentistId(e.target.value)}
                    >
                      <option value="">Select dentist</option>
                      {dentists.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button
                      className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={busy || draftLines.length === 0}
                      onClick={saveVisit}
                    >
                      {busy ? "Saving…" : "Save visit"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Tooth #</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={lineTooth}
                      onChange={(e) => setLineTooth(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Procedure</span>
                    <select
                      className="h-10 rounded-lg border bg-white px-3"
                      value={txServiceId}
                      onChange={(e) => {
                        const svc = serviceMenu.find((s) => s.id === e.target.value);
                        setTxServiceId(e.target.value);
                        setTxServiceName(svc?.service_name ?? "");
                      }}
                    >
                      <option value="">Select procedure</option>
                      {serviceMenu.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.service_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Notes</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={lineNote}
                      onChange={(e) => setLineNote(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      className="h-10 rounded-lg border bg-white px-3 text-sm font-semibold disabled:opacity-60"
                      disabled={!txServiceId}
                      onClick={addDraftLine}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {draftLines.length > 0 ? (
                  <div className="mt-3 rounded-xl border bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-700">Draft procedures</div>
                    <div className="mt-2 space-y-2">
                      {draftLines.map((ln) => (
                        <div key={ln.id} className="flex items-center justify-between rounded-lg bg-white p-2">
                          <div className="text-sm">
                            {ln.tooth_number ? `Tooth ${ln.tooth_number}: ` : ""}
                            {ln.procedure}
                            {ln.note ? ` (${ln.note})` : ""}
                          </div>
                          <button
                            className="rounded border bg-white px-2 py-1 text-sm"
                            onClick={() => removeDraftLine(ln.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold">Treatment history</div>

                <div className="mt-3 space-y-4">
                  {groupedTreatmentHistory.map(([date, txs]) => (
                    <div key={date} className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-800">{formatDatePH(date)}</div>
                      <div className="mt-2 space-y-2">
                        {txs.map((t) => (
                          <div key={t.id} className="flex items-center justify-between rounded-lg bg-white p-3">
                            <div className="grid gap-1">
                              <div className="text-sm font-semibold">
                                {t.tooth_number ? `Tooth ${t.tooth_number}: ` : ""}
                                {t.procedure}
                              </div>
                              <div className="text-xs text-slate-600">
                                {t.dentist_name || "Unknown dentist"} • {formatDateTimePH(t.created_at)}
                              </div>
                              {t.notes ? <div className="text-xs text-slate-500">{t.notes}</div> : null}
                            </div>
                            <button
                              className="rounded border bg-white px-3 py-1 text-sm"
                              onClick={() => deleteTreatment(t.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {groupedTreatmentHistory.length === 0 ? (
                    <div className="text-sm text-slate-500">No treatments yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );

  function removeDraftLine(lineId: string) {
    setDraftLines((prev) => prev.filter((x) => x.id !== lineId));
  }
}
