"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useClinic } from "@/contexts/ClinicContext";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type { Treatment, DentistRow, ServicePriceRow, Patient } from "@/lib/types";
import { todayLocalISO, splitFullName, formatDateStandard } from "@/lib/helpers";
import { AddVisitModal } from "./AddVisitModal";
import { EditVisitModal } from "./EditVisitModal";
import { PageLoader } from "@/components/Spinner";


export default function TreatmentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { clinicId } = useClinic();

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
  const [treatmentSort, setTreatmentSort] = useState<"DATE_DESC" | "DATE_ASC">("DATE_DESC");

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
    if (treatmentSort === "DATE_ASC") return list.sort((a, b) => (a[0] > b[0] ? 1 : -1));
    return list.sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [treatments, treatmentSort]);

  const loadData = useCallback(async () => {
    if (!id || !clinicId) return;
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
      .select("id, full_name")
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
      .select("concerns")
      .eq("patient_id", id)
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .order("appointment_date", { ascending: false })
      .limit(1);
    if (!appt.error && appt.data?.length && appt.data[0].concerns) {
      setDefaultAppointmentConcern(appt.data[0].concerns);
    } else {
      setDefaultAppointmentConcern("");
    }

    setLoading(false);
  }, [id, clinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const editingTreatments = useMemo(
    () => (editingVisitDate ? groupedTreatmentHistory.find(([d]) => d === editingVisitDate)?.[1] ?? [] : []),
    [editingVisitDate, groupedTreatmentHistory]
  );

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
                <select
                  className="form-select-standard"
                  value={treatmentSort}
                  onChange={(e) => setTreatmentSort(e.target.value as any)}
                >
                  <option value="DATE_DESC">Newest</option>
                  <option value="DATE_ASC">Oldest</option>
                </select>
                <button className="save-btn" onClick={() => setShowAddVisitModal(true)}>
                  Add visit
                </button>
              </div>
            </div>

            {/* Desktop table */}
            <div className="table-wrapper hidden md:block">
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
                    <th className="data-table-head-cell-right">Status</th>
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
                            <div key={t.id} className="text-sm">
                              {t.tooth_number ? `Tooth ${t.tooth_number}: ` : ""}
                              {t.procedure}
                              {t.notes ? <div className="hint-text">{t.notes}</div> : null}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="data-table-cell-right">
                        {invoicedDates.has(date) ? (
                          <div className="inline-block px-3 py-1 rounded-lg bg-amber-100 text-amber-800 text-sm font-semibold">Invoiced</div>
                        ) : null}
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
        dentists={dentists}
        serviceMenu={serviceMenu}
        defaultConcern={defaultAppointmentConcern}
      />

      <EditVisitModal
        open={editingVisitDate !== null}
        date={editingVisitDate}
        onClose={() => setEditingVisitDate(null)}
        onSaved={loadData}
        patientId={id}
        dentists={dentists}
        serviceMenu={serviceMenu}
        visitTreatments={editingTreatments}
      />
    </>
  );
}
