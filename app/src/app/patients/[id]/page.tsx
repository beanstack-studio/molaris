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

  // Treatments
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [procDate, setProcDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tTooth, setTTooth] = useState("");
  const [tNotes, setTNotes] = useState("");

  // Treatments: service menu selection + fee logic
  const [txServiceId, setTxServiceId] = useState<string>("");
  const [txServiceName, setTxServiceName] = useState<string>("");
  const [txDefaultFee, setTxDefaultFee] = useState<number>(0); // remembers menu default
  const [txFee, setTxFee] = useState<string>("");              // editable input
  const [txFeeEdited, setTxFeeEdited] = useState<boolean>(false);
  const [txFeeNote, setTxFeeNote] = useState<string>("");      // required if edited

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

  // Create invoice
  const [newInvoiceDate, setNewInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newInvoiceNotes, setNewInvoiceNotes] = useState("");

  const [serviceMenu, setServiceMenu] = useState<ServicePriceRow[]>([]);

  // Service menu form
  const [svcName, setSvcName] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcType, setSvcType] = useState<"SERVICE" | "ADD_ON">("SERVICE");
  const [svcActive, setSvcActive] = useState(true);
  const [svcSort, setSvcSort] = useState("0");

  // Add item
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [itemService, setItemService] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemUnitPrice, setItemUnitPrice] = useState("");
  const [itemTooth, setItemTooth] = useState("");
  const [itemDentist, setItemDentist] = useState("");

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
      .select("id, treatment_date, procedure, tooth_number, fee, notes")
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

    // Invoices (use select("*") so it won’t crash if discount columns aren’t created yet)
    const inv = await supabase
      .from("invoices")
      .select("*")
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

  async function addTreatment() {
    setBusy(true);
    setErr(null);

    // Inputs
    const toothNum = tTooth.trim() ? Number(tTooth) : null;
    const toothVal = Number.isFinite(toothNum as any) ? toothNum : null;

    const feeNum = Number(txFee);

    // Validation
    if (!txServiceId || !txServiceName.trim()) {
      setBusy(false);
      setErr("Select a procedure/service from the menu.");
      return;
    }
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      setBusy(false);
      setErr("Enter a valid fee.");
      return;
    }
    if (txFeeEdited && !txFeeNote.trim()) {
      setBusy(false);
      setErr("Fee was adjusted. Please add a fee adjustment note.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    // Insert
    const res = await supabase.from("treatments").insert({
      patient_id: id,
      treatment_date: procDate,
      procedure: txServiceName.trim(), // keep this column as the visible procedure
      service_price_id: txServiceId || null,
      default_fee: txDefaultFee,
      fee: feeNum,
      fee_note: txFeeEdited ? (txFeeNote.trim() || null) : null,
      tooth_number: toothVal,
      notes: tNotes.trim() || null,
      created_by: userId,
      dentist_id: userId,
    } as any);

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    // Clear form
    setTxServiceId("");
    setTxServiceName("");
    setTxDefaultFee(0);
    setTxFee("");
    setTxFeeEdited(false);
    setTxFeeNote("");

    setTTooth("");
    setTNotes("");

    await loadAll();
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

  async function createInvoice() {
    if (!patient) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    // Try insert WITH discount columns (if they exist)
    const res1 = await supabase
      .from("invoices")
      .insert({
        patient_id: patient.id,
        invoice_date: newInvoiceDate,
        status: "OPEN",
        discount_type: "NONE",
        discount_value: 0,
        notes: newInvoiceNotes.trim() || null,
        created_by: userId,
      } as any)
      .select("id")
      .single();

    // If discount columns don’t exist yet, retry without them
    const res =
      res1.error && isMissingColumnError(res1.error.message)
        ? await supabase
            .from("invoices")
            .insert({
              patient_id: patient.id,
              invoice_date: newInvoiceDate,
              status: "OPEN",
              notes: newInvoiceNotes.trim() || null,
              created_by: userId,
            } as any)
            .select("id")
            .single()
        : res1;

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    const newId = res.data?.id as string;
    setActiveInvoiceId(newId);
    setNewInvoiceNotes("");

    // Initialize totals (will work only if your recalc function expects the columns)
    await recalcInvoice(newId);
    await loadAll();
    await loadInvoiceDetails(newId);
  }

  async function addServiceMenuItem() {
    setBusy(true);
    setErr(null);

    const price = Number(svcPrice);
    const sort = Number(svcSort);

    if (!svcName.trim()) {
      setBusy(false);
      setErr("Service name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setBusy(false);
      setErr("Enter a valid price.");
      return;
    }

    const res = await supabase.from("service_prices").insert({
      service_name: svcName.trim(),
      default_price: price,
      item_type: svcType,
      is_active: svcActive,
      sort_order: Number.isFinite(sort) ? sort : 0,
    });

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setSvcName("");
    setSvcPrice("");
    setSvcType("SERVICE");
    setSvcActive(true);
    setSvcSort("0");

    await loadAll();
  }

  async function toggleServiceActive(id: string, next: boolean) {
    setBusy(true);
    setErr(null);

    const res = await supabase.from("service_prices").update({ is_active: next }).eq("id", id);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    await loadAll();
  }

  async function deleteServiceMenuItem(id: string) {
    setBusy(true);
    setErr(null);

    const res = await supabase.from("service_prices").delete().eq("id", id);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    await loadAll();
  }

  async function addInvoiceItem() {
    if (!activeInvoiceId) return;

    setBusy(true);
    setErr(null);

    const qty = Number(itemQty);
    const unit = Number(itemUnitPrice);

    if (!itemService.trim()) {
      setBusy(false);
      setErr("Service name is required.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setBusy(false);
      setErr("Enter a valid quantity.");
      return;
    }
    if (!Number.isFinite(unit) || unit < 0) {
      setBusy(false);
      setErr("Enter a valid unit price.");
      return;
    }

    const toothNum = itemTooth.trim() ? Number(itemTooth) : null;
    const toothVal = Number.isFinite(toothNum as any) ? toothNum : null;

    const res = await supabase.from("invoice_items").insert({
      invoice_id: activeInvoiceId,
      service_price_id: selectedServiceId || null,
      service_name: itemService.trim(),
      qty,
      unit_price: unit,
      tooth_number: toothVal,
      dentist_name: itemDentist.trim() || null,
    });

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setItemService("");
    setSelectedServiceId("");
    setItemQty("1");
    setItemUnitPrice("");
    setItemTooth("");
    setItemDentist("");

    await recalcInvoice(activeInvoiceId);
    await loadAll();
    await loadInvoiceDetails(activeInvoiceId);
  }

  async function deleteInvoiceItem(itemId: string) {
    if (!activeInvoiceId) return;

    setBusy(true);
    setErr(null);

    const res = await supabase.from("invoice_items").delete().eq("id", itemId);

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    await recalcInvoice(activeInvoiceId);
    await loadAll();
    await loadInvoiceDetails(activeInvoiceId);
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
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="sm:col-span-1">
                  <Field label="Date" value={procDate} onChange={setProcDate} type="date" />
                </div>
                <div className="sm:col-span-2">
                   <label className="block text-sm font-medium">Procedure / Service</label>
                    <select
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                      value={txServiceId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setTxServiceId(id);

                        const pick = serviceMenu.find((x) => x.id === id);
                        if (pick) {
                          setTxServiceName(pick.service_name);
                          setTxDefaultFee(Number(pick.default_price ?? 0));
                          setTxFee(String(Number(pick.default_price ?? 0)));
                          setTxFeeEdited(false);
                          setTxFeeNote("");
                        } else {
                          setTxServiceName("");
                          setTxDefaultFee(0);
                          setTxFee("");
                          setTxFeeEdited(false);
                          setTxFeeNote("");
                        }
                      }}
                    >
                      <option value="">— Select from menu —</option>

                      <optgroup label="Services">
                        {serviceMenu
                          .filter((x) => x.is_active && x.item_type === "SERVICE")
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.service_name} (PHP {Number(x.default_price).toFixed(2)})
                            </option>
                          ))}
                      </optgroup>

                      <optgroup label="Add-ons">
                        {serviceMenu
                          .filter((x) => x.is_active && x.item_type === "ADD_ON")
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.service_name} (PHP {Number(x.default_price).toFixed(2)})
                            </option>
                          ))}
                      </optgroup>
                    </select>

                    <div className="mt-1 text-xs text-slate-600">
                      Selecting a menu item auto-fills the fee. You can edit it if needed.
                    </div>
                </div>
                <div className="sm:col-span-1">
                  <Field label="Tooth" value={tTooth} onChange={setTTooth} placeholder="optional" />
                </div>
                <div className="sm:col-span-1">
                  <Field
                    label="Fee (PHP)"
                    value={txFee}
                    onChange={(v) => {
                      setTxFee(v);

                      const num = Number(v);
                      const edited =
                        Number.isFinite(num) &&
                        Math.round(num * 100) !== Math.round(txDefaultFee * 100);

                      setTxFeeEdited(edited);

                      // If they revert to default, remove requirement + clear note
                      if (!edited) {
                        setTxFeeNote("");
                      }
                    }}
                    placeholder="0.00"
                  />

                  {txFeeEdited ? (
                    <div className="sm:col-span-5">
                      <div className="mt-1 text-xs text-rose-700">
                        Fee differs from default. Fee adjustment note is required.
                      </div>
                      <div className="mt-2">
                        <Field
                          label="Fee adjustment note (required)"
                          value={txFeeNote}
                          onChange={setTxFeeNote}
                          placeholder="e.g., Family discount / promo / waived portion"
                          textarea
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <Field label="Notes" value={tNotes} onChange={setTNotes} textarea />
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={busy || !txServiceId || (txFeeEdited && !txFeeNote.trim())}
                  onClick={addTreatment}
                >
                  {busy ? "Adding…" : "Add treatment"}
                </button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Procedure</th>
                      <th className="text-left px-3 py-2">Tooth</th>
                      <th className="text-left px-3 py-2">Fee</th>
                      <th className="text-left px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatments.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-3 py-2">{t.treatment_date}</td>
                        <td className="px-3 py-2 font-medium">{t.procedure}</td>
                        <td className="px-3 py-2">{t.tooth_number ?? "-"}</td>
                        <td className="px-3 py-2">{num(t.fee).toFixed(2)}</td>
                        <td className="px-3 py-2">{t.notes ?? "-"}</td>
                      </tr>
                    ))}
                    {treatments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-slate-600">
                          No treatments yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
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
              <div className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Billing</div>
                    <div className="text-xs text-slate-600">Create invoices (visits), add items, apply discounts, and record payments.</div>
                    <div className="rounded-xl border bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">Service menu</div>
                          <div className="text-xs text-slate-600">Manage services and add-ons used for billing and receipts.</div>
                        </div>
                        <button
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          disabled={busy}
                          onClick={addServiceMenuItem}
                        >
                          Add menu item
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <Field label="Name" value={svcName} onChange={setSvcName} placeholder="e.g., Composite filling" />
                        <Field label="Default price (PHP)" value={svcPrice} onChange={setSvcPrice} placeholder="0.00" />
                        <div>
                          <label className="block text-sm font-medium">Type</label>
                          <select
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                            value={svcType}
                            onChange={(e) => setSvcType(e.target.value as any)}
                          >
                            <option value="SERVICE">Service</option>
                            <option value="ADD_ON">Add-on</option>
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <Field label="Sort order" value={svcSort} onChange={setSvcSort} placeholder="0" />
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={svcActive} onChange={(e) => setSvcActive(e.target.checked)} />
                            Active
                          </label>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border overflow-hidden">
                        {serviceMenu.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-slate-600">No menu items yet.</div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr className="border-b">
                                <th className="text-left px-3 py-2">Name</th>
                                <th className="text-left px-3 py-2">Type</th>
                                <th className="text-right px-3 py-2">Price</th>
                                <th className="text-center px-3 py-2">Active</th>
                                <th className="text-right px-3 py-2">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {serviceMenu.map((s) => (
                                <tr key={s.id} className="border-t">
                                  <td className="px-3 py-2">{s.service_name}</td>
                                  <td className="px-3 py-2">{s.item_type}</td>
                                  <td className="px-3 py-2 text-right">PHP {Number(s.default_price).toFixed(2)}</td>
                                  <td className="px-3 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={s.is_active}
                                      onChange={(e) => toggleServiceActive(s.id, e.target.checked)}
                                      disabled={busy}
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      className="rounded-lg border px-3 py-1 text-xs font-semibold transition hover:bg-slate-50 disabled:opacity-60"
                                      onClick={() => deleteServiceMenuItem(s.id)}
                                      disabled={busy}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={busy || !patient}
                    onClick={createInvoice}
                  >
                    Create invoice
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Invoice date" value={newInvoiceDate} onChange={setNewInvoiceDate} type="date" />
                  <div className="sm:col-span-2">
                    <Field label="Invoice notes (optional)" value={newInvoiceNotes} onChange={setNewInvoiceNotes} placeholder="Optional notes" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">Invoices ({invoices.length})</div>

                  {invoices.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-600">No invoices yet.</div>
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

                <div className="grid gap-4">
                  {!activeInvoiceId ? (
                    <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">Select an invoice to view details.</div>
                  ) : (
                    <>
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

                      <div className="rounded-xl border bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold">Invoice items</div>
                          <button
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            disabled={busy || !activeInvoiceId}
                            onClick={addInvoiceItem}
                          >
                            Add item
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-5">
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium">Service / Add-on</label>
                            <select
                              className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                              value={selectedServiceId}
                              onChange={(e) => {
                                const id = e.target.value;
                                setSelectedServiceId(id);

                                const pick = serviceMenu.find((x) => x.id === id);
                                if (pick) {
                                  setItemService(pick.service_name);
                                  setItemUnitPrice(String(pick.default_price ?? 0));
                                } else {
                                  setItemService("");
                                  setItemUnitPrice("");
                                }
                              }}
                            >
                              <option value="">— Select from menu —</option>

                              <optgroup label="Services">
                                {serviceMenu
                                  .filter((x) => x.is_active && x.item_type === "SERVICE")
                                  .map((x) => (
                                    <option key={x.id} value={x.id}>
                                      {x.service_name} (PHP {Number(x.default_price).toFixed(2)})
                                    </option>
                                  ))}
                              </optgroup>

                              <optgroup label="Add-ons">
                                {serviceMenu
                                  .filter((x) => x.is_active && x.item_type === "ADD_ON")
                                  .map((x) => (
                                    <option key={x.id} value={x.id}>
                                      {x.service_name} (PHP {Number(x.default_price).toFixed(2)})
                                    </option>
                                  ))}
                              </optgroup>
                            </select>

                            <div className="mt-1 text-xs text-slate-600">
                              Selecting an item auto-fills the unit price. You can still edit price manually.
                            </div>
                          </div>
                          <Field label="Qty" value={itemQty} onChange={setItemQty} placeholder="1" />
                          <Field label="Unit price (PHP)" value={itemUnitPrice} onChange={setItemUnitPrice} placeholder="0.00" />
                          <Field label="Tooth (optional)" value={itemTooth} onChange={setItemTooth} placeholder="e.g., 36" />
                        </div>

                        <div className="mt-3">
                          <Field label="Dentist (optional)" value={itemDentist} onChange={setItemDentist} placeholder="Dr. Daisy / Dr. Dexely" />
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
                                  <th className="text-right px-3 py-2">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invoiceItems.map((it) => (
                                  <tr key={it.id} className="border-t">
                                    <td className="px-3 py-2">{it.service_name}</td>
                                    <td className="px-3 py-2">{it.tooth_number ?? "-"}</td>
                                    <td className="px-3 py-2">{it.dentist_name ?? "-"}</td>
                                    <td className="px-3 py-2 text-right">{num(it.qty)}</td>
                                    <td className="px-3 py-2 text-right">PHP {num(it.unit_price).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right">PHP {num(it.line_total).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right">
                                      <button
                                        className="rounded-lg border px-3 py-1 text-xs font-semibold transition hover:bg-slate-50 disabled:opacity-60"
                                        disabled={busy}
                                        onClick={() => deleteInvoiceItem(it.id)}
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold">Discount</div>
                          <button
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            disabled={busy || !activeInvoiceId}
                            onClick={applyDiscount}
                          >
                            Apply discount
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className="block text-sm font-medium">Type</label>
                            <select
                              className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                              value={discType}
                              onChange={(e) => setDiscType(e.target.value as any)}
                              disabled={busy}
                            >
                              <option value="NONE">None</option>
                              <option value="AMOUNT">Amount</option>
                              <option value="PERCENT">Percent</option>
                            </select>
                          </div>
                          <Field
                            label={discType === "PERCENT" ? "Value (%)" : "Value (PHP)"}
                            value={discValue}
                            onChange={setDiscValue}
                            placeholder={discType === "NONE" ? "" : discType === "PERCENT" ? "10" : "500"}
                          />
                          <div className="text-xs text-slate-600 flex items-end">
                            If discount columns are missing, run the SQL migration first.
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold">Payments</div>
                          <button
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            disabled={busy || !activeInvoiceId}
                            onClick={addInvoicePayment}
                          >
                            Add payment
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <Field label="Date" value={payDate} onChange={setPayDate} type="date" />
                          <Field label="Amount (PHP)" value={payAmount} onChange={setPayAmount} placeholder="0.00" />
                          <div>
                            <label className="block text-sm font-medium">Mode</label>
                            <select
                              className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                              value={payMode}
                              onChange={(e) => setPayMode(e.target.value)}
                            >
                              {["Cash", "GCash", "Bank Transfer", "Card", "Other"].map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Field label="Reference no. (optional)" value={payRef} onChange={setPayRef} placeholder="GCash ref / bank ref" />
                          <div className="flex items-center gap-3 mt-6">
                            <input type="checkbox" checked={payInstallment} onChange={(e) => setPayInstallment(e.target.checked)} />
                            <div className="text-sm font-medium">Installment</div>
                          </div>
                        </div>

                        {payInstallment ? (
                          <div className="mt-3">
                            <Field label="Installment note" value={payInstallNote} onChange={setPayInstallNote} placeholder="e.g., Ortho installment #2" />
                          </div>
                        ) : null}

                        <div className="mt-3">
                          <Field label="Notes (optional)" value={payNotes} onChange={setPayNotes} textarea />
                        </div>

                        <div className="mt-4 rounded-lg border overflow-hidden">
                          {invoicePayments.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-slate-600">No payments yet.</div>
                          ) : (
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50">
                                <tr className="border-b">
                                  <th className="text-left px-3 py-2">Date</th>
                                  <th className="text-right px-3 py-2">Amount</th>
                                  <th className="text-left px-3 py-2">Mode</th>
                                  <th className="text-left px-3 py-2">Ref</th>
                                  <th className="text-left px-3 py-2">Installment</th>
                                  <th className="text-left px-3 py-2">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invoicePayments.map((p) => (
                                  <tr key={p.id} className="border-t">
                                    <td className="px-3 py-2">{p.payment_date}</td>
                                    <td className="px-3 py-2 text-right">PHP {num(p.amount).toFixed(2)}</td>
                                    <td className="px-3 py-2">{p.mode}</td>
                                    <td className="px-3 py-2">{p.reference_no ?? "-"}</td>
                                    <td className="px-3 py-2">{p.is_installment ? (p.installment_note ?? "Yes") : "No"}</td>
                                    <td className="px-3 py-2">{p.notes ?? "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
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
