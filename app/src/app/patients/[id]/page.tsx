"use client";

import ToothChart, { getStatusTheme, ToothStatus } from "@/components/ToothChart";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  occupation: string | null;
  email: string | null;
  notes: string | null;
};

type MedHist = {
  id: string;
  allergies: string | null;
  medications: string | null;
  blood_pressure: string | null;
  notes: string | null;
  conditions: any;
};

type ChartEntry = {
  id: string;
  tooth_number: number;
  surfaces: string | null;
  finding_code: string;
  finding_detail?: string | null;
  notes: string | null;
  recorded_at: string;
};

type Treatment = {
  id: string;
  treatment_date: string;
  procedure: string;
  tooth_number: number | null;
  fee: number;
  notes: string | null;
  dentist_name: string | null;
};

type ToothStatusRow = {
  tooth_number: number;
  status: string;
  note: string | null;
  updated_at: string | null;
};

type DocTemplate = {
  id: string;
  name: string;
  doc_type: string;
  content_html: string;
};

type GeneratedDoc = {
  id: string;
  doc_type: string;
  doc_number: string | null;
  payload: any;
  created_at: string;
};

type Attachment = {
  id: string;
  type: string;
  file_path: string;
  file_name: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

type ServicePriceRow = {
  id: string;
  service_name: string;
  default_price: number;
  item_type: "SERVICE" | "ADD_ON";
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

type PaymentRow = {
  id: string;
  payment_date: string;
  amount: number;
  mode: string;
  reference_no: string | null;
  is_installment: boolean;
  installment_note: string | null;
  notes: string | null;
  created_at: string;
};

type EncounterRow = {
  id: string;
  patient_id: string;
  encounter_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  invoice_date: string;
  status: string | null;
  subtotal?: number | null;
  discount_type?: "NONE" | "AMOUNT" | "PERCENT" | null;
  discount_value?: number | null;
  discount_amount?: number | null;
  total?: number | null;
  notes?: string | null;
  created_at?: string;
};

type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  service_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  tooth_number: number | null;
  dentist_name: string | null;
  created_at?: string;
};

type DentistRow = {
  id: string;
  full_name: string;
};

const attachmentTypes = ["XRAY", "PHOTO", "FORM", "LAB", "OTHER"] as const;
type AttachmentType = (typeof attachmentTypes)[number];

const tabs = ["Info", "Medical", "Chart", "Treatments", "Files", "Documents", "Billing"] as const;
type Tab = (typeof tabs)[number];

function num(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function isMissingColumnError(msg: string) {
  return msg.toLowerCase().includes("could not find the") && msg.toLowerCase().includes("column");
}

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("Info");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Patient + edit mode
  const [patient, setPatient] = useState<Patient | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Medical
  const [med, setMed] = useState<MedHist | null>(null);
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [bp, setBp] = useState("");
  const [medNotes, setMedNotes] = useState("");

  // Chart + Tooth status
  const [chart, setChart] = useState<ChartEntry[]>([]);
  const [toothStatuses, setToothStatuses] = useState<
    Record<number, { status: ToothStatus; note: string | null; updated_at?: string }>
  >({});
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [toothNote, setToothNote] = useState("");
  const [surfaceSel, setSurfaceSel] = useState<string[]>([]);
  const [findingDetail, setFindingDetail] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string>("HEALTHY");

  // Chart entry form (kept for later, but currently you use Tooth status editor)
  const [tooth, setTooth] = useState("");
  const [surfaces, setSurfaces] = useState("");
  const [finding, setFinding] = useState("");
  const [chartNotes, setChartNotes] = useState("");

  // Treatments (Visit-style)
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  // Visit header (pick once)
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [visitDentistId, setVisitDentistId] = useState<string>(""); // uses dentists table
  const [visitNote, setVisitNote] = useState("");

  // Draft procedure line inputs
  const [lineTooth, setLineTooth] = useState("");
  const [txServiceId, setTxServiceId] = useState<string>("");
  const [txServiceName, setTxServiceName] = useState<string>("");

  // Draft list
  type DraftLine = {
    id: string;
    tooth_number: number | null;
    service_price_id: string | null;
    procedure: string;
  };
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);

  // Files
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadType, setUploadType] = useState<AttachmentType>("XRAY");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  // Documents
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);

  // Document input fields
  const [docType, setDocType] = useState<"" | "CERTIFICATE" | "RECEIPT">("");
  const [docVisitDate, setDocVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [docFindings, setDocFindings] = useState("");
  const [docTreatmentDone, setDocTreatmentDone] = useState("");
  const [docRemarks, setDocRemarks] = useState("");
  const [docDentistName, setDocDentistName] = useState("");
  const [docPrcLicense, setDocPrcLicense] = useState("");
  const [docReceiptNo, setDocReceiptNo] = useState("");
  const [docItems, setDocItems] = useState("");
  const [docAmountPaid, setDocAmountPaid] = useState("");
  const [docPaymentMethod, setDocPaymentMethod] = useState("Cash");
  const [docBalance, setDocBalance] = useState("");
  const [docIssuedBy, setDocIssuedBy] = useState("");

  // BILLING
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemRow[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<PaymentRow[]>([]);

  const [encounters, setEncounters] = useState<EncounterRow[]>([]);
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);

  // Create encounter
  const [newEncounterDate, setNewEncounterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEncounterNotes, setNewEncounterNotes] = useState("");

    // Billing: visit dates available (from Treatments)
  const visitDates = useMemo(() => {
    const set = new Set<string>();
    for (const t of treatments) {
      if (t.treatment_date) set.add(t.treatment_date);
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [treatments]);

  async function openBillingForVisitDate(date: string) {
    if (!patient) return;

    setBusy(true);
    setErr(null);

    // Ensure invoice exists for this visit date, then rebuild items from Treatments
    const invoiceId = await ensureEncounterInvoice(patient.id, date, undefined);
    if (!invoiceId) {
      setBusy(false);
      return;
    }

    const ok = await syncInvoiceFromTreatments(invoiceId);
    if (!ok) {
      setBusy(false);
      return;
    }

    setActiveInvoiceId(invoiceId);

    // Reload lists + details
    await loadAll();
    await loadInvoiceDetails(invoiceId);

    setBusy(false);
  }

  // Create invoice
  const [newInvoiceDate, setNewInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newInvoiceNotes, setNewInvoiceNotes] = useState("");

  const [serviceMenu, setServiceMenu] = useState<ServicePriceRow[]>([]);

  // Dentists
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [txDentistId, setTxDentistId] = useState<string | null>(null);

  // Discount (may not exist yet in DB)
  const [discType, setDiscType] = useState<"NONE" | "AMOUNT" | "PERCENT">("NONE");
  const [discValue, setDiscValue] = useState("");

  // Add payment (linked to invoice)
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [payInstallment, setPayInstallment] = useState(false);
  const [payInstallNote, setPayInstallNote] = useState("");
  const [payNotes, setPayNotes] = useState("");

  async function loadInvoiceDetails(invoiceId: string) {
    const it = await supabase
      .from("invoice_items")
      .select("id, invoice_id, service_name, qty, unit_price, line_total, tooth_number, dentist_name, created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    if (!it.error && it.data) setInvoiceItems(it.data as InvoiceItemRow[]);
    else setInvoiceItems([]);

    const pay = await supabase
      .from("payments")
      .select("id, payment_date, amount, mode, reference_no, is_installment, installment_note, notes, created_at")
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!pay.error && pay.data) setInvoicePayments(pay.data as PaymentRow[]);
    else setInvoicePayments([]);
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);

    // Patient
    const p = await supabase
      .from("patients")
      .select("id, full_name, phone, birth_date, address, occupation, email, notes")
      .eq("id", id)
      .single();

    if (p.error) {
      setErr(p.error.message);
      setLoading(false);
      return;
    }

    const pat = p.data as Patient;
    setPatient(pat);

    // Initialize edit fields from fetched patient (not from stale state)
    setEditName(pat.full_name ?? "");
    setEditPhone(pat.phone ?? "");
    setEditBirthDate(pat.birth_date ?? "");
    setEditAddress(pat.address ?? "");

    // Medical history (latest)
    const m = await supabase
      .from("patient_medical_histories")
      .select("id, allergies, medications, blood_pressure, notes, conditions")
      .eq("patient_id", id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!m.error && m.data?.length) {
      const row = m.data[0] as MedHist;
      setMed(row);
      setAllergies(row.allergies ?? "");
      setMedications(row.medications ?? "");
      setBp(row.blood_pressure ?? "");
      setMedNotes(row.notes ?? "");
    } else {
      setMed(null);
    }

    // Chart history
    const c = await supabase
      .from("dental_chart_entries")
      .select("id, tooth_number, surfaces, finding_code, finding_detail, notes, recorded_at")
      .eq("patient_id", id)
      .order("recorded_at", { ascending: false });

    if (!c.error && c.data) setChart(c.data as ChartEntry[]);
    else setChart([]);

    // Treatments
    const t = await supabase
      .from("treatments")
      .select("id, treatment_date, procedure, tooth_number, fee, notes, dentist_name")
      .eq("patient_id", id)
      .order("treatment_date", { ascending: false })
      .limit(200);

    if (!t.error && t.data) setTreatments(t.data as Treatment[]);
    else setTreatments([]);

    // Attachments
    const a = await supabase
      .from("attachments")
      .select("id, type, file_path, file_name, content_type, file_size_bytes, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });

    if (!a.error && a.data) setAttachments(a.data as Attachment[]);
    else setAttachments([]);

    // Templates
    const tpl = await supabase
      .from("document_templates")
      .select("id, name, doc_type, content_html")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (!tpl.error && tpl.data) {
      setTemplates(tpl.data as DocTemplate[]);
      if (!selectedTemplateId && tpl.data.length) setSelectedTemplateId(tpl.data[0].id);
    } else {
      setTemplates([]);
    }

    // Generated docs
    const gd = await supabase
      .from("generated_documents")
      .select("id, doc_type, doc_number, payload, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!gd.error && gd.data) setGeneratedDocs(gd.data as GeneratedDoc[]);
    else setGeneratedDocs([]);

    // Tooth statuses
    const s = await supabase
      .from("tooth_statuses")
      .select("tooth_number, status, note, updated_at")
      .eq("patient_id", id);

    if (!s.error && s.data) {
      const map: Record<number, { status: ToothStatus; note: string | null; updated_at?: string }> = {};
      for (const row of s.data as ToothStatusRow[]) {
        map[row.tooth_number] = {
          status: row.status as ToothStatus,
          note: row.note,
          updated_at: row.updated_at ?? undefined,
        };
      }
      setToothStatuses(map);
    } else {
      setToothStatuses({});
    }

    const enc = await supabase
    .from("encounters")
    .select("id, patient_id, encounter_date, notes, created_at")
    .eq("patient_id", id)
    .order("encounter_date", { ascending: false });

  if (!enc.error && enc.data) {
    setEncounters(enc.data as EncounterRow[]);
    if (!activeEncounterId && enc.data.length > 0) setActiveEncounterId(enc.data[0].id);
  }

    // Invoices (use select("*") so it won’t crash if discount columns aren’t created yet)
    const inv = await supabase
    .from("invoices")
    .select("id, encounter_id, invoice_date, status, subtotal, discount_type, discount_value, discount_amount, total, notes, created_at")
    .eq("patient_id", id)
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });

    if (!inv.error && inv.data) {
      const rows = inv.data as InvoiceRow[];
      setInvoices(rows);

      // Set active invoice
      const nextActive = activeInvoiceId ? rows.find((r) => r.id === activeInvoiceId)?.id : null;
      if (!nextActive && rows.length > 0) setActiveInvoiceId(rows[0].id);

      // Sync discount UI from active (if exists)
      const active = rows.find((r) => r.id === (nextActive ?? activeInvoiceId)) ?? rows[0];
      if (active) {
        const dt = (active.discount_type ?? "NONE") as any;
        setDiscType(dt === "AMOUNT" || dt === "PERCENT" ? dt : "NONE");
        setDiscValue(dt === "NONE" ? "" : String(active.discount_value ?? ""));
      }
    } else {
      setInvoices([]);
    }

    const sm = await supabase
    .from("service_prices")
    .select("id, service_name, default_price, item_type, is_active, sort_order, created_at")
    .order("item_type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("service_name", { ascending: true });

  if (!sm.error && sm.data) setServiceMenu(sm.data as ServicePriceRow[]);

    const d = await supabase
    .from("dentists")
    .select("id, full_name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("full_name", { ascending: true });

    if (!d.error && d.data) {
      setDentists(d.data as DentistRow[]);
      if (!visitDentistId && d.data.length > 0) {
        setVisitDentistId(d.data[0].id);
      }
    }         

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (activeInvoiceId) loadInvoiceDetails(activeInvoiceId);
  }, [activeInvoiceId]);

  function toggleSurface(s: string) {
    setSurfaceSel((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function deletePatient() {
    if (!patient) return;

    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      setErr('Type DELETE to confirm.');
      return;
    }

    setBusy(true);
    setErr(null);

    const res = await supabase.from("patients").delete().eq("id", patient.id);

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    window.location.href = "/patients";
  }

  async function saveMedical() {
    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const payload = {
      patient_id: id,
      allergies: allergies.trim() || null,
      medications: medications.trim() || null,
      blood_pressure: bp.trim() || null,
      notes: medNotes.trim() || null,
      conditions: {},
      updated_by: userId,
    };

    const res = med?.id
      ? await supabase.from("patient_medical_histories").update(payload).eq("id", med.id)
      : await supabase.from("patient_medical_histories").insert(payload);

    setBusy(false);
    if (res.error) return setErr(res.error.message);
    await loadAll();
  }

  async function addChartEntry() {
    const toothNum = Number(tooth);
    if (!toothNum || toothNum < 1) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const res = await supabase.from("dental_chart_entries").insert({
      patient_id: id,
      tooth_number: toothNum,
      surfaces: surfaces.trim() || null,
      finding_code: finding.trim(),
      notes: chartNotes.trim() || null,
      recorded_by: userId,
    });

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setTooth("");
    setSurfaces("");
    setFinding("");
    setChartNotes("");
    await loadAll();
  }

  function parseToothOrNull(v: string) {
    const n = v.trim() ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function addDraftLine() {
    setErr(null);

    if (!visitDate) {
      setErr("Select a visit date first.");
      return;
    }
    if (!visitDentistId) {
      setErr("Select the attending dentist first.");
      return;
    }
    if (!txServiceId || !txServiceName.trim()) {
      setErr("Select a procedure/service from the menu.");
      return;
    }

    const toothVal = parseToothOrNull(lineTooth);

    const next: DraftLine = {
      id: crypto.randomUUID(),
      tooth_number: toothVal,
      service_price_id: txServiceId || null,
      procedure: txServiceName.trim(),
    };

    setDraftLines((prev) => [next, ...prev]);

    // clear line inputs
    setLineTooth("");
    setTxServiceId("");
    setTxServiceName("");
  }

  function removeDraftLine(id: string) {
    setDraftLines((prev) => prev.filter((x) => x.id !== id));
  }

  async function saveVisit() {
    if (!patient) return;

    setBusy(true);
    setErr(null);

    // Validate visit basics
    if (!visitDate) {
      setBusy(false);
      setErr("Select a date for this visit.");
      return;
    }

    // Dentist must be selected (neutral state is "")
    if (!visitDentistId) {
      setBusy(false);
      setErr("Select the attending dentist.");
      return;
    }

    const dentistName = dentists.find((d) => d.id === visitDentistId)?.full_name ?? null;
    if (!dentistName) {
      setBusy(false);
      setErr("Select a valid dentist.");
      return;
    }

    if (draftLines.length === 0) {
      setBusy(false);
      setErr("Add at least one procedure for this visit.");
      return;
    }

    // Session (audit)
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    // 1) Ensure encounter + invoice exists for this date
    const invoiceId = await ensureEncounterInvoice(patient.id, visitDate, visitNote);
    if (!invoiceId) {
      setBusy(false);
      return;
    }

    // 2) Fetch encounter_id from the invoice (so treatments can link)
    const inv = await supabase.from("invoices").select("encounter_id").eq("id", invoiceId).single();

    if (inv.error) {
      setBusy(false);
      setErr(inv.error.message);
      return;
    }

    const encounterId = (inv.data as any)?.encounter_id ?? null;
    if (!encounterId) {
      setBusy(false);
      setErr("Invoice was created but encounter_id was missing. Check ensure_encounter_invoice().");
      return;
    }

    // 3) Insert each draft line as a treatment row
    const payload = draftLines.map((ln) => ({
      patient_id: patient.id,
      encounter_id: encounterId,
      treatment_date: visitDate,
      procedure: ln.procedure,
      service_price_id: ln.service_price_id,
      tooth_number: ln.tooth_number,
      notes: visitNote.trim() || null,     // one note per visit (duplicated into rows)
      dentist_name: dentistName,           // human-readable for history/printing
      dentist_id: visitDentistId,          // real dentist reference
      created_by: userId,
    })) as any[];

    const res = await supabase.from("treatments").insert(payload);
    if (res.error) {
      setBusy(false);
      setErr(res.error.message);
      return;
    }

    // 4) Sync invoice items from treatments, then open Billing on that invoice
    const ok = await syncInvoiceFromTreatments(invoiceId);
    if (!ok) {
      setBusy(false);
      return;
    }

    setActiveInvoiceId(invoiceId);

    // Clear visit draft
    setDraftLines([]);
    setVisitNote("");
    setLineTooth("");
    setTxServiceId("");
    setTxServiceName("");

    setBusy(false);
    await loadAll();
    await loadInvoiceDetails(invoiceId);
  }

  async function saveToothStatus(status: string) {
    if (!selectedTooth) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    // Save snapshot
    const up = await supabase.from("tooth_statuses").upsert(
      {
        patient_id: id,
        tooth_number: selectedTooth,
        status,
        note: toothNote.trim() || null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id,tooth_number" }
    );

    if (up.error) {
      setBusy(false);
      setErr(up.error.message);
      return;
    }

    // Append history
    const surfacesToSave =
      status === "CARIES" || status === "FILLED"
        ? (surfaceSel.length ? surfaceSel.slice().sort().join("") : null)
        : null;

    const hist = await supabase.from("dental_chart_entries").insert({
      patient_id: id,
      tooth_number: selectedTooth,
      finding_code: status,
      finding_detail: findingDetail.trim() || null,
      surfaces: surfacesToSave,
      notes: toothNote.trim() || null,
      recorded_by: userId,
    });

    setBusy(false);

    if (hist.error) {
      setErr(hist.error.message);
      return;
    }

    // Clear surfaces if not caries/filled
    if (status !== "CARIES" && status !== "FILLED") setSurfaceSel([]);

    await loadAll();
  }

  function safeFileName(name: string) {
    return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  }

  async function uploadAttachment() {
    if (!fileToUpload) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const base = safeFileName(fileToUpload.name);
    const random = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const path = `${id}/${today}/${random}_${base}`;

    const up = await supabase.storage.from("patient-files").upload(path, fileToUpload, {
      contentType: fileToUpload.type || "application/octet-stream",
      upsert: false,
    });

    if (up.error) {
      setBusy(false);
      setErr(up.error.message);
      return;
    }

    const ins = await supabase.from("attachments").insert({
      patient_id: id,
      type: uploadType,
      file_path: path,
      file_name: fileToUpload.name,
      content_type: fileToUpload.type || null,
      file_size_bytes: fileToUpload.size ?? null,
      uploaded_by: userId,
    });

    setBusy(false);

    if (ins.error) {
      setErr(ins.error.message);
      return;
    }

    setFileToUpload(null);
    await loadAll();
  }

  async function renameAttachment(attachmentId: string, newFileName: string) {
    setBusy(true);
    setErr(null);

    const res = await supabase
      .from("attachments")
      .update({ file_name: newFileName })
      .eq("id", attachmentId);

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    await loadAll();
  }

  async function deleteAttachment(attachmentId: string, storagePath: string) {
    setBusy(true);
    setErr(null);

    // 1) remove from storage bucket
    const bucket = "patient-files";
    const s = await supabase.storage.from(bucket).remove([storagePath]);

    if (s.error) {
      setBusy(false);
      setErr(s.error.message);
      return;
    }

    // 2) remove DB record
    const d = await supabase.from("attachments").delete().eq("id", attachmentId);

    setBusy(false);

    if (d.error) {
      setErr(d.error.message);
      return;
    }

    await loadAll();
  }
  async function savePatientEdits() {
    if (!patient) return;

    setBusy(true);
    setErr(null);

    const res = await supabase
      .from("patients")
      .update({
        full_name: editName.trim(),
        phone: editPhone.trim(),
        birth_date: editBirthDate || null,
        address: editAddress.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", patient.id);

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setEditMode(false);
    await loadAll();
  }

  // ===== BILLING functions =====

  async function recalcInvoice(invoiceId: string) {
    const r = await supabase.rpc("recalc_invoice", { p_invoice_id: invoiceId });
    if (r.error) {
      setErr(r.error.message);
      return false;
    }
    return true;
  }

  async function ensureEncounterInvoice(patientId: string, encounterDate: string, notes?: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id ?? null;

  const r = await supabase.rpc("ensure_encounter_invoice", {
    p_patient_id: patientId,
    p_encounter_date: encounterDate,
    p_notes: notes ?? null,
    p_created_by: userId,
  });

  if (r.error) {
    setErr(r.error.message);
    return null;
  }

  // RPC returns invoice_id (uuid)
  return r.data as string;
  }

  async function syncInvoiceFromTreatments(invoiceId: string) {
    const r = await supabase.rpc("sync_invoice_items_from_treatments", { p_invoice_id: invoiceId });
    if (r.error) {
      setErr(r.error.message);
      return false;
    }
    return true;
  }

  async function createEncounter() {
    if (!patient) return;

    setBusy(true);
    setErr(null);

    const invoiceId = await ensureEncounterInvoice(patient.id, newEncounterDate, newEncounterNotes);
    setBusy(false);

    if (!invoiceId) return;

    // Ensure items reflect treatments for this encounter
    setBusy(true);
    await syncInvoiceFromTreatments(invoiceId);
    setBusy(false);

    setActiveInvoiceId(invoiceId);
    setNewEncounterNotes("");

    await loadAll();
    await loadInvoiceDetails(invoiceId);
  }

  async function applyDiscount() {
    if (!activeInvoiceId) return;

    setBusy(true);
    setErr(null);

    const v = discType === "NONE" ? 0 : Number(discValue);
    if (discType !== "NONE" && (!Number.isFinite(v) || v < 0)) {
      setBusy(false);
      setErr("Enter a valid discount value.");
      return;
    }

    const res = await supabase
      .from("invoices")
      .update({
        discount_type: discType,
        discount_value: v,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", activeInvoiceId);

    setBusy(false);

    if (res.error) {
      // Clear message if columns are missing
      if (isMissingColumnError(res.error.message)) {
        setErr(
          "Discount columns are not in your invoices table yet. Run the SQL migration to add discount_type / discount_value / discount_amount, then try again."
        );
        return;
      }
      setErr(res.error.message);
      return;
    }

    await recalcInvoice(activeInvoiceId);
    await loadAll();
    await loadInvoiceDetails(activeInvoiceId);
  }

  async function addInvoicePayment() {
    if (!activeInvoiceId || !patient) return;

    setBusy(true);
    setErr(null);

    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setBusy(false);
      setErr("Enter a valid payment amount.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const res = await supabase.from("payments").insert({
      patient_id: patient.id,
      invoice_id: activeInvoiceId,
      payment_date: payDate,
      amount: amt,
      mode: payMode,
      reference_no: payRef.trim() || null,
      is_installment: payInstallment,
      installment_note: payInstallment ? (payInstallNote.trim() || null) : null,
      notes: payNotes.trim() || null,
      created_by: userId,
    });

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setPayAmount("");
    setPayRef("");
    setPayInstallment(false);
    setPayInstallNote("");
    setPayNotes("");

    await loadAll();
    await loadInvoiceDetails(activeInvoiceId);
  }

  async function renameFile(fileId: string, newName: string) {
    setBusy(true);
    setErr(null);

    const res = await supabase.from("files").update({ display_name: newName.trim() }).eq("id", fileId);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    await loadAll();
  }

  async function openAttachment(a: Attachment) {
    setErr(null);

    const signed = await supabase.storage.from("patient-files").createSignedUrl(a.file_path, 60 * 10);
    if (signed.error || !signed.data?.signedUrl) {
      setErr(signed.error?.message ?? "Failed to generate signed URL.");
      return;
    }
    window.open(signed.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteFile(fileId: string, storagePath: string) {
    setBusy(true);
    setErr(null);

    // 1) remove from storage
    const bucket = "patient-files"; // change if your bucket name is different
    const s = await supabase.storage.from(bucket).remove([storagePath]);
    if (s.error) {
      setBusy(false);
      setErr(s.error.message);
      return;
    }

    // 2) remove db record
    const d = await supabase.from("files").delete().eq("id", fileId);

    setBusy(false);
    if (d.error) return setErr(d.error.message);

    await loadAll();
  } 

  function escapeHtml(s: string) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderTemplate(html: string, vars: Record<string, string>) {
    let out = html;
    for (const [key, val] of Object.entries(vars)) out = out.replaceAll(`{{${key}}}`, val);
    return out;
  }

  function patientBirthDateLine(p: Patient) {
    if (!p.birth_date) return "";
    return `, born on <b>${escapeHtml(p.birth_date)}</b>,`;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) ?? null;
  }, [templates, selectedTemplateId]);

  function buildVars(): Record<string, string> {
    if (!patient) return {};

    return {
      "patient.full_name": escapeHtml(patient.full_name),
      "patient.birth_date_line": patientBirthDateLine(patient),

      "doc.visit_date": escapeHtml(docVisitDate || todayISO()),
      "doc.issue_date": escapeHtml(todayISO()),

      "doc.findings": escapeHtml(docFindings || "-").replaceAll("\n", "<br />"),
      "doc.treatment_done": escapeHtml(docTreatmentDone || "-").replaceAll("\n", "<br />"),
      "doc.remarks": escapeHtml(docRemarks || "-").replaceAll("\n", "<br />"),

      "doc.dentist_name": escapeHtml(docDentistName || "________________"),
      "doc.prc_license": escapeHtml(docPrcLicense || "__________"),

      "doc.receipt_no": escapeHtml(docReceiptNo || "__________"),
      "doc.items": escapeHtml(docItems || "-").replaceAll("\n", "<br />"),
      "doc.amount_paid": escapeHtml(docAmountPaid || "0.00"),
      "doc.payment_method": escapeHtml(docPaymentMethod || "Cash"),
      "doc.balance": escapeHtml(docBalance || "0.00"),
      "doc.issued_by": escapeHtml(docIssuedBy || "________________"),
    };
  }

  function generatePreview() {
    if (!selectedTemplate) return;
    const vars = buildVars();
    const html = renderTemplate(selectedTemplate.content_html, vars);
    setPreviewHtml(html);
  }

  function printPreview() {
    if (!previewHtml) return;

    const w = window.open("about:blank", "_blank");
    if (!w) {
      setErr("Popup blocked. Please allow popups for this site, then try again.");
      return;
    }

    try {
      // @ts-ignore
      w.opener = null;
    } catch {}

    w.document.open();
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Print</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; }
            @page { margin: 12mm; }
          </style>
        </head>
        <body>
          ${previewHtml}
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    w.document.close();
  }

  async function saveGeneratedDoc() {
    if (!selectedTemplate || !patient) return;

    setBusy(true);
    setErr(null);

    const payload = {
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        birth_date: patient.birth_date,
        phone: patient.phone,
        address: patient.address,
      },
      doc: {
        visit_date: docVisitDate || todayISO(),
        issue_date: todayISO(),
        findings: docFindings,
        treatment_done: docTreatmentDone,
        remarks: docRemarks,
        dentist_name: docDentistName,
        prc_license: docPrcLicense,
        receipt_no: docReceiptNo,
        items: docItems,
        amount_paid: docAmountPaid,
        payment_method: docPaymentMethod,
        balance: docBalance,
        issued_by: docIssuedBy,
      },
    };

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const res = await supabase.from("generated_documents").insert({
      template_id: selectedTemplate.id,
      patient_id: patient.id,
      doc_type: selectedTemplate.doc_type,
      payload,
      created_by: userId,
    });

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    await loadAll();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading…</div>;
  }

  if (!patient) {
    return (
      <div className="min-h-screen p-6">
        <button className="rounded-lg border bg-white px-4 py-2" onClick={() => router.push("/patients")}>
          Back
        </button>
        <p className="mt-4 text-red-600">Patient not found.</p>
        {err ? <p className="mt-2 text-slate-600">{err}</p> : null}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button className="rounded-lg border bg-white px-3 py-1 text-sm" onClick={() => router.push("/patients")}>
              ← Back
            </button>

            <h1 className="mt-2 text-2xl font-semibold">{patient.full_name}</h1>
            <p className="text-sm text-slate-600">
              {patient.phone ?? "No phone"} {patient.birth_date ? `• Born ${patient.birth_date}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={() => router.push("/settings/services")}
            >
              Settings · Services
            </button>

            <button
              type="button"
              className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={() => router.push("/settings/dentists")}
            >
              Settings · Dentists
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              className={
                "rounded-lg px-3 py-2 text-sm font-medium border " +
                (tab === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-900")
              }
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {err ? <div className="mt-3 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        {/* Tab content */}
        <div className="mt-4 rounded-xl border bg-white p-4">
          {tab === "Info" ? (
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Patient info</div>

                {!editMode ? (
                  <button
                    className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
                    onClick={() => setEditMode(true)}
                    disabled={busy}
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
                      onClick={() => {
                        setEditName(patient.full_name ?? "");
                        setEditPhone(patient.phone ?? "");
                        setEditBirthDate(patient.birth_date ?? "");
                        setEditAddress(patient.address ?? "");
                        setEditMode(false);
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </button>

                    <button
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      onClick={savePatientEdits}
                      disabled={busy || editName.trim().length < 2}
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  {editMode ? (
                    <Field label="Full name" value={editName} onChange={setEditName} placeholder="Full name" />
                  ) : (
                    <InfoRow label="Full name" value={patient.full_name ?? "-"} />
                  )}
                </div>

                {editMode ? (
                  <Field label="Phone" value={editPhone} onChange={setEditPhone} placeholder="Phone" />
                ) : (
                  <InfoRow label="Phone" value={patient.phone ?? "-"} />
                )}

                {editMode ? (
                  <Field label="Birth date" value={editBirthDate} onChange={setEditBirthDate} type="date" />
                ) : (
                  <InfoRow label="Birth date" value={patient.birth_date ?? "-"} />
                )}

                <div className="sm:col-span-2">
                  {editMode ? (
                    <Field label="Address" value={editAddress} onChange={setEditAddress} placeholder="Address" textarea />
                  ) : (
                    <InfoRow label="Address" value={patient.address ?? "-"} />
                  )}
                </div>

                <InfoRow label="Email" value={patient.email ?? "-"} />
                <InfoRow label="Occupation" value={patient.occupation ?? "-"} />
                <InfoRow label="Notes" value={patient.notes ?? "-"} />
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="text-sm font-semibold text-rose-900">Danger zone</div>
                <div className="mt-1 text-sm text-rose-900/80">
                  Deleting a patient removes associated chart entries, files, documents, and billing records.
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label='Type "DELETE" to confirm' value={deleteConfirm} onChange={setDeleteConfirm} placeholder="DELETE" />
                  <div className="flex items-end">
                    <button
                      className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={busy}
                      onClick={deletePatient}
                    >
                      Delete patient
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "Medical" ? (
            <div className="grid gap-3">
              <Field label="Allergies" value={allergies} onChange={setAllergies} />
              <Field label="Medications" value={medications} onChange={setMedications} />
              <Field label="Blood pressure" value={bp} onChange={setBp} placeholder="e.g., 120/80" />
              <Field label="Notes" value={medNotes} onChange={setMedNotes} textarea />
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={busy}
                  onClick={saveMedical}
                >
                  {busy ? "Saving…" : "Save medical history"}
                </button>
              </div>
            </div>
          ) : null}

          {tab === "Chart" ? (
            <div className="grid gap-4">
              <ToothChart
                entries={chart}
                statuses={toothStatuses}
                selectedTooth={selectedTooth}
                onSelectTooth={(t) => {
                  setSelectedTooth(t);
                  setTooth(String(t));
                  setToothNote(toothStatuses[t]?.note ?? "");
                  setSurfaceSel([]);
                  setFindingDetail("");
                }}
              />

              {selectedTooth ? (
                <div className="rounded-xl border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Selected tooth: {selectedTooth}</div>
                    <div className="text-xs text-slate-600">
                      History: {chart.filter((e) => e.tooth_number === selectedTooth).length}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">Current status:</span>
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                        getStatusTheme((toothStatuses[selectedTooth]?.status ?? "HEALTHY") as ToothStatus).chip,
                      ].join(" ")}
                    >
                      {(toothStatuses[selectedTooth]?.status ?? "HEALTHY") as string}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">Last updated:</span>{" "}
                    {toothStatuses[selectedTooth]?.updated_at
                      ? new Date(toothStatuses[selectedTooth].updated_at!).toLocaleString()
                      : "—"}
                  </div>

                  <div className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">Note:</span>{" "}
                    {toothStatuses[selectedTooth]?.note?.trim() ? toothStatuses[selectedTooth].note!.slice(0, 140) : "—"}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-semibold">Update tooth status</div>

                <div className="mt-3">
                  <label className="block text-sm font-medium">Finding detail (optional)</label>
                  <select
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    value={findingDetail}
                    onChange={(e) => setFindingDetail(e.target.value)}
                    disabled={!selectedTooth || busy}
                  >
                    <option value="">— Select —</option>
                    <option value="Deep caries">Deep caries</option>
                    <option value="Recurrent caries">Recurrent caries</option>
                    <option value="Fracture">Fracture</option>
                    <option value="Abrasion">Abrasion</option>
                    <option value="Attrition">Attrition</option>
                    <option value="Mobility">Mobility</option>
                    <option value="Impacted">Impacted</option>
                    <option value="For extraction">For extraction</option>
                    <option value="Under observation">Under observation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="mt-3">
                  <div className="text-sm font-medium">Surfaces (optional)</div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {["M", "O", "D", "B", "L", "I"].map((s) => {
                      const active = surfaceSel.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          className={[
                            "h-10 w-10 rounded-xl border text-sm font-semibold transition",
                            active ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() => toggleSurface(s)}
                          disabled={!selectedTooth || busy || (pendingStatus !== "CARIES" && pendingStatus !== "FILLED")}
                          title={s === "I" ? "Incisal" : s}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    Selected: {surfaceSel.length ? surfaceSel.slice().sort().join("") : "-"}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">Surfaces are only used for Caries or Filled.</div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium">Tooth note</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[90px]"
                    value={toothNote}
                    onChange={(e) => setToothNote(e.target.value)}
                    placeholder="Optional notes for this tooth"
                    disabled={!selectedTooth || busy}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {["HEALTHY", "CARIES", "FILLED", "MISSING", "EXTRACTED", "RCT", "CROWN", "IMPLANT", "DENTURE"].map((s) => {
                    const theme = getStatusTheme(s as any);
                    const isCurrent = selectedTooth && (toothStatuses[selectedTooth]?.status ?? "HEALTHY") === s;

                    return (
                      <button
                        key={s}
                        type="button"
                        className={[
                          "rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60 transition",
                          "hover:brightness-95 hover:ring-2 hover:ring-slate-400 active:scale-[0.99]",
                          theme.chip,
                          isCurrent ? "ring-2 ring-slate-700" : "",
                        ].join(" ")}
                        disabled={!selectedTooth || busy}
                        onClick={() => {
                          setPendingStatus(s);
                          saveToothStatus(s);
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">
                  {selectedTooth ? `Tooth ${selectedTooth} history` : "All chart history"}
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-white text-slate-700">
                    <tr className="border-b">
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Tooth</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Detail</th>
                      <th className="text-left px-3 py-2">Surfaces</th>
                      <th className="text-left px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedTooth ? chart.filter((e) => e.tooth_number === selectedTooth) : chart).map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="px-3 py-2">{new Date(e.recorded_at).toLocaleString()}</td>
                        <td className="px-3 py-2">{e.tooth_number}</td>
                        <td className="px-3 py-2 font-medium">{e.finding_code}</td>
                        <td className="px-3 py-2">{e.finding_detail ?? "-"}</td>
                        <td className="px-3 py-2">{e.surfaces ?? "-"}</td>
                        <td className="px-3 py-2">{e.notes ?? "-"}</td>
                      </tr>
                    ))}
                    {chart.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-slate-600">
                          No chart history yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "Treatments" ? (
            <div className="grid gap-4">
              {/* Step 1: Date + Dentist */}
              <div className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Visit</div>
                    <div className="text-xs text-slate-600">
                      Select date and attending dentist, then add procedures. Visit note is last.
                    </div>
                  </div>

                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={busy || !patient || !visitDate || !visitDentistId || draftLines.length === 0}
                    onClick={saveVisit}
                    title={!visitDentistId ? "Select dentist first" : draftLines.length === 0 ? "Add at least 1 procedure" : ""}
                  >
                    Save visit
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Visit date" value={visitDate} onChange={setVisitDate} type="date" />

                  <div>
                    <label className="block text-sm font-medium">Attending dentist</label>
                    <select
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                      value={visitDentistId}
                      onChange={(e) => setVisitDentistId(e.target.value)}
                      disabled={busy}
                    >
                      <option value="">Select…</option>
                      {dentists.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-xs text-slate-600">
                      Required.
                    </div>
                  </div>

                  <div className="hidden sm:block" />
                </div>
              </div>

              {/* Step 2: Procedures */}
              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-semibold">Procedures</div>
                <div className="mt-1 text-xs text-slate-600">
                  Add procedures for this visit. Fees are handled in Billing.
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-6">
                  <div className="sm:col-span-1">
                    <Field label="Tooth" value={lineTooth} onChange={setLineTooth} placeholder="e.g., 11" />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-sm font-medium">Procedure / Service</label>
                    <select
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                      value={txServiceId}
                      onChange={(e) => {
                        const sid = e.target.value;
                        setTxServiceId(sid);

                        const pick = serviceMenu.find((x) => x.id === sid);
                        setTxServiceName(pick ? pick.service_name : "");
                      }}
                      disabled={busy || !visitDate || !visitDentistId}
                    >
                      <option value="">Select…</option>
                      {serviceMenu
                        .filter((x) => x.is_active && x.item_type === "SERVICE")
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.service_name}
                          </option>
                        ))}
                    </select>
                    {!visitDentistId ? (
                      <div className="mt-1 text-xs text-rose-600">Select the dentist first.</div>
                    ) : null}
                  </div>

                  <div className="sm:col-span-1 flex items-end justify-end">
                    <button
                      type="button"
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={busy || !visitDate || !visitDentistId || !txServiceId}
                      onClick={addDraftLine}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border overflow-hidden">
                  {draftLines.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-600">No procedures added yet.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b">
                          <th className="text-left px-3 py-2">Tooth</th>
                          <th className="text-left px-3 py-2">Procedure</th>
                          <th className="text-right px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftLines.map((ln) => (
                          <tr key={ln.id} className="border-t">
                            <td className="px-3 py-2">{ln.tooth_number ?? "—"}</td>
                            <td className="px-3 py-2 font-medium">{ln.procedure}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                className="rounded-lg border px-3 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                                disabled={busy}
                                onClick={() => removeDraftLine(ln.id)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Step 3: Visit note (last) */}
              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-semibold">Visit note (optional)</div>
                <div className="mt-1 text-xs text-slate-600">
                  One note per visit (shared across procedures). This will show in History under the date.
                </div>

                <textarea
                  className="mt-3 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  rows={4}
                  value={visitNote}
                  onChange={(e) => setVisitNote(e.target.value)}
                  placeholder="Long notes for this visit."
                  disabled={busy}
                />
              </div>

              {/* History */}
              <div className="rounded-xl border bg-white overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">History</div>

                {treatments.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-600">No treatment history yet.</div>
                ) : (
                  <div className="divide-y">
                    {Object.entries(
                      treatments.reduce((acc: Record<string, Treatment[]>, t) => {
                        const k = t.treatment_date;
                        acc[k] = acc[k] ? [...acc[k], t] : [t];
                        return acc;
                      }, {})
                    )
                      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                      .map(([date, rows]) => (
                        <div key={date} className="p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold">{date}</div>
                            {/* dentist is per-row in DB, so show the first row dentist_name if present */}
                            <div className="text-xs text-slate-600">
                              {rows[0] && (rows[0] as any).dentist_name ? `Dentist: ${(rows[0] as any).dentist_name}` : ""}
                            </div>
                          </div>

                          {rows[0]?.notes ? (
                            <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                              {rows[0].notes}
                            </div>
                          ) : null}

                          <ul className="mt-3 space-y-2">
                            {rows.map((r) => (
                              <li key={r.id} className="text-sm">
                                <span className="font-semibold">
                                  {r.tooth_number ? `Tooth ${r.tooth_number}: ` : ""}
                                </span>
                                {r.procedure}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === "Files" ? (
            <div className="grid gap-4">
              <div className="rounded-lg border p-4 bg-slate-50">
                <div className="text-sm font-semibold">Upload file</div>
                <p className="text-xs text-slate-600 mt-1">
                  Use for X-rays, photos, consent forms, lab results. Files are stored privately.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium">Type</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 bg-white"
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value as AttachmentType)}
                    >
                      {attachmentTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium">Choose file</label>
                    <input
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)}
                    />
                    <div className="mt-1 text-xs text-slate-600">
                      {fileToUpload ? `Selected: ${fileToUpload.name}` : "No file selected."}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={busy || !fileToUpload}
                    onClick={uploadAttachment}
                  >
                    {busy ? "Uploading…" : "Upload"}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="bg-white px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Patient files</div>
                    <div className="text-xs text-slate-600">{attachments.length} file(s)</div>
                  </div>
                </div>

                <div className="bg-white">
                  {attachments.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-600">No files uploaded yet.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="text-left px-4 py-2">Type</th>
                          <th className="text-left px-4 py-2">File</th>
                          <th className="text-left px-4 py-2">Uploaded</th>
                          <th className="text-right px-4 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attachments.map((a) => (
                          <tr key={a.id} className="border-t">
                            <td className="px-4 py-2 font-medium">{a.type}</td>
                            <td className="px-4 py-2">{a.file_name ?? a.file_path}</td>
                            <td className="px-4 py-2">{new Date(a.created_at).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  className="rounded-lg border bg-white px-3 py-1 text-sm font-medium"
                                  onClick={() => openAttachment(a)}
                                >
                                  View
                                </button>

                                <button
                                  className="rounded-lg border bg-white px-3 py-1 text-sm font-medium transition hover:bg-slate-50"
                                  onClick={() => {
                                    const n = window.prompt("Rename file to:", a.file_name ?? "");
                                    if (n && n.trim()) renameAttachment(a.id, n.trim());
                                  }}
                                >
                                  Rename
                                </button>

                                <button
                                  className="rounded-lg border bg-white px-3 py-1 text-sm font-medium transition hover:bg-slate-50"
                                  onClick={() => {
                                    if (confirm("Delete this file?")) deleteAttachment(a.id, a.file_path);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "Documents" ? (
            <div className="grid gap-4">
              <div className="rounded-lg border p-4 bg-slate-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Generate document</div>
                    <p className="text-xs text-slate-600 mt-1">Choose a template, fill details, preview, print, and save a record.</p>
                  </div>

                  <div className="flex gap-2">
                    <button className="rounded-lg border bg-white px-4 py-2 text-sm font-medium" onClick={generatePreview}>
                      Preview
                    </button>
                    <button
                      className="rounded-lg border bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                      onClick={printPreview}
                      disabled={!previewHtml}
                    >
                      Print
                    </button>
                    <button
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      onClick={saveGeneratedDoc}
                      disabled={busy || !selectedTemplate}
                    >
                      {busy ? "Saving…" : "Save record"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">Template</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 bg-white"
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        setPreviewHtml("");
                      }}
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Field label="Visit date" value={docVisitDate} onChange={setDocVisitDate} type="date" />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Dentist name" value={docDentistName} onChange={setDocDentistName} placeholder="Dr. ____" />
                  <Field label="PRC license no." value={docPrcLicense} onChange={setDocPrcLicense} placeholder="____" />
                </div>

                <div className="mt-3 grid gap-3">
                  <Field label="Findings / Diagnosis" value={docFindings} onChange={setDocFindings} textarea />
                  <Field label="Treatment done" value={docTreatmentDone} onChange={setDocTreatmentDone} textarea />
                  <Field label="Remarks / Recommendation" value={docRemarks} onChange={setDocRemarks} textarea />
                </div>

                <div className="mt-4 rounded-lg border bg-white p-3">
                  <div className="text-sm font-semibold">Receipt fields (use when template is Receipt)</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Receipt no." value={docReceiptNo} onChange={setDocReceiptNo} placeholder="R-2026-0001" />
                    <Field label="Issued by" value={docIssuedBy} onChange={setDocIssuedBy} placeholder="Staff name" />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Amount paid" value={docAmountPaid} onChange={setDocAmountPaid} placeholder="0.00" />
                    <Field label="Balance" value={docBalance} onChange={setDocBalance} placeholder="0.00" />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Payment method" value={docPaymentMethod} onChange={setDocPaymentMethod} placeholder="Cash / GCash" />
                    <Field label="Items / Services" value={docItems} onChange={setDocItems} textarea />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-white overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">Preview</div>
                <div className="p-4">
                  {previewHtml ? (
                    <div className="max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  ) : (
                    <div className="text-sm text-slate-600">Click Preview to generate.</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-white overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">Saved documents</div>
                {generatedDocs.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-600">No saved documents yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-white text-slate-700">
                      <tr className="border-b">
                        <th className="text-left px-4 py-2">Type</th>
                        <th className="text-left px-4 py-2">Created</th>
                        <th className="text-left px-4 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedDocs.map((d) => (
                        <tr key={d.id} className="border-t">
                          <td className="px-4 py-2 font-medium">{d.doc_type}</td>
                          <td className="px-4 py-2">{new Date(d.created_at).toLocaleString()}</td>
                          <td className="px-4 py-2 text-slate-600">
                            {d.payload?.doc?.receipt_no
                              ? `Receipt #${d.payload.doc.receipt_no}`
                              : d.payload?.doc?.visit_date
                              ? `Visit ${d.payload.doc.visit_date}`
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}

          {tab === "Billing" ? (
            <div className="grid gap-4">
              {/* Visit selector (jump to visit dates only) */}
              <div className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Billing</div>
                    <div className="text-xs text-slate-600">
                      Select a visit date that has Treatments. We auto-generate the invoice and items from Treatments.
                    </div>
                  </div>

                  <button
                    type="button"
                    className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                    disabled={busy || visitDates.length === 0}
                    onClick={async () => {
                      if (visitDates.length === 0) return;
                      await openBillingForVisitDate(visitDates[0]);
                    }}
                    title={visitDates.length === 0 ? "No visits yet. Add Treatments first." : "Open the most recent visit"}
                  >
                    Open latest visit
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-medium">Visit date</label>
                    <select
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                      value={(() => {
                        const active = invoices.find((x) => x.id === activeInvoiceId);
                        return active?.invoice_date ?? "";
                      })()}
                      onChange={async (e) => {
                        const d = e.target.value;
                        if (!d) return;
                        await openBillingForVisitDate(d);
                      }}
                      disabled={busy || visitDates.length === 0}
                    >
                      <option value="">{visitDates.length === 0 ? "No visits yet" : "Select…"}</option>
                      {visitDates.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>

                    <div className="mt-1 text-xs text-slate-600">
                      Only dates with Treatments appear here.
                    </div>
                  </div>

                  <div className="sm:col-span-2 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
                    Tip: If you edit Treatments (add/remove procedures), re-open the date or click “Refresh from Treatments” below.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
                {/* Visits list (only those that exist as invoices already) */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">Invoices ({invoices.length})</div>

                  {invoices.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-600">
                      No invoices yet. Select a visit date above to auto-generate one.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {invoices.map((inv) => {
                        const isActive = inv.id === activeInvoiceId;
                        return (
                          <button
                            key={inv.id}
                            type="button"
                            className={[
                              "w-full text-left px-4 py-3 transition",
                              isActive ? "bg-slate-900 text-white" : "hover:bg-slate-50",
                            ].join(" ")}
                            onClick={() => setActiveInvoiceId(inv.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">{inv.invoice_date}</div>
                              <div className="text-xs opacity-80">{inv.status ?? "OPEN"}</div>
                            </div>
                            <div className="mt-1 text-xs opacity-80">Total: PHP {num(inv.total).toFixed(2)}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="grid gap-4">
                  {!activeInvoiceId ? (
                    <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
                      Select a visit date above to open billing.
                    </div>
                  ) : (
                    <>
                      {/* Totals summary */}
                      <div className="rounded-xl border bg-white p-4">
                        {(() => {
                          const inv = invoices.find((x) => x.id === activeInvoiceId);
                          const paid = invoicePayments.reduce((sum, p) => sum + num(p.amount), 0);
                          const total = num(inv?.total);
                          const bal = Math.max(0, total - paid);

                          return (
                            <div className="grid gap-2 sm:grid-cols-4">
                              <div>
                                <div className="text-xs text-slate-600">Subtotal</div>
                                <div className="text-sm font-semibold">PHP {num(inv?.subtotal).toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-600">Discount</div>
                                <div className="text-sm font-semibold">PHP {num(inv?.discount_amount).toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-600">Paid</div>
                                <div className="text-sm font-semibold">PHP {paid.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-600">Balance</div>
                                <div className="text-sm font-semibold">PHP {bal.toFixed(2)}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Invoice items (read-only, generated from Treatments) */}
                      <div className="rounded-xl border bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">Invoice items</div>
                            <div className="text-xs text-slate-600">
                              Items are generated from Treatments. To change items, edit Treatments.
                            </div>
                          </div>

                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                            disabled={busy || !activeInvoiceId}
                            onClick={async () => {
                              if (!activeInvoiceId) return;
                              setBusy(true);
                              setErr(null);

                              const r = await supabase.rpc("sync_invoice_items_from_treatments", { p_invoice_id: activeInvoiceId });
                              if (r.error) setErr(r.error.message);

                              setBusy(false);
                              await loadInvoiceDetails(activeInvoiceId);
                              await loadAll();
                            }}
                            title="Rebuild items from Treatments"
                          >
                            Refresh from Treatments
                          </button>
                        </div>

                        <div className="mt-4 rounded-lg border overflow-hidden">
                          {invoiceItems.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-slate-600">No items yet.</div>
                          ) : (
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50">
                                <tr className="border-b">
                                  <th className="text-left px-3 py-2">Service</th>
                                  <th className="text-left px-3 py-2">Tooth</th>
                                  <th className="text-left px-3 py-2">Dentist</th>
                                  <th className="text-right px-3 py-2">Qty</th>
                                  <th className="text-right px-3 py-2">Unit</th>
                                  <th className="text-right px-3 py-2">Line</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invoiceItems.map((it) => (
                                  <tr key={it.id} className="border-t">
                                    <td className="px-3 py-2">
                                      <div className="font-medium">{it.service_name}</div>
                                    </td>
                                    <td className="px-3 py-2">{it.tooth_number ?? "—"}</td>
                                    <td className="px-3 py-2">{it.dentist_name ?? "—"}</td>
                                    <td className="px-3 py-2 text-right">{it.qty}</td>
                                    <td className="px-3 py-2 text-right">PHP {num(it.unit_price).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right font-semibold">PHP {num(it.line_total).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>

                      {/* Discount + Payments blocks stay as-is below this point */}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      {textarea ? (
        <textarea
          className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[90px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type ?? "text"}
        />
      )}
    </div>
  );
}
