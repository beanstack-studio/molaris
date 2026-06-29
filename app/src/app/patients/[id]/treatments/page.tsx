"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useClinic } from "@/contexts/ClinicContext";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type { Treatment, DentistRow, ServicePriceRow, Patient } from "@/lib/types";
import { todayLocalISO, splitFullName, formatDateStandard, formatPatientNameFormal, printTableAsHTML } from "@/lib/helpers";
import { AddVisitModal } from "./AddVisitModal";
import { EditVisitModal } from "./EditVisitModal";
import { PageLoader } from "@/components/Spinner";
import { TableOptions, SortArrow, type ColumnConfig } from "@/components/shared/TableOptions";


export default function TreatmentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { clinicId, isLoading: clinicLoading, isAdmin, isDentist, isHandler, handlerFor, profileId } = useClinic();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [serviceMenu, setServiceMenu] = useState<ServicePriceRow[]>([]);
  const [invoicedDates, setInvoicedDates] = useState<Set<string>>(new Set());
  const [defaultAppointmentConcern, setDefaultAppointmentConcern] = useState("");

  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [editingVisitDate, setEditingVisitDate] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "treatment_date", direction: "desc" });

  const TREATMENT_COLUMNS: ColumnConfig[] = [
    { key: "date",       label: "Date",       required: true },
    { key: "dentist",    label: "Dentist" },
    { key: "tooth",      label: "Tooth" },
    { key: "treatments", label: "Treatments" },
  ];

  const groupedTreatmentHistory = useMemo(() => {
    const acc: Record<string, Treatment[]> = {};
    for (const t of treatments) {
      const k = t.treatment_date;
      acc[k] = acc[k] ? [...acc[k], t] : [t];
    }
    for (const k of Object.keys(acc)) {
      acc[k] = acc[k].slice().sort((a, b) => {
        const toothA = a.tooth_number ?? 999;
        const toothB = b.tooth_number ?? 999;
        if (toothA !== toothB) return toothA - toothB;
        const aa = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bb - aa;
      });
    }
    const list = Object.entries(acc);
    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;

    if (key === "treatment_date") {
      return list.sort((a, b) => dir * (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0));
    }
    if (key === "dentist_name") {
      return list.sort((a, b) => {
        const aDentist = (a[1][0]?.dentist_name ?? "").toLowerCase();
        const bDentist = (b[1][0]?.dentist_name ?? "").toLowerCase();
        return dir * aDentist.localeCompare(bDentist);
      });
    }
    if (key === "procedure") {
      return list.sort((a, b) => {
        const aProc = (a[1][0]?.procedure ?? "").toLowerCase();
        const bProc = (b[1][0]?.procedure ?? "").toLowerCase();
        return dir * aProc.localeCompare(bProc);
      });
    }
    if (key === "tooth_number") {
      return list.sort((a, b) => {
        const aT = a[1][0]?.tooth_number ?? 999;
        const bT = b[1][0]?.tooth_number ?? 999;
        return dir * (aT - bT);
      });
    }
    // default: date desc
    return list.sort((a, b) => dir * (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0));
  }, [treatments, sortConfig]);

  const loadData = useCallback(async () => {
    if (clinicLoading || !id || !clinicId) return;
    setLoading(true);
    setError(null);

    const p = await supabase.from("patients").select("*").eq("id", id).eq("clinic_id", clinicId).single();
    if (!p.error && p.data) {
      const patRaw = p.data as any;
      const fallback = splitFullName(patRaw.full_name ?? "");
      const dbFirst = String(patRaw.first_name ?? "").trim();
      const dbLast = String(patRaw.last_name ?? "").trim();
      setPatient({
        id: patRaw.id,
        clinic_id: patRaw.clinic_id,
        full_name: patRaw.full_name,
        first_name: dbFirst || fallback.first,
        middle_name: patRaw.middle_name ?? null,
        last_name: dbLast || fallback.last,
        phone: patRaw.phone,
        birth_date: patRaw.birth_date,
        address: patRaw.address,
        occupation: patRaw.occupation,
        email: patRaw.email,
        gender: patRaw.gender,
        notes: patRaw.notes,
        created_at: patRaw.created_at,
        updated_at: patRaw.updated_at,
      });
    }

    const d = await supabase
      .from("dentists")
      .select("id, full_name, nickname, profile_id")
      .eq("clinic_id", clinicId)
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });
    setDentists(!d.error && d.data ? (d.data as DentistRow[]) : []);

    const sm = await supabase
      .from("service_prices")
      .select("id, service_name, default_price, item_type, sort_order, created_at, category")
      .eq("clinic_id", clinicId)
      .eq("category", "general")
      .order("item_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("service_name", { ascending: true });
    setServiceMenu(!sm.error && sm.data ? (sm.data as ServicePriceRow[]) : []);

    const t = await supabase
      .from("treatments")
      .select("id, treatment_date, procedure, tooth_number, notes, visit_concern, dentist_id, dentist_name, service_price_id, created_at, clinic_id")
      .eq("patient_id", id)
      .eq("clinic_id", clinicId)
      .order("treatment_date", { ascending: false })
      .order("created_at", { ascending: false });
    setTreatments(!t.error && t.data ? (t.data as Treatment[]) : []);

    const inv = await supabase.from("invoices").select("invoice_date").eq("patient_id", id).eq("clinic_id", clinicId);
    const invoicedDateSet = new Set<string>();
    if (!inv.error && inv.data) {
      inv.data.forEach((record: any) => {
        if (record.invoice_date) invoicedDateSet.add(record.invoice_date);
      });
    }
    setInvoicedDates(invoicedDateSet);

    const appt = await supabase
      .from("appointments")
      .select("notes")
      .eq("patient_id", id)
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .order("appointment_date", { ascending: false })
      .limit(1);
    if (!appt.error && appt.data?.length && appt.data[0].notes) {
      setDefaultAppointmentConcern(appt.data[0].notes);
    } else {
      setDefaultAppointmentConcern("");
    }

    setLoading(false);
  }, [clinicLoading, id, clinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const editingTreatments = useMemo(
    () => (editingVisitDate ? groupedTreatmentHistory.find(([d]) => d === editingVisitDate)?.[1] ?? [] : []),
    [editingVisitDate, groupedTreatmentHistory]
  );

  const canWrite = isAdmin || isDentist || isHandler;
  const filteredDentists = isAdmin
    ? dentists
    : isDentist
      ? dentists.filter((d) => d.profile_id === profileId)
      : dentists.filter((d) => handlerFor.includes(d.id));

  const patientLabel = patient
    ? formatPatientNameFormal(patient.first_name ?? null, patient.middle_name ?? null, patient.last_name ?? null)
    : "Patient";

  function downloadTreatmentsPDF() {
    const headers = ["Date", "Dentist", "Tooth", "Treatment", "Notes"];
    const rows: string[][] = [];
    for (const [date, txs] of groupedTreatmentHistory) {
      for (const t of txs) {
        rows.push([
          formatDateStandard(date),
          txs[0]?.dentist_name ?? "—",
          t.tooth_number != null ? String(t.tooth_number) : "—",
          t.procedure ?? "—",
          t.notes ?? "",
        ]);
      }
    }
    printTableAsHTML(`Treatment History — ${patientLabel}`, headers, rows);
  }

  if (loading) {
    return (
      <PageLoader />
    );
  }

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}
          <div className="card">
            <div className="flex-wrap-items-center-justify-between">
              <div className="card-title">Treatment history</div>
              <div className="inline-row">
                <TableOptions
                  tableName="treatments"
                  columns={TREATMENT_COLUMNS}
                  currentSort={sortConfig}
                  onSortChange={(key, direction) => setSortConfig({ key, direction })}
                  data={treatments}
                  onDownloadCSV={() => {}}
                  onDownloadPDF={downloadTreatmentsPDF}
                />
                {canWrite && (
                  <button className="save-btn" onClick={() => setShowAddVisitModal(true)}>
                    Add visit
                  </button>
                )}
              </div>
            </div>

            {/* Desktop table */}
            <div className="table-wrapper hidden md:block">
              <table className="data-table min-w-[550px]">
                <colgroup>
                  <col className="col-15" />
                  <col className="col-20" />
                  <col className="col-10" />
                  <col className="col-55" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th
                      className="data-table-head-cell cursor-pointer select-none"
                      onClick={() => setSortConfig({ key: "treatment_date", direction: sortConfig.key === "treatment_date" && sortConfig.direction === "asc" ? "desc" : "asc" })}
                    >
                      Date <SortArrow dir={sortConfig.key === "treatment_date" ? sortConfig.direction : null} />
                    </th>
                    <th
                      className="data-table-head-cell cursor-pointer select-none"
                      onClick={() => setSortConfig({ key: "dentist_name", direction: sortConfig.key === "dentist_name" && sortConfig.direction === "asc" ? "desc" : "asc" })}
                    >
                      Dentist <SortArrow dir={sortConfig.key === "dentist_name" ? sortConfig.direction : null} />
                    </th>
                    <th
                      className="data-table-head-cell cursor-pointer select-none"
                      onClick={() => setSortConfig({ key: "tooth_number", direction: sortConfig.key === "tooth_number" && sortConfig.direction === "asc" ? "desc" : "asc" })}
                    >
                      Tooth <SortArrow dir={sortConfig.key === "tooth_number" ? sortConfig.direction : null} />
                    </th>
                    <th
                      className="data-table-head-cell cursor-pointer select-none"
                      onClick={() => setSortConfig({ key: "procedure", direction: sortConfig.key === "procedure" && sortConfig.direction === "asc" ? "desc" : "asc" })}
                    >
                      Treatments <SortArrow dir={sortConfig.key === "procedure" ? sortConfig.direction : null} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTreatmentHistory.map(([date, txs], index) => (
                    <tr
                      key={date}
                      className={`data-table-row cursor-pointer hover:bg-slate-50 ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                      onClick={() => { if (!invoicedDates.has(date)) setEditingVisitDate(date); }}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !invoicedDates.has(date)) { e.preventDefault(); setEditingVisitDate(date); } }}
                      tabIndex={invoicedDates.has(date) ? -1 : 0}
                      role={invoicedDates.has(date) ? undefined : "button"}
                      aria-label={invoicedDates.has(date) ? undefined : `Edit visit on ${formatDateStandard(date)}`}
                    >
                      <td className="data-table-cell">{formatDateStandard(date)}</td>
                      <td className="data-table-cell">{txs[0]?.dentist_name || "—"}</td>
                      <td className="data-table-cell">
                        <div className="space-y-1">
                          {txs.map((t) => (
                            <div key={t.id} className="text-sm text-slate-600">
                              {t.tooth_number ?? "—"}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="data-table-cell">
                        <div className="space-y-1">
                          {txs.map((t) => (
                            <div key={t.id} className="text-sm">
                              {t.procedure}
                              {t.notes ? <div className="hint-text">{t.notes}</div> : null}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {groupedTreatmentHistory.length === 0 && (
                    <tr>
                      <td className="data-table-empty" colSpan={4}>No treatments yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mt-3 grid gap-2 md:hidden">
              {groupedTreatmentHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No treatments yet.</div>
              ) : (
                groupedTreatmentHistory.map(([date, txs]) => {
                  const isInvoiced = invoicedDates.has(date);
                  return (
                    <button
                      key={date}
                      type="button"
                      className="w-full text-left rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200 transition-colors disabled:cursor-default"
                      onClick={() => { if (!isInvoiced) setEditingVisitDate(date); }}
                      disabled={isInvoiced}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{formatDateStandard(date)}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{txs[0]?.dentist_name || "—"}</div>
                        </div>
                        {isInvoiced ? (
                          <span className="inline-block px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-semibold">Invoiced</span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1 border-t border-slate-50 pt-2">
                        {txs.map((t) => (
                          <div key={t.id} className="text-sm text-slate-700">
                            {t.tooth_number ? <span className="font-medium">Tooth {t.tooth_number}:</span> : null}{" "}
                            {t.procedure}
                            {t.notes ? <div className="text-xs text-slate-400">{t.notes}</div> : null}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

      <AddVisitModal
        open={showAddVisitModal}
        onClose={() => setShowAddVisitModal(false)}
        onSaved={loadData}
        patientId={id}
        dentists={filteredDentists}
        serviceMenu={serviceMenu}
        defaultConcern={defaultAppointmentConcern}
      />

      <EditVisitModal
        open={editingVisitDate !== null}
        date={editingVisitDate}
        onClose={() => setEditingVisitDate(null)}
        onSaved={loadData}
        patientId={id}
        dentists={filteredDentists}
        serviceMenu={serviceMenu}
        visitTreatments={editingTreatments}
      />
    </>
  );
}
