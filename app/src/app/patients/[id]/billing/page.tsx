"use client";

import { FeatureGate } from "@/components/shared/FeatureGate";

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
import { formatMoney, formatDateStandard, todayLocalISO, splitFullName, formatPatientNameFormal } from "@/lib/helpers";
import { useClinic } from "@/contexts/ClinicContext";
import { getActivePaymentModes } from "@/lib/paymentModeHelpers";
import { generateReceipt, voidPayment } from "@/lib/receiptHelpers";
import { getNextTransactionNumber, getNextInvoiceNumber } from "@/lib/numberGenerationHelpers";
import { generateInvoiceDocument, generatePaymentReceiptDocument } from "@/lib/invoiceReceiptGenerators";
import { openDocumentViewer } from "@/components/DocumentViewer";
import { CreateInvoiceModal } from "./CreateInvoiceModal";
import { AddPaymentModal } from "./AddPaymentModal";
import { VerifyPaymentModal } from "./VerifyPaymentModal";
import { VoidPaymentModal } from "./VoidPaymentModal";
import { ViewInvoiceModal } from "./ViewInvoiceModal";
import { PaymentReminderModal } from "./PaymentReminderModal";
import { PageLoader, Spinner } from "@/components/Spinner";
import { TableOptions, type ColumnConfig } from "@/components/shared/TableOptions";


