"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PatientTabs from "@/components/PatientTabs";
import { EditModal } from "@/components/EditModal";
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
  const [invoicedDates, setInvoicedDates] = useState<Set<string>>(new Set());

  const [visitDate, setVisitDate] = useState(() => todayLocalISO());
  const [visitDentistId, setVisitDentistId] = useState<string>("");
  const [visitConcern, setVisitConcern] = useState<string>("");
  const [defaultAppointmentConcern, setDefaultAppointmentConcern] = useState<string>("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [lineTooth, setLineTooth] = useState("");
  const [txServiceId, setTxServiceId] = useState<string>("");
  const [txServiceName, setTxServiceName] = useState<string>("");
  const [lineNote, setLineNote] = useState("");

  // Edit/delete states
  const [editingVisitDate, setEditingVisitDate] = useState<string | null>(null);
  const [editingVisitDentistId, setEditingVisitDentistId] = useState<string>("");
  const [editingVisitConcern, setEditingVisitConcern] = useState<string>("");
  const [editingTreatmentNotes, setEditingTreatmentNotes] = useState<Record<string, string>>({});
  const [editingTreatmentTooth, setEditingTreatmentTooth] = useState<Record<string, string>>({});
  const [editingTreatmentProcedure, setEditingTreatmentProcedure] = useState<Record<string, string>>({});
  const [editingTreatmentServiceId, setEditingTreatmentServiceId] = useState<Record<string, string>>({});
  const [newTreatmentsToAdd, setNewTreatmentsToAdd] = useState<DraftLine[]>([]);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [treatmentSort, setTreatmentSort] = useState<"DATE_DESC" | "DATE_ASC">("DATE_DESC");

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
        // Sort by tooth number first (ascending), then by creation time (newest first)
        const toothA = a.tooth_number ?? 999;
        const toothB = b.tooth_number ?? 999;
        if (toothA !== toothB) return toothA - toothB;
        const aa = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bb - aa;
      });
    }
    const list = Object.entries(acc);
    if (treatmentSort === "DATE_ASC") {
      return list.sort((a, b) => (a[0] > b[0] ? 1 : -1));
    }
    return list.sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [treatments, treatmentSort]);

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
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });
    setDentists(!d.error && d.data ? (d.data as DentistRow[]) : []);

    const sm = await supabase
      .from("service_prices")
      .select("id, service_name, default_price, item_type, sort_order, created_at")
      .order("item_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("service_name", { ascending: true });
    setServiceMenu(!sm.error && sm.data ? (sm.data as ServicePriceRow[]) : []);

    const t = await supabase
      .from("treatments")
      .select(
        "id, treatment_date, procedure, tooth_number, notes, visit_concern, dentist_id, dentist_name, service_price_id, created_at"
      )
      .eq("patient_id", id)
      .order("treatment_date", { ascending: false })
      .order("created_at", { ascending: false });
    setTreatments(!t.error && t.data ? (t.data as Treatment[]) : []);

    // Load invoices to track which dates are invoiced
    const inv = await supabase
      .from("invoices")
      .select("invoice_date")
      .eq("patient_id", id);
    const invoicedDateSet = new Set<string>();
    if (!inv.error && inv.data) {
      inv.data.forEach((record: any) => {
        if (record.invoice_date) invoicedDateSet.add(record.invoice_date);
      });
    }
    setInvoicedDates(invoicedDateSet);

    // Load last appointment's concern to use as default
    const appt = await supabase
      .from("appointments")
      .select("concerns")
      .eq("patient_id", id)
      .eq("status", "completed")
      .order("appointment_date", { ascending: false })
      .limit(1);
    if (!appt.error && appt.data?.length && appt.data[0].concerns) {
      setDefaultAppointmentConcern(appt.data[0].concerns);
      setVisitConcern(appt.data[0].concerns); // Pre-fill on initial load
    } else {
      setDefaultAppointmentConcern("");
      setVisitConcern(""); // Reset to empty/placeholder if no appointment
    }

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

  function removeDraftLine(id: string) {
    setDraftLines((prev) => prev.filter((ln) => ln.id !== id));
  }

  async function saveVisit() {
    if (!id) return;
    setErr(null);

    if (!visitDate) return setErr("Select a visit date.");
    if (!visitConcern.trim()) return setErr("Enter the visit concern.");
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
      visit_concern: visitConcern.trim() || null,
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
    setVisitConcern(""); // Reset concern after saving
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
      <div className="loading-screen">
        <div className="loading-container">
          <img src="/loading.gif" alt="Loading" className="loading-icon" />
          <div className="loading-text">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {err ? <div className="error-banner">{err}</div> : null}
      <div className="page-content">
        <div className="page-sections">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Add visit</div>
              </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-6">
                  <label className="form-field-wrapper sm:col-span-1">
                    <span className="label-text">Visit date</span>
                    <div className="relative">
                      <input
                        type="text"
                        className="input-standard pointer-events-none"
                        value={visitDate ? formatDatePH(visitDate) : ""}
                        readOnly
                      />
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <input
                        type="date"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                      />
                    </div>
                  </label>

                  <label className="form-field-wrapper sm:col-span-2">
                    <span className="label-text">Concern</span>
                    <input
                      type="text"
                      className="input-standard"
                      value={visitConcern}
                      onChange={(e) => setVisitConcern(e.target.value)}
                      placeholder={defaultAppointmentConcern ? "From appointment" : "Chief complaint or concern"}
                    />
                  </label>

                  <label className="form-field-wrapper sm:col-span-2">
                    <span className="label-text">Dentist</span>
                    <select
                      className="input-h10-border-white"
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

                  <div className="button-group-row sm:col-span-1">
                    <button
                      className="btn-secondary-dark"
                      disabled={busy || draftLines.length === 0 || !visitConcern.trim()}
                      onClick={saveVisit}
                    >
                      {busy ? "Saving…" : "Save visit"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-6">
                  <label className="form-field-wrapper sm:col-span-1">
                    <span className="label-text">Tooth #</span>
                    <input
                      className="input-standard"
                      value={lineTooth}
                      onChange={(e) => setLineTooth(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="form-field-wrapper sm:col-span-2">
                    <span className="label-text">Treatment</span>
                    <select
                      className="input-h10-border-white"
                      value={txServiceId}
                      onChange={(e) => {
                        const svc = serviceMenu.find((s) => s.id === e.target.value);
                        setTxServiceId(e.target.value);
                        setTxServiceName(svc?.service_name ?? "");
                      }}
                    >
                      <option value="">Select treatment</option>
                      {serviceMenu
                        .slice()
                        .sort((a, b) => {
                          if (a.item_type !== b.item_type) {
                            return a.item_type === "SERVICE" ? -1 : 1;
                          }
                          return a.service_name.localeCompare(b.service_name);
                        })
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.service_name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="form-field-wrapper sm:col-span-2">
                    <span className="label-text">Notes</span>
                    <input
                      className="input-standard"
                      value={lineNote}
                      onChange={(e) => setLineNote(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <div className="button-group-row sm:col-span-1">
                    <button
                      className="btn-secondary-dark"
                      disabled={!txServiceId}
                      onClick={addDraftLine}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {draftLines.length > 0 ? (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead className="data-table-head">
                        <tr>
                          <th className="data-table-head-cell">Draft Visit</th>
                          <th className="data-table-head-cell-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftLines.map((ln, index) => (
                          <tr key={ln.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                            <td className="data-table-cell">
                              {ln.tooth_number ? `Tooth ${ln.tooth_number}: ` : ""}
                              {ln.procedure}
                              {ln.note ? ` (${ln.note})` : ""}
                            </td>
                            <td className="data-table-cell-right">
                              <button
                                className="data-table-btn"
                                onClick={() => removeDraftLine(ln.id)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
                
              <div className="card">
                <div className="flex-wrap-items-center-justify-between">
                  <div className="card-title">Treatment history</div>
                  <select
                    className="form-select-standard"
                    value={treatmentSort}
                    onChange={(e) => setTreatmentSort(e.target.value as any)}
                  >
                    <option value="DATE_DESC">Newest</option>
                    <option value="DATE_ASC">Oldest</option>
                  </select>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <colgroup>
                      <col className="col-20" />
                      <col className="col-25" />
                      <col className="col-40" />
                      <col className="col-15" />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Date</th>
                        <th className="data-table-head-cell">Dentist</th>
                        <th className="data-table-head-cell">Treatments</th>
                        <th className="data-table-head-cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedTreatmentHistory.map(([date, txs], index) => (
                        <tr key={date} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                          <td className="data-table-cell">{formatDatePH(date)}</td>
                          <td className="data-table-cell">{txs[0]?.dentist_name || "—"}</td>
                          <td className="data-table-cell">
                            <div className="space-y-1">
                              {txs.map((t) => (
                                <div key={t.id} className="text-sm">
                                  {t.tooth_number ? `Tooth ${t.tooth_number}: ` : ""}
                                  {t.procedure}
                                  {t.notes ? <div className="text-xs-slate-500-base">{t.notes}</div> : null}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="data-table-cell-right">
                            {invoicedDates.has(date) ? (
                              <div className="inline-block px-3 py-1 rounded-lg bg-amber-100 text-amber-800 text-sm font-semibold">Invoiced</div>
                            ) : (
                              <button
                                className="data-table-btn"
                                onClick={() => {
                                  setEditingVisitDate(date);
                                  setEditingTreatmentNotes({});
                                  setEditingTreatmentTooth({});
                                  setEditingTreatmentProcedure({});
                                  setEditingTreatmentServiceId({});
                                  setNewTreatmentsToAdd([]);
                                  // Extract concern from existing treatments on this date
                                  const txsForDate = groupedTreatmentHistory.find(([d]) => d === date)?.[1] || [];
                                  setEditingVisitConcern(txsForDate[0]?.visit_concern || "");
                                }}
                              >
                                Edit Visit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {groupedTreatmentHistory.length === 0 ? (
                        <tr>
                          <td className="data-table-empty" colSpan={4}>
                            No treatments yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
      </div>
      {/* Edit Visit Modal */}
      <EditModal
        open={editingVisitDate !== null}
        title={`Edit Visit - ${editingVisitDate ? formatDatePH(editingVisitDate) : ""}`}
        onClose={() => {
          setEditingVisitDate(null);
          setEditingVisitDentistId("");
          setEditingVisitConcern("");
          setEditingTreatmentNotes({});
          setEditingTreatmentTooth({});
          setEditingTreatmentProcedure({});
          setEditingTreatmentServiceId({});
          setNewTreatmentsToAdd([]);
          setDeleteConfirmationText("");
          setErr(null);
        }}
      >
        {editingVisitDate && (() => {
          const visitTreatments = groupedTreatmentHistory.find(([d]) => d === editingVisitDate)?.[1] || [];
          if (!editingVisitDentistId && visitTreatments.length > 0) {
            setEditingVisitDentistId(visitTreatments[0].dentist_id || "");
          }
          return (
            <div className="spacing-vertical-lg">
              {/* Dentist Dropdown */}
              <div className="grid-gap-1">
                <label className="text-sm-medium-slate-700">Dentist</label>
                <select
                  className="input-h10-border-white"
                  value={editingVisitDentistId}
                  onChange={(e) => setEditingVisitDentistId(e.target.value)}
                >
                  <option value="">Select dentist…</option>
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Visit Concern */}
              <div className="grid-gap-1">
                <label className="text-sm-medium-slate-700">Concern</label>
                <input
                  type="text"
                  className="input-h10-border-white"
                  value={editingVisitConcern}
                  onChange={(e) => setEditingVisitConcern(e.target.value)}
                  placeholder="Chief complaint or concern"
                />
              </div>

              {/* Treatment Items */}
              <div className="space-y-2">
                <div className="text-sm-medium-slate-700">Treatments ({visitTreatments.length + newTreatmentsToAdd.length})</div>
                {visitTreatments.map((t) => (
                  <div key={t.id} className="rounded-lg border bg-slate-50 p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="grid gap-1">
                        <label className="text-xs-semibold-slate-700">Tooth #</label>
                        <input
                          type="number"
                          className="input-standard-sm"
                          placeholder="Optional"
                          value={editingTreatmentTooth[t.id] ?? (t.tooth_number?.toString() || "")}
                          onChange={(e) =>
                            setEditingTreatmentTooth((prev) => ({ ...prev, [t.id]: e.target.value }))
                          }
                          min="1"
                          max="32"
                        />
                      </div>
                      <div className="grid gap-1 col-span-2">
                        <label className="text-xs-semibold-slate-700">Treatment</label>
                        <select
                          className="input-h10-border-white"
                          value={editingTreatmentServiceId[t.id] ?? (t.service_price_id || "")}
                          onChange={(e) => {
                            const svc = serviceMenu.find((s) => s.id === e.target.value);
                            setEditingTreatmentServiceId((prev) => ({ ...prev, [t.id]: e.target.value }));
                            setEditingTreatmentProcedure((prev) => ({ ...prev, [t.id]: svc?.service_name ?? "" }));
                          }}
                        >
                          <option value="">Select treatment</option>
                          {serviceMenu
                            .slice()
                            .sort((a, b) => {
                              if (a.item_type !== b.item_type) {
                                return a.item_type === "SERVICE" ? -1 : 1;
                              }
                              return a.service_name.localeCompare(b.service_name);
                            })
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.service_name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        className="input-standard-sm flex-1"
                        placeholder="Notes…"
                        value={editingTreatmentNotes[t.id] ?? t.notes ?? ""}
                        onChange={(e) =>
                          setEditingTreatmentNotes((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                      />
                      <button
                        className="btn-sm-delete"
                        onClick={() => deleteTreatment(t.id)}
                        title="Delete treatment"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {visitTreatments.length === 0 ? (
                  <div className="text-xs-slate-500-base">No treatments on this date.</div>
                ) : null}
                
                {newTreatmentsToAdd.map((newT) => (
                  <div key={newT.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="grid gap-1">
                        <label className="text-xs-semibold-slate-700">Tooth #</label>
                        <input
                          type="number"
                          className="input-standard-sm"
                          placeholder="Optional"
                          value={editingTreatmentTooth[newT.id] ?? ""}
                          onChange={(e) =>
                            setEditingTreatmentTooth((prev) => ({ ...prev, [newT.id]: e.target.value }))
                          }
                          min="1"
                          max="32"
                        />
                      </div>
                      <div className="grid gap-1 col-span-2">
                        <label className="text-xs-semibold-slate-700">Treatment</label>
                        <select
                          className="input-h10-border-white"
                          value={editingTreatmentServiceId[newT.id] ?? ""}
                          onChange={(e) => {
                            const svc = serviceMenu.find((s) => s.id === e.target.value);
                            setEditingTreatmentServiceId((prev) => ({ ...prev, [newT.id]: e.target.value }));
                            setEditingTreatmentProcedure((prev) => ({ ...prev, [newT.id]: svc?.service_name ?? "" }));
                          }}
                        >
                          <option value="">Select treatment</option>
                          {serviceMenu
                            .slice()
                            .sort((a, b) => {
                              if (a.item_type !== b.item_type) {
                                return a.item_type === "SERVICE" ? -1 : 1;
                              }
                              return a.service_name.localeCompare(b.service_name);
                            })
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.service_name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        className="input-standard-sm flex-1"
                        placeholder="Notes…"
                        value={editingTreatmentNotes[newT.id] ?? ""}
                        onChange={(e) =>
                          setEditingTreatmentNotes((prev) => ({ ...prev, [newT.id]: e.target.value }))
                        }
                      />
                      <button
                        className="btn-sm-delete"
                        onClick={() => setNewTreatmentsToAdd((prev) => prev.filter((nt) => nt.id !== newT.id))}
                        title="Remove treatment"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  className="btn btn-sm btn-ghost w-full mt-2"
                  onClick={() => {
                    setNewTreatmentsToAdd((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        tooth_number: null,
                        service_price_id: null,
                        procedure: "",
                        note: "",
                      },
                    ]);
                  }}
                >
                  + Add Treatment
                </button>
              </div>

              {/* Delete Entire Visit */}
              <div className="delete-confirmation">
                <div className="delete-confirmation-title-red">Delete entire visit?</div>
                <div className="delete-confirmation-hint">
                  Type <span className="delete-confirmation-code">DELETE</span> to confirm deletion of all treatments on this date
                </div>
                <input
                  type="text"
                  className="delete-confirmation-input"
                  placeholder="DELETE"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                />
              </div>

              {/* Modal Actions */}
              <div className="modal-actions">
                <div className="modal-actions-left">
                  <button
                    className="delete-btn"
                    disabled={busy || deleteConfirmationText !== "DELETE"}
                    onClick={async () => {
                    if (!editingVisitDate) return;
                    setBusy(true);
                    setErr(null);
                    const { error } = await supabase
                      .from("treatments")
                      .delete()
                      .in("id", visitTreatments.map((t) => t.id));
                    setBusy(false);
                    if (error) return setErr(error.message);
                    setEditingVisitDate(null);
                    setEditingVisitDentistId("");
                    setEditingVisitConcern("");
                    setEditingTreatmentNotes({});
                    setEditingTreatmentTooth({});
                    setEditingTreatmentProcedure({});
                    setEditingTreatmentServiceId({});
                    setNewTreatmentsToAdd([]);
                    setDeleteConfirmationText("");
                    await loadData();
                  }}
                >
                    {busy ? "Deleting…" : "Delete Visit"}
                  </button>
                </div>
                <div className="modal-actions-right">
                  <button
                    className="cancel-btn"
                    onClick={() => {
                      setEditingVisitDate(null);
                      setEditingVisitDentistId("");
                      setEditingVisitConcern("");
                      setEditingTreatmentNotes({});
                      setEditingTreatmentTooth({});
                      setEditingTreatmentProcedure({});
                      setEditingTreatmentServiceId({});
                      setNewTreatmentsToAdd([]);
                      setDeleteConfirmationText("");
                      setErr(null);
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    className="save-btn"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setErr(null);
                      
                      // Update existing treatments
                      for (const t of visitTreatments) {
                        const toothVal = editingTreatmentTooth[t.id] !== undefined ? (editingTreatmentTooth[t.id].trim() ? Number(editingTreatmentTooth[t.id]) : null) : t.tooth_number;
                        const procedureVal = editingTreatmentProcedure[t.id] ?? t.procedure;
                        const serviceIdVal = editingTreatmentServiceId[t.id] ?? t.service_price_id;
                        const notesVal = editingTreatmentNotes[t.id] ?? t.notes;

                        const hasChanges = 
                          toothVal !== t.tooth_number ||
                          procedureVal !== t.procedure ||
                          serviceIdVal !== t.service_price_id ||
                          notesVal !== t.notes ||
                          editingVisitConcern !== (t.visit_concern ?? "");

                        if (hasChanges) {
                          const { error } = await supabase
                            .from("treatments")
                            .update({
                              tooth_number: toothVal,
                              procedure: procedureVal,
                              service_price_id: serviceIdVal,
                              notes: notesVal || null,
                              visit_concern: editingVisitConcern?.trim() || null,
                            })
                            .eq("id", t.id);
                          if (error) {
                            setBusy(false);
                            return setErr(error.message);
                          }
                        }
                      }

                      // Insert new treatments
                      if (newTreatmentsToAdd.length > 0) {
                        const dentistName = dentists.find((d) => d.id === editingVisitDentistId)?.full_name || "";
                        const newPayload = newTreatmentsToAdd
                          .filter((nt) => editingTreatmentServiceId[nt.id]) // Only insert if procedure selected
                          .map((nt) => ({
                            patient_id: id,
                            treatment_date: editingVisitDate,
                            tooth_number: editingTreatmentTooth[nt.id]?.trim() ? Number(editingTreatmentTooth[nt.id]) : null,
                            procedure: editingTreatmentProcedure[nt.id] || "",
                            service_price_id: editingTreatmentServiceId[nt.id],
                            notes: editingTreatmentNotes[nt.id]?.trim() || null,
                            visit_concern: editingVisitConcern?.trim() || null,
                            dentist_id: editingVisitDentistId || null,
                            dentist_name: dentistName || null,
                          }));
                        
                        if (newPayload.length > 0) {
                          const { error } = await supabase.from("treatments").insert(newPayload);
                          if (error) {
                            setBusy(false);
                            return setErr(error.message);
                          }
                        }
                      }

                      setBusy(false);
                      setEditingVisitDate(null);
                      setEditingVisitDentistId("");
                      setEditingVisitConcern("");
                      setEditingTreatmentNotes({});
                      setEditingTreatmentTooth({});
                      setEditingTreatmentProcedure({});
                      setEditingTreatmentServiceId({});
                      setNewTreatmentsToAdd([]);
                      setDeleteConfirmationText("");
                      await loadData();
                    }}
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()} 
      </EditModal>
    </>
  );
}
