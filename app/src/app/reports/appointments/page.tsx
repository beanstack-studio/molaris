"use client";

import { useEffect, useState } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { formatDateStandard } from "@/lib/helpers";
import { downloadCSV } from "@/lib/exportHelpers";
import { PageLoader } from "@/components/Spinner";

interface DentistStat {
  id: string;
  full_name: string;
  total: number;
  confirmed: number;
  cancelled: number;
}

interface MonthStat {
  month: string;
  total: number;
  confirmed: number;
  cancelled: number;
}

function AppointmentsReportPage() {
  const { clinicId, isLoading: clinicLoading } = useClinic();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ total: 0, confirmed: 0, cancelled: 0, pending: 0 });
  const [byDentist, setByDentist] = useState<DentistStat[]>([]);
  const [byMonth, setByMonth] = useState<MonthStat[]>([]);

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    loadData();
  }, [clinicLoading, clinicId]);

  async function loadData() {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: appts }, { data: dentists }] = await Promise.all([
        supabase.from("appointments").select("id, dentist_id, appointment_date, status").eq("clinic_id", clinicId).is("deleted_at", null),
        supabase.from("dentists").select("id, full_name, nickname").eq("clinic_id", clinicId),
      ]);

      const dentistMap: Record<string, string> = {};
      for (const d of (dentists || []) as any[]) dentistMap[d.id] = d.nickname?.trim() || d.full_name;

      let total = 0, confirmed = 0, cancelled = 0, pending = 0;
      const dentistStats: Record<string, DentistStat> = {};
      const monthStats: Record<string, MonthStat> = {};

      for (const a of appts || []) {
        total++;
        const s = (a.status || "").toLowerCase();
        if (s === "confirmed") confirmed++;
        else if (s === "cancelled") cancelled++;
        else pending++;

        // By dentist
        const did = a.dentist_id || "__unassigned__";
        if (!dentistStats[did]) dentistStats[did] = { id: did, full_name: dentistMap[did] || "Unassigned", total: 0, confirmed: 0, cancelled: 0 };
        dentistStats[did].total++;
        if (s === "confirmed") dentistStats[did].confirmed++;
        if (s === "cancelled") dentistStats[did].cancelled++;

        // By month
        if (a.appointment_date) {
          const month = a.appointment_date.substring(0, 7); // "YYYY-MM"
          if (!monthStats[month]) monthStats[month] = { month, total: 0, confirmed: 0, cancelled: 0 };
          monthStats[month].total++;
          if (s === "confirmed") monthStats[month].confirmed++;
          if (s === "cancelled") monthStats[month].cancelled++;
        }
      }

      setSummary({ total, confirmed, cancelled, pending });
      setByDentist(Object.values(dentistStats).sort((a, b) => b.total - a.total));
      setByMonth(Object.values(monthStats).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const maxMonthTotal = byMonth.length > 0 ? Math.max(...byMonth.map((m) => m.total)) : 1;

  function fmtMonth(ym: string) {
    const [y, m] = ym.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  if (loading) return <PageLoader />;

  return (
    <>
      {error && <div className="error-banner">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card">
          <div className="text-muted">Total</div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 mt-2">{summary.total}</div>
        </div>
        <div className="card">
          <div className="text-muted">Confirmed</div>
          <div className="text-xl md:text-2xl font-bold text-green-700 mt-2">{summary.confirmed}</div>
        </div>
        <div className="card">
          <div className="text-muted">Cancelled</div>
          <div className="text-xl md:text-2xl font-bold text-red-600 mt-2">{summary.cancelled}</div>
        </div>
        <div className="card">
          <div className="text-muted">Pending / Other</div>
          <div className="text-xl md:text-2xl font-bold text-yellow-600 mt-2">{summary.pending}</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* By Dentist */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">By Dentist</div>
            <button className="cancel-btn" onClick={() => downloadCSV(byDentist.map((d) => ({
              "Dentist": d.full_name,
              "Total": d.total,
              "Confirmed": d.confirmed,
              "Cancelled": d.cancelled,
            })), "appointments-by-dentist")}>
              CSV
            </button>
          </div>
          {byDentist.length === 0 ? (
            <p className="text-center text-slate-500 py-4">No data</p>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Dentist</th>
                    <th className="data-table-head-cell-right">Total</th>
                    <th className="data-table-head-cell-right">Confirmed</th>
                    <th className="data-table-head-cell-right">Cancelled</th>
                  </tr>
                </thead>
                <tbody>
                  {byDentist.map((d, i) => (
                    <tr key={d.id} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                      <td className="data-table-cell">{d.full_name}</td>
                      <td className="data-table-cell-right font-semibold">{d.total}</td>
                      <td className="data-table-cell-right text-green-700">{d.confirmed}</td>
                      <td className="data-table-cell-right text-red-600">{d.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* By Month */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">By Month (last 12)</div>
            <button className="cancel-btn" onClick={() => downloadCSV(byMonth.map((m) => ({
              "Month": fmtMonth(m.month),
              "Total": m.total,
              "Confirmed": m.confirmed,
              "Cancelled": m.cancelled,
            })), "appointments-by-month")}>
              CSV
            </button>
          </div>
          {byMonth.length === 0 ? (
            <p className="text-center text-slate-500 py-4">No data</p>
          ) : (
            <div className="space-y-2 px-1 py-2">
              {byMonth.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-slate-500 flex-shrink-0 text-right">{fmtMonth(m.month)}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
                    <div
                      className="h-5 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(8, Math.round((m.total / maxMonthTotal) * 100))}%`, background: "hsl(var(--accent-hue) var(--accent-sat) 50%)" }}
                    />
                  </div>
                  <div className="w-6 text-xs font-semibold text-slate-700 text-right">{m.total}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

import { FeatureGate } from "@/components/shared/FeatureGate";
export default function AppointmentsReportPageGated() {
  return <FeatureGate feature="reports"><AppointmentsReportPage /></FeatureGate>;
}
