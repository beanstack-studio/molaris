"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type {
  Invoice,
  PaymentRow,
  Treatment,
  ServicePriceRow,
  Patient,
} from "@/lib/types";
import { formatMoney, formatDatePH, todayLocalISO, combineFullName, splitFullName } from "@/lib/helpers";

/* Helpers */
function num(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export default function BillingPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentModes, setPaymentModes] = useState<Array<{ id: string; name: string }>>([]);

  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(() => todayLocalISO());
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => todayLocalISO());
  const [paymentMode, setPaymentMode] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Visit date selection and treatments
  const [visitDates, setVisitDates] = useState<string[]>([]);
  const [selectedVisitDate, setSelectedVisitDate] = useState<string>("");
  const [visitTreatments, setVisitTreatments] = useState<Treatment[]>([]);
  const [servicePrices, setServicePrices] = useState<ServicePriceRow[]>([]);
  const [discountAmount, setDiscountAmount] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);

  // Invoice totals calculated from invoice_items
  const [invoiceTotalsById, setInvoiceTotalsById] = useState<Record<string, number>>({});
  const loadInvoiceTotalsRequestRef = useRef<Set<string>>(new Set());

  const subtotal = useMemo(() => {
    if (!selectedVisitDate) return 0;
    return visitTreatments.reduce((sum, t: Treatment) => {
      const price = servicePrices.find((sp) => sp.id === t.service_price_id);
      return sum + num(price?.default_price || 0);
    }, 0);
  }, [selectedVisitDate, visitTreatments, servicePrices]);

  const discountValue = useMemo(() => {
    if (!showDiscount) return 0;
    const amount = parseFloat(discountAmount) || 0;
    return -amount; // Always negative for display
  }, [discountAmount, showDiscount]);

  const invoiceTotal = useMemo(() => {
    return Math.max(0, subtotal + discountValue);
  }, [subtotal, discountValue]);

  /* Calculate treatment total for a specific date */
  const computeVisitTotalFromTreatments = useCallback(
    (visitDate: string) => {
      return visitTreatments
        .filter((t) => t.visit_date === visitDate)
        .reduce((sum, t) => {
          const price = servicePrices.find((sp) => sp.id === t.service_price_id);
          return sum + num(price?.default_price || 0);
        }, 0);
    },
    [visitTreatments, servicePrices]
  );

  /* Load invoice totals from invoice_items for each invoice */
  const loadInvoiceTotalsForInvoices = useCallback(
    async (invoiceIds: string[]) => {
      if (!invoiceIds.length) return;

      const toFetch = invoiceIds.filter((id) => {
        const alreadyLoading = loadInvoiceTotalsRequestRef.current.has(id);
        if (!alreadyLoading) loadInvoiceTotalsRequestRef.current.add(id);
        return !alreadyLoading && !invoiceTotalsById[id];
      });

      if (!toFetch.length) return;

      const { data: items, error } = await supabase
        .from("invoice_items")
        .select("invoice_id, line_total")
        .in("invoice_id", toFetch);

      toFetch.forEach((id) => loadInvoiceTotalsRequestRef.current.delete(id));

      if (error) {
        return;
      }

      const totalsById: Record<string, number> = {};
      items?.forEach((item: { invoice_id: string; line_total: number }) => {
        if (!totalsById[item.invoice_id]) totalsById[item.invoice_id] = 0;
        totalsById[item.invoice_id] += num(item.line_total);
      });

      setInvoiceTotalsById((prev) => ({ ...prev, ...totalsById }));
    },
    [invoiceTotalsById]
  );

  // Billing overview calculations with fallback logic
  const billingOverview = useMemo(() => {
    const totalAll = invoices.reduce((sum, inv: Invoice) => {
      const fromItems = invoiceTotalsById[inv.id];
      if (fromItems !== undefined) return sum + num(fromItems);

      const dbTotal = num(inv.total);
      if (dbTotal > 0) return sum + dbTotal;

      if (inv.invoice_date)
        return sum + computeVisitTotalFromTreatments(inv.invoice_date);

      return sum;
    }, 0);

    const paidAll = payments.reduce((sum, p) => sum + num(p.amount), 0);
    const balanceAll = totalAll - paidAll;

    return { totalInvoiced: totalAll, totalPaid: paidAll, balance: balanceAll };
  }, [invoices, invoiceTotalsById, payments, computeVisitTotalFromTreatments]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr(null);

    // Load patient info
    const p = await supabase.from("patients").select("*").eq("id", id).single();
    if (!p.error && p.data) {
      const patRaw = p.data;
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

    const inv = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, status, total, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });
    

    
    setInvoices(inv.error === null && inv.data ? (inv.data as Invoice[]) : []);

    // Get payments for all invoices of this patient
    const invoiceIds = (inv.data as any[])?.map((i: any) => i.id) || [];
    let allPayments: PaymentRow[] = [];
    
    if (invoiceIds.length > 0) {
      const pay = await supabase
        .from("payments")
        .select("id, invoice_id, amount, payment_date, mode, received_by, reference_no, notes, created_at, invoices(invoice_number)")
        .in("invoice_id", invoiceIds)
        .order("created_at", { ascending: false });
      

      allPayments = pay.error === null && pay.data ? pay.data : [];
    }
    
    setPayments(allPayments);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load invoice totals from invoice_items whenever invoices change
  useEffect(() => {
    loadInvoiceTotalsForInvoices(invoices.map((inv) => inv.id));
  }, [invoices, loadInvoiceTotalsForInvoices]);

  // Load visit dates and service prices
  useEffect(() => {
    async function loadVisitData() {
      if (!id) return;

      const { data: treatments, error: treatmentsError } = await supabase
        .from("treatments")
        .select("treatment_date")
        .eq("patient_id", id)
        .not("treatment_date", "is", null)
        .order("treatment_date", { ascending: false });

      if (treatmentsError === null && treatments) {
        const uniqueDates = [...new Set(treatments.map((t: any) => t.treatment_date))];
        
        // Get dates that already have invoices to exclude them
        const { data: invoiceData, error: invoiceError } = await supabase
          .from("invoice_items")
          .select("invoices(invoice_date)")
          .eq("invoices.patient_id", id);
        
        let invoicedDates = new Set<string>();
        if (invoiceError === null && invoiceData) {
          invoicedDates = new Set(
            invoiceData
              .map((item: any) => item.invoices?.invoice_date)
              .filter((d: string | null) => d !== null)
          );
        }
        
        // Filter out dates that already have invoices
        const availableDates = uniqueDates.filter(date => !invoicedDates.has(date));
        

        setVisitDates(availableDates);
      }

      const { data: prices, error: pricesError } = await supabase
        .from("service_prices")
        .select("*")
        .order("service_name", { ascending: true });

      if (pricesError === null && prices) {
        setServicePrices(prices as ServicePriceRow[]);
      }
    }

    loadVisitData();
  }, [id]);

  // Load payment modes
  useEffect(() => {
    async function loadModes() {
      const { data, error } = await supabase
        .from("payment_modes")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error === null && data) {
        setPaymentModes(data);
      }
    }
    loadModes();
  }, []);

  // Load treatments for selected visit date
  useEffect(() => {
    async function loadTreatmentsForDate() {
      if (!id || !selectedVisitDate) {
        setVisitTreatments([]);
        return;
      }

      const { data: treatments, error } = await supabase
        .from("treatments")
        .select("id, treatment_date, procedure, tooth_number, notes, dentist_id, dentist_name, service_price_id, created_at")
        .eq("patient_id", id)
        .eq("treatment_date", selectedVisitDate)
        .order("created_at", { ascending: true });

      if (error === null && treatments) {
        const mapped = treatments.map((t: any) => ({
          id: t.id,
          visit_date: t.treatment_date,
          treatment_date: t.treatment_date,
          procedure: t.procedure,
          tooth_number: t.tooth_number,
          notes: t.notes,
          dentist_id: t.dentist_id,
          dentist_name: t.dentist_name,
          service_price_id: t.service_price_id,
          created_at: t.created_at,
        }));
        setVisitTreatments(mapped);
      } else {
        setVisitTreatments([]);
      }
    }

    loadTreatmentsForDate();
  }, [id, selectedVisitDate]);

  // Don't auto-populate items - let user decide what to add

  async function createInvoice() {
    if (!id) return;
    setErr(null);

    if (!selectedVisitDate) return setErr("Select a visit date.");
    if (visitTreatments.length === 0) return setErr("Add at least one treatment.");

    setBusy(true);

    const ins = await supabase.from("invoices").insert({
      patient_id: id,
      invoice_date: invoiceDate,
      total: invoiceTotal,
      status: "unpaid",
    });

    if (ins.error) {
      setBusy(false);
      return setErr(ins.error.message);
    }

    const invoiceId = (ins as any).data?.[0]?.id;
    if (invoiceId) {
      const itemsToInsert = visitTreatments
        .filter((t) => t.visit_date === selectedVisitDate)
        .map((treatment) => {
          const servicePrice = servicePrices.find((sp) => sp.id === treatment.service_price_id);
          const unitPrice = (servicePrice as any)?.default_price || 0;
          return {
            invoice_id: invoiceId,
            service_name: servicePrice?.service_name || "Service",
            description: treatment.procedure || "Treatment",
            qty: 1,
            unit_price: unitPrice,
            line_total: unitPrice,
            tooth_number: treatment.tooth_number,
            dentist_name: treatment.dentist_name,
          };
        });

      const itemsIns = await supabase.from("invoice_items").insert(itemsToInsert);

      if (itemsIns.error) {
        setBusy(false);
        return setErr(itemsIns.error.message);
      }

      await supabase.rpc("recalc_invoice", { invoice_id: invoiceId });
    }

    setBusy(false);
    setShowCreateInvoice(false);
    setSelectedVisitDate("");
    setVisitTreatments([]);
    setDiscountAmount("");
    setShowDiscount(false);
    await loadData();
  }

  async function addPayment() {
    if (!id) return;
    setErr(null);

    if (!paymentInvoiceId) return setErr("Select an invoice.");
    if (!paymentAmount) return setErr("Enter payment amount.");
    if (!paymentMode) return setErr("Select payment mode.");

    setBusy(true);

    const ins = await supabase.from("payments").insert({
      patient_id: id,
      invoice_id: paymentInvoiceId,
      amount: parseFloat(paymentAmount),
      payment_date: paymentDate,
      mode: paymentMode,
      notes: paymentNotes.trim() || null,
    });

    setBusy(false);
    if (ins.error) return setErr(ins.error.message);

    await supabase.rpc("recalc_invoice", { invoice_id: paymentInvoiceId });

    setShowAddPayment(false);
    setPaymentInvoiceId("");
    setPaymentAmount("");
    setPaymentMode("");
    setPaymentNotes("");
    await loadData();
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <img src="/loading.gif" alt="Loading" className="h-12 w-12" />
          <div className="text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">
            {patient ? combineFullName(patient.first_name, patient.last_name) || patient.full_name || "" : "Patient Billing"}
          </div>
          <button className="btn btn-secondary" onClick={() => window.history.back()}>
            Back
          </button>
        </div>

        {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        <div className="app-section-body">
          <PatientTabs activeTab="Billing" />

          <div className="grid gap-4">
            {/* Billing Overview (MUST COME FIRST) */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold">Billing Overview</div>

                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border bg-blue-50 p-3">
                    <div className="text-xs text-blue-600 font-medium">Total Invoiced</div>
                    <div className="text-lg font-semibold text-blue-900">{formatMoney(billingOverview.totalInvoiced)}</div>
                  </div>

                  <div className="rounded-lg border bg-green-50 p-3">
                    <div className="text-xs text-green-600 font-medium">Total Paid</div>
                    <div className="text-lg font-semibold text-green-900">{formatMoney(billingOverview.totalPaid)}</div>
                  </div>

                  <div className={`rounded-lg border p-3 ${billingOverview.balance > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                    <div className={`text-xs font-medium ${billingOverview.balance > 0 ? "text-red-600" : "text-gray-600"}`}>
                      Outstanding Balance
                    </div>
                    <div className={`text-lg font-semibold ${billingOverview.balance > 0 ? "text-red-900" : "text-gray-900"}`}>
                      {formatMoney(billingOverview.balance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices */}
              <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="text-sm font-semibold">Invoices</div>
                  </div>
                  <button
                    className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white"
                    onClick={() => setShowCreateInvoice(true)}
                  >
                    Create invoice
                  </button>
                </div>

                <div className="mt-3">
                  <table className="data-table">
                    <colgroup>
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "10%" }} />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Invoice #</th>
                        <th className="data-table-head-cell">Date</th>
                        <th className="data-table-head-cell-right">Invoice Amount</th>
                        <th className="data-table-head-cell-right">Paid</th>
                        <th className="data-table-head-cell-right">Balance</th>
                        <th className="data-table-head-cell">Status</th>
                        <th className="data-table-head-cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv: any, index: number) => {
                        const invoiceAmount = inv.total ?? 0;
                        const paidAmount = payments
                          .filter((p: any) => p.invoice_id === inv.id)
                          .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
                        const balance = invoiceAmount - paidAmount;
                        return (
                        <tr key={inv.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                          <td className="data-table-cell">{inv.invoice_number}</td>
                          <td className="data-table-cell">{formatDatePH(inv.invoice_date)}</td>
                          <td className="data-table-cell-right">{formatMoney(invoiceAmount)}</td>
                          <td className="data-table-cell-right text-green-700 font-semibold">{formatMoney(paidAmount)}</td>
                          <td className="data-table-cell-right font-semibold" style={{ color: balance > 0 ? "#dc2626" : "#16a34a" }}>
                            {formatMoney(Math.max(0, balance))}
                          </td>
                          <td className="data-table-cell">
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                                inv.status === "paid"
                                  ? "bg-green-100 text-green-800"
                                  : inv.status === "overdue"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="data-table-cell-right">
                            <button
                              className="data-table-btn"
                              onClick={async () => {
                                const { data: items, error } = await supabase
                                  .from("invoice_items")
                                  .select("*")
                                  .eq("invoice_id", inv.id);
                                setViewingInvoice({
                                  ...inv,
                                  invoice_items: error === null && items ? items : [],
                                });
                              }}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                      {invoices.length === 0 ? (
                        <tr>
                          <td className="data-table-empty" colSpan={7}>
                            No invoices yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments */}
              <div className="rounded-2xl border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="text-sm font-semibold">Payments</div>
                  <button className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white" onClick={() => setShowAddPayment(true)}>
                    Add payment
                  </button>
                </div>

                <div className="mt-3">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col style={{ width: 110 }} />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 90 }} />
                      <col />
                    </colgroup>
                    <thead>
                      <tr className="text-left text-slate-600 border-b bg-slate-50">
                        <th className="py-3 px-3 font-semibold">Invoice #</th>
                        <th className="py-3 px-3 font-semibold">Date</th>
                        <th className="py-3 px-3 font-semibold text-right">Amount</th>
                        <th className="py-3 px-3 font-semibold">Mode</th>
                        <th className="py-3 px-3 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((pay: any, index: number) => (
                        <tr key={pay.id} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}>
                          <td className="py-3 px-3">{(pay as any).invoices?.invoice_number ?? "—"}</td>
                          <td className="py-3 px-3">{formatDatePH(pay.payment_date)}</td>
                          <td className="py-3 px-3 text-right">{formatMoney(pay.amount)}</td>
                          <td className="py-3 px-3">{pay.mode ?? "—"}</td>
                          <td className="py-3 px-3">{pay.notes ?? "—"}</td>
                        </tr>
                      ))}
                      {payments.length === 0 ? (
                        <tr>
                          <td className="py-3 px-3 text-slate-500 text-center" colSpan={5}>
                            No payments yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
        </div>

        {/* Create invoice modal */}
        {showCreateInvoice ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl border bg-white p-6">
              <h2 className="text-lg font-semibold">Create invoice</h2>

              <div className="mt-4 grid gap-4">
                {/* Visit date, Add Item and Add Discount on one row */}
                <div className="flex gap-3 items-end">
                  <label className="flex-1 grid gap-1 text-sm">
                    <span className="text-slate-700">Visit date</span>
                    <select
                      className="h-10 rounded-lg border bg-white px-3"
                      value={selectedVisitDate}
                      onChange={(e) => {
                        setSelectedVisitDate(e.target.value);
                        setInvoiceDate(e.target.value || invoiceDate);
                      }}
                    >
                      <option value="">Select a visit date</option>
                      {visitDates.map((d) => (
                        <option key={d} value={d}>
                          {formatDatePH(d)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button 
                    className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={!selectedVisitDate}
                    onClick={() => setShowDiscount(!showDiscount)}
                  >
                    {showDiscount ? "Remove discount" : "Add discount"}
                  </button>
                </div>

                {/* Combined invoice table - only shown when visit date selected */}
                {selectedVisitDate && (
                  <div className="rounded-xl border bg-white p-4">
                    {/* Treatments section */}
                    {visitTreatments.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm font-semibold mb-2">Treatments on {formatDatePH(selectedVisitDate)} ({visitTreatments.length})</div>
                        <div className="space-y-2 mb-4 pb-4 border-b">
                          {visitTreatments.map((t: any) => {
                            const servicePrice = servicePrices.find((sp) => sp.id === t.service_price_id);
                            // Use default_price since the alias didn't work
                            const priceValue = (servicePrice as any)?.default_price ?? (servicePrice as any)?.price ?? 0;
                            
                            return (
                              <div key={t.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <div className="flex-1">
                                  <div className="text-sm">{servicePrice?.service_name || t.procedure || "Treatment"}</div>
                                  {t.tooth_number && <div className="text-xs text-slate-500">Tooth {t.tooth_number}</div>}
                                </div>
                                <div className="text-sm font-semibold text-slate-900">{formatMoney(priceValue)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Summary totals */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-semibold">{formatMoney(subtotal)}</span>
                      </div>
                      {showDiscount && (
                        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex-1 grid gap-2 sm:grid-cols-1">
                            <input
                              type="number"
                              placeholder="Discount amount"
                              className="h-9 rounded-lg border bg-white px-2 text-sm"
                              value={discountAmount}
                              onChange={(e) => setDiscountAmount(e.target.value)}
                              step="0.01"
                            />
                          </div>
                          <div className="text-sm font-semibold text-red-600">
                            -{formatMoney(Math.abs(discountValue))}
                          </div>
                          <button
                            className="h-8 w-8 rounded-lg border bg-white text-red-600 hover:bg-red-100"
                            onClick={() => {
                              setShowDiscount(false);
                              setDiscountAmount("");
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 text-base font-bold">
                        <span>Total</span>
                        <span className="text-lg">
                          {formatMoney(invoiceTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold" onClick={() => setShowCreateInvoice(false)}>
                    Cancel
                  </button>
                  <button
                    className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={busy || !selectedVisitDate}
                    onClick={createInvoice}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        </div>

        {/* Add payment modal */}
        {showAddPayment ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Add payment</h2>
                <button className="h-8 w-8 rounded-lg border bg-white" onClick={() => setShowAddPayment(false)}>
                  ✕
                </button>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Invoice</span>
                  <select
                    className="h-10 rounded-lg border bg-white px-3"
                    value={paymentInvoiceId}
                    onChange={(e) => setPaymentInvoiceId(e.target.value)}
                  >
                    <option value="">Select invoice</option>
                    {invoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} ({formatMoney(inv.total ?? 0)})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    className="h-10 rounded-lg border px-3"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Payment date</span>
                  <input type="date" className="h-10 rounded-lg border px-3" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Payment mode</span>
                  <select
                    className="h-10 rounded-lg border bg-white px-3"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="">Select mode</option>
                    {paymentModes.map((mode: any) => (
                      <option key={mode.id} value={mode.name}>
                        {mode.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Notes</span>
                  <textarea
                    className="min-h-[88px] rounded-lg border px-3 py-2"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold" onClick={() => setShowAddPayment(false)}>
                    Cancel
                  </button>
                  <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={addPayment}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

      {viewingInvoice ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50">
          <div className="max-h-screen overflow-y-auto rounded-2xl border bg-white w-full max-w-2xl">
            <div className="sticky top-0 border-b bg-white p-4 flex items-center justify-between">
              <div className="text-lg font-semibold">Invoice {viewingInvoice.invoice_number}</div>
              <button
                className="rounded-lg border bg-white px-2 py-1 text-sm"
                onClick={() => setViewingInvoice(null)}
              >
                Close
              </button>
            </div>

            <div className="p-4">
              <div className="grid gap-4">
                {/* Header Info */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-600">Invoice date</div>
                    <div className="text-sm font-semibold">{formatDatePH(viewingInvoice.invoice_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Status</div>
                    <div className="text-sm font-semibold capitalize">{viewingInvoice.status}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Total amount</div>
                    <div className="text-sm font-semibold text-blue-900">{formatMoney(viewingInvoice.total ?? 0)}</div>
                  </div>
                </div>

                {/* Invoice items table */}
                <div className="border-t pt-4">
                  <div className="text-sm font-semibold mb-3">Items</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-600 bg-slate-50">
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Quantity</th>
                        <th className="py-2 px-3 text-right">Unit price</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((viewingInvoice as any).invoice_items || []).map((item: any, i: number) => {
                        const qty = item.qty ?? item.quantity ?? 1;
                        const unitPrice = item.unit_price ?? 0;
                        const lineTotal = qty * unitPrice;
                        return (
                          <tr key={item.id || i} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                            <td className="py-2 px-3">{item.description || item.service_name || "Service"}</td>
                            <td className="py-2 px-3 text-right">{qty}</td>
                            <td className="py-2 px-3 text-right">{formatMoney(unitPrice)}</td>
                            <td className="py-2 px-3 text-right font-semibold">{formatMoney(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Payments applied */}
                {payments.filter((p: any) => p.invoice_id === viewingInvoice.id).length > 0 ? (
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold mb-3">Payments</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-600 bg-slate-50">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Amount</th>
                          <th className="py-2 px-3">Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.filter((p: any) => p.invoice_id === viewingInvoice.id).map((payment: any, i: number) => (
                          <tr key={payment.id} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                            <td className="py-2 px-3">{formatDatePH(payment.payment_date)}</td>
                            <td className="py-2 px-3 font-semibold">{formatMoney(payment.amount)}</td>
                            <td className="py-2 px-3">{payment.mode || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {/* Summary */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600">Total:</span>
                    <span className="font-semibold">{formatMoney(viewingInvoice.total ?? 0)}</span>
                  </div>
                  {payments.filter((p: any) => p.invoice_id === viewingInvoice.id).length > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-slate-600">Paid:</span>
                        <span className="font-semibold text-green-900">
                          {formatMoney(
                            payments
                              .filter((p: any) => p.invoice_id === viewingInvoice.id)
                              .reduce((sum: number, p: any) => sum + num(p.amount), 0)
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold border-t pt-2">
                        <span className="text-slate-700">Remaining:</span>
                        <span className="text-red-900">
                          {formatMoney(
                            num(viewingInvoice.total) -
                              payments
                                .filter((p: any) => p.invoice_id === viewingInvoice.id)
                                .reduce((sum: number, p: any) => sum + num(p.amount), 0)
                          )}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