/* Helpers */
function num(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function BillingPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { clinicId, isLoading: clinicLoading } = useClinic();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRowExtended[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode | null>(null);

  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showPaymentReminder, setShowPaymentReminder] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(() => todayLocalISO());
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => todayLocalISO());
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentReceivedBy, setPaymentReceivedBy] = useState<string>("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

  const [billingSortConfig, setBillingSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "invoice_date", direction: "desc" });
  const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);
  const [verifyingPaymentDetails, setVerifyingPaymentDetails] = useState<any | null>(null);
  const [verificationConfirmation, setVerificationConfirmation] = useState("");
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
        .filter((t) => t.treatment_date === visitDate)
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
    if (clinicLoading || !id || !clinicId) return;
    setLoading(true);
    setError(null);

    // Load patient info
    const p = await supabase.from("patients").select("*").eq("id", id).eq("clinic_id", clinicId).single();
    if (!p.error && p.data) {
      const patRaw = p.data;
      const fallback = splitFullName(patRaw.full_name ?? "");
      const dbFirst = String(patRaw.first_name ?? "").trim();
      const dbLast = String(patRaw.last_name ?? "").trim();
      const firstNameFinal = dbFirst || fallback.first;
      const lastNameFinal = dbLast || fallback.last;

      setPatient({
        id: patRaw.id,
        clinic_id: patRaw.clinic_id,
        full_name: patRaw.full_name,
        first_name: firstNameFinal,
        middle_name: patRaw.middle_name ?? null,
        last_name: lastNameFinal,
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

    const inv = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, status, total, created_at")
      .eq("clinic_id", clinicId)
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
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      

      allPayments = pay.error === null && pay.data ? pay.data : [];
    }
    
    setPayments(allPayments);

    setLoading(false);
  }, [clinicLoading, id, clinicId]);

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
        .eq("clinic_id", clinicId)
        .eq("patient_id", id)
        .not("treatment_date", "is", null)
        .order("treatment_date", { ascending: false });

      const treatmentDates = (treatments || []).map((t: any) => t.treatment_date);

      // Load ortho entry dates (from ortho cases)
      let orthoDates: string[] = [];
      try {
        // First, get all ortho cases for this patient
        const { data: cases, error: casesError } = await supabase
          .from("ortho_cases")
          .select("*")
          .eq("clinic_id", clinicId)
          .eq("patient_id", id);


        if (!casesError && cases && cases.length > 0) {
          const caseIds = (cases as any[]).map((c: any) => c.id);
          
          // Then get all entries for those cases
          const { data: entries, error: entriesError } = await supabase
            .from("ortho_entries")
            .select("entry_date")
            .in("ortho_case_id", caseIds)
            .order("entry_date", { ascending: false });


          if (!entriesError && entries) {
            orthoDates = (entries as any[]).map((e: any) => e.entry_date);
          }
        }
      } catch (e) {
        console.error("Error loading ortho dates:", e);
      }


      // Combine all dates
      const allDates = [...new Set([...treatmentDates, ...orthoDates])];
      
      // Get dates that already have invoices to exclude them
      const { data: invoices, error: invoiceError } = await supabase
        .from("invoices")
        .select("invoice_date")
        .eq("clinic_id", clinicId)
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
      
      setVisitDates(availableDates);
      setOrthoDateSet(new Set(orthoDates));

      const { data: prices, error: pricesError } = await supabase
        .from("service_prices")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("service_name", { ascending: true });

      if (!pricesError && prices) {
        setServicePrices(prices as ServicePriceRow[]);
      }
    }

    loadVisitData();
  }, [id, clinicId]);

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
        .select("id, clinic_id, treatment_date, procedure, tooth_number, notes, visit_concern, dentist_id, dentist_name, service_price_id, created_at")
        .eq("patient_id", id)
        .eq("clinic_id", clinicId)
        .eq("treatment_date", selectedVisitDate)
        .order("created_at", { ascending: true });

      if (treatmentsError === null && treatments && treatments.length > 0) {
        const mapped = treatments.map((t: any) => ({
          id: t.id,
          clinic_id: t.clinic_id,
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

      // Check if this date has ortho entries — same pattern as loadVisitData
      const { data: cases, error: casesError } = await supabase
        .from("ortho_cases")
        .select("*")
        .eq("clinic_id", clinicId)
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
    setError(null);

    if (!selectedVisitDate) return setError("Select a visit date.");
    
    // Check which type of invoice to create
    if (selectedVisitType === "treatment") {
      if (visitTreatments.length === 0) return setError("No treatments found for this visit.");
    } else if (selectedVisitType === "ortho") {
      if (orthoVisits.length === 0) return setError("No ortho visits found for this date.");
    } else {
      return setError("No visit data found for the selected date.");
    }

    setBusy(true);

    try {
      const invoiceNumber = await getNextInvoiceNumber(clinicId);

      // Create invoice with appropriate type
      const invoiceType = selectedVisitType === "ortho" ? "ortho" : "regular";

      const ins = await supabase.from("invoices").insert({
        clinic_id: clinicId,
        patient_id: id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        total: invoiceTotal,
        status: "unpaid",
        invoice_type: invoiceType,
      }).select().single();

      if (ins.error) {
        setBusy(false);
        return setError(ins.error.message);
      }

      const invoiceId = ins.data?.id;
      
      if (!invoiceId) {
        setBusy(false);
        return setError("Failed to create invoice.");
      }

      // Handle treatment items
      if (selectedVisitType === "treatment") {
        const itemsToInsert = visitTreatments
          .filter((t) => t.treatment_date === selectedVisitDate)
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
          return setError(itemsIns.error.message);
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
                source_type: "ortho_entry",
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
            return setError(itemsIns.error.message);
          }
        }
      }

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
      console.error("[createInvoice] FATAL ERROR:", error);
      console.error("[createInvoice] Error type:", typeof error);
      console.error("[createInvoice] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      setBusy(false);
      setError(error instanceof Error ? error.message : "Failed to create invoice");
    }
  }

  async function verifyPayment() {
    if (!verifyingPaymentId) return;
    
    // Require confirmation phrase
    if (verificationConfirmation.toUpperCase() !== "VERIFY") {
      setError('Type "VERIFY" to confirm payment');
      return;
    }

    setError(null);
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
        .eq("id", verifyingPaymentId)
        .eq("clinic_id", clinicId);

      if (error) throw error;

      // Auto-generate receipt for verified payment
      const userSession = await supabase.auth.getSession();
      const userId = userSession.data?.session?.user?.id;
      if (userId) {
        try {
          await generateReceipt(verifyingPaymentId, userId, userId, clinicId);
        } catch (receiptError) {
          console.error("[verifyPayment] Warning: Receipt generation failed (non-fatal):", receiptError);
        }
      }

      setVerifyingPaymentId(null);
      setVerifyingPaymentDetails(null);
      setVerificationConfirmation("");
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to verify payment");
    } finally {
      setBusy(false);
    }
  }

  async function handleVoidPayment() {
    if (!voidingPaymentId || !voidReason.trim()) {
      setError("Please provide a reason for voiding");
      return;
    }

    setError(null);
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
      setError(error instanceof Error ? error.message : "Failed to void payment");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateReceipt(paymentId: string) {
    setError(null);
    setBusy(true);

    try {
      const userSession = await supabase.auth.getSession();
      const userId = userSession.data?.session?.user?.id;
      const userEmail = userSession.data?.session?.user?.email ?? "Unknown";
      if (!userId) throw new Error("User not authenticated");

      // For now, use current user as both staff and issuer
      const receipt = await generateReceipt(paymentId, userId, userId, clinicId);

      alert(`Receipt ${receipt[0].receipt_number} generated successfully!`);
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to generate receipt");
    } finally {
      setBusy(false);
    }
  }

  async function addPayment() {
    if (!id) return;
    setError(null);

    if (selectedInvoiceIds.length === 0) return setError("Select at least one invoice.");
    if (!paymentAmount) return setError("Enter payment amount.");
    if (!selectedPaymentMode) return setError("Select payment mode.");

    // Validate mode-specific requirements
    if (selectedPaymentMode.requires_reference && !paymentReference) {
      return setError(`${selectedPaymentMode.name} requires a reference number.`);
    }
    if (selectedPaymentMode.requires_proof && !paymentProofFile) {
      return setError(`${selectedPaymentMode.name} requires a proof file.`);
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
      return setError(`Payment amount (${formatMoney(paymentAmountNum)}) exceeds total balance (${formatMoney(totalAvailableBalance)}) of selected invoices.`);
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

      // Add "received_by" for cash payments
      if (selectedPaymentMode.code === "CASH" && paymentReceivedBy) {
        paymentDetails.received_by = paymentReceivedBy;
      }

      // Store proof file as data URL if provided
      if (paymentProofFile && selectedPaymentMode.requires_proof) {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            paymentDetails.proof_file_data = reader.result as string; // Data URL as string
            paymentDetails.proof_file_name = paymentProofFile.name;
            resolve();
          };
          reader.onerror = () => reject(new Error("Failed to read proof file"));
          reader.readAsDataURL(paymentProofFile);
        });
      }

      const status = selectedPaymentMode.auto_verifies || selectedPaymentMode.code === "CASH" ? "verified" : "pending";
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
          const transactionId = await getNextTransactionNumber(clinicId);
          paymentRecords.push({
            clinic_id: clinicId,
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

      const ins = await supabase.from("payments").insert(paymentRecords).select();

      if (ins.error) {
        throw ins.error;
      }

      // Auto-generate receipts for verified payments
      if (status === "verified" && ins.data && userId) {
        try {
          const paymentData = ins.data as any[];
          if (Array.isArray(paymentData) && paymentData.length > 0) {
            for (const payment of paymentData) {
              try {
                await generateReceipt(payment.id, userId, userId, clinicId);
              } catch (singleReceiptError) {
                // Receipt generation failed silently
              }
            }
          }
        } catch (receiptError) {
          // Receipt generation block error
        }
      }

      setShowAddPayment(false);
      setSelectedInvoiceIds([]);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentReceivedBy("");
      setPaymentProofFile(null);
      setSelectedPaymentMode(null);
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to add payment");
    } finally {
      setBusy(false);
    }
  }
  const BILLING_COLUMNS: ColumnConfig[] = [
    { key: "date",    label: "Date",           required: true },
    { key: "number",  label: "Invoice #" },
    { key: "amount",  label: "Invoice Amount" },
    { key: "paid",    label: "Paid" },
    { key: "balance", label: "Balance" },
    { key: "status",  label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  const sortedInvoices = [...invoices].sort((a, b) => {
    const { key, direction } = billingSortConfig;
    const dir = direction === "asc" ? 1 : -1;
    if (key === "invoice_date") {
      return dir * (a.invoice_date ?? "").localeCompare(b.invoice_date ?? "");
    }
    if (key === "total") {
      return dir * ((a.total ?? 0) - (b.total ?? 0));
    }
    if (key === "status") {
      return dir * (a.status ?? "").localeCompare(b.status ?? "");
    }
    return 0;
  });

  if (loading) {
    return (
      <PageLoader />
    );
  }

  return (
    <>
      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-white p-3 text-sm text-red-600">{error}</div> : null}

            {/* Billing Overview (MUST COME FIRST) */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Billing Overview</div>
                {billingOverview.balance > 0 && (
                  <button
                    className="cancel-btn flex items-center gap-1.5"
                    onClick={() => setShowPaymentReminder(true)}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.327 5.502 3.414 7.271V22l3.107-1.707A11.05 11.05 0 0012 20.486c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.07 12.447l-2.545-2.713-4.963 2.713 5.461-5.797 2.607 2.713 4.9-2.713-5.46 5.797z"/>
                    </svg>
                    Send Reminder
                  </button>
                )}
              </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="text-xs text-blue-600 font-medium">Total Invoiced</div>
                    <div className="text-lg font-semibold text-blue-900">{formatMoney(billingOverview.totalInvoiced)}</div>
                  </div>

                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="text-xs text-green-600 font-medium">Total Paid</div>
                    <div className="text-lg font-semibold text-green-900">{formatMoney(billingOverview.totalPaid)}</div>
                  </div>

                  <div className={`rounded-lg border p-3 ${billingOverview.balance > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-gray-50"}`}>
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
                  <div className="flex items-center gap-2">
                    <TableOptions
                      tableName="billing_invoices"
                      columns={BILLING_COLUMNS}
                      sorts={[
                        { key: "invoice_date", label: "Date" },
                        { key: "total",        label: "Total" },
                        { key: "status",       label: "Status" },
                      ]}
                      currentSort={billingSortConfig}
                      onSortChange={(k, d) => setBillingSortConfig({ key: k, direction: d })}
                      data={invoices}
                      onDownloadCSV={() => {}}
                    />
                    <button
                      className="save-btn"
                      onClick={() => setShowCreateInvoice(true)}
                    >
                      Create invoice
                    </button>
                  </div>
                </div>

                <div className="table-wrapper hidden md:block">
                  <table className="data-table">
                    <colgroup>
                      <col className="col-16" />
                      <col className="col-15" />
                      <col className="col-16" />
                      <col className="col-14" />
                      <col className="col-14" />
                      <col className="col-12" />
                      <col className="col-13" />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Date</th>
                        <th className="data-table-head-cell">Invoice #</th>
                        <th className="data-table-head-cell-right">Invoice Amount</th>
                        <th className="data-table-head-cell-right">Paid</th>
                        <th className="data-table-head-cell-right">Balance</th>
                        <th className="data-table-head-cell">Status</th>
                        <th className="data-table-head-cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sortedInvoices as unknown[]).map((invRaw, index: number) => {
                        const inv = invRaw as Invoice & { invoice_type?: string };
                        const invoiceAmount = inv.total ?? 0;
                        const paidAmount = payments
                          .filter((p: any) => p.invoice_id === inv.id && !p.voided_at)
                          .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
                        const balance = invoiceAmount - paidAmount;
                        return (
                        <tr key={inv.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                          <td className="data-table-cell">{formatDateStandard(inv.invoice_date)}</td>
                          <td className="data-table-cell">
                            <div className="inline-row">
                              <span>{inv.invoice_number}</span>
                              {/* Show Ortho badge only for ortho invoices */}
                              {inv.invoice_type === "ortho" && (
                                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                                  Ortho
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="data-table-cell-right">{formatMoney(invoiceAmount)}</td>
                          <td className="data-table-cell-right text-green-700 font-semibold">{formatMoney(paidAmount)}</td>
                          <td className={`data-table-cell-right font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
                              title="Open invoice document"
                              onClick={async () => {
                                try {
                                  setBusy(true);
                                  const html = await generateInvoiceDocument(
                                    inv.id,
                                    formatPatientNameFormal(patient?.first_name ?? null, patient?.middle_name ?? null, patient?.last_name ?? null),
                                    inv.invoice_number ?? "",
                                    formatDateStandard(inv.invoice_date),
                                  );
                                  openDocumentViewer({
                                    html,
                                    docType: "INVOICE",
                                    docNumber: inv.invoice_number ?? "",
                                  });
                                } catch (error) {
                                  console.error("Error generating invoice document:", error);
                                  alert("Failed to generate invoice document");
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              disabled={busy}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                      {sortedInvoices.length === 0 ? (
                        <tr>
                          <td className="data-table-empty" colSpan={7}>
                            No invoices yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {/* Mobile invoice cards */}
                <div className="mt-3 grid gap-2 md:hidden">
                  {sortedInvoices.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">No invoices yet.</div>
                  ) : (sortedInvoices as unknown[]).map((invRaw) => {
                    const inv = invRaw as Invoice & { invoice_type?: string };
                    const invoiceAmount = inv.total ?? 0;
                    const paidAmount = payments.filter((p: any) => p.invoice_id === inv.id && !p.voided_at).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
                    const balance = invoiceAmount - paidAmount;
                    return (
                      <div key={inv.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 text-sm">{inv.invoice_number}</span>
                              {inv.invoice_type === "ortho" && <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">Ortho</span>}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{formatDateStandard(inv.invoice_date)}</div>
                          </div>
                          <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${balance === 0 ? "bg-green-100 text-green-800" : inv.status === "overdue" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                            {balance === 0 ? "paid" : inv.status || "pending"}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs border-t border-slate-50 pt-2">
                          <div><div className="text-slate-400">Amount</div><div className="font-semibold text-slate-800">{formatMoney(invoiceAmount)}</div></div>
                          <div><div className="text-slate-400">Paid</div><div className="font-semibold text-green-700">{formatMoney(paidAmount)}</div></div>
                          <div><div className="text-slate-400">Balance</div><div className={`font-semibold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>{formatMoney(Math.max(0, balance))}</div></div>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <button className="data-table-btn" disabled={busy} onClick={async () => { try { setBusy(true); const html = await generateInvoiceDocument(inv.id, formatPatientNameFormal(patient?.first_name ?? null, patient?.middle_name ?? null, patient?.last_name ?? null), inv.invoice_number ?? "", formatDateStandard(inv.invoice_date)); openDocumentViewer({ html, docType: "INVOICE", docNumber: inv.invoice_number ?? "" }); } catch { alert("Failed to generate invoice document"); } finally { setBusy(false); } }}>Open</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payments */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Payments</div>
                  <button className="save-btn" onClick={() => setShowAddPayment(true)}>
                    Add payment
                  </button>
                </div>

                <div className="table-wrapper hidden md:block">
                  <table className="data-table">
                    <colgroup>
                      <col className="col-14" />
                      <col className="col-18" />
                      <col className="col-16" />
                      <col className="col-14" />
                      <col className="col-13" />
                      <col className="col-25" />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Date</th>
                        <th className="data-table-head-cell">Transaction ID</th>
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
                            <td className="data-table-cell">{formatDateStandard(pay.payment_date)}</td>
                            <td className="data-table-cell">{pay.transaction_id || "—"}</td>
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
                                {pay.status === 'pending' && !isVoided && (
                                  <button
                                    className="data-table-btn-warning"
                                    title="Verify this pending payment"
                                    onClick={async () => {
                                      try {
                                        const { data: fullPayment, error } = await supabase
                                          .from("payments")
                                          .select("*")
                                          .eq("id", pay.id)
                                          .eq("clinic_id", clinicId)
                                          .single();
                                        if (error) throw error;
                                        setVerifyingPaymentDetails(fullPayment);
                                        setVerifyingPaymentId(pay.id);
                                        setVerificationConfirmation("");
                                      } catch (error) {
                                        console.error("Error fetching payment details:", error);
                                        setError("Failed to load payment details");
                                      }
                                    }}
                                    disabled={busy}
                                  >
                                    Verify
                                  </button>
                                )}
                                {pay.status === 'verified' && !isVoided && (
                                  <button
                                    className="data-table-btn"
                                    title="View payment receipt"
                                    onClick={async () => {
                                      try {
                                        setBusy(true);
                                        const html = await generatePaymentReceiptDocument(
                                          pay.id,
                                          formatPatientNameFormal(patient?.first_name ?? null, patient?.middle_name ?? null, patient?.last_name ?? null),
                                          pay.transaction_id || "PMT00000",
                                        );
                                        openDocumentViewer({
                                          html,
                                          docType: "PAYMENT_RECEIPT",
                                          docNumber: pay.transaction_id || "PMT00000",
                                        });
                                      } catch (error) {
                                        console.error("Error generating receipt:", error);
                                        alert("Failed to generate receipt");
                                      } finally {
                                        setBusy(false);
                                      }
                                    }}
                                    disabled={busy}
                                  >
                                    View
                                  </button>
                                )}
                                {!isVoided && (
                                  <button
                                    className="data-table-btn-danger"
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
                          <td className="data-table-empty" colSpan={6}>
                            No payments yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {/* Mobile payment cards */}
                <div className="mt-3 grid gap-2 md:hidden">
                  {payments.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">No payments yet.</div>
                  ) : payments.map((pay: any) => {
                    const modeData = paymentModes.find((m: any) => m.code === pay.details?.payment_mode_code);
                    const isVoided = !!pay.voided_at;
                    const statusColor = pay.status === 'verified' ? 'bg-green-100 text-green-800' : pay.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800';
                    return (
                      <div key={pay.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-green-700 text-sm">{formatMoney(pay.amount)}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{formatDateStandard(pay.payment_date)}</div>
                            <div className="text-xs text-slate-500">{modeData?.name || pay.details?.payment_mode_name || "—"}</div>
                          </div>
                          <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${statusColor} ${isVoided ? 'line-through opacity-60' : ''}`}>
                            {isVoided ? 'voided' : pay.status || 'pending'}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-end gap-1.5">
                          {pay.status === 'pending' && !isVoided && (
                            <button className="data-table-btn-warning" disabled={busy} onClick={async () => { try { const { data: fullPayment, error } = await supabase.from("payments").select("*").eq("id", pay.id).eq("clinic_id", clinicId).single(); if (error) throw error; setVerifyingPaymentDetails(fullPayment); setVerifyingPaymentId(pay.id); setVerificationConfirmation(""); } catch { setError("Failed to load payment details"); } }}>Verify</button>
                          )}
                          {pay.status === 'verified' && !isVoided && (
                            <button className="data-table-btn" disabled={busy} onClick={async () => { try { setBusy(true); const html = await generatePaymentReceiptDocument(pay.id, formatPatientNameFormal(patient?.first_name ?? null, patient?.middle_name ?? null, patient?.last_name ?? null), pay.transaction_id || "PMT00000"); openDocumentViewer({ html, docType: "PAYMENT_RECEIPT", docNumber: pay.transaction_id || "PMT00000" }); } catch { alert("Failed to generate receipt"); } finally { setBusy(false); } }}>View</button>
                          )}
                          {!isVoided && (
                            <button className="data-table-btn-danger" disabled={busy} onClick={() => setVoidingPaymentId(pay.id)}>Void</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>


        <CreateInvoiceModal
          open={showCreateInvoice}
          onClose={() => setShowCreateInvoice(false)}
          busy={busy}
          selectedVisitDate={selectedVisitDate}
          setSelectedVisitDate={setSelectedVisitDate}
          invoiceDate={invoiceDate}
          setInvoiceDate={setInvoiceDate}
          visitDates={visitDates}
          orthoDateSet={orthoDateSet}
          visitTreatments={visitTreatments}
          orthoVisits={orthoVisits}
          orthoVisitItems={orthoVisitItems}
          orthoCase={orthoCase}
          servicePrices={servicePrices}
          showDiscount={showDiscount}
          setShowDiscount={setShowDiscount}
          discountDescription={discountDescription}
          setDiscountDescription={setDiscountDescription}
          discountAmount={discountAmount}
          setDiscountAmount={setDiscountAmount}
          subtotal={subtotal}
          invoiceTotal={invoiceTotal}
          onCreateInvoice={createInvoice}
        />

        <AddPaymentModal
          open={showAddPayment}
          onClose={() => setShowAddPayment(false)}
          busy={busy}
          invoices={invoices}
          payments={payments}
          selectedInvoiceIds={selectedInvoiceIds}
          setSelectedInvoiceIds={setSelectedInvoiceIds}
          paymentAmount={paymentAmount}
          setPaymentAmount={setPaymentAmount}
          paymentDate={paymentDate}
          setPaymentDate={setPaymentDate}
          selectedPaymentMode={selectedPaymentMode}
          setSelectedPaymentMode={setSelectedPaymentMode}
          paymentModes={paymentModes}
          paymentReceivedBy={paymentReceivedBy}
          setPaymentReceivedBy={setPaymentReceivedBy}
          paymentReference={paymentReference}
          setPaymentReference={setPaymentReference}
          paymentProofFile={paymentProofFile}
          setPaymentProofFile={setPaymentProofFile}
          onAddPayment={addPayment}
        />

        <VerifyPaymentModal
          open={!!(verifyingPaymentId && verifyingPaymentDetails)}
          onClose={() => {
            setVerifyingPaymentId(null);
            setVerifyingPaymentDetails(null);
            setVerificationConfirmation("");
            setError(null);
          }}
          busy={busy}
          verifyingPaymentDetails={verifyingPaymentDetails}
          verificationConfirmation={verificationConfirmation}
          setVerificationConfirmation={setVerificationConfirmation}
          onVerify={verifyPayment}
        />

        <VoidPaymentModal
          open={!!voidingPaymentId}
          onClose={() => setVoidingPaymentId(null)}
          busy={busy}
          voidReason={voidReason}
          setVoidReason={setVoidReason}
          onVoid={handleVoidPayment}
        />

      <ViewInvoiceModal
          viewingInvoice={viewingInvoice}
          payments={payments}
          onClose={() => setViewingInvoice(null)}
        />

      <PaymentReminderModal
        open={showPaymentReminder}
        patient={patient}
        balance={billingOverview.balance}
        onClose={() => setShowPaymentReminder(false)}
      />
    </>
  );
}

export default function BillingPageGated() {
  return <FeatureGate feature="billing"><BillingPage /></FeatureGate>;
}
