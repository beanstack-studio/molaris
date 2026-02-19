"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type {
  Invoice,
  PaymentRow,
  PaymentRowExtended,
  Treatment,
  ServicePriceRow,
  Patient,
  PaymentMode,
  OrthoEntry,
  OrthoEntryItem,
  OrthoCase,
} from "@/lib/types";
import { formatMoney, formatDatePH, todayLocalISO, combineFullName, splitFullName, generateInvoiceNumber, generateReceiptNumber } from "@/lib/helpers";
import { getActivePaymentModes } from "@/lib/paymentModeHelpers";
import { generateReceipt, voidPayment } from "@/lib/receiptHelpers";
import { getNextTransactionNumber, getNextInvoiceNumber } from "@/lib/numberGenerationHelpers";

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
  const [payments, setPayments] = useState<PaymentRowExtended[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode | null>(null);

  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(() => todayLocalISO());
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => todayLocalISO());
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

  const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Visit date selection and treatments
  const [visitDates, setVisitDates] = useState<string[]>([]);
  const [orthoDateSet, setOrthoDateSet] = useState<Set<string>>(new Set());
  const [selectedVisitDate, setSelectedVisitDate] = useState<string>("");
  const [selectedVisitType, setSelectedVisitType] = useState<"treatment" | "ortho" | "">("");
  const [visitTreatments, setVisitTreatments] = useState<Treatment[]>([]);
  const [orthoVisits, setOrthoVisits] = useState<OrthoEntry[]>([]);
  const [orthoVisitItems, setOrthoVisitItems] = useState<OrthoEntryItem[]>([]);
  const [orthoCase, setOrthoCase] = useState<OrthoCase | null>(null);
  const [servicePrices, setServicePrices] = useState<ServicePriceRow[]>([]);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountDescription, setDiscountDescription] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);

  // Invoice totals calculated from invoice_items
  const [invoiceTotalsById, setInvoiceTotalsById] = useState<Record<string, number>>({});
  const loadInvoiceTotalsRequestRef = useRef<Set<string>>(new Set());

  const subtotal = useMemo(() => {
    if (!selectedVisitDate) return 0;
    
    let total = 0;
    
    // Calculate from treatments
    if (selectedVisitType === "treatment") {
      total = visitTreatments.reduce((sum, t: Treatment) => {
        const price = servicePrices.find((sp) => sp.id === t.service_price_id);
        return sum + num(price?.default_price || 0);
      }, 0);
    }
    
    // Calculate from ortho visits
    if (selectedVisitType === "ortho") {
      orthoVisits.forEach((entry: OrthoEntry) => {
        const items = orthoVisitItems.filter((item) => item.ortho_entry_id === entry.id);
        const chargedItems = items.filter((item) => item.is_charged);
        
        chargedItems.forEach((item) => {
          const svc = servicePrices.find((s) => s.id === item.service_id);
          total += num(svc?.default_price || 0);
        });
        
        if (entry.invoice_package && orthoCase?.package_fee) {
          total += num(orthoCase.package_fee);
        }
      });
    }
    
    return total;
  }, [selectedVisitDate, selectedVisitType, visitTreatments, orthoVisits, orthoVisitItems, orthoCase, servicePrices]);

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

    const paidAll = payments
      .filter((p: any) => !p.voided_at) // Exclude voided payments
      .reduce((sum, p) => sum + num(p.amount), 0);
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
    let allPayments: any[] = [];
    
    if (invoiceIds.length > 0) {
      const pay = await supabase
        .from("payments")
        .select("id, invoice_id, patient_id, transaction_id, amount, payment_date, status, reference_number, details, voided_at, voided_by, created_at, invoices(invoice_number)")
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

  // Load visit dates and service prices (both treatments and ortho visits)
  useEffect(() => {
    async function loadVisitData() {
      if (!id) return;

      // Load treatment dates
      const { data: treatments, error: treatmentsError } = await supabase
        .from("treatments")
        .select("treatment_date")
        .eq("patient_id", id)
        .not("treatment_date", "is", null)
        .order("treatment_date", { ascending: false });

      const treatmentDates = (treatments || []).map((t: any) => t.treatment_date);
      console.log("Treatment dates loaded:", treatmentDates);

      // Load ortho entry dates (from ortho cases)
      let orthoDates: string[] = [];
      try {
        // First, get all ortho cases for this patient
        console.log("Loading ortho cases for patient:", id);
        const { data: cases, error: casesError } = await supabase
          .from("ortho_cases")
          .select("*")
          .eq("patient_id", id);

        console.log("Ortho cases error:", casesError);
        console.log("Ortho cases found:", cases?.length ?? 0, cases);

        if (!casesError && cases && cases.length > 0) {
          const caseIds = (cases as any[]).map((c: any) => c.id);
          console.log("Ortho case IDs:", caseIds);
          
          // Then get all entries for those cases
          const { data: entries, error: entriesError } = await supabase
            .from("ortho_entries")
            .select("entry_date")
            .in("ortho_case_id", caseIds)
            .order("entry_date", { ascending: false });

          console.log("Ortho entries error:", entriesError);
          console.log("Ortho entries found:", entries?.length ?? 0, entries);

          if (!entriesError && entries) {
            orthoDates = (entries as any[]).map((e: any) => e.entry_date);
          }
        }
      } catch (e) {
        console.error("Error loading ortho dates:", e);
      }

      console.log("Ortho dates loaded:", orthoDates);

      // Combine all dates
      const allDates = [...new Set([...treatmentDates, ...orthoDates])];
      console.log("All dates combined:", allDates);
      
      // Get dates that already have invoices to exclude them
      const { data: invoices, error: invoiceError } = await supabase
        .from("invoices")
        .select("invoice_date")
        .eq("patient_id", id);
      
      let invoicedDates = new Set<string>();
      if (!invoiceError && invoices) {
        invoicedDates = new Set(
          (invoices as any[])
            .map((inv: any) => inv.invoice_date)
            .filter((d: string | null) => d !== null)
        );
      }
      
      // Filter out dates that already have invoices and sort
      const availableDates = allDates
        .filter(date => !invoicedDates.has(date))
        .sort()
        .reverse();
      
      console.log("Available dates to invoice:", availableDates);
      setVisitDates(availableDates);
      setOrthoDateSet(new Set(orthoDates));

      const { data: prices, error: pricesError } = await supabase
        .from("service_prices")
        .select("*")
        .order("service_name", { ascending: true });

      if (!pricesError && prices) {
        setServicePrices(prices as ServicePriceRow[]);
      }
    }

    loadVisitData();
  }, [id]);

  // Load payment modes
  useEffect(() => {
    async function loadModes() {
      try {
        const modes = await getActivePaymentModes();
        setPaymentModes(modes || []);
      } catch (err) {
        console.error("Failed to load payment modes:", err);
      }
    }
    loadModes();
  }, []);

  // Load treatments or ortho entries for selected visit date
  useEffect(() => {
    async function loadDataForDate() {
      if (!id || !selectedVisitDate) {
        setVisitTreatments([]);
        setOrthoVisits([]);
        setOrthoVisitItems([]);
        setOrthoCase(null);
        setSelectedVisitType("");
        return;
      }

      // Check if this date has treatments
      const { data: treatments, error: treatmentsError } = await supabase
        .from("treatments")
        .select("id, treatment_date, procedure, tooth_number, notes, dentist_id, dentist_name, service_price_id, created_at")
        .eq("patient_id", id)
        .eq("treatment_date", selectedVisitDate)
        .order("created_at", { ascending: true });

      if (treatmentsError === null && treatments && treatments.length > 0) {
        const mapped = treatments.map((t: any) => ({
          id: t.id,
          visit_date: t.treatment_date,
          treatment_date: t.treatment_date,
          procedure: t.procedure,
          tooth_number: t.tooth_number,
          notes: t.notes,
          visit_concern: t.visit_concern || null,
          dentist_id: t.dentist_id,
          dentist_name: t.dentist_name,
          service_price_id: t.service_price_id,
          created_at: t.created_at,
        }));
        setVisitTreatments(mapped);
        setOrthoVisits([]);
        setOrthoVisitItems([]);
        setOrthoCase(null);
        setSelectedVisitType("treatment");
        return;
      }

      // Check if this date has ortho entries
      const { data: cases, error: casesError } = await supabase
        .from("ortho_cases")
        .select("*")
        .eq("patient_id", id);

      if (casesError === null && cases && cases.length > 0) {
        const caseIds = cases.map((c: any) => c.id);
        const { data: entries, error: entriesError } = await supabase
          .from("ortho_entries")
          .select("*")
          .in("ortho_case_id", caseIds)
          .eq("entry_date", selectedVisitDate);

        if (entriesError === null && entries && entries.length > 0) {
          setOrthoVisits(entries as OrthoEntry[]);
          
          // Load ortho entry items for all entries on this date
          const entryIds = entries.map((e: any) => e.id);
          const { data: items, error: itemsError } = await supabase
            .from("ortho_entry_items")
            .select("*")
            .in("ortho_entry_id", entryIds);
          
          if (itemsError === null && items) {
            setOrthoVisitItems(items as OrthoEntryItem[]);
          }
          
          // Load the ortho case for package info
          const orthoCase = cases[0] as OrthoCase;
          setOrthoCase(orthoCase);
          
          setVisitTreatments([]);
          setSelectedVisitType("ortho");
          return;
        }
      }

      // No data found for this date
      setVisitTreatments([]);
      setOrthoVisits([]);
      setOrthoVisitItems([]);
      setOrthoCase(null);
      setSelectedVisitType("");
    }

    loadDataForDate();
  }, [id, selectedVisitDate]);

  // Don't auto-populate items - let user decide what to add

  async function createInvoice() {
    if (!id) return;
    setErr(null);

    if (!selectedVisitDate) return setErr("Select a visit date.");
    
    // Check which type of invoice to create
    if (selectedVisitType === "treatment") {
      if (visitTreatments.length === 0) return setErr("No treatments found for this visit.");
    } else if (selectedVisitType === "ortho") {
      if (orthoVisits.length === 0) return setErr("No ortho visits found for this date.");
    } else {
      return setErr("No visit data found for the selected date.");
    }

    setBusy(true);

    try {
      const invoiceNumber = await getNextInvoiceNumber();

      // Create invoice with appropriate type
      const invoiceType = selectedVisitType === "ortho" ? "ortho" : "regular";
      
      const ins = await supabase.from("invoices").insert({
        patient_id: id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        total: invoiceTotal,
        status: "unpaid",
        invoice_type: invoiceType,
      });

      if (ins.error) {
        setBusy(false);
        return setErr(ins.error.message);
      }

      const invoiceId = (ins as any).data?.[0]?.id;
      if (!invoiceId) {
        setBusy(false);
        return setErr("Failed to create invoice.");
      }

      // Handle treatment items
      if (selectedVisitType === "treatment") {
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
              source_type: "treatment",
              source_id: treatment.id,
            };
          });

        const itemsIns = await supabase.from("invoice_items").insert(itemsToInsert);
        if (itemsIns.error) {
          setBusy(false);
          return setErr(itemsIns.error.message);
        }
      }
      // Handle ortho items
      else if (selectedVisitType === "ortho") {
        const orthoItems = [];

        // Process each ortho entry
        for (const entry of orthoVisits) {
          // Add charged services
          const chargedItems = orthoVisitItems.filter((item) => item.ortho_entry_id === entry.id && item.is_charged);
          
          for (const item of chargedItems) {
            const svc = servicePrices.find((s) => s.id === item.service_id);
            if (svc) {
              orthoItems.push({
                invoice_id: invoiceId,
                service_name: svc.service_name,
                description: item.service_detail || `Ortho Service`,
                qty: 1,
                unit_price: (svc as any)?.default_price || 0,
                line_total: (svc as any)?.default_price || 0,
                source_type: "ortho_addon",
                source_id: item.id,
              });
            }
          }

          // Add package if invoice_package is true
          if (entry.invoice_package && orthoCase?.package_service_id) {
            const packageService = servicePrices.find((s) => s.id === orthoCase.package_service_id);
            if (packageService) {
              orthoItems.push({
                invoice_id: invoiceId,
                service_name: packageService.service_name,
                description: "Ortho Package",
                qty: 1,
                unit_price: (packageService as any)?.default_price || orthoCase.package_fee || 0,
                line_total: (packageService as any)?.default_price || orthoCase.package_fee || 0,
                source_type: "ortho_package",
                source_id: entry.id,
              });
            }
          }
        }

        if (orthoItems.length > 0) {
          const itemsIns = await supabase.from("invoice_items").insert(orthoItems);
          if (itemsIns.error) {
            setBusy(false);
            return setErr(itemsIns.error.message);
          }
        }
      }

      // Recalculate invoice totals
      await supabase.rpc("recalc_invoice", { invoice_id: invoiceId });

      setBusy(false);
      setShowCreateInvoice(false);
      setSelectedVisitDate("");
      setSelectedVisitType("");
      setVisitTreatments([]);
      setOrthoVisits([]);
      setOrthoVisitItems([]);
      setOrthoCase(null);
      setDiscountAmount("");
      setDiscountDescription("");
      setShowDiscount(false);
      await loadData();
    } catch (error) {
      setBusy(false);
      setErr(error instanceof Error ? error.message : "Failed to create invoice");
    }
  }

  async function verifyPayment() {
    if (!verifyingPaymentId) return;
    setErr(null);
    setBusy(true);

    try {
      // Update payment status to verified
      const { error } = await supabase
        .from("payments")
        .update({ 
          status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: (await supabase.auth.getSession()).data?.session?.user?.id || null,
        })
        .eq("id", verifyingPaymentId);

      if (error) throw error;

      setVerifyingPaymentId(null);
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to verify payment");
    } finally {
      setBusy(false);
    }
  }

  async function handleVoidPayment() {
    if (!voidingPaymentId || !voidReason.trim()) {
      setErr("Please provide a reason for voiding");
      return;
    }

    setErr(null);
    setBusy(true);

    try {
      const userId = (await supabase.auth.getSession()).data?.session?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // Use voidPayment helper which handles receipt voiding too
      await voidPayment(voidingPaymentId, userId, voidReason.trim());

      setVoidingPaymentId(null);
      setVoidReason("");
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to void payment");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateReceipt(paymentId: string) {
    setErr(null);
    setBusy(true);

    try {
      const userId = (await supabase.auth.getSession()).data?.session?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // For now, use current user as both staff and issuer
      const receipt = await generateReceipt(paymentId, userId, userId);

      alert(`Receipt ${receipt[0].receipt_number} generated successfully!`);
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to generate receipt");
    } finally {
      setBusy(false);
    }
  }

  async function addPayment() {
    if (!id) return;
    setErr(null);

    if (selectedInvoiceIds.length === 0) return setErr("Select at least one invoice.");
    if (!paymentAmount) return setErr("Enter payment amount.");
    if (!selectedPaymentMode) return setErr("Select payment mode.");

    // Validate mode-specific requirements
    if (selectedPaymentMode.requires_reference && !paymentReference) {
      return setErr(`${selectedPaymentMode.name} requires a reference number.`);
    }
    if (selectedPaymentMode.requires_proof && !paymentProofFile) {
      return setErr(`${selectedPaymentMode.name} requires a proof file.`);
    }

    // Calculate total balance of selected invoices
    const totalAvailableBalance = selectedInvoiceIds.reduce((sum, invoiceId) => {
      const inv = invoices.find((i: any) => i.id === invoiceId);
      if (!inv) return sum;
      const invoicePayments = payments.filter((p) => p.invoice_id === invoiceId && !p.voided_at);
      const totalPaid = invoicePayments.reduce((s, p) => s + num(p.amount), 0);
      const balance = num(inv.total) - totalPaid;
      return sum + balance;
    }, 0);

    const paymentAmountNum = parseFloat(paymentAmount);
    if (paymentAmountNum > totalAvailableBalance) {
      return setErr(`Payment amount (${formatMoney(paymentAmountNum)}) exceeds total balance (${formatMoney(totalAvailableBalance)}) of selected invoices.`);
    }

    setBusy(true);

    try {
      // Prepare payment details (flexible JSONB field)
      const paymentDetails: Record<string, any> = {
        payment_mode_code: selectedPaymentMode.code,
        payment_mode_name: selectedPaymentMode.name,
      };

      if (paymentReference) {
        paymentDetails.reference_number = paymentReference;
      }

      // Set status based on mode auto-verify
      const status = selectedPaymentMode.auto_verifies ? "verified" : "pending";
      const userId = (await supabase.auth.getSession()).data?.session?.user?.id || null;

      // Create a payment record for each selected invoice
      // Distribute payment sequentially by invoice number (pay first invoice completely, then next, etc.)
      const paymentRecords = [];
      let remainingAmount = paymentAmountNum;

      // Sort selected invoice IDs by their invoice numbers for sequential payment
      const sortedInvoiceIds = selectedInvoiceIds
        .map(invoiceId => invoices.find((i: any) => i.id === invoiceId))
        .filter(inv => inv !== undefined)
        .sort((a: any, b: any) => (a.invoice_number || "").localeCompare(b.invoice_number || ""))
        .map((inv: any) => inv.id);

      for (const invoiceId of sortedInvoiceIds) {
        if (remainingAmount <= 0) break;

        const inv = invoices.find((i: any) => i.id === invoiceId);
        if (!inv) continue;

        const invoicePayments = payments.filter((p) => p.invoice_id === invoiceId && !p.voided_at);
        const totalPaid = invoicePayments.reduce((s, p) => s + num(p.amount), 0);
        const balance = num(inv.total) - totalPaid;

        // Pay this invoice: min of balance and remaining payment amount
        const invoicePaymentAmount = Math.min(balance, remainingAmount);

        if (invoicePaymentAmount > 0) {
          const transactionId = await getNextTransactionNumber();
          paymentRecords.push({
            patient_id: id,
            invoice_id: invoiceId,
            transaction_id: transactionId,
            amount: invoicePaymentAmount,
            payment_date: paymentDate,
            status,
            details: paymentDetails,
            created_by: userId,
          });
          remainingAmount -= invoicePaymentAmount;
        }
      }

      if (paymentRecords.length === 0) {
        throw new Error("No valid invoices to apply payment to.");
      }

      const ins = await supabase.from("payments").insert(paymentRecords);

      if (ins.error) {
        throw ins.error;
      }

      // Recalculate all affected invoices
      for (const invoiceId of selectedInvoiceIds) {
        await supabase.rpc("recalc_invoice", { invoice_id: invoiceId });
      }

      setShowAddPayment(false);
      setSelectedInvoiceIds([]);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentProofFile(null);
      setSelectedPaymentMode(null);
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to add payment");
    } finally {
      setBusy(false);
    }
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
    <>
      {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

      <div className="page-content">
        <div className="page-sections">
            {/* Billing Overview (MUST COME FIRST) */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Billing Overview</div>
              </div>

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
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Invoices</div>
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
                          .filter((p: any) => p.invoice_id === inv.id && !p.voided_at)
                          .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
                        const balance = invoiceAmount - paidAmount;
                        return (
                        <tr key={inv.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                          <td className="data-table-cell">
                            <div className="flex items-center gap-2">
                              <span>{inv.invoice_number}</span>
                              {/* PART 7: Show Ortho badge only for ortho invoices */}
                              {inv.invoice_type === "ortho" && (
                                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                                  Ortho
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="data-table-cell">{formatDatePH(inv.invoice_date)}</td>
                          <td className="data-table-cell-right">{formatMoney(invoiceAmount)}</td>
                          <td className="data-table-cell-right text-green-700 font-semibold">{formatMoney(paidAmount)}</td>
                          <td className="data-table-cell-right font-semibold" style={{ color: balance > 0 ? "#dc2626" : "#16a34a" }}>
                            {formatMoney(Math.max(0, balance))}
                          </td>
                          <td className="data-table-cell">
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                                balance === 0
                                  ? "bg-green-100 text-green-800"
                                  : inv.status === "paid"
                                  ? "bg-green-100 text-green-800"
                                  : inv.status === "overdue"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {balance === 0 ? "paid" : inv.status || "pending"}
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
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Payments</div>
                  <button className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white" onClick={() => setShowAddPayment(true)}>
                    Add payment
                  </button>
                </div>

                <div className="mt-3">
                  <table className="data-table">
                    <colgroup>
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "16%" }} />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Transaction ID</th>
                        <th className="data-table-head-cell">Invoice #</th>
                        <th className="data-table-head-cell">Date</th>
                        <th className="data-table-head-cell-right">Amount</th>
                        <th className="data-table-head-cell">Mode</th>
                        <th className="data-table-head-cell">Status</th>
                        <th className="data-table-head-cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((pay: any, index: number) => {
                        const modeData = paymentModes.find(m => m.code === pay.details?.payment_mode_code);
                        const statusBadgeColor = pay.status === 'verified' ? 'bg-green-100 text-green-800' 
                          : pay.status === 'pending' ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800';
                        const isVoided = !!pay.voided_at;
                        
                        return (
                          <tr key={pay.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                            <td className="data-table-cell">{pay.transaction_id || "—"}</td>
                            <td className="data-table-cell">{(pay as any).invoices?.invoice_number ?? "—"}</td>
                            <td className="data-table-cell">{formatDatePH(pay.payment_date)}</td>
                            <td className="data-table-cell-right text-green-700 font-semibold">{formatMoney(pay.amount)}</td>
                            <td className="data-table-cell">
                              {modeData?.name || pay.details?.payment_mode_name || "—"}
                            </td>
                            <td className="data-table-cell">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeColor} ${isVoided ? 'line-through opacity-60' : ''}`}>
                                {isVoided ? 'voided' : pay.status || 'pending'}
                              </span>
                            </td>
                            <td className="data-table-cell-right">
                              <div className="flex gap-1 justify-end">
                                {pay.status === 'verified' && !isVoided && (
                                  <button 
                                    className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    title="Issue receipt for verified payment"
                                    onClick={() => handleGenerateReceipt(pay.id)}
                                    disabled={busy}
                                  >
                                    Receipt
                                  </button>
                                )}
                                {pay.status === 'pending' && !isVoided && (
                                  <button 
                                    className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                    title="Verify this pending payment"
                                    onClick={() => setVerifyingPaymentId(pay.id)}
                                    disabled={busy}
                                  >
                                    Verify
                                  </button>
                                )}
                                {!isVoided && (
                                  <button 
                                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                                    title="Void this payment"
                                    onClick={() => setVoidingPaymentId(pay.id)}
                                    disabled={busy}
                                  >
                                    Void
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {payments.length === 0 ? (
                        <tr>
                          <td className="data-table-empty" colSpan={7}>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setShowCreateInvoice(false)} onDoubleClick={(e) => e.target === e.currentTarget && setShowCreateInvoice(false)}>
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
                          {formatDatePH(d)}{orthoDateSet.has(d) ? " (ORTHO)" : ""}
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

                    {/* Ortho Visits section */}
                    {orthoVisits.length > 0 && (
                      <div className="mb-4">
                        {(() => {
                          // Calculate total treatment/service/addon/package count
                          let totalItemCount = 0;
                          orthoVisits.forEach((entry: OrthoEntry) => {
                            const items = orthoVisitItems.filter((item) => item.ortho_entry_id === entry.id);
                            const chargedItems = items.filter((item) => item.is_charged);
                            if (entry.invoice_package && orthoCase?.package_service_id) {
                              totalItemCount++;
                            }
                            totalItemCount += chargedItems.length;
                          });
                          
                          return (
                            <>
                              <div className="text-sm font-semibold mb-2">Treatments on {formatDatePH(selectedVisitDate)} ({totalItemCount}) - ORTHO</div>
                              <div className="space-y-2 mb-4 pb-4 border-b">
                                {orthoVisits.map((entry: OrthoEntry) => {
                                  const items = orthoVisitItems.filter((item) => item.ortho_entry_id === entry.id);
                                  const chargedItems = items.filter((item) => item.is_charged);
                                  
                                  return (
                                    <div key={entry.id} className="space-y-2">
                                      {/* Package row (if invoice_package is true) */}
                                      {entry.invoice_package && orthoCase?.package_service_id && (
                                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                          <div className="flex-1">
                                            <div className="text-sm">{servicePrices.find((s) => s.id === orthoCase.package_service_id)?.service_name || "Ortho Package"}</div>
                                          </div>
                                          <div className="text-sm font-semibold text-slate-900">{formatMoney(num(orthoCase.package_fee || 0))}</div>
                                        </div>
                                      )}
                                      
                                      {/* Charged services rows */}
                                      {chargedItems.map((item: OrthoEntryItem) => {
                                        const svc = servicePrices.find((s) => s.id === item.service_id);
                                        const price = (svc as any)?.default_price || 0;
                                        
                                        return (
                                          <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                            <div className="flex-1">
                                              <div className="text-sm">{svc?.service_name || "Service"}</div>
                                              {item.service_detail && <div className="text-xs text-slate-500">{item.service_detail}</div>}
                                            </div>
                                            <div className="text-sm font-semibold text-slate-900">{formatMoney(price)}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Summary totals */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-semibold">{formatMoney(subtotal)}</span>
                      </div>
                      {showDiscount && (
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Discount code/description"
                              className="h-9 rounded-lg border bg-white px-2 text-sm flex-1"
                              value={discountDescription}
                              onChange={(e) => setDiscountDescription(e.target.value)}
                            />
                            <span className="text-sm font-semibold text-red-600">−</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              className="h-9 rounded-lg border bg-white px-2 text-sm w-24"
                              value={discountAmount}
                              onChange={(e) => setDiscountAmount(e.target.value)}
                              step="0.01"
                            />
                          </div>
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
                  <button className="cancel-btn" onClick={() => setShowCreateInvoice(false)}>
                    Cancel
                  </button>
                  <button
                    className="save-btn"
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

        {/* Add payment modal */}
        {showAddPayment ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setShowAddPayment(false)} onDoubleClick={(e) => e.target === e.currentTarget && setShowAddPayment(false)}>
            <div className="w-full max-w-md rounded-2xl border bg-white p-6">
              <h2 className="text-lg font-semibold">Add payment</h2>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-2 text-sm">
                  <label className="text-slate-700 font-medium">Invoices</label>
                  
                  {/* Individual checkboxes */}
                  <div className="space-y-2 border rounded-lg bg-slate-50 p-3">
                    {invoices
                      .map((inv: any) => {
                        const invoicePayments = payments.filter((p) => p.invoice_id === inv.id && !p.voided_at);
                        const totalPaid = invoicePayments.reduce((sum, p) => sum + num(p.amount), 0);
                        const balance = num(inv.total) - totalPaid;
                        return { inv, balance };
                      })
                      .filter(({ balance }) => balance > 0)
                      .map(({ inv, balance }) => {
                        const isSelected = selectedInvoiceIds.includes(inv.id);
                        return (
                          <label key={inv.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedInvoiceIds([...selectedInvoiceIds, inv.id]);
                                } else {
                                  setSelectedInvoiceIds(selectedInvoiceIds.filter(id => id !== inv.id));
                                }
                              }}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm">
                              <span className="font-bold">{inv.invoice_number}</span>
                              {' '}— {formatDatePH(inv.invoice_date)} — Bal: {formatMoney(balance)}
                            </span>
                          </label>
                        );
                      })}
                  </div>

                  {/* Total balance display */}
                  {selectedInvoiceIds.length > 0 && (
                    <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                      <div className="font-semibold text-blue-700">Total balance: {formatMoney(
                        selectedInvoiceIds.reduce((sum, invoiceId) => {
                          const inv = invoices.find((i: any) => i.id === invoiceId);
                          if (!inv) return sum;
                          const invoicePayments = payments.filter((p) => p.invoice_id === invoiceId && !p.voided_at);
                          const totalPaid = invoicePayments.reduce((s, p) => s + num(p.amount), 0);
                          const balance = num(inv.total) - totalPaid;
                          return sum + balance;
                        }, 0)
                      )}</div>
                    </div>
                  )}
                </div>

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

                {/* Validation message for amount exceeding balance */}
                {selectedInvoiceIds.length > 0 && paymentAmount && (() => {
                  const totalAvailableBalance = selectedInvoiceIds.reduce((sum, invoiceId) => {
                    const inv = invoices.find((i: any) => i.id === invoiceId);
                    if (!inv) return sum;
                    const invoicePayments = payments.filter((p) => p.invoice_id === invoiceId && !p.voided_at);
                    const totalPaid = invoicePayments.reduce((s, p) => s + num(p.amount), 0);
                    const balance = num(inv.total) - totalPaid;
                    return sum + balance;
                  }, 0);
                  const paymentAmountNum = parseFloat(paymentAmount);
                  if (paymentAmountNum > totalAvailableBalance) {
                    return (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                        Payment amount ({formatMoney(paymentAmountNum)}) exceeds total balance ({formatMoney(totalAvailableBalance)})
                      </div>
                    );
                  }
                  return null;
                })()}

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Payment date</span>
                  <input type="date" className="h-10 rounded-lg border px-3" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Payment mode</span>
                  <select
                    className="h-10 rounded-lg border bg-white px-3"
                    value={selectedPaymentMode?.code || ""}
                    onChange={(e) => {
                      const mode = paymentModes.find(m => m.code === e.target.value) || null;
                      setSelectedPaymentMode(mode);
                    }}
                  >
                    <option value="">Select mode</option>
                    {paymentModes.map((mode: PaymentMode) => (
                      <option key={mode.id} value={mode.code}>
                        {mode.name}
                        {!mode.auto_verifies && " (needs verification)"}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedPaymentMode?.requires_reference && (
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Reference number *</span>
                    <input
                      type="text"
                      className="h-10 rounded-lg border px-3"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder={`Required for ${selectedPaymentMode.name}`}
                    />
                  </label>
                )}

                {selectedPaymentMode?.requires_proof && (
                  <div className="grid gap-1">
                    <span className="text-sm text-slate-700 font-medium">Proof file *</span>
                    <label className="relative group">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                      />
                      <div className={`
                        flex items-center justify-center gap-3 p-4 rounded-lg border-2 border-dashed transition cursor-pointer
                        ${paymentProofFile 
                          ? 'border-green-300 bg-green-50 hover:bg-green-100' 
                          : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
                        }
                      `}>
                        <svg className={`w-5 h-5 flex-shrink-0 ${paymentProofFile ? 'text-green-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {paymentProofFile ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          )}
                        </svg>
                        <div className="text-left">
                          {paymentProofFile ? (
                            <div>
                              <div className={`text-sm font-medium ${paymentProofFile ? 'text-green-700' : 'text-slate-700'}`}>
                                {paymentProofFile.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {(paymentProofFile.size / 1024).toFixed(0)} KB
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm font-medium text-slate-700">
                                Drop file or click to select
                              </div>
                              <div className="text-xs text-slate-500">
                                JPG, PNG, PDF (max 10MB)
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button className="cancel-btn" onClick={() => {
                    setShowAddPayment(false);
                    setSelectedInvoiceIds([]);
                    setPaymentAmount("");
                    setPaymentReference("");
                    setPaymentProofFile(null);
                    setSelectedPaymentMode(null);
                  }}>
                    Cancel
                  </button>
                  <button className="save-btn" disabled={busy} onClick={addPayment}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Verify payment modal */}
        {verifyingPaymentId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setVerifyingPaymentId(null)} onDoubleClick={(e) => e.target === e.currentTarget && setVerifyingPaymentId(null)}>
            <div className="w-full max-w-md rounded-2xl border bg-white p-6">
              <h2 className="text-lg font-semibold">Verify Payment</h2>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to mark this payment as verified?
              </p>

              <div className="mt-6 flex justify-end gap-2">
                <button className="cancel-btn" onClick={() => setVerifyingPaymentId(null)} disabled={busy}>
                  Cancel
                </button>
                <button className="save-btn" disabled={busy} onClick={verifyPayment}>
                  {busy ? "Verifying..." : "Verify"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Void payment modal */}
        {voidingPaymentId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setVoidingPaymentId(null)} onDoubleClick={(e) => e.target === e.currentTarget && setVoidingPaymentId(null)}>
            <div className="w-full max-w-md rounded-2xl border bg-white p-6">
              <h2 className="text-lg font-semibold">Void Payment</h2>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Reason for voiding *</span>
                  <textarea
                    className="min-h-[80px] rounded-lg border px-3 py-2"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="E.g., Duplicate payment, customer request, etc."
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button className="cancel-btn" onClick={() => {
                    setVoidingPaymentId(null);
                    setVoidReason("");
                  }} disabled={busy}>
                    Cancel
                  </button>
                  <button className="save-btn" disabled={busy || !voidReason.trim()} onClick={handleVoidPayment}>
                    {busy ? "Voiding..." : "Void Payment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

      {viewingInvoice ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50" onClick={(e) => e.target === e.currentTarget && setViewingInvoice(null)} onDoubleClick={(e) => e.target === e.currentTarget && setViewingInvoice(null)}>
          <div className="max-h-screen overflow-y-auto rounded-2xl border bg-white w-full max-w-2xl">
            <div className="sticky top-0 border-b bg-white p-4">
              <div className="text-lg font-semibold">Invoice {viewingInvoice.invoice_number}</div>
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
    </>
  );
}
