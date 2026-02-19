"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";
import type { OrthoCase, OrthoEntry, DentistRow, Appointment, ServicePriceRow } from "@/lib/types";
import { formatDatePH } from "@/lib/helpers";
import { orthoEntryTags, orthoArchOptions, orthoApplianceTypes, orthoVisitTypes } from "@/lib/types";

export default function OrthoPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Case data
  const [orthoCase, setOrthoCase] = useState<OrthoCase | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [orthoServices, setOrthoServices] = useState<ServicePriceRow[]>([]);
  const [orthoPaid, setOrthoPaid] = useState(0); // Total paid on ortho invoices
  const [orthoOutstanding, setOrthoOutstanding] = useState(0); // Outstanding balance on ortho invoices

  // Entries data
  const [entries, setEntries] = useState<OrthoEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<OrthoEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // Case edit modal
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [caseModalMode, setCaseModalMode] = useState<"create" | "edit">("create");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "on_hold" | "completed">("active");
  const [editProviderDentistId, setEditProviderDentistId] = useState("");
  const [editPackageFee, setEditPackageFee] = useState("");
  const [editCaseNotes, setEditCaseNotes] = useState("");
  const [editPackageServiceId, setEditPackageServiceId] = useState("");
  const [editPhase, setEditPhase] = useState<"braces" | "aligners" | "retainer" | "completed" | "">("");
  const [editInclusions, setEditInclusions] = useState<Record<string, boolean>>({
    case_analysis: false,
    braces_installation: false,
    monthly_adjustments: false,
    consultations: false,
    ortho_kit: false,
    prophylaxis: false,
    xray: false,
    retainer: false,
  });

  // Entry modal
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryModalMode, setEntryModalMode] = useState<"create" | "edit">("create");
  const [editEntryId, setEditEntryId] = useState("");
  const [editEntryDate, setEditEntryDate] = useState("");
  const [editEntryTag, setEditEntryTag] = useState<"adjustment" | "wire_change" | "elastics" | "bracket_repair" | "retainer" | "follow_up" | "other">("adjustment");
  const [editEntryNote, setEditEntryNote] = useState("");
  const [editEntryArch, setEditEntryArch] = useState("");
  const [editEntryTeeth, setEditEntryTeeth] = useState("");
  const [editEntryWireDetails, setEditEntryWireDetails] = useState("");
  // PART 4B: New entry fields
  const [editEntryVisitType, setEditEntryVisitType] = useState<"adjustment" | "emergency" | "rebond" | "install" | "debond" | "retainer" | "consultation" | "">("");
  const [editEntryLostBracket, setEditEntryLostBracket] = useState(false);
  const [editEntryBrokenBracket, setEditEntryBrokenBracket] = useState(false);
  const [editEntryPokedWire, setEditEntryPokedWire] = useState(false);
  const [editEntryIsBillable, setEditEntryIsBillable] = useState(false);
  const [editEntryAddonServiceId, setEditEntryAddonServiceId] = useState("");
  const [editEntryAmountOverride, setEditEntryAmountOverride] = useState("");

  // Delete confirmation
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);

    // Load ortho case
    const caseRes = await supabase
      .from("ortho_cases")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!caseRes.error && caseRes.data?.length) {
      const c = caseRes.data[0] as OrthoCase;
      setOrthoCase(c);
    } else {
      setOrthoCase(null);
    }

    // Load dentists
    const dentistsRes = await supabase
      .from("dentists")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (!dentistsRes.error && dentistsRes.data) {
      setDentists(dentistsRes.data as DentistRow[]);
    }

    // PART 4A: Load ortho services (category='ortho')
    const servicesRes = await supabase
      .from("service_prices")
      .select("*")
      .eq("category", "ortho")
      .eq("is_active", true)
      .order("service_name", { ascending: true });

    if (!servicesRes.error && servicesRes.data) {
      setOrthoServices(servicesRes.data as ServicePriceRow[]);
    }

    // Load next appointment
    const appointmentsRes = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", id)
      .gte("appointment_date", new Date().toISOString().split("T")[0])
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(1);

    if (!appointmentsRes.error && appointmentsRes.data?.length) {
      setNextAppointment(appointmentsRes.data[0] as Appointment);
    } else {
      setNextAppointment(null);
    }

    setLoading(false);
  }, [id]);

  const loadEntries = useCallback(async () => {
    if (!orthoCase) return;
    setEntriesLoading(true);

    const entriesRes = await supabase
      .from("ortho_entries")
      .select("*")
      .eq("ortho_case_id", orthoCase.id)
      .order("entry_date", { ascending: false });

    if (!entriesRes.error && entriesRes.data) {
      setEntries(entriesRes.data as OrthoEntry[]);
      setFilteredEntries(entriesRes.data as OrthoEntry[]);
    }

    setEntriesLoading(false);
  }, [orthoCase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function saveCase() {
    if (!id) return;
    setErr(null);

    const data: Partial<OrthoCase> = {
      patient_id: id,
      status: editStatus,
      start_date: editStartDate || null,
      end_date: editEndDate || null,
      provider_dentist_id: editProviderDentistId || null,
      package_fee: editPackageFee ? parseFloat(editPackageFee) : null,
      notes: editCaseNotes.trim() || null,
      package_service_id: editPackageServiceId || null,
      phase: editPhase || null,
      inclusions: editInclusions,
    };

    setBusy(true);

    let res;
    if (caseModalMode === "create" && !orthoCase) {
      res = await supabase.from("ortho_cases").insert([data]);
    } else if (caseModalMode === "edit" && orthoCase) {
      res = await supabase.from("ortho_cases").update(data).eq("id", orthoCase.id);
    } else {
      setBusy(false);
      return;
    }

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
    } else {
      setCaseModalOpen(false);
      await loadData();
    }
  }

  function openCreateCaseModal() {
    setCaseModalMode("create");
    setEditStartDate("");
    setEditEndDate("");
    setEditStatus("active");
    setEditProviderDentistId("");
    setEditPackageFee("");
    setEditCaseNotes("");
    setEditPackageServiceId("");
    setEditPhase("");
    setEditInclusions({
      case_analysis: false,
      braces_installation: false,
      monthly_adjustments: false,
      consultations: false,
      ortho_kit: false,
      prophylaxis: false,
      xray: false,
      retainer: false,
    });
    setCaseModalOpen(true);
  }

  function openEditCaseModal() {
    if (!orthoCase) return;
    setCaseModalMode("edit");
    setEditStartDate(orthoCase.start_date || "");
    setEditEndDate(orthoCase.end_date || "");
    setEditStatus(orthoCase.status as "active" | "on_hold" | "completed");
    setEditProviderDentistId(orthoCase.provider_dentist_id || "");
    setEditPackageFee(orthoCase.package_fee?.toString() || "");
    setEditCaseNotes(orthoCase.notes || "");
    setEditPackageServiceId(orthoCase.package_service_id || "");
    setEditPhase(orthoCase.phase || "");
    setEditInclusions(orthoCase.inclusions || {
      case_analysis: false,
      braces_installation: false,
      monthly_adjustments: false,
      consultations: false,
      ortho_kit: false,
      prophylaxis: false,
      xray: false,
      retainer: false,
    });
    setCaseModalOpen(true);
  }

  async function saveEntry() {
    if (!orthoCase) return;
    setErr(null);

    if (!editEntryDate.trim()) {
      return setErr("Entry date is required.");
    }

    const data: Partial<OrthoEntry> = {
      ortho_case_id: orthoCase.id,
      entry_date: editEntryDate,
      tag: editEntryTag,
      note: editEntryNote.trim() || undefined,
      arch: editEntryArch || undefined,
      teeth: editEntryTeeth.trim() || undefined,
      wire_details: editEntryWireDetails.trim() || undefined,
      // PART 4B: New entry fields
      visit_type: editEntryVisitType || null,
      lost_bracket: editEntryLostBracket,
      broken_bracket: editEntryBrokenBracket,
      poked_wire: editEntryPokedWire,
      is_billable: editEntryIsBillable,
      addon_service_id: editEntryIsBillable && editEntryAddonServiceId ? editEntryAddonServiceId : null,
      amount_override: editEntryAmountOverride ? parseFloat(editEntryAmountOverride) : null,
    };

    setBusy(true);

    let res;
    if (entryModalMode === "create") {
      res = await supabase.from("ortho_entries").insert([data]);
    } else if (entryModalMode === "edit" && editEntryId) {
      res = await supabase.from("ortho_entries").update(data).eq("id", editEntryId);
    } else {
      setBusy(false);
      return;
    }

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
    } else {
      setEntryModalOpen(false);
      await loadEntries();
    }
  }

  function openCreateEntryModal() {
    // PART 4B: Reset new entry fields
    setEditEntryVisitType("");
    setEditEntryLostBracket(false);
    setEditEntryBrokenBracket(false);
    setEditEntryPokedWire(false);
    setEditEntryIsBillable(false);
    setEditEntryAddonServiceId("");
    setEditEntryAmountOverride("");
    setEntryModalOpen(true);
  }

  function openEditEntryModal(entry: OrthoEntry) {
    setEntryModalMode("edit");
    setEditEntryId(entry.id);
    setEditEntryDate(entry.entry_date);
    setEditEntryTag(entry.tag as "adjustment" | "wire_change" | "elastics" | "bracket_repair" | "retainer" | "follow_up" | "other");
    setEditEntryNote(entry.note || "");
    setEditEntryArch(entry.arch || "");
    setEditEntryTeeth(entry.teeth || "");
    setEditEntryWireDetails(entry.wire_details || "");
    // PART 4B: Load new entry fields
    setEditEntryVisitType(entry.visit_type || "");
    setEditEntryLostBracket(entry.lost_bracket || false);
    setEditEntryBrokenBracket(entry.broken_bracket || false);
    setEditEntryPokedWire(entry.poked_wire || false);
    setEditEntryIsBillable(entry.is_billable || false);
    setEditEntryAddonServiceId(entry.addon_service_id || "");
    setEditEntryAmountOverride(entry.amount_override?.toString() || "");
    setEntryModalOpen(true);
  }

  async function deleteEntry(entryId: string) {
    setErr(null);
    setBusy(true);

    const res = await supabase.from("ortho_entries").delete().eq("id", entryId);

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setDeleteConfirmEntry(null);
    await loadEntries();
  }

  if (loading) {
    return (
      <div className="flex-col-center justify-center min-h-screen">
        <div className="text-muted">Loading…</div>
      </div>
    );
  }

  return (
    <>
      {err ? <div className="error-banner">{err}</div> : null}
      <div className="page-content">
        <div className="page-sections">

          {/* Case Overview Box - Like Patient Information */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Case Overview</div>
              {orthoCase ? (
                <button className="btn-primary-dark" disabled={busy} onClick={openEditCaseModal}>
                  Edit
                </button>
              ) : (
                <button className="btn-secondary-dark" disabled={busy} onClick={openCreateCaseModal}>
                  Create Case
                </button>
              )}
            </div>

            {orthoCase ? (
              <div className="spacing-vertical-lg">
                {/* Row 1: Start Date, End Date, Status, Phase */}
                <div className="grid gap-3 grid-cols-4">
                  <label className="field-label">
                    <span className="field-label-text">Start Date</span>
                    <input className="field-input-readonly" value={orthoCase.start_date ? formatDatePH(orthoCase.start_date) : ""} readOnly />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">End Date</span>
                    <input className="field-input-readonly" value={orthoCase.end_date ? formatDatePH(orthoCase.end_date) : ""} readOnly />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Status</span>
                    <input className="field-input-readonly" value={orthoCase.status.charAt(0).toUpperCase() + orthoCase.status.slice(1).replace(/_/g, " ")} readOnly />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Phase</span>
                    <input className="field-input-readonly" value={orthoCase.phase ? orthoCase.phase.charAt(0).toUpperCase() + orthoCase.phase.slice(1) : ""} readOnly />
                  </label>
                </div>

                {/* Row 2: Dentist, Package, Next Appointment */}
                <div className="grid gap-3 grid-cols-3">
                  <label className="field-label">
                    <span className="field-label-text">Dentist</span>
                    <input 
                      className="field-input-readonly" 
                      value={
                      orthoCase.provider_dentist_id 
                        ? dentists.find(d => d.id === orthoCase.provider_dentist_id)?.full_name || ""
                        : ""
                    } 
                      readOnly 
                    />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Package</span>
                    <input 
                      className="field-input-readonly" 
                      value={orthoServices.find(s => s.id === orthoCase.package_service_id)?.service_name || ""} 
                      readOnly 
                    />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Next Appointment</span>
                    <input 
                      className="field-input-readonly" 
                      value={nextAppointment ? formatDatePH(nextAppointment.appointment_date) : "Use Appointments tool to schedule"} 
                      readOnly 
                    />
                  </label>
                </div>

                {/* Row 3: Inclusions (2 columns) + Notes */}
                <div className="grid gap-3 grid-cols-2">
                  {/* Inclusions - only show if any are checked */}
                  {orthoCase.inclusions && Object.values(orthoCase.inclusions).some(v => v) ? (
                    <div className="field-label">
                      <span className="field-label-text">Inclusions</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: "case_analysis", label: "Case Analysis & Diagnostics" },
                          { key: "ortho_kit", label: "Ortho Kit" },
                          { key: "braces_installation", label: "Braces Installation" },
                          { key: "prophylaxis", label: "Dental Prophylaxis" },
                          { key: "monthly_adjustments", label: "Monthly Adjustments" },
                          { key: "xray", label: "X-ray" },
                          { key: "consultations", label: "Ortho Consultations" },
                          { key: "retainer", label: "Retainer" },
                        ].map(({key, label}) => (
                          orthoCase.inclusions?.[key] ? (
                            <div key={key} className="flex items-center gap-2 text-sm">
                              ✓ <span>{label}</span>
                            </div>
                          ) : null
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Notes */}
                  <label className="field-label">
                    <span className="field-label-text">Notes</span>
                    {orthoCase.notes ? (
                      <textarea className="field-textarea" value={orthoCase.notes} readOnly rows={4} />
                    ) : (
                      <div className="text-sm text-slate-600">No notes</div>
                    )}
                  </label>
                </div>

                {/* Row 4: Package Fee, Paid, Outstanding */}
                <div className="grid gap-3 grid-cols-3 border-t pt-3">
                  <label className="field-label">
                    <span className="field-label-text">Package Fee</span>
                    <input 
                      className="field-input-readonly" 
                      value={orthoCase.package_fee ? `₱ ${Number(orthoCase.package_fee).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""} 
                      readOnly 
                    />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Paid</span>
                    <input 
                      className="field-input-readonly" 
                      value={`₱ ${Number(orthoPaid).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                      readOnly 
                    />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Outstanding</span>
                    <input 
                      className="field-input-readonly" 
                      value={`₱ ${Number(orthoOutstanding).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                      readOnly 
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600 py-4">No ortho case created yet. Click "Create Case" to get started.</div>
            )}
          </div>

          {/* Adjustment Log - Like Treatment History Table */}
          {orthoCase && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Adjustment Log</div>
                <button className="btn-secondary-dark" disabled={busy || entriesLoading} onClick={openCreateEntryModal}>
                  Add Entry
                </button>
              </div>

              {entriesLoading ? (
                <div className="text-center py-8 text-slate-500">Loading entries…</div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No adjustment entries yet.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <colgroup>
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "25%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "9%" }} />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Date</th>
                        <th className="data-table-head-cell">Tag</th>
                        <th className="data-table-head-cell">Note</th>
                        <th className="data-table-head-cell">Arch</th>
                        <th className="data-table-head-cell">Visit Type</th>
                        <th className="data-table-head-cell">Incidents</th>
                        <th className="data-table-head-cell">Charge</th>
                        <th className="data-table-head-cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry, index) => {
                        // PART 5: Helper to get service price or override
                        const chargeAmount = entry.amount_override || (
                          entry.addon_service_id 
                            ? orthoServices.find(s => s.id === entry.addon_service_id)?.default_price 
                            : undefined
                        );
                        const chargeDisplay = entry.is_billable && chargeAmount 
                          ? `₱ ${Number(chargeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—";

                        // PART 5: Helper to display incident badges
                        const incidents = [];
                        if (entry.lost_bracket) incidents.push("Lost");
                        if (entry.broken_bracket) incidents.push("Broken");
                        if (entry.poked_wire) incidents.push("Poked");

                        return (
                          <tr key={entry.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                            <td className="data-table-cell">{formatDatePH(entry.entry_date)}</td>
                            <td className="data-table-cell">
                              <span className="badge badge-secondary">{entry.tag.replace(/_/g, " ")}</span>
                            </td>
                            <td className="data-table-cell">{entry.note || "—"}</td>
                            <td className="data-table-cell">{entry.arch || "—"}</td>
                            <td className="data-table-cell">
                              {entry.visit_type ? (
                                <span className="text-xs text-slate-600">{entry.visit_type.replace(/_/g, " ")}</span>
                              ) : "—"}
                            </td>
                            <td className="data-table-cell">
                              {incidents.length > 0 ? (
                                <div className="flex gap-1 flex-wrap">
                                  {incidents.map((inc) => (
                                    <span key={inc} className="inline-block text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                      {inc}
                                    </span>
                                  ))}
                                </div>
                              ) : "—"}
                            </td>
                            <td className="data-table-cell">
                              <span className="text-sm font-medium">{chargeDisplay}</span>
                            </td>
                            <td className="data-table-cell-right">
                              <button
                                className="data-table-btn"
                                disabled={busy}
                                onClick={() => openEditEntryModal(entry)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Case Modal */}
      {caseModalOpen && (
        <EditModal 
          open={caseModalOpen} 
          title={`${caseModalMode === "create" ? "Create" : "Edit"} Ortho Case`} 
          onClose={() => { setCaseModalOpen(false); setErr(null); }}
        >
          <div className="spacing-vertical-lg">
            {/* Row 1: Start Date, End Date */}
            <div className="grid-gap-4-cols-2">
              <div className="field-label">
                <span className="field-label-text">Start Date</span>
                <input
                  type="date"
                  className="field-input"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="field-label">
                <span className="field-label-text">End Date</span>
                <input
                  type="date"
                  className="field-input"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Status, Phase */}
            <div className="grid-gap-4-cols-2">
              <div className="field-label">
                <span className="field-label-text">Status</span>
                <select
                  className="field-input"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "active" | "on_hold" | "completed")}
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="field-label">
                <span className="field-label-text">Phase</span>
                <select 
                  className="field-input" 
                  value={editPhase} 
                  onChange={(e) => setEditPhase(e.target.value as "braces" | "aligners" | "retainer" | "completed" | "")}
                >
                  <option value="">— Select —</option>
                  <option value="braces">Braces</option>
                  <option value="aligners">Aligners</option>
                  <option value="retainer">Retainer</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Row 3: Dentist */}
            <div className="field-label">
              <span className="field-label-text">Dentist</span>
              <select className="field-input" value={editProviderDentistId} onChange={(e) => setEditProviderDentistId(e.target.value)}>
                <option value="">— None —</option>
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 4: Treatment (Package Service) */}
            <div className="field-label">
              <span className="field-label-text">Treatment</span>
              <select 
                className="field-input" 
                value={editPackageServiceId} 
                onChange={(e) => setEditPackageServiceId(e.target.value)}
              >
                <option value="">— None —</option>
                {orthoServices.filter(s => s.item_type === "SERVICE").map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.service_name} (₱ {Number(s.default_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </option>
                ))}
              </select>
            </div>

            {/* Row 5: Inclusions Checklist (2 columns) */}
            <div className="field-label">
              <span className="field-label-text">Inclusions</span>
              <div className="grid gap-3 grid-cols-2">
                {[
                  { key: "case_analysis", label: "Case Analysis & Diagnostics" },
                  { key: "ortho_kit", label: "Ortho Kit" },
                  { key: "braces_installation", label: "Braces Installation" },
                  { key: "prophylaxis", label: "Dental Prophylaxis" },
                  { key: "monthly_adjustments", label: "Monthly Adjustments" },
                  { key: "xray", label: "X-ray" },
                  { key: "consultations", label: "Ortho Consultations" },
                  { key: "retainer", label: "Retainer" },
                ].map((inc) => (
                  <label key={inc.key} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={editInclusions[inc.key] || false}
                      onChange={(e) => setEditInclusions({ ...editInclusions, [inc.key]: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">{inc.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Row 6: Notes */}
            <div className="field-label">
              <span className="field-label-text">Notes</span>
              <textarea 
                className="field-textarea" 
                value={editCaseNotes} 
                onChange={(e) => setEditCaseNotes(e.target.value)} 
                placeholder="Any notes about the case…"
                rows={3}
              />
            </div>

            {/* Modal Footer */}
            <div className="modal-footer-spread">
              {caseModalMode === "edit" && orthoCase && (
                <button
                  className="btn-danger-lg"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const res = await supabase.from("ortho_cases").delete().eq("id", orthoCase.id);
                    setBusy(false);
                    if (res.error) return setErr(res.error.message);
                    setCaseModalOpen(false);
                    await loadData();
                  }}
                >
                  {busy ? "Deleting…" : "Delete Case"}
                </button>
              )}
              <div className="modal-footer-buttons">
                <button className="btn-secondary-outlined" onClick={() => setCaseModalOpen(false)}>
                  Cancel
                </button>
                <button
                  className="h-10 save-btn"
                  disabled={busy}
                  onClick={saveCase}
                >
                  {busy ? "Saving…" : caseModalMode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </EditModal>
      )}

      {/* Add/Edit Entry Modal */}
      {entryModalOpen && (
        <EditModal 
          open={entryModalOpen} 
          title={`${entryModalMode === "create" ? "Add" : "Edit"} Entry`} 
          onClose={() => { setEntryModalOpen(false); setErr(null); }}
        >
          <div className="spacing-vertical-lg">
            {/* Row 1: Date, Tag */}
            <div className="grid-gap-4-cols-2">
              <div className="field-label">
                <span className="field-label-text">Date</span>
                <input
                  type="date"
                  className="field-input"
                  value={editEntryDate}
                  onChange={(e) => setEditEntryDate(e.target.value)}
                />
              </div>
              <div className="field-label">
                <span className="field-label-text">Tag</span>
                <select className="field-input" value={editEntryTag} onChange={(e) => setEditEntryTag(e.target.value as any)}>
                  {orthoEntryTags.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note - Optional */}
            <div className="field-label">
              <span className="field-label-text">Note <span className="text-slate-400 text-xs">(optional)</span></span>
              <textarea
                className="field-textarea"
                value={editEntryNote}
                onChange={(e) => setEditEntryNote(e.target.value)}
                placeholder="Adjustment details, wire change info, etc."
                rows={3}
              />
            </div>

            {/* Row 2: Arch, Teeth */}
            <div className="grid-gap-4-cols-2">
              <div className="field-label">
                <span className="field-label-text">Arch</span>
                <select className="field-input" value={editEntryArch} onChange={(e) => setEditEntryArch(e.target.value)}>
                  <option value="">— None —</option>
                  {orthoArchOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-label">
                <span className="field-label-text">Teeth</span>
                <input
                  className="field-input"
                  value={editEntryTeeth}
                  onChange={(e) => setEditEntryTeeth(e.target.value)}
                  placeholder="e.g., 1.1, 1.2"
                />
              </div>
            </div>

            {/* Wire Details */}
            <div className="field-label">
              <span className="field-label-text">Wire Details</span>
              <input
                className="field-input"
                value={editEntryWireDetails}
                onChange={(e) => setEditEntryWireDetails(e.target.value)}
                placeholder="e.g., 0.016 NiTi"
              />
            </div>

            {/* PART 4B: New Ortho Entry Fields */}
            <div className="field-label">
              <span className="field-label-text">Visit Type</span>
              <select 
                className="field-input" 
                value={editEntryVisitType} 
                onChange={(e) => setEditEntryVisitType(e.target.value as any)}
              >
                <option value="">— Select —</option>
                <option value="adjustment">Adjustment</option>
                <option value="emergency">Emergency</option>
                <option value="rebond">Rebond</option>
                <option value="install">Install</option>
                <option value="debond">Debond</option>
                <option value="retainer">Retainer</option>
                <option value="consultation">Consultation</option>
              </select>
            </div>

            <div className="field-label">
              <span className="field-label-text">Incidents</span>
              <div className="grid gap-3">
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={editEntryLostBracket}
                    onChange={(e) => setEditEntryLostBracket(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Lost Bracket</span>
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={editEntryBrokenBracket}
                    onChange={(e) => setEditEntryBrokenBracket(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Broken Bracket</span>
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={editEntryPokedWire}
                    onChange={(e) => setEditEntryPokedWire(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Poked Wire</span>
                </label>
              </div>
            </div>

            <div className="field-label">
              <label className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={editEntryIsBillable}
                  onChange={(e) => setEditEntryIsBillable(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Additional Charge?</span>
              </label>
            </div>

            {editEntryIsBillable && (
              <div className="grid-gap-4-cols-2">
                <div className="field-label">
                  <span className="field-label-text">Service</span>
                  <select 
                    className="field-input" 
                    value={editEntryAddonServiceId} 
                    onChange={(e) => setEditEntryAddonServiceId(e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {orthoServices.filter(s => s.item_type === "SERVICE").map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.service_name} (₱ {Number(s.default_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-label">
                  <span className="field-label-text">Override Amount</span>
                  <input
                    type="number"
                    className="field-input"
                    step="0.01"
                    value={editEntryAmountOverride}
                    onChange={(e) => setEditEntryAmountOverride(e.target.value)}
                    placeholder="Leave blank to use service price"
                  />
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="modal-footer-spread">
              {entryModalMode === "edit" && editEntryId && (
                <button
                  className="btn-danger-lg"
                  disabled={busy}
                  onClick={() => setDeleteConfirmEntry(editEntryId)}
                >
                  Delete
                </button>
              )}
              <div className="modal-footer-buttons">
                <button className="btn-secondary-outlined" onClick={() => setEntryModalOpen(false)}>
                  Cancel
                </button>
                <button
                  className="h-10 save-btn"
                  disabled={busy}
                  onClick={saveEntry}
                >
                  {busy ? "Saving…" : entryModalMode === "create" ? "Add" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </EditModal>
      )}

      {/* Delete Entry Confirmation Modal */}
      {deleteConfirmEntry && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmEntry(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Entry?</div>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="delete-warning-title">Are you sure?</div>
                <div className="delete-warning-text">This action cannot be undone.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary-outlined" onClick={() => setDeleteConfirmEntry(null)}>
                Cancel
              </button>
              <button
                className="btn-danger-lg"
                disabled={busy}
                onClick={() => deleteEntry(deleteConfirmEntry)}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
