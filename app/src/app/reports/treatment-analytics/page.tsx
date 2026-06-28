"use client";

import { useEffect, useState } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/helpers";
import { downloadCSV } from "@/lib/exportHelpers";
import { PageLoader } from "@/components/Spinner";

interface ServiceRow {
  service_name: string;
  count: number;
  total_revenue: number;
  avg_price: number;
}

function TreatmentAnalyticsReportPage() {
  const { clinicId, isLoading: clinicLoading } = useClinic();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [summary, setSummary] = useState({ totalServices: 0, totalRevenue: 0, uniqueServices: 0 });
  const [sort, setSort] = useState<"count" | "revenue" | "avg" | "name">("count");

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    loadData();
  }, [clinicLoading, clinicId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const { data: items, error: err } = await supabase
        .from("invoice_items")
        .select("service_name, qty, unit_price, line_total")
        .eq("clinic_id", clinicId);
      if (err) throw err;

      const serviceMap: Record<string, ServiceRow> = {};
      for (const item of items || []) {
        const name = item.service_name || "Unknown";
        if (!serviceMap[name]) serviceMap[name] = { service_name: name, count: 0, total_revenue: 0, avg_price: 0 };
        serviceMap[name].count += item.qty || 1;
        serviceMap[name].total_revenue += item.line_total || 0;
      }

      const result = Object.values(serviceMap).map((s) => ({
        ...s,
        avg_price: s.count > 0 ? s.total_revenue / s.count : 0,
      }));

      const totalServices = result.reduce((s, r) => s + r.count, 0);
      const totalRevenue = result.reduce((s, r) => s + r.total_revenue, 0);
      setSummary({ totalServices, totalRevenue, uniqueServices: result.length });
      setRows(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const sorted = [...rows].sort((a, b) => {
    if (sort === "name") return a.service_name.localeCompare(b.service_name);
    if (sort === "revenue") return b.total_revenue - a.total_revenue;
    if (sort === "avg") return b.avg_price - a.avg_price;
    return b.count - a.count;
  });

  const maxCount = sorted.length > 0 ? Math.max(...sorted.map((r) => r.count)) : 1;

  if (loading) return <PageLoader />;

  return (
    <>
      {error && <div className="error-banner">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-muted">Unique Services</div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 mt-2">{summary.uniqueServices}</div>
        </div>
        <div className="card">
          <div className="text-muted">Total Procedures</div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 mt-2">{summary.totalServices}</div>
        </div>
        <div className="card">
          <div className="text-muted">Total Revenue</div>
          <div className="text-xl md:text-2xl font-bold text-green-700 mt-2">{formatMoney(summary.totalRevenue)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Services Breakdown</div>
          <div className="inline-row">
            <select className="form-select-standard" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="count">Most Used</option>
              <option value="revenue">Highest Revenue</option>
              <option value="avg">Highest Avg Price</option>
              <option value="name">Name A–Z</option>
            </select>
            <button className="cancel-btn" onClick={() => downloadCSV(sorted.map((r) => ({
              "Service": r.service_name,
              "Times Used": r.count,
              "Total Revenue (₱)": r.total_revenue.toFixed(2),
              "Avg Price (₱)": r.avg_price.toFixed(2),
            })), "treatment-analytics")}>
              Download CSV
            </button>
          </div>
        </div>
        {sorted.length === 0 ? (
          <p className="text-center text-slate-500 py-6">No treatment data yet.</p>
        ) : (
          <div className="table-wrapper overflow-x-auto">
            <table className="data-table min-w-[500px]">
              <colgroup>
                <col className="col-35" />
                <col className="col-25" />
                <col className="col-20" />
                <col className="col-20" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Service / Procedure</th>
                  <th className="data-table-head-cell">Usage</th>
                  <th className="data-table-head-cell-right">Total Revenue</th>
                  <th className="data-table-head-cell-right">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.service_name} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                    <td className="data-table-cell font-medium">{r.service_name}</td>
                    <td className="data-table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 max-w-[100px]">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${Math.round((r.count / maxCount) * 100)}%`, background: "hsl(var(--accent-hue) var(--accent-sat) 50%)" }}
                          />
                        </div>
                        <span className="text-sm text-slate-700 font-medium w-6 text-right">{r.count}</span>
                      </div>
                    </td>
                    <td className="data-table-cell-right">{formatMoney(r.total_revenue)}</td>
                    <td className="data-table-cell-right text-slate-500">{formatMoney(r.avg_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

import { FeatureGate } from "@/components/shared/FeatureGate";
export default function TreatmentAnalyticsPageGated() {
  return <FeatureGate feature="reports"><TreatmentAnalyticsReportPage /></FeatureGate>;
}
