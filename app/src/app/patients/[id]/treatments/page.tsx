"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type { Treatment, DentistRow, ServicePriceRow, Patient } from "@/lib/types";
import { todayLocalISO, splitFullName, formatDateStandard } from "@/lib/helpers";
import { AddVisitModal } from "./AddVisitModal";
import { EditVisitModal } from "./EditVisitModal";

export default function TreatmentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

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
    setLoading(true);
    setError(null);

    const p = await supabase.from("patients").select("*").eq("id", id).single();
    if (!p.error && p.data) {
      const patRaw = p.data as any;
      const fallback = splitFullName(patRaw.full_name ?? "");
      const dbFirst = String(patRaw.first_name ?? "").trim();
      const dbLast = String(patRaw.last_name ?? "").trim();
      setPatient({
        id: patRaw.id,
        full_name: patRaw.full_name,
        first_name: dbFirst || fallback.first,
        last_name: dbLast || fallback.last,
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
      .select("id, service_name, default_price, item_type, sort_order, created_at, category")
      .eq("category", "general")
      .order("item_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("service_name", { ascending: true });
    setServiceMenu(!sm.error && sm.data ? (sm.data as ServicePriceRow[]) : []);

    const t = await supabase
      .from("treatments")
      .select("id, treatment_date, procedure, tooth_number, notes, visit_concern, dentist_id, dentist_name, service_price_id, created_at")
      .eq("patient_id", id)
      .order("treatment_date", { ascending: false })
      .order("created_at", { ascending: false });
    setTreatments(!t.error && t.data ? (t.data as Treatment[]) : []);

    const inv = await supabase.from("invoices").select("invoice_date").eq("patient_id", id);
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
      .eq("status", "completed")
      .order("appointment_date", { ascending: false })
      .limit(1);
    if (!appt.error && appt.data?.length && appt.data[0].concerns) {
      setDefaultAppointmentConcern(appt.data[0].concerns);
    } else {
      setDefaultAppointmentConcern("");
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const editingTreatments = useMemo(
    () => (editingVisitDate ? groupedTreatmentHistory.find(([d]) => d === editingVisitDate)?.[1] ?? [] : []),
    [editingVisitDate, groupedTreatmentHistory]
  );

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
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="page-content">
        <div className="page-sections">
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
                        ) : (
                          <button
                            className="data-table-btn"
                            onClick={() => setEditingVisitDate(date)}
                          >
                            Edit Visit
                          </button>
                        )}
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
          </div>
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
