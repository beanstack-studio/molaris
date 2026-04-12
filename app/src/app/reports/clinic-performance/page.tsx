"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/helpers";
import { PageLoader } from "@/components/Spinner";

interface KPI {
  totalPatients: number;
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  appointmentsThisMonth: number;
  activePatients: number;
  collectionRate: number;
}

interface MonthRevenue {
  month: string;
  revenue: number;
}

export default function ClinicPerformanceReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthRevenue[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const thisY = now.getFullYear(), thisM = now.getMonth() + 1;
      const lastM = thisM === 1 ? 12 : thisM - 1;
      const lastY = thisM === 1 ? thisY - 1 : thisY;
      const thisMonthStart = `${thisY}-${String(thisM).padStart(2, "0")}-01`;
      const lastMonthStart = `${lastY}-${String(lastM).padStart(2, "0")}-01`;

      const [
        { count: totalPatients },
        { data: allPayments },
        { data: allInvoices },
        { count: appointmentsThisMonth },
        { count: activePatients },
      ] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount, payment_date, voided_at"),
        supabase.from("invoices").select("total"),
        supabase.from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("appointment_date", thisMonthStart)
          .is("deleted_at", null),
        supabase.from("patients")
          .select("id", { count: "exact", head: true })
          .gte("created_at", `${thisY - 1}-01-01`),
      ]);

      const validPayments = (allPayments || []).filter((p) => !p.voided_at);
      const totalRevenue = validPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const revenueThisMonth = validPayments
        .filter((p) => p.payment_date >= thisMonthStart)
        .reduce((s, p) => s + (p.amount || 0), 0);
      const revenueLastMonth = validPayments
        .filter((p) => p.payment_date >= lastMonthStart && p.payment_date < thisMonthStart)
        .reduce((s, p) => s + (p.amount || 0), 0);

      const totalInvoiced = (allInvoices || []).reduce((s, i) => s + (i.total || 0), 0);
      const collectionRate = totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0;

      setKpi({
        totalPatients: totalPatients || 0,
        totalRevenue,
        revenueThisMonth,
        revenueLastMonth,
        appointmentsThisMonth: appointmentsThisMonth || 0,
        activePatients: activePatients || 0,
        collectionRate,
      });

      // Monthly revenue (last 12 months)
      const monthMap: Record<string, number> = {};
      for (const p of validPayments) {
        if (!p.payment_date) continue;
        const month = p.payment_date.substring(0, 7);
        monthMap[month] = (monthMap[month] || 0) + (p.amount || 0);
      }
      const months = Object.entries(monthMap)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12)
        .map(([month, revenue]) => ({ month, revenue }));
      setMonthlyRevenue(months);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function fmtMonth(ym: string) {
    const [y, m] = ym.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  const maxRevenue = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map((m) => m.revenue)) : 1;

  const momChange = kpi && kpi.revenueLastMonth > 0
    ? Math.round(((kpi.revenueThisMonth - kpi.revenueLastMonth) / kpi.revenueLastMonth) * 100)
    : null;

  if (loading) return <PageLoader />;

  return (
    <>
      {error && <div className="error-banner">{error}</div>}

      {kpi && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card">
              <div className="text-muted">Total Revenue (All Time)</div>
              <div className="text-2xl font-bold text-green-700 mt-2">{formatMoney(kpi.totalRevenue)}</div>
            </div>
            <div className="card">
              <div className="text-muted">Revenue This Month</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{formatMoney(kpi.revenueThisMonth)}</div>
              {momChange !== null && (
                <div className={`text-xs mt-1 font-medium ${momChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {momChange >= 0 ? "▲" : "▼"} {Math.abs(momChange)}% vs last month
                </div>
              )}
            </div>
            <div className="card">
              <div className="text-muted">Revenue Last Month</div>
              <div className="text-2xl font-bold text-slate-500 mt-2">{formatMoney(kpi.revenueLastMonth)}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card">
              <div className="text-muted">Total Patients</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{kpi.totalPatients}</div>
            </div>
            <div className="card">
              <div className="text-muted">Appointments This Month</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{kpi.appointmentsThisMonth}</div>
            </div>
            <div className="card">
              <div className="text-muted">Collection Rate</div>
              <div className="text-2xl font-bold text-blue-700 mt-2">{kpi.collectionRate}%</div>
              <div className="text-xs text-slate-400 mt-1">Payments ÷ Total Invoiced</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Monthly Revenue (Last 12 Months)</div>
            </div>
            {monthlyRevenue.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No payment data yet.</p>
            ) : (
              <div className="space-y-3 px-1 py-2">
                {monthlyRevenue.map((m) => (
                  <div key={m.month} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-slate-500 flex-shrink-0 text-right">{fmtMonth(m.month)}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className="h-6 rounded-full"
                        style={{ width: `${Math.max(4, Math.round((m.revenue / maxRevenue) * 100))}%`, background: "hsl(var(--accent-hue) var(--accent-sat) 48%)" }}
                      />
                    </div>
                    <div className="w-28 text-xs font-semibold text-slate-700 text-right">{formatMoney(m.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
