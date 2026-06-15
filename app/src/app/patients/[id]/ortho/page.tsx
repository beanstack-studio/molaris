"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";
import { VISIT_REASONS, VisitReasonType, getOrthoOnlyReasons, getVisitReasonLabel } from "@/lib/visitReasonHelpers";
import type { OrthoCase, OrthoEntry, OrthoEntryItem, DentistRow, Appointment, ServicePriceRow, Invoice } from "@/lib/types";
import { formatDateStandard } from "@/lib/helpers";
import { PageLoader } from "@/components/Spinner";

/* Helpers */
function num(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export default function OrthoPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { clinicId } = useClinic();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Case data
  const [orthoCase, setOrthoCase] = useState<OrthoCase | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [orthoServices, setOrthoServices] = useState<ServicePriceRow[]>([]);
  const [orthoInvoices, setOrthoInvoices] = useState<Invoice[]>([]);
  const [orthoPayments, setOrthoPayments] = useState<any[]>([]);
  const [orthoPaid, setOrthoPaid] = useState(0); // Total paid on ortho invoices
  const [orthoOutstanding, setOrthoOutstanding] = useState(0); // Outstanding balance on ortho invoices
  const [orthoTotalPackageFee, setOrthoTotalPackageFee] = useState(0); // Total package fee including add-ons

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

  // Refs for date pickers
  const startDateRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const visitDateRef = useRef<HTMLInputElement | null>(null);

  // Visit log modal
  const [entries, setEntries] = useState<OrthoEntry[]>([]);
  const [entryItems, setEntryItems] = useState<Map<string, OrthoEntryItem[]>>(new Map());
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitModalMode, setVisitModalMode] = useState<"create" | "edit">("create");
  const [editVisitId, setEditVisitId] = useState("");
  const [editVisitDate, setEditVisitDate] = useState("");
  const [editVisitType, setEditVisitType] = useState<VisitReasonType>("adjustment");
  const [editVisitNote, setEditVisitNote] = useState("");
  const [editVisitItems, setEditVisitItems] = useState<Partial<OrthoEntryItem>[]>([]);
  const [editPackageInvoice, setEditPackageInvoice] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const loadData = useCallback(async () => {
    if (!id || !clinicId) return;
    setLoading(true);
    setError(null);

    // Load ortho case
    const caseRes = await supabase
      .from("ortho_cases")
      .select("*")
      .eq("patient_id", id)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(1);

    let currentOrthoCase: OrthoCase | null = null;
    if (!caseRes.error && caseRes.data?.length) {
      const c = caseRes.data[0] as OrthoCase;
      setOrthoCase(c);
      currentOrthoCase = c;
    } else {
      setOrthoCase(null);
    }

    // Load dentists
    const dentistsRes = await supabase
      .from("dentists")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .order("full_name", { ascending: true });

    if (!dentistsRes.error && dentistsRes.data) {
      setDentists(dentistsRes.data as DentistRow[]);
    }

    // PART 4A: Load ortho services (category='ortho')
    const servicesRes = await supabase
      .from("service_prices")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("category", "ortho")
      .eq("is_active", true)
      .order("service_name", { ascending: true });

    if (!servicesRes.error && servicesRes.data) {
      setOrthoServices(servicesRes.data as ServicePriceRow[]);
    }

    // Load ortho entries and items early so we can calculate charged extras
    if (currentOrthoCase) {
      const entriesRes = await supabase
        .from("ortho_entries")
        .select("*")
        .eq("ortho_case_id", currentOrthoCase.id)
        .order("entry_date", { ascending: false });

      if (!entriesRes.error && entriesRes.data) {
        setEntries(entriesRes.data as OrthoEntry[]);

        // Load items for each entry
        const itemsMap = new Map<string, OrthoEntryItem[]>();
        for (const entry of entriesRes.data) {
          const itemsRes = await supabase
            .from("ortho_entry_items")
            .select("*")
            .eq("ortho_entry_id", entry.id)
            .order("created_at", { ascending: true });

          if (!itemsRes.error && itemsRes.data) {
            itemsMap.set(entry.id, itemsRes.data as OrthoEntryItem[]);
          }
        }
        setEntryItems(itemsMap);
      }
    }

    // Load next appointment
    const appointmentsRes = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", id)
      .eq("clinic_id", clinicId)
      .gte("appointment_date", new Date().toISOString().split("T")[0])
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(1);

    if (!appointmentsRes.error && appointmentsRes.data?.length) {
      setNextAppointment(appointmentsRes.data[0] as Appointment);
    } else {
      setNextAppointment(null);
    }

    // Load ortho invoices
    const orthoInvoicesRes = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, status, total, created_at")
      .eq("patient_id", id)
      .eq("clinic_id", clinicId)
      .eq("invoice_type", "ortho")
      .order("created_at", { ascending: false });

    if (!orthoInvoicesRes.error && orthoInvoicesRes.data) {
      setOrthoInvoices(orthoInvoicesRes.data as Invoice[]);

      // Load all payments for these invoices
      const orthoInvoiceIds = (orthoInvoicesRes.data as Invoice[]).map((inv) => inv.id);
      if (orthoInvoiceIds.length > 0) {
        const orthoPayRes = await supabase
          .from("payments")
          .select("id, invoice_id, amount, payment_date, status, voided_at, created_at")
          .in("invoice_id", orthoInvoiceIds)
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false });

        if (!orthoPayRes.error && orthoPayRes.data) {
          setOrthoPayments(orthoPayRes.data);
        }
      }
    } else {
      setOrthoInvoices([]);
      setOrthoPayments([]);
    }

    setLoading(false);
  }, [id, clinicId]);

  const loadEntries = useCallback(async () => {
    if (!orthoCase) return;
    setEntriesLoading(true);

    // Load all entries for this case
    const entriesRes = await supabase
      .from("ortho_entries")
      .select("*")
      .eq("ortho_case_id", orthoCase.id)
      .order("entry_date", { ascending: false });

    if (!entriesRes.error && entriesRes.data) {
      setEntries(entriesRes.data as OrthoEntry[]);

      // Load items for each entry
      const itemsMap = new Map<string, OrthoEntryItem[]>();
      
      for (const entry of entriesRes.data) {
        const itemsRes = await supabase
          .from("ortho_entry_items")
          .select("*")
          .eq("ortho_entry_id", entry.id)
          .order("created_at", { ascending: true });

        if (!itemsRes.error && itemsRes.data) {
          itemsMap.set(entry.id, itemsRes.data as OrthoEntryItem[]);
        }
      }
      setEntryItems(itemsMap);
    }

    setEntriesLoading(false);
  }, [orthoCase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (orthoCase) {
      loadEntries();
    }
  }, [orthoCase, loadEntries]);

  // Calculate ortho billing overview reactively from invoices, payments, and charged entries
  const orthoBillingOverview = useMemo(() => {
    const totalInvoiced = orthoInvoices.reduce((sum, inv: Invoice) => {
      return sum + num(inv.total);
    }, 0);

    // Add charged extras from entries (those with is_charged=true and not package services)
    let chargedExtras = 0;
    entries.forEach((entry: OrthoEntry) => {
      const itemsForEntry = entryItems.get(entry.id) || [];
      itemsForEntry.forEach((item: OrthoEntryItem) => {
        if (item.is_charged) {
          const service = orthoServices.find((s) => s.id === item.service_id);
          // Only add if it's not a package service (packages are base components of invoice total)
          if (service && service.ortho_kind !== "package") {
            const amount = item.amount_override || service.default_price || 0;
            chargedExtras += num(amount);
          }
        }
      });
    });

    const totalPaid = orthoPayments
      .filter((p: any) => !p.voided_at)
      .reduce((sum, p) => sum + num(p.amount), 0);
    
    const totalChargeable = totalInvoiced + chargedExtras;
    return { totalInvoiced: totalChargeable, totalPaid, outstanding: totalChargeable - totalPaid };
  }, [orthoInvoices, orthoPayments, entries, entryItems, orthoServices]);

  // Sync calculation results to display state
  useEffect(() => {
    setOrthoTotalPackageFee(orthoBillingOverview.totalInvoiced);
    setOrthoPaid(orthoBillingOverview.totalPaid);
    setOrthoOutstanding(Math.max(0, orthoBillingOverview.outstanding));
  }, [orthoBillingOverview]);

  async function saveCase() {
    if (!id) return;
    setError(null);

    const data: Partial<OrthoCase> = {
      clinic_id: clinicId,
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
      setError(res.error.message);
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

  async function saveVisit() {
    if (!orthoCase) return;
    setError(null);

    if (!editVisitDate.trim()) {
      return setError("Visit date is required.");
    }

    const visitData: Partial<OrthoEntry> = {
      ortho_case_id: orthoCase.id,
      entry_date: editVisitDate,
      concern_type: editVisitType,
      note: editVisitNote.trim() || null,
      invoice_package: editPackageInvoice,
    };

    setBusy(true);

    let entryId: string;
    if (visitModalMode === "create") {
      const res = await supabase.from("ortho_entries").insert([visitData]).select("id");
      if (res.error) {
        setBusy(false);
        return setError(res.error.message);
      }
      entryId = res.data?.[0]?.id;
    } else if (visitModalMode === "edit") {
      entryId = editVisitId;
      const res = await supabase.from("ortho_entries").update(visitData).eq("id", entryId);
      if (res.error) {
        setBusy(false);
        return setError(res.error.message);
      }
    } else {
      setBusy(false);
      return;
    }

    // Remove old items if editing
    if (visitModalMode === "edit") {
      const deleteRes = await supabase.from("ortho_entry_items").delete().eq("ortho_entry_id", entryId);
      if (deleteRes.error) {
        setBusy(false);
        return setError(deleteRes.error.message);
      }
    }

    // Check if any item being charged is an ortho package and already exists in another visit
    for (const item of editVisitItems) {
      if (item.is_charged && item.service_id) {
        const service = orthoServices.find(s => s.id === item.service_id);
        if (service?.ortho_kind === "package") {
          // Check if this package is already billed for this case
          const existingRes = await supabase
            .from("ortho_entry_items")
            .select("id")
            .eq("service_id", item.service_id)
            .eq("is_charged", true);

          const caseEntries = await supabase
            .from("ortho_entries")
            .select("id")
            .eq("ortho_case_id", orthoCase.id);

          const caseEntryIds = caseEntries.data?.map(e => e.id) || [];
          const isAlreadyBilled = existingRes.data?.some(ei => caseEntryIds.includes(ei.id));

          if (isAlreadyBilled && visitModalMode === "create") {
            setBusy(false);
            return setError("This ortho package has already been billed for this case.");
          }
        }
      }
    }

    // Insert new items
    const itemsToInsert = editVisitItems
      .filter(item => item.service_id)
      .map(item => ({
        ortho_entry_id: entryId,
        service_id: item.service_id,
        is_charged: item.is_charged || false,
        amount_override: item.amount_override || null,
        service_detail: item.service_detail?.trim() || null,
      }));

    if (itemsToInsert.length > 0) {
      const itemsRes = await supabase.from("ortho_entry_items").insert(itemsToInsert);
      if (itemsRes.error) {
        setBusy(false);
        return setError(itemsRes.error.message);
      }
    }

    setBusy(false);
    setVisitModalOpen(false);
    await loadEntries();
  }

  function openCreateVisitModal() {
    setVisitModalMode("create");
    setEditVisitId("");
    const today = new Date().toISOString().split("T")[0];
    setEditVisitDate(today);
    setEditVisitType("adjustment");
    setEditVisitNote("");
    setEditVisitItems([]);
    setEditPackageInvoice(false);
    setVisitModalOpen(true);
  }

  function openEditVisitModal(entry: OrthoEntry) {
    setVisitModalMode("edit");
    setEditVisitId(entry.id);
    setEditVisitDate(entry.entry_date);
    setEditVisitType((entry.concern_type as VisitReasonType) || "adjustment");
    setEditVisitNote(entry.note || "");
    setEditPackageInvoice(entry.invoice_package || false);
    const items = entryItems.get(entry.id) || [];
    setEditVisitItems(items);
    setVisitModalOpen(true);
  }

  function addVisitItem() {
    setEditVisitItems([...editVisitItems, { service_id: "", is_charged: false }]);
  }

  function removeVisitItem(index: number) {
    setEditVisitItems(editVisitItems.filter((_, i) => i !== index));
  }

  function updateVisitItem(index: number, updates: Partial<OrthoEntryItem>) {
    const updated = [...editVisitItems];
    updated[index] = { ...updated[index], ...updates };
    setEditVisitItems(updated);
  }

  if (loading) {
    return <PageLoader text="Loading ortho records…" />;
  }

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}

          {/* Case Overview Box - Like Patient Information */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Case Overview</div>
              {orthoCase ? (
                <button className="save-btn" disabled={busy} onClick={openEditCaseModal}>
                  Edit
                </button>
              ) : (
                <button className="save-btn" disabled={busy} onClick={openCreateCaseModal}>
                  Create Case
                </button>
              )}
            </div>

            {orthoCase ? (
              <div className="spacing-vertical-lg">
                {/* Row 1: Start Date, End Date, Status, Phase */}
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  <label className="field-label">
                    <span className="field-label-text">Start Date</span>
                    <input className="field-input-readonly" value={orthoCase.start_date ? formatDateStandard(orthoCase.start_date) : ""} readOnly />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">End Date</span>
                    <input className="field-input-readonly" value={orthoCase.end_date ? formatDateStandard(orthoCase.end_date) : ""} readOnly />
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

                {/* Row 2: Orthodontist, Package, Next Appointment */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <label className="field-label">
                    <span className="field-label-text">Orthodontist</span>
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
                      value={nextAppointment ? formatDateStandard(nextAppointment.appointment_date) : "Use Appointments tool to schedule"} 
                      readOnly 
                    />
                  </label>
                </div>

                {/* Row 3: Inclusions & Notes */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 items-start">
                  <div className="field-label flex flex-col">
                    <span className="field-label-text">Inclusions</span>
                    {orthoCase.inclusions && Object.values(orthoCase.inclusions).some(v => v) ? (
                      <div className="card-light">
                        <div className="grid grid-cols-2 gap-1">
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
                              <div key={key} className="flex items-start gap-2 text-sm leading-tight">
                                <span className="text-slate-400">•</span>
                                <span>{label}</span>
                              </div>
                            ) : null
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No inclusions selected</div>
                    )}
                  </div>

                  <div className="field-label flex flex-col">
                    <span className="field-label-text">Notes</span>
                    {orthoCase.notes ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap">{orthoCase.notes}</div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No notes</div>
                    )}
                  </div>
                </div>

                {/* Row 4: Package Fee, Paid, Outstanding */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 border-t pt-3">
                  <label className="field-label">
                    <span className="field-label-text">Total Package Fee</span>
                    <input 
                      className="field-input-readonly" 
                      value={orthoTotalPackageFee ? `₱ ${Number(orthoTotalPackageFee).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""} 
                      readOnly 
                    />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Paid</span>
                    <input 
                      className="field-input-readonly" 
                      value={`₱ ${Number(orthoPaid).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                      readOnly 
                    />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Outstanding</span>
                    <input 
                      className="field-input-readonly" 
                      value={`₱ ${Number(orthoOutstanding).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                      readOnly 
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600 py-4">No ortho case created yet. Click "Create Case" to get started.</div>
            )}
          </div>

          {/* Ortho Visit Log Table */}
          {orthoCase && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Ortho Visit Log</div>
                <button className="save-btn" disabled={busy || entriesLoading} onClick={openCreateVisitModal}>
                  Add Visit
                </button>
              </div>

              {entriesLoading ? (
                <div className="flex justify-center py-8"><span className="loading-text">Loading visits…</span></div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No visits recorded yet.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <colgroup>
                      <col className="col-14" />
                      <col className="col-16" />
                      <col className="col-56" />
                      <col className="col-14" />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Date</th>
                        <th className="data-table-head-cell">Visit Type</th>
                        <th className="data-table-head-cell">Service</th>
                        <th className="data-table-head-cell">Charged Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, index) => {
                        const items = entryItems.get(entry.id) || [];
                        const chargedItems = items.filter(item => item.is_charged);
                        let chargedTotal = chargedItems.reduce((sum, item) => {
                          const amount = item.amount_override || 
                            orthoServices.find(s => s.id === item.service_id)?.default_price || 0;
                          return sum + (Number(amount) || 0);
                        }, 0);

                        // Add package fee if invoice_package is true
                        if (entry.invoice_package && orthoCase?.package_fee) {
                          chargedTotal += Number(orthoCase.package_fee);
                        }

                        // Build services list including package if invoiced
                        const addonsSummary = [];
                        if (entry.invoice_package && orthoCase?.package_service_id) {
                          const packageService = orthoServices.find(s => s.id === orthoCase.package_service_id);
                          if (packageService) {
                            addonsSummary.push(packageService.service_name);
                          }
                        }
                        // Add charged add-ons
                        items.filter(item => item.is_charged).forEach(item => {
                          const service = orthoServices.find(s => s.id === item.service_id);
                          if (service) {
                            addonsSummary.push(service.service_name);
                          }
                        });

                        // Format concern type (capitalize and replace underscores)
                        const visitTypeDisplay = entry.concern_type
                          ? entry.concern_type.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
                          : '—';

                        return (
                          <tr
                            key={entry.id}
                            className={`data-table-row cursor-pointer hover:bg-slate-50 ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                            onClick={() => openEditVisitModal(entry)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEditVisitModal(entry); } }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Edit ortho visit on ${formatDateStandard(entry.entry_date)}`}
                          >
                            <td className="data-table-cell">{formatDateStandard(entry.entry_date)}</td>
                            <td className="data-table-cell">
                              <span className="badge badge-secondary">{visitTypeDisplay}</span>
                            </td>
                            <td className="data-table-cell text-sm">
                              {addonsSummary.length > 0 ? (
                                <div className="space-y-1">
                                  {addonsSummary.map((svc, idx) => (
                                    <div key={idx}>{svc}</div>
                                  ))}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="data-table-cell">
                              <span className="font-medium">{chargedTotal > 0 ? `₱ ${Number(chargedTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</span>
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


      {/* Create/Edit Case Modal */}
      {caseModalOpen && (
        <EditModal 
          open={caseModalOpen} 
          title={`${caseModalMode === "create" ? "Create" : "Edit"} Ortho Case`} 
          onClose={() => { setCaseModalOpen(false); setError(null); }}
        >
          <div className="spacing-vertical-lg">
            {/* Row 1: Start Date, End Date */}
            <div className="two-col-grid">
              <DatePickerField
                label="Start Date"
                value={editStartDate}
                onChange={setEditStartDate}
                inputRef={startDateRef}
                variant="case-modal"
              />
              <DatePickerField
                label="End Date"
                value={editEndDate}
                onChange={setEditEndDate}
                inputRef={endDateRef}
                variant="case-modal"
              />
            </div>

            {/* Row 2: Status, Phase */}
            <div className="two-col-grid">
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

            {/* Row 3: Orthodontist */}
            <div className="field-label">
              <span className="field-label-text">Orthodontist</span>
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
                onChange={(e) => {
                  setEditPackageServiceId(e.target.value);
                  const selectedService = orthoServices.find(s => s.id === e.target.value);
                  if (selectedService) {
                    setEditPackageFee((selectedService.default_price || 0).toString());
                  } else {
                    setEditPackageFee("");
                  }
                }}
              >
                <option value="" disabled>Select a Package</option>
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
                  <label key={inc.key} className="inline-row">
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
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setCaseModalOpen(false)}>
                Cancel
              </button>
              <button
                className="save-btn"
                disabled={busy}
                onClick={saveCase}
              >
                {busy ? "Saving…" : caseModalMode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </EditModal>
      )}

      {/* Create/Edit Visit Modal */}
      {visitModalOpen && orthoCase && (
        <EditModal 
          open={visitModalOpen} 
          title={visitModalMode === "create" ? "Add Visit" : "Edit Visit"} 
          onClose={() => { setVisitModalOpen(false); setError(null); }}
        >
          <div className="spacing-vertical-lg">
            {/* Visit Date and Visit Type - Side by Side */}
            <div className="section-columns">
              <div className="w-[40%]">
                <DatePickerField
                  label="Visit date"
                  value={editVisitDate}
                  onChange={setEditVisitDate}
                  inputRef={visitDateRef}
                  variant="visit-modal"
                  wrapperClassName="grid-gap-1"
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="grid-gap-1 w-[60%]">
                <label className="text-field-label">Visit Type</label>
                <select
                  className="input-full"
                  value={editVisitType}
                  onChange={(e) => setEditVisitType(e.target.value as VisitReasonType)}
                >
                  <option value="">-- Select a visit type --</option>
                  {getOrthoOnlyReasons().map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Visit Notes */}
            <div className="grid-gap-1">
              <label className="text-field-label">Notes</label>
              <input
                type="text"
                className="input-standard"
                value={editVisitNote}
                onChange={(e) => setEditVisitNote(e.target.value)}
                placeholder="Incidents, observations…"
              />
            </div>

            {/* Package Invoice Checkbox - Only show in edit mode and if no other visit has invoice_package = true */}
            {visitModalMode === "edit" && orthoCase?.package_service_id && !entries.some(entry => entry.id !== editVisitId && entry.invoice_package) && (
              <div className="form-section">
                {/* 2-Column Layout: 5% Checkbox + 95% Fields */}
                <div className="flex gap-3">
                  {/* Column 1: Checkbox (5%) */}
                  <div className="flex items-center w-[5%] min-w-8">
                    <input
                      type="checkbox"
                      checked={editPackageInvoice}
                      onChange={(e) => setEditPackageInvoice(e.target.checked)}
                      className="w-5 h-5"
                    />
                  </div>

                  {/* Column 2: Fields (95%) */}
                  <div className="flex-1 w-[95%]">
                    {/* Row 1: Package (70%) + Fee (30%) */}
                    <div className="flex gap-3 mb-2">
                      <input
                        type="text"
                        className="field-input-readonly w-[70%]"
                        value={orthoServices.find(s => s.id === orthoCase.package_service_id)?.service_name || ""}
                        readOnly
                      />
                      <input
                        type="text"
                        className="field-input-readonly w-[30%]"
                        value={`₱ ${Number(orthoCase.package_fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        readOnly
                      />
                    </div>

                    {/* Row 2: Inclusions (taller height, more rounded) */}
                    {orthoCase.inclusions && Object.values(orthoCase.inclusions).some(v => v) ? (
                      <div className="grid grid-cols-2 gap-2 bg-white p-2 text-xs rounded-lg overflow-hidden max-h-24 border border-slate-200">
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
                            <div key={key} className="flex items-start gap-1">
                              <span className="text-slate-400 flex-shrink-0">•</span>
                              <span className="leading-tight">{label}</span>
                            </div>
                          ) : null
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-500">No inclusions</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Service/Add-ons Items */}
            <div className="space-y-2">
              <div className="text-field-label">Service/Add-ons ({editVisitItems.length})</div>
              {editVisitItems.map((item, index) => {
                // Filter services to show: Only ADD_ONs tagged 'ortho'
                const availableServices = orthoServices.filter(s => {
                  if (s.category !== "ortho") return false;
                  if (s.item_type !== "ADD_ON") return false;
                  // Exclude already added services (except current item)
                  if (editVisitItems.some((vi, idx) => idx !== index && vi.service_id === s.id)) {
                    return false;
                  }
                  return true;
                });

                return (
                  <div key={index} className="form-section">
                    {/* Row 1: Service Dropdown + Charge Extra Toggle */}
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 grid gap-1">
                        <label className="field-sublabel">Service/Add-ons</label>
                        <select
                          className="input-standard"
                          value={item.service_id || ""}
                          onChange={(e) => updateVisitItem(index, { service_id: e.target.value })}
                        >
                          <option value="" disabled>Select service/treatment</option>
                          {availableServices.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.service_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Charge Extra Toggle */}
                      <div className="flex flex-col gap-2">
                        <label className="field-sublabel">Charge extra?</label>
                        <button
                          type="button"
                          onClick={() => updateVisitItem(index, { is_charged: !item.is_charged })}
                          className={`switch-btn ${item.is_charged ? 'switch-btn-on' : 'switch-btn-off'}`}
                          aria-label={item.is_charged ? 'Charge extra enabled' : 'Charge extra disabled'}
                        >
                          <span className={`switch-thumb ${item.is_charged ? 'switch-thumb-on' : 'switch-thumb-off'}`} />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Details + Delete Button */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 grid gap-1">
                        <label className="field-sublabel">Details</label>
                        <input
                          type="text"
                          className="input-standard"
                          value={item.service_detail || ""}
                          onChange={(e) => updateVisitItem(index, { service_detail: e.target.value })}
                          placeholder="Wire, arc, teeth..."
                        />
                      </div>
                      
                      {/* Delete Button */}
                      <button
                        type="button"
                        className="item-delete-btn h-10"
                        onClick={() => removeVisitItem(index)}
                        title="Remove service"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {editVisitItems.length === 0 ? (
                <div className="hint-text">No services on this visit yet.</div>
              ) : null}

              <button
                className="add-row-btn"
                onClick={addVisitItem}
              >
                + Add Service/Add-on
              </button>
            </div>

            {/* Delete Entire Visit */}
            {visitModalMode === "edit" && (
              <div className="delete-confirmation">
                <div className="delete-confirmation-title">Delete entire visit?</div>
                <div className="delete-confirmation-hint">
                  Type <span className="delete-confirmation-code">DELETE</span> to confirm deletion of this visit
                </div>
                <input
                  type="text"
                  className="delete-confirmation-input"
                  placeholder="DELETE"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="modal-actions">
              <div className="modal-actions-left">
                {visitModalMode === "edit" && (
                  <button
                    className="delete-btn"
                    disabled={busy || deleteConfirmationText !== "DELETE"}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      const res = await supabase.from("ortho_entries").delete().eq("id", editVisitId);
                      if (res.error) {
                        setBusy(false);
                        return setError(res.error.message);
                      }
                      setBusy(false);
                      setVisitModalOpen(false);
                      setDeleteConfirmationText("");
                      await loadEntries();
                    }}
                  >
                    {busy ? "Deleting…" : "Delete Visit"}
                  </button>
                )}
              </div>
              <div className="modal-actions-right">
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setVisitModalOpen(false);
                    setDeleteConfirmationText("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className="save-btn"
                  disabled={busy}
                  onClick={saveVisit}
                >
                  {busy ? "Saving…" : "Save Visit"}
                </button>
              </div>
            </div>
          </div>
        </EditModal>
      )}
    </>
  );
}
