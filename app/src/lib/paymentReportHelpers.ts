import { supabase } from "./supabaseClient";

/**
 * Daily payment summary grouped by payment mode
 * Shows totals, counts, and percentages
 */
export async function getDailyPaymentSummary(date: string) {
  const { data, error } = await supabase.rpc("get_daily_payment_summary", {
    summary_date: date,
  });

  if (error) throw error;
  return data || [];
}

/**
 * Monthly payment summary grouped by payment mode
 * Shows totals by week/day for the month
 */
export async function getMonthlyPaymentSummary(yearMonth: string) {
  // yearMonth format: "2026-01"
  const startDate = `${yearMonth}-01`;
  const endDate = new Date(parseInt(yearMonth.split("-")[0]), parseInt(yearMonth.split("-")[1]), 0)
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      payment_date,
      status,
      voided_at,
      payment_modes(code, name)
    `)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .is("voided_at", null)
    .order("payment_date", { ascending: true });

  if (error) throw error;

  // Process data to group by mode and date
  const summary: Record<string, any> = {};
  const modes: Record<string, { count: number; total: number }> = {};

  (data || []).forEach((payment: any) => {
    const mode = payment.payment_modes?.code || "UNKNOWN";
    const date = payment.payment_date;

    if (!modes[mode]) {
      modes[mode] = { count: 0, total: 0 };
    }

    modes[mode].count += 1;
    modes[mode].total += payment.amount || 0;

    if (!summary[date]) {
      summary[date] = {};
    }
    if (!summary[date][mode]) {
      summary[date][mode] = { count: 0, total: 0 };
    }

    summary[date][mode].count += 1;
    summary[date][mode].total += payment.amount || 0;
  });

  return { byMode: modes, byDateAndMode: summary };
}

/**
 * Get outstanding invoices (unpaid or partially paid)
 * Shows balance due for each invoice
 */
export async function getOutstandingInvoices(patientId?: string) {
  let query = supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      invoice_date,
      status,
      total,
      patient_id,
      patients(first_name, last_name)
    `)
    .neq("status", "paid")
    .order("invoice_date", { ascending: false });

  if (patientId) {
    query = query.eq("patient_id", patientId);
  }

  const { data: invoices, error } = await query;
  if (error) throw error;

  // Calculate paid amount for each invoice
  const { data: payments, error: paymentError } = await supabase
    .from("payments")
    .select(`
      id,
      invoice_id,
      amount,
      voided_at
    `)
    .in(
      "invoice_id",
      (invoices || []).map((inv: any) => inv.id)
    )
    .is("voided_at", null);

  if (paymentError) throw paymentError;

  // Aggregate payments by invoice
  const paidByInvoice: Record<string, number> = {};
  (payments || []).forEach((payment: any) => {
    if (!paidByInvoice[payment.invoice_id]) {
      paidByInvoice[payment.invoice_id] = 0;
    }
    paidByInvoice[payment.invoice_id] += payment.amount || 0;
  });

  // Add balance information
  return (invoices || []).map((inv: any) => ({
    ...inv,
    paid_amount: paidByInvoice[inv.id] || 0,
    balance: Math.max(0, (inv.total || 0) - (paidByInvoice[inv.id] || 0)),
    is_overpaid: (paidByInvoice[inv.id] || 0) > (inv.total || 0),
  }));
}

/**
 * Payment reconciliation report
 * Compares recorded payments with expected totals
 */
export async function getPaymentReconciliation(startDate: string, endDate: string) {
  // Get all payments
  const { data: payments, error: paymentError } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      payment_date,
      status,
      voided_at,
      payment_modes(code, name),
      invoices(invoice_number, total)
    `)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date", { ascending: true });

  if (paymentError) throw paymentError;

  // Get all invoices in date range
  const { data: invoices, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      total,
      status
    `)
    .gte("invoice_date", startDate)
    .lte("invoice_date", endDate);

  if (invoiceError) throw invoiceError;

  // Calculate totals
  const summary = {
    period: { start: startDate, end: endDate },
    invoices: {
      count: (invoices || []).length,
      total: (invoices || []).reduce((sum, inv: any) => sum + (inv.total || 0), 0),
    },
    payments: {
      active: {
        count: (payments || []).filter((p: any) => !p.voided_at).length,
        total: (payments || [])
          .filter((p: any) => !p.voided_at)
          .reduce((sum, p: any) => sum + (p.amount || 0), 0),
      },
      voided: {
        count: (payments || []).filter((p: any) => p.voided_at).length,
        total: (payments || [])
          .filter((p: any) => p.voided_at)
          .reduce((sum, p: any) => sum + (p.amount || 0), 0),
      },
    },
    variance: 0,
  };

  summary.variance = summary.invoices.total - summary.payments.active.total;

  return { summary, payments: payments || [], invoices: invoices || [] };
}

/**
 * Get overpaid invoices (paid more than total)
 */
export async function getOverpaidInvoices() {
  const outstanding = await getOutstandingInvoices();
  return outstanding.filter((inv: any) => inv.is_overpaid);
}

/**
 * Payment mode statistics
 * Shows usage and totals by payment mode
 */
export async function getPaymentModeStats(startDate?: string, endDate?: string) {
  let query = supabase
    .from("payments")
    .select(`
      id,
      amount,
      status,
      payment_modes(code, name, requires_proof, requires_reference)
    `)
    .is("voided_at", null);

  if (startDate) {
    query = query.gte("payment_date", startDate);
  }
  if (endDate) {
    query = query.lte("payment_date", endDate);
  }

  const { data: payments, error } = await query;
  if (error) throw error;

  const stats: Record<string, any> = {};

  (payments || []).forEach((payment: any) => {
    const mode = payment.payment_modes?.code || "UNKNOWN";

    if (!stats[mode]) {
      stats[mode] = {
        code: mode,
        name: payment.payment_modes?.name || mode,
        count: 0,
        total: 0,
        verified_count: 0,
        verified_total: 0,
        pending_count: 0,
        pending_total: 0,
      };
    }

    stats[mode].count += 1;
    stats[mode].total += payment.amount || 0;

    if (payment.status === "verified") {
      stats[mode].verified_count += 1;
      stats[mode].verified_total += payment.amount || 0;
    } else if (payment.status === "pending") {
      stats[mode].pending_count += 1;
      stats[mode].pending_total += payment.amount || 0;
    }
  });

  return Object.values(stats).sort((a: any, b: any) => b.total - a.total);
}

/**
 * Get invoice balance overview
 * Summary of total receivable and collected
 */
export async function getInvoiceBalanceOverview() {
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, total, status");

  if (error) throw error;

  const outstanding = await getOutstandingInvoices();

  const overview = {
    total_invoiced: (invoices || []).reduce((sum, inv: any) => sum + (inv.total || 0), 0),
    total_paid: (invoices || []).reduce((sum, inv: any) => sum + (inv.total || 0), 0) -
      outstanding.reduce((sum, inv: any) => sum + (inv.balance || 0), 0),
    total_outstanding: outstanding.reduce((sum, inv: any) => sum + (inv.balance || 0), 0),
    total_overpaid: outstanding
      .filter((inv: any) => inv.is_overpaid)
      .reduce((sum, inv: any) => sum + ((inv.paid_amount || 0) - (inv.total || 0)), 0),
    invoice_count: (invoices || []).length,
    paid_count: (invoices || []).filter((inv: any) => inv.status === "paid").length,
    outstanding_count: outstanding.length,
  };

  return overview;
}
