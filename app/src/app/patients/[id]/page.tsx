"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ToothChart, { ToothStatus, getStatusTheme } from "@/components/ToothChart";
import { EditModal } from "@/components/EditModal";
import { supabase } from "@/lib/supabaseClient";

/* =========================
   Types
========================= */
type GenderDB = "male" | "female" | null;

type Patient = {
  id: string;
  full_name: string; // kept for compatibility + documents
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  occupation: string | null;
  email: string | null;
  gender: GenderDB;
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

type DentistRow = { id: string; full_name: string };

type ChartEntry = {
  id: string;
  tooth_number: number;
  surfaces: string | null;
  finding_code: string;
  finding_detail?: string | null;
  notes: string | null;
  recorded_at: string;
};

type ToothStatusRow = {
  tooth_number: number;
  status: string;
  note: string | null;
  updated_at: string | null;
};

type Treatment = {
  id: string;
  treatment_date: string;
  procedure: string;
  tooth_number: number | null;
  notes: string | null;
  dentist_id: string | null;
  dentist_name: string | null;
  service_price_id: string | null;
  created_at: string | null;
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

type InvoiceRow = {
  id: string;
  invoice_date: string;
  status: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total: number | null;
  notes: string | null;
  created_at: string | null;
};

type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  service_name: string;
  description?: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  tooth_number: number | null;
  dentist_name: string | null;
  created_at: string | null;
};

type PaymentRow = {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  mode: string;
  reference_no: string | null;
  notes: string | null;
  created_at: string | null;
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

type DraftLine = {
  id: string;
  tooth_number: number | null;
  service_price_id: string | null;
  procedure: string;
  note: string;
};

const attachmentTypes = ["XRAY", "PHOTO", "FORM", "LAB", "OTHER"] as const;
type AttachmentType = (typeof attachmentTypes)[number];

const tabs = ["Info", "Medical", "Chart", "Treatments", "Attachments", "Documents", "Billing"] as const;
type Tab = (typeof tabs)[number];

/* =========================
   Helpers
========================= */
function splitFullName(full: string | null | undefined) {
  const s = (full ?? "").trim().replace(/\s+/g, " ");
  if (!s) return { first: "", last: "" };

  const parts = s.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };

  const first = parts.slice(0, -1).join(" ");
  const last = parts[parts.length - 1];
  return { first, last };
}

function combineFullName(first: string | null | undefined, last: string | null | undefined) {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  return [f, l].filter(Boolean).join(" ").trim();
}

function num(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatPHPhoneVisible(input: string) {
  const digits = (input || "").replace(/\D/g, "").slice(0, 11); // max 11 digits
  if (!digits) return "";

  const p1 = digits.slice(0, 4);
  const p2 = digits.slice(4, 7);
  const p3 = digits.slice(7, 11);

  if (digits.length <= 4) return p1;
  if (digits.length <= 7) return `${p1} ${p2}`;
  return `${p1} ${p2} ${p3}`;
}

function formatGenderLabel(g: GenderDB) {
  if (g === "male") return "Male";
  if (g === "female") return "Female";
  return "—";
}

function normalizeGenderInput(v: string): GenderDB {
  const s = (v || "").trim().toLowerCase();
  if (s === "male") return "male";
  if (s === "female") return "female";
  return null;
}

function formatDatePH(isoDate: string | null | undefined) {
  if (!isoDate) return "—";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function formatDateTimePH(iso: string | null | undefined) {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function calcAge(isoDate: string | null | undefined) {
  if (!isoDate) return null;
  const parts = isoDate.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;

  const today = new Date();
  let age = today.getFullYear() - y;
  const mm = today.getMonth() + 1;
  const dd = today.getDate();
  if (mm < m || (mm === m && dd < d)) age -= 1;
  return age;
}

function generateReceiptNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCPT-${y}${m}${d}-${rand}`;
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
}

function parseToothOrNull(v: string) {
  const n = v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
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

/* =========================
   Modal
========================= */
function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4"
      onDoubleClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl border overflow-hidden"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="text-sm font-semibold">{title}</div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* =========================
   Field
========================= */
function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-700">{label}</span>
      {textarea ? (
        <textarea
          className="min-h-[88px] rounded-lg border px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="h-10 rounded-lg border px-3"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

/* =========================
   Page
========================= */
export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();

  const id = (params?.id as string) || "";

  const [tab, setTab] = useState<Tab>("Info");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);

  // Last visit (concern will later come from appointments integration)
  const [lastVisitDate, setLastVisitDate] = useState<string>("");
  const [lastVisitDentist, setLastVisitDentist] = useState<string>("");
  const [lastVisitConcern, setLastVisitConcern] = useState<string>("");

  // Info edit
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editGender, setEditGender] = useState<"" | "male" | "female">("");
  const [editAddress, setEditAddress] = useState("");
  const [deletePatientText, setDeletePatientText] = useState("");

  // Medical
  const [med, setMed] = useState<MedHist | null>(null);
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [bp, setBp] = useState("");
  const [medNotes, setMedNotes] = useState("");

  // Dentists + services
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [serviceMenu, setServiceMenu] = useState<ServicePriceRow[]>([]);

  const dentistNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of dentists) m[d.id] = d.full_name;
    return m;
  }, [dentists]);

  // Chart
  const [chart, setChart] = useState<ChartEntry[]>([]);
  const [toothStatuses, setToothStatuses] = useState<
    Record<number, { status: ToothStatus; note: string | null; updated_at?: string }>
  >({});
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [toothNote, setToothNote] = useState("");
  const [surfaceSel, setSurfaceSel] = useState<string[]>([]);
  const [findingDetail, setFindingDetail] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string>("HEALTHY");

  // Treatments
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  useEffect(() => {
    if (!treatments || treatments.length === 0) {
      setLastVisitDate("");
      setLastVisitDentist("");
      setLastVisitConcern("");
      return;
    }

    const latest = [...treatments].sort((a, b) => {
      const da = (a.treatment_date ?? "").localeCompare(b.treatment_date ?? "");
      const dc = (a.created_at ?? "").localeCompare(b.created_at ?? "");
      if (da !== 0) return da * -1;
      return dc * -1;
    })[0];

    setLastVisitDate(latest.treatment_date ?? "");

    const name =
      (latest.dentist_id ? dentistNameById[latest.dentist_id] : "") || latest.dentist_name || "";

    setLastVisitDentist(name);
    setLastVisitConcern("");
  }, [treatments, dentistNameById]);

  const [visitDate, setVisitDate] = useState(() => todayLocalISO());
  const [visitDentistId, setVisitDentistId] = useState<string>(""); // neutral
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [lineTooth, setLineTooth] = useState("");
  const [txServiceId, setTxServiceId] = useState<string>("");
  const [txServiceName, setTxServiceName] = useState<string>("");
  const [lineNote, setLineNote] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadType, setUploadType] = useState<AttachmentType | "">("");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [attachmentEdit, setAttachmentEdit] = useState<Attachment | null>(null);
  const [attachmentEditName, setAttachmentEditName] = useState("");
  const [attachmentDeleteConfirm, setAttachmentDeleteConfirm] = useState("");
  const [attachmentSort, setAttachmentSort] = useState<"DATE_DESC" | "DATE_ASC" | "NAME_ASC">("DATE_DESC");

  // Documents
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);
  const [docSort, setDocSort] = useState<"DATE_DESC" | "DATE_ASC" | "TYPE_ASC">("DATE_DESC");
  const [genDocEdit, setGenDocEdit] = useState<GeneratedDoc | null>(null);
  const [genDocEditNumber, setGenDocEditNumber] = useState("");
  const [genDocDeleteConfirm, setGenDocDeleteConfirm] = useState("");

  const [docVisitDate, setDocVisitDate] = useState(() => todayLocalISO());
  const [docDentistId, setDocDentistId] = useState<string>(""); // neutral
  const [docReceiptNo, setDocReceiptNo] = useState("");
  const [docItems, setDocItems] = useState("");
  const [docAmountPaid, setDocAmountPaid] = useState("");
  const [docPaymentMethod, setDocPaymentMethod] = useState("Cash");
  const [docBalance, setDocBalance] = useState("");
  const [docFindings, setDocFindings] = useState("");
  const [docTreatmentDone, setDocTreatmentDone] = useState("");
  const [docRemarks, setDocRemarks] = useState("");
  const [docIssuedBy, setDocIssuedBy] = useState("");

  // Billing
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemRow[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<PaymentRow[]>([]);
  const [visitSelectInvoiceId, setVisitSelectInvoiceId] = useState<string>("");

  // Discount modal
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<"AMOUNT" | "PERCENT">("AMOUNT");
  const [discountValue, setDiscountValue] = useState("");

  // Edit item modal
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<InvoiceItemRow | null>(null);
  const [editItemQty, setEditItemQty] = useState("1");
  const [editItemUnit, setEditItemUnit] = useState("0");
  const [deleteItemConfirmOpen, setDeleteItemConfirmOpen] = useState(false);
  const [deleteItemText, setDeleteItemText] = useState("");

  // Payments add
  const [payDate, setPayDate] = useState(() => todayLocalISO());
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [paymentView, setPaymentView] = useState<PaymentRow | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const displayedAttachments = useMemo(() => {
    const copy = [...attachments];
    if (attachmentSort === "NAME_ASC") {
      copy.sort((a, b) => {
        const an = (a.file_name ?? a.file_path.split("/").slice(-1)[0] ?? "").toLowerCase();
        const bn = (b.file_name ?? b.file_path.split("/").slice(-1)[0] ?? "").toLowerCase();
        return an.localeCompare(bn);
      });
      return copy;
    }
    if (attachmentSort === "DATE_ASC") {
      copy.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
      return copy;
    }
    copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return copy;
  }, [attachments, attachmentSort]);

  const displayedGeneratedDocs = useMemo(() => {
    const copy = [...generatedDocs];
    if (docSort === "TYPE_ASC") {
      copy.sort(
        (a, b) =>
          (a.doc_type ?? "").localeCompare(b.doc_type ?? "") || (a.created_at < b.created_at ? 1 : -1)
      );
      return copy;
    }
    if (docSort === "DATE_ASC") {
      copy.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
      return copy;
    }
    copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return copy;
  }, [generatedDocs, docSort]);

  const invoicesById = useMemo(() => {
    const m: Record<string, InvoiceRow> = {};
    for (const i of invoices) m[i.id] = i;
    return m;
  }, [invoices]);

  const groupedTreatmentHistory = useMemo(() => {
    const acc: Record<string, Treatment[]> = {};
    for (const t of treatments) {
      const k = t.treatment_date;
      acc[k] = acc[k] ? [...acc[k], t] : [t];
    }
    for (const k of Object.keys(acc)) {
      acc[k] = acc[k].slice().sort((a, b) => {
        const aa = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bb - aa;
      });
    }
    return Object.entries(acc).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [treatments]);

  const visitDates = useMemo(() => {
    const set = new Set<string>();
    for (const t of treatments) {
      if (t.treatment_date) set.add(t.treatment_date);
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [treatments]);

  const [billingVisitDate, setBillingVisitDate] = useState<string>("");

  const billingSummary = useMemo(() => {
    const totalAll = invoices.reduce((sum, i) => sum + num(i.total), 0);
    const paidAll = payments.reduce((sum, p) => sum + num(p.amount), 0);
    const balanceAll = Math.max(0, totalAll - paidAll);
    return { totalAll, paidAll, balanceAll };
  }, [invoices, payments]);

  const activeInvoice = activeInvoiceId ? invoicesById[activeInvoiceId] : null;
  const activePaid = invoicePayments.reduce((sum, p) => sum + num(p.amount), 0);
  const activeTotal = num(activeInvoice?.total);
  const activeBalance = Math.max(0, activeTotal - activePaid);

  const invoiceSubtotalComputed = useMemo(() => {
    return invoiceItems.reduce((sum, it) => {
      const isDiscount = (it.service_name ?? "").toLowerCase() === "discount";
      return sum + (isDiscount ? 0 : num(it.line_total));
    }, 0);
  }, [invoiceItems]);

  /* =========================
     Data loading
  ========================= */
  async function loadInvoiceDetails(invoiceId: string) {
    const it = await supabase
      .from("invoice_items")
      .select("id, invoice_id, service_name, description, qty, unit_price, line_total, tooth_number, dentist_name, created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    if (it.error || !it.data) {
      setInvoiceItems([]);
    } else {
      const items = it.data as InvoiceItemRow[];

      const isDiscount = (x: InvoiceItemRow) => (x.service_name ?? "").toLowerCase() === "discount";

      const sorted = items.slice().sort((a, b) => {
        const ad = isDiscount(a);
        const bd = isDiscount(b);
        if (ad !== bd) return ad ? 1 : -1;

        const ta = a.tooth_number ?? 9999;
        const tb = b.tooth_number ?? 9999;
        if (ta !== tb) return ta - tb;

        const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
        const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ca - cb;
      });

      setInvoiceItems(sorted);
    }

    const pay = await supabase
      .from("payments")
      .select("id, invoice_id, payment_date, amount, mode, reference_no, notes, created_at")
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (pay.error || !pay.data) setInvoicePayments([]);
    else setInvoicePayments(pay.data as PaymentRow[]);
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

  async function openBillingForVisitDate(date: string) {
    if (!patient) return;

    setBusy(true);
    setErr(null);

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
    setVisitSelectInvoiceId(invoiceId);
    setBillingVisitDate(date);

    const rec = await supabase.rpc("recalc_invoice", { p_invoice_id: invoiceId });
    if (rec.error) {
      setBusy(false);
      setErr(rec.error.message);
      return;
    }

    await loadInvoiceDetails(invoiceId);

    const inv = await supabase
      .from("invoices")
      .select("id, invoice_date, dentist_name, status, subtotal, discount_amount, total, notes, created_at")
      .eq("patient_id", id)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!inv.error && inv.data) setInvoices(inv.data as InvoiceRow[]);

    const pay = await supabase
      .from("payments")
      .select("id, invoice_id, payment_date, amount, mode, reference_no, notes, created_at")
      .eq("patient_id", id);

    if (!pay.error && pay.data) setPayments(pay.data as PaymentRow[]);

    setBusy(false);
  }

  async function refreshActiveInvoiceFromTreatments() {
    if (!activeInvoiceId) {
      setErr("Open an invoice first (select a visit date).");
      return;
    }

    setBusy(true);
    setErr(null);

    const r = await supabase.rpc("sync_invoice_items_from_treatments", {
      p_invoice_id: activeInvoiceId,
    });
    if (r.error) {
      setBusy(false);
      setErr(r.error.message);
      return;
    }

    const rec = await supabase.rpc("recalc_invoice", { p_invoice_id: activeInvoiceId });
    if (rec.error) {
      setBusy(false);
      setErr(rec.error.message);
      return;
    }

    await loadInvoiceDetails(activeInvoiceId);

    const inv = await supabase
      .from("invoices")
      .select("id, invoice_date, dentist_name, status, subtotal, discount_amount, total, notes, created_at")
      .eq("patient_id", id)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!inv.error && inv.data) setInvoices(inv.data as InvoiceRow[]);

    const pay = await supabase
      .from("payments")
      .select("id, invoice_id, payment_date, amount, mode, reference_no, notes, created_at")
      .eq("patient_id", id);

    if (!pay.error && pay.data) setPayments(pay.data as PaymentRow[]);

    setBusy(false);
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);

    const p = await supabase
      .from("patients")
      .select("id, full_name, first_name, last_name, phone, birth_date, address, occupation, email, notes, gender")
      .eq("id", id)
      .single();

    if (p.error) {
      setErr(p.error.message);
      setLoading(false);
      return;
    }

    const patRaw = p.data as any;

    // Prefer first/last from DB, fallback to full_name split
    const fallback = splitFullName(patRaw.full_name ?? "");
    const dbFirst = String(patRaw.first_name ?? "").trim();
    const dbLast = String(patRaw.last_name ?? "").trim();
    const firstNameFinal = dbFirst || fallback.first;
    const lastNameFinal = dbLast || fallback.last;

    const fullNameFinal = combineFullName(firstNameFinal, lastNameFinal) || String(patRaw.full_name ?? "").trim();

    const pat: Patient = {
      id: patRaw.id,
      full_name: fullNameFinal,
      first_name: firstNameFinal || null,
      last_name: lastNameFinal || null,
      phone: patRaw.phone ?? null,
      birth_date: patRaw.birth_date ?? null,
      address: patRaw.address ?? null,
      occupation: patRaw.occupation ?? null,
      email: patRaw.email ?? null,
      notes: patRaw.notes ?? null,
      gender: normalizeGenderInput(String(patRaw.gender ?? "")),
    };

    setPatient(pat);

    setEditFirstName(pat.first_name ?? "");
    setEditLastName(pat.last_name ?? "");
    setEditPhone(pat.phone ?? "");
    setEditBirthDate(pat.birth_date ?? "");
    setEditGender((pat.gender ?? "") as any);
    setEditAddress(pat.address ?? "");

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
      setAllergies("");
      setMedications("");
      setBp("");
      setMedNotes("");
    }

    const d = await supabase
      .from("dentists")
      .select("id, full_name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });

    setDentists(!d.error && d.data ? (d.data as DentistRow[]) : []);

    const sm = await supabase
      .from("service_prices")
      .select("id, service_name, default_price, item_type, is_active, sort_order, created_at")
      .order("item_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("service_name", { ascending: true });

    setServiceMenu(!sm.error && sm.data ? (sm.data as ServicePriceRow[]) : []);

    const c = await supabase
      .from("dental_chart_entries")
      .select("id, tooth_number, surfaces, finding_code, finding_detail, notes, recorded_at")
      .eq("patient_id", id)
      .order("recorded_at", { ascending: false });

    setChart(!c.error && c.data ? (c.data as ChartEntry[]) : []);

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

    const t = await supabase
      .from("treatments")
      .select("id, treatment_date, procedure, tooth_number, notes, dentist_id, dentist_name, service_price_id, created_at")
      .eq("patient_id", id)
      .order("treatment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    setTreatments(!t.error && t.data ? (t.data as Treatment[]) : []);

    const a = await supabase
      .from("attachments")
      .select("id, type, file_path, file_name, content_type, file_size_bytes, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });

    setAttachments(!a.error && a.data ? (a.data as Attachment[]) : []);

    const tpl = await supabase
      .from("document_templates")
      .select("id, name, doc_type, content_html")
      .eq("is_active", true)
      .order("name", { ascending: true });

    setTemplates(!tpl.error && tpl.data ? (tpl.data as DocTemplate[]) : []);

    const gd = await supabase
      .from("generated_documents")
      .select("id, doc_type, doc_number, payload, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    setGeneratedDocs(!gd.error && gd.data ? (gd.data as GeneratedDoc[]) : []);

    const inv = await supabase
      .from("invoices")
      .select("id, invoice_date, dentist_name, status, subtotal, discount_amount, total, notes, created_at")
      .eq("patient_id", id)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    const invRows = !inv.error && inv.data ? (inv.data as InvoiceRow[]) : [];
    setInvoices(invRows);

    const latest = invRows[0] ?? null;
    if (latest?.invoice_date) {
      setLastVisitDate(latest.invoice_date ?? "");
      const invDentist = String((latest as any)?.dentist_name ?? "").trim();
      if (invDentist) setLastVisitDentist(invDentist);
    }
    setLastVisitConcern((latest as any)?.notes ?? "");

    const pay = await supabase
      .from("payments")
      .select("id, invoice_id, payment_date, amount, mode, reference_no, notes, created_at")
      .eq("patient_id", id);

    setPayments(!pay.error && pay.data ? (pay.data as PaymentRow[]) : []);

    if (invRows.length) {
      const next = activeInvoiceId || visitSelectInvoiceId || invRows[0].id;

      setVisitSelectInvoiceId(next);
      setActiveInvoiceId(next);
      await loadInvoiceDetails(next);

      const chosen = invRows.find((x) => x.id === next);
      if (chosen?.invoice_date) setBillingVisitDate(chosen.invoice_date);
    } else {
      setVisitSelectInvoiceId("");
      setActiveInvoiceId(null);
      setInvoiceItems([]);
      setInvoicePayments([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!id) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!activeInvoiceId) return;
    const inv = invoicesById[activeInvoiceId];
    if (inv?.invoice_date) setBillingVisitDate(inv.invoice_date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInvoiceId]);

  /* =========================
     Actions
  ========================= */
  async function savePatientEdits() {
    if (!patient) return;

    const f = editFirstName.trim();
    const l = editLastName.trim();
    const full = combineFullName(f, l);

    if (!f && !l) {
      setErr("Please enter at least a first name or last name.");
      return;
    }

    setBusy(true);
    setErr(null);

    const genderToSave: GenderDB =
      editGender === "male" || editGender === "female" ? editGender : null;

    const res = await supabase
      .from("patients")
      .update({
        first_name: f || null,
        last_name: l || null,
        full_name: full || null, // keep compatibility
        phone: editPhone.trim() || null,
        birth_date: editBirthDate || null,
        gender: genderToSave,
        address: editAddress.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", patient.id);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setEditOpen(false);
    setDeletePatientText("");
    await loadAll();
  }

  async function deletePatient() {
    if (!patient) return;
    if (deletePatientText.trim().toUpperCase() !== "DELETE") {
      setErr("Type DELETE to confirm.");
      return;
    }
    setBusy(true);
    setErr(null);

    const res = await supabase.from("patients").delete().eq("id", patient.id);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

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

  async function saveToothStatus(status: string) {
    if (!selectedTooth) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

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
      return setErr(up.error.message);
    }

    const surfacesToSave =
      status === "CARIES" || status === "FILLED"
        ? surfaceSel.length
          ? surfaceSel.slice().sort().join("")
          : null
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
    if (hist.error) return setErr(hist.error.message);

    if (status !== "CARIES" && status !== "FILLED") setSurfaceSel([]);
    await loadAll();
  }

  function addDraftLine() {
    setErr(null);

    if (!visitDate) return setErr("Select a visit date first.");
    if (!visitDentistId) return setErr("Select the attending dentist first.");
    if (!txServiceId || !txServiceName.trim()) return setErr("Select a procedure/service.");

    const toothVal = parseToothOrNull(lineTooth);

    const next: DraftLine = {
      id: crypto.randomUUID(),
      tooth_number: toothVal,
      service_price_id: txServiceId || null,
      procedure: txServiceName.trim(),
      note: lineNote.trim(),
    };

    setDraftLines((prev) => [next, ...prev]);
    setLineTooth("");
    setTxServiceId("");
    setTxServiceName("");
    setLineNote("");
  }

  function removeDraftLine(lineId: string) {
    setDraftLines((prev) => prev.filter((x) => x.id !== lineId));
  }

  async function saveVisit() {
    if (!patient) return;
    setErr(null);

    if (!visitDate) return setErr("Select a visit date.");
    if (!visitDentistId) return setErr("Select the attending dentist.");
    if (draftLines.length === 0) return setErr("Add at least one procedure.");

    setBusy(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const payload = draftLines.map((ln) => ({
      patient_id: patient.id,
      treatment_date: visitDate,
      dentist_id: visitDentistId,
      procedure: ln.procedure,
      service_price_id: ln.service_price_id,
      tooth_number: ln.tooth_number,
      notes: ln.note || null,
      created_by: userId,
    }));

    const res = await supabase.from("treatments").insert(payload);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setDraftLines([]);
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

  async function uploadAttachment() {
    if (!fileToUpload) return;
    if (!uploadType) {
      setErr("Please select an attachment type.");
      return;
    }
    if (fileToUpload.size > 5 * 1024 * 1024) {
      setErr("File is too large. Please upload a file up to 5 MB.");
      return;
    }

    setErr(null);
    setBusy(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const base = safeFileName(fileToUpload.name);
    const random = crypto.randomUUID();
    const today = todayLocalISO();
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
    if (ins.error) return setErr(ins.error.message);

    setFileToUpload(null);
    setUploadType("");
    await loadAll();
  }

  async function renameAttachment(attachmentId: string, newFileName: string) {
    setBusy(true);
    setErr(null);

    const res = await supabase
      .from("attachments")
      .update({ file_name: newFileName.trim() || null })
      .eq("id", attachmentId);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setAttachmentEdit(null);
    setAttachmentEditName("");
    setAttachmentDeleteConfirm("");
    await loadAll();
  }

  async function deleteAttachment(attachmentId: string, storagePath: string) {
    setBusy(true);
    setErr(null);

    const s = await supabase.storage.from("patient-files").remove([storagePath]);
    if (s.error) {
      setBusy(false);
      return setErr(s.error.message);
    }

    const d = await supabase.from("attachments").delete().eq("id", attachmentId);

    setBusy(false);
    if (d.error) return setErr(d.error.message);

    await loadAll();
  }

  async function recalcInvoice(invoiceId: string) {
    const r = await supabase.rpc("recalc_invoice", { p_invoice_id: invoiceId });
    if (r.error) {
      setErr(r.error.message);
      return false;
    }
    return true;
  }

  function subtotalExcludingDiscount(items: InvoiceItemRow[]) {
    return items
      .filter((it) => (it.service_name ?? "").toLowerCase() !== "discount")
      .reduce((sum, it) => sum + num(it.line_total), 0);
  }

  async function applyDiscountAsLine() {
    setErr(null);
    if (!activeInvoiceId) {
      setErr("Open an invoice first (select a visit date) before adding a discount.");
      return;
    }

    const raw = Number(discountValue);
    if (!Number.isFinite(raw) || raw <= 0) {
      setErr("Enter a valid discount value.");
      return;
    }

    const base = subtotalExcludingDiscount(invoiceItems);

    let amount = 0;
    if (discountMode === "AMOUNT") amount = raw;
    else amount = (base * raw) / 100;

    amount = Math.max(0, amount);
    if (amount <= 0) {
      setErr("Discount computed to 0.");
      return;
    }

    setBusy(true);

    const existing = invoiceItems.filter((it) => (it.service_name ?? "").toLowerCase() === "discount");
    if (existing.length) {
      const del = await supabase
        .from("invoice_items")
        .delete()
        .in(
          "id",
          existing.map((x) => x.id)
        );

      if (del.error) {
        setBusy(false);
        setErr(del.error.message);
        return;
      }
    }

    const ins = await supabase.from("invoice_items").insert({
      invoice_id: activeInvoiceId,
      service_name: "Discount",
      description: discountMode === "PERCENT" ? `${raw}% discount` : `PHP ${raw.toFixed(2)} discount`,
      qty: 1,
      unit_price: -amount,
      line_total: -amount,
      tooth_number: null,
      dentist_name: null,
    });

    if (ins.error) {
      setBusy(false);
      setErr(ins.error.message);
      return;
    }

    const rec = await supabase.rpc("recalc_invoice", { p_invoice_id: activeInvoiceId });
    if (rec.error) {
      setBusy(false);
      setErr(rec.error.message);
      return;
    }

    await loadInvoiceDetails(activeInvoiceId);

    const inv = await supabase
      .from("invoices")
      .select("id, invoice_date, dentist_name, status, subtotal, discount_amount, total, notes, created_at")
      .eq("patient_id", id)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!inv.error && inv.data) setInvoices(inv.data as InvoiceRow[]);

    const pay = await supabase
      .from("payments")
      .select("id, invoice_id, payment_date, amount, mode, reference_no, notes, created_at")
      .eq("patient_id", id);

    if (!pay.error && pay.data) setPayments(pay.data as PaymentRow[]);

    setBusy(false);

    setDiscountOpen(false);
    setDiscountValue("");
  }

  function openEditItem(it: InvoiceItemRow) {
    setEditItem(it);
    setEditItemQty(String(it.qty ?? 1));
    setEditItemUnit(String(it.unit_price ?? 0));
    setEditItemOpen(true);
  }

  async function saveEditItem() {
    if (!editItem) return;
    setErr(null);

    const q = Number(editItemQty);
    const u = Number(editItemUnit);

    if (!Number.isFinite(q) || q <= 0) return setErr("Qty must be a valid number.");
    if (!Number.isFinite(u)) return setErr("Unit price must be a valid number.");

    const lt = q * u;

    setBusy(true);
    const res = await supabase
      .from("invoice_items")
      .update({ qty: q, unit_price: u, line_total: lt })
      .eq("id", editItem.id);

    if (res.error) {
      setBusy(false);
      return setErr(res.error.message);
    }

    if (activeInvoiceId) await recalcInvoice(activeInvoiceId);

    setBusy(false);
    setEditItemOpen(false);
    setEditItem(null);

    if (activeInvoiceId) {
      await loadInvoiceDetails(activeInvoiceId);
      await loadAll();
    }
  }

  async function deleteInvoiceItem() {
    if (!editItem) return;
    if (deleteItemText.trim().toUpperCase() !== "DELETE") {
      setErr("Type DELETE to confirm.");
      return;
    }

    setBusy(true);
    const res = await supabase.from("invoice_items").delete().eq("id", editItem.id);

    if (res.error) {
      setBusy(false);
      return setErr(res.error.message);
    }

    if (activeInvoiceId) await recalcInvoice(activeInvoiceId);

    setBusy(false);
    setDeleteItemConfirmOpen(false);
    setEditItemOpen(false);
    setEditItem(null);
    setDeleteItemText("");

    if (activeInvoiceId) {
      await loadInvoiceDetails(activeInvoiceId);
      await loadAll();
    }
  }

  async function addPayment() {
    if (!activeInvoiceId || !patient) return;

    setErr(null);
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) return setErr("Enter a valid payment amount.");

    setBusy(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const res = await supabase.from("payments").insert({
      patient_id: patient.id,
      invoice_id: activeInvoiceId,
      payment_date: payDate,
      amount: amt,
      mode: payMode,
      reference_no: payRef.trim() || null,
      created_by: userId,
    });

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setPayAmount("");
    setPayRef("");

    await loadInvoiceDetails(activeInvoiceId);
    await loadAll();
  }

  function buildDocVars(): Record<string, string> {
    if (!patient) return {};
    const dentistName = docDentistId ? dentistNameById[docDentistId] ?? "" : "";
    const full = combineFullName(patient.first_name, patient.last_name) || patient.full_name || "";

    return {
      "patient.full_name": escapeHtml(full),
      "patient.phone": escapeHtml(patient.phone ?? ""),
      "patient.birth_date": escapeHtml(patient.birth_date ?? ""),
      "patient.address": escapeHtml(patient.address ?? ""),
      "doc.visit_date": escapeHtml(docVisitDate || todayLocalISO()),
      "doc.dentist_name": escapeHtml(dentistName),
      "doc.receipt_no": escapeHtml(docReceiptNo),
      "doc.items": escapeHtml(docItems).replaceAll("\n", "<br/>"),
      "doc.amount_paid": escapeHtml(docAmountPaid),
      "doc.payment_method": escapeHtml(docPaymentMethod),
      "doc.balance": escapeHtml(docBalance),
      "doc.findings": escapeHtml(docFindings).replaceAll("\n", "<br/>"),
      "doc.treatment_done": escapeHtml(docTreatmentDone).replaceAll("\n", "<br/>"),
      "doc.remarks": escapeHtml(docRemarks).replaceAll("\n", "<br/>"),
      "doc.issued_by": escapeHtml(docIssuedBy),
    };
  }

  function updatePreviewFromTemplate(tpl: DocTemplate | null) {
    if (!tpl) {
      setPreviewHtml("");
      return;
    }
    const vars = buildDocVars();
    const html = renderTemplate(tpl.content_html ?? "", vars);
    setPreviewHtml(html);
  }

  useEffect(() => {
    updatePreviewFromTemplate(selectedTemplate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedTemplateId,
    patient?.id,
    docVisitDate,
    docDentistId,
    docReceiptNo,
    docItems,
    docAmountPaid,
    docPaymentMethod,
    docBalance,
    docFindings,
    docTreatmentDone,
    docRemarks,
    docIssuedBy,
  ]);

  async function generateDocument() {
    if (!patient) return;
    if (!selectedTemplate) return setErr("Select a template.");
    if (!docVisitDate) return setErr("Select a visit date.");
    if (!docDentistId) return setErr("Select a dentist.");

    setBusy(true);
    setErr(null);

    const payload = {
      template_id: selectedTemplate.id,
      template_name: selectedTemplate.name,
      doc_type: selectedTemplate.doc_type,
      visit_date: docVisitDate,
      dentist_id: docDentistId,
      dentist_name: dentistNameById[docDentistId] ?? null,
      fields: {
        receipt_no: docReceiptNo || null,
        items: docItems || null,
        amount_paid: docAmountPaid || null,
        payment_method: docPaymentMethod || null,
        balance: docBalance || null,
        findings: docFindings || null,
        treatment_done: docTreatmentDone || null,
        remarks: docRemarks || null,
        issued_by: docIssuedBy || null,
      },
      rendered_html: previewHtml,
    };

    const ins = await supabase.from("generated_documents").insert({
      patient_id: patient.id,
      doc_type: selectedTemplate.doc_type,
      doc_number: docReceiptNo.trim() || null,
      payload,
    });

    setBusy(false);
    if (ins.error) return setErr(ins.error.message);

    await loadAll();
  }

  async function updateGeneratedDocNumber(docId: string, nextNumber: string) {
    setBusy(true);
    setErr(null);

    const res = await supabase
      .from("generated_documents")
      .update({ doc_number: nextNumber.trim() || null })
      .eq("id", docId);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setGenDocEdit(null);
    setGenDocEditNumber("");
    setGenDocDeleteConfirm("");
    await loadAll();
  }

  async function deleteGeneratedDoc(docId: string) {
    setBusy(true);
    setErr(null);

    const res = await supabase.from("generated_documents").delete().eq("id", docId);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setGenDocEdit(null);
    setGenDocEditNumber("");
    setGenDocDeleteConfirm("");
    await loadAll();
  }

  function printHtml(html: string) {
    if (!html) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Print</title></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  function openHtml(html: string) {
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  /* =========================
     Render
  ========================= */
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

  if (!patient) {
    return <div className="min-h-screen p-6 text-red-600">Patient not found.</div>;
  }

  const displayFullName = combineFullName(patient.first_name, patient.last_name) || patient.full_name || "";

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{displayFullName}</h1>
          </div>

          <button className="rounded-lg border bg-white px-3 py-2 text-sm" onClick={() => router.push("/patients")}>
            Back
          </button>
        </div>

        {err ? (
          <div className="mt-3 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div>
        ) : null}

        {/* Main box */}
        <div className="mt-4 rounded-2xl border bg-white overflow-hidden">
          {/* Outer tabs only */}
          <div className="flex flex-wrap gap-1 border-b bg-slate-50 px-2 pt-2">
            {tabs.map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={[
                    "px-3 py-2 text-sm font-semibold rounded-t-xl border",
                    active ? "bg-white border-b-white" : "bg-slate-50 hover:bg-white",
                  ].join(" ")}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="p-4">
            {/* ================= Modals ================= */}
            <Modal
              open={editOpen}
              title="Edit patient"
              onClose={() => {
                setEditOpen(false);
                setDeletePatientText("");
              }}
            >
              <div className="grid gap-4">
                {/* R1: Last Name, First Name */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Last name</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Last name"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">First name</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="First name"
                    />
                  </label>
                </div>

                {/* R2: Birth date, Gender */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Birth date</span>
                    <input
                      type="date"
                      className="h-10 rounded-lg border px-3"
                      value={editBirthDate}
                      onChange={(e) => setEditBirthDate(e.target.value)}
                    />
                  </label>

                  <div className="grid gap-1 text-sm">
                    <span className="text-slate-700">Gender</span>
                    <div className="h-10 rounded-lg border bg-white px-3 flex items-center gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="gender" checked={editGender === "male"} onChange={() => setEditGender("male")} />
                        <span>Male</span>
                      </label>

                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="gender" checked={editGender === "female"} onChange={() => setEditGender("female")} />
                        <span>Female</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* R3: Phone number, Address */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Phone number</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={editPhone}
                      onChange={(e) => setEditPhone(formatPHPhoneVisible(e.target.value))}
                      placeholder="09XX XXX XXXX"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Address</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Address"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold"
                    onClick={() => {
                      setEditOpen(false);
                      setDeletePatientText("");
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                    onClick={savePatientEdits}
                    disabled={busy}
                  >
                    Save
                  </button>
                </div>

                {/* Delete section (type to DELETE) */}
                <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <div className="text-sm font-semibold text-rose-800">Delete patient</div>
                  <div className="mt-1 text-xs text-rose-700">
                    This will permanently delete this patient and related data. Type DELETE to confirm.
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      className="h-10 rounded-lg border border-rose-200 bg-white px-3"
                      value={deletePatientText}
                      onChange={(e) => setDeletePatientText(e.target.value)}
                      placeholder="Type DELETE"
                    />
                    <button
                      className="h-10 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
                      onClick={deletePatient}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </Modal>

            {/* ================= Tab content ================= */}
            {tab === "Info" ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Patient information</div>
                    <button
                      className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold"
                      onClick={() => setEditOpen(true)}
                    >
                      Edit
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {/* First + Last */}
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">First name</span>
                      <input
                        className="rounded-lg border bg-slate-50 px-3 py-2"
                        value={patient.first_name ?? ""}
                        readOnly
                      />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Last name</span>
                      <input
                        className="rounded-lg border bg-slate-50 px-3 py-2"
                        value={patient.last_name ?? ""}
                        readOnly
                      />
                    </label>

                    {/* DOB + Age */}
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Date of birth</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={patient.birth_date ?? ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Age</span>
                      <input
                        className="rounded-lg border bg-slate-50 px-3 py-2"
                        value={calcAge(patient.birth_date)?.toString() ?? ""}
                        readOnly
                      />
                    </label>

                    {/* Gender + Phone */}
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Gender</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={formatGenderLabel(patient.gender)} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Phone number</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={patient.phone ?? ""} readOnly />
                    </label>

                    {/* Address */}
                    <label className="grid gap-1 text-sm sm:col-span-2">
                      <span className="text-slate-700">Address</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={patient.address ?? ""} readOnly />
                    </label>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">Last visit</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Date</span>
                      <input className="rounded-lg border bg-white px-3 py-2" value={lastVisitDate ? formatDatePH(lastVisitDate) : ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Dentist</span>
                      <input className="rounded-lg border bg-white px-3 py-2" value={lastVisitDentist || ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Concern</span>
                      <input className="rounded-lg border bg-white px-3 py-2" value={lastVisitConcern || ""} readOnly />
                    </label>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    TODO: Replace “Concern” with appointment/visit chief complaint once scheduling/messenger integration is done.
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
              <div className="rounded-2xl border bg-white p-4">
                <ToothChart
                  entries={chart ?? []}
                  statuses={toothStatuses}
                  selectedTooth={selectedTooth}
                  onSelectTooth={(n) => {
                    setSelectedTooth(n);
                    setToothNote(toothStatuses[n]?.note ?? "");
                    setPendingStatus(toothStatuses[n]?.status ?? "HEALTHY");
                    setSurfaceSel([]);
                    setFindingDetail("");
                  }}
                />

                <div className="mt-4 rounded-xl border bg-slate-50 p-3">
                  <div className="flex items-center justify-center">
                    <div className="text-sm font-semibold">Tooth tools</div>
                  </div>

                  <div className="mt-2 text-center text-sm text-slate-700">
                    Tooth# <span className="font-semibold text-slate-900">{selectedTooth ?? "—"}</span>
                  </div>

                  {/* Status buttons (centered, NO auto-save) */}
                  <div className="mt-4">
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {(
                        ["HEALTHY", "CARIES", "FILLED", "MISSING", "EXTRACTED", "RCT", "CROWN", "IMPLANT", "DENTURE"] as ToothStatus[]
                      ).map((s) => {
                        const theme = getStatusTheme(s);
                        const isCurrent = pendingStatus === s;

                        return (
                          <button
                            key={s}
                            type="button"
                            className={[
                              "rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60 transition",
                              "hover:brightness-95 active:scale-[0.99]",
                              theme.chip,
                              isCurrent ? "ring-2 ring-slate-700" : "",
                            ].join(" ")}
                            disabled={!selectedTooth || busy}
                            onClick={() => {
                              setPendingStatus(s);
                              if (s !== "CARIES" && s !== "FILLED") setSurfaceSel([]);
                            }}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Surfaces (centered, NO auto-save) */}
                  {pendingStatus === "CARIES" || pendingStatus === "FILLED" ? (
                    <div className="mt-4">
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        {[
                          { code: "O", label: "O" },
                          { code: "M", label: "M" },
                          { code: "D", label: "D" },
                          { code: "B", label: "B" },
                          { code: "L", label: "L" },
                          { code: "I", label: "I" },
                        ].map((s) => {
                          const on = surfaceSel.includes(s.code);
                          return (
                            <button
                              key={s.code}
                              type="button"
                              className={[
                                "h-10 w-10 rounded-xl border text-sm font-semibold transition disabled:opacity-60",
                                on ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50",
                              ].join(" ")}
                              onClick={() =>
                                setSurfaceSel((prev) =>
                                  prev.includes(s.code) ? prev.filter((x) => x !== s.code) : [...prev, s.code]
                                )
                              }
                              disabled={!selectedTooth || busy}
                              title={s.code === "I" ? "Incisal" : s.code}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Note */}
                  <div className="mt-3 flex justify-center">
                    <label className="grid w-full max-w-xl gap-1 text-sm">
                      <span className="text-slate-700">Note</span>
                      <input
                        className="h-[42px] rounded-lg border bg-white px-3"
                        value={toothNote}
                        onChange={(e) => setToothNote(e.target.value)}
                        placeholder="Optional"
                        disabled={!selectedTooth || busy}
                      />
                    </label>
                  </div>

                  {/* Save button below Note */}
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      className="h-[42px] rounded-lg bg-slate-900 px-6 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={!selectedTooth || busy}
                      onClick={() => saveToothStatus(pendingStatus)}
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold">History</div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Tooth</th>
                          <th className="py-2 pr-3">Finding</th>
                          <th className="py-2 pr-3">Surfaces</th>
                          <th className="py-2 pr-3">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chart.map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="py-2 pr-3">{formatDateTimePH(row.recorded_at)}</td>
                            <td className="py-2 pr-3">{row.tooth_number}</td>
                            <td className="py-2 pr-3">{row.finding_code}</td>
                            <td className="py-2 pr-3">{row.surfaces ?? "—"}</td>
                            <td className="py-2 pr-3">{row.notes ?? "—"}</td>
                          </tr>
                        ))}
                        {!chart.length ? (
                          <tr>
                            <td className="py-3 text-slate-500" colSpan={5}>
                              No chart history yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "Treatments" ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">New visit</div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Visit date</span>
                      <input
                        type="date"
                        className="rounded-lg border px-3 py-2"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                      />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Dentist</span>
                      <select
                        className="rounded-lg border px-3 py-2"
                        value={visitDentistId}
                        onChange={(e) => setVisitDentistId(e.target.value)}
                      >
                        <option value="">Select</option>
                        {dentists.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3">
                    {/* Tooth column smaller */}
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-[72px_minmax(0,2fr)_minmax(0,3fr)_110px] items-end">
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-700">Tooth</span>
                        <input
                          className="h-[36px] w-[72px] rounded-lg border px-2 text-sm"
                          value={lineTooth}
                          onChange={(e) => setLineTooth(e.target.value)}
                          placeholder="11"
                          inputMode="numeric"
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-700">Procedure/Service</span>
                        <select
                          className="rounded-lg border px-3 py-2 min-w-0"
                          value={txServiceId}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTxServiceId(v);
                            const row = serviceMenu.find((x) => x.id === v);
                            setTxServiceName(row?.service_name ?? "");
                          }}
                        >
                          <option value="">Select</option>
                          {serviceMenu
                            .filter((x) => x.is_active)
                            .map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.service_name}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-700">Note</span>
                        <input
                          className="rounded-lg border px-3 py-2 min-w-0"
                          value={lineNote}
                          onChange={(e) => setLineNote(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>

                      <button
                        type="button"
                        className="h-[42px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                        disabled={busy}
                        onClick={addDraftLine}
                      >
                        Add
                      </button>
                    </div>

                    {draftLines.length ? (
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-600">
                              <th className="py-2 pr-3">Tooth</th>
                              <th className="py-2 pr-3">Procedure</th>
                              <th className="py-2 pr-3">Note</th>
                              <th className="py-2 pr-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {draftLines.map((ln) => (
                              <tr key={ln.id} className="border-t">
                                <td className="py-2 pr-3">{ln.tooth_number ?? "—"}</td>
                                <td className="py-2 pr-3">{ln.procedure}</td>
                                <td className="py-2 pr-3">{ln.note || "—"}</td>
                                <td className="py-2 pr-3 text-right">
                                  <button
                                    className="rounded-lg border bg-white px-3 py-1 text-sm"
                                    onClick={() => removeDraftLine(ln.id)}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">No procedures added yet.</div>
                    )}

                    <div className="flex items-center justify-end">
                      <button
                        disabled={busy}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        onClick={saveVisit}
                      >
                        Save visit
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Treatment history</div>
                  <div className="mt-3 grid gap-3">
                    {groupedTreatmentHistory.map(([date, rows]) => {
                      const firstDid = rows.find((r) => r.dentist_id)?.dentist_id ?? null;
                      const label =
                        (firstDid ? dentistNameById[firstDid] : "") ||
                        rows.find((r) => r.dentist_name)?.dentist_name ||
                        "—";

                      return (
                        <div key={date} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">{formatDatePH(date)}</div>
                            <div className="text-sm text-slate-600">{label}</div>
                          </div>

                          <div className="mt-2 overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left text-slate-600">
                                  <th className="py-2 pr-3">Tooth</th>
                                  <th className="py-2 pr-3">Procedure</th>
                                  <th className="py-2 pr-3">Note</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r) => (
                                  <tr key={r.id} className="border-t">
                                    <td className="py-2 pr-3">{r.tooth_number ?? "—"}</td>
                                    <td className="py-2 pr-3">{r.procedure}</td>
                                    <td className="py-2 pr-3 whitespace-pre-wrap">{r.notes ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                    {!groupedTreatmentHistory.length ? (
                      <div className="text-sm text-slate-500">No treatments yet.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "Attachments" ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Upload attachment</div>

                  {/* One-row upload controls */}
                  <div className="mt-3 grid gap-2">
                    <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_120px] items-end">
                      {/* Type */}
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-700">Type</span>
                        <select
                          className="h-[42px] rounded-lg border px-3 text-sm"
                          value={uploadType}
                          onChange={(e) => {
                            const v = e.target.value as any;
                            setUploadType(v);
                          }}
                        >
                          <option value="">Select</option>
                          {attachmentTypes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* File */}
                        <div className="grid gap-1 text-sm min-w-0">
                          <span className="text-slate-700">File</span>

                          {/* Unified file input box */}
                          <div className="h-[42px] min-w-0 flex items-center rounded-lg border bg-slate-50 overflow-hidden">
                            {/* Choose file button (embedded) */}
                            <label className="h-full shrink-0 cursor-pointer px-4 flex items-center justify-center bg-white border-r text-sm font-semibold hover:bg-slate-100">
                              Choose file
                              <input
                                type="file"
                                className="sr-only"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;

                                  if (f && f.size > 5 * 1024 * 1024) {
                                    setErr("File is too large. Please upload a file up to 5 MB.");
                                    setFileToUpload(null);
                                    e.currentTarget.value = "";
                                    return;
                                  }

                                  setErr(null);
                                  setFileToUpload(f);
                                }}
                                disabled={busy}
                              />
                            </label>

                            {/* Filename / placeholder */}
                            <div className="flex-1 px-3 text-sm text-slate-700 truncate">
                              {fileToUpload ? fileToUpload.name : "No file selected"}
                            </div>
                          </div>
                        </div>
                      {/* Upload */}
                      <button
                        type="button"
                        disabled={busy || !fileToUpload || !uploadType}
                        className="h-[42px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                        onClick={uploadAttachment}
                      >
                        Upload
                      </button>
                    </div>

                    <div className="text-xs text-slate-500">Max file size: 5 MB.</div>
                  </div>
                </div>

                
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Attachments</div>

                    <select
                      className="h-9 w-40 rounded-lg border bg-white px-2 text-sm"
                      value={attachmentSort}
                      onChange={(e) => setAttachmentSort(e.target.value as any)}
                    >
                      <option value="DATE_DESC">Newest</option>
                      <option value="DATE_ASC">Oldest</option>
                      <option value="NAME_ASC">Name A–Z</option>
                    </select>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col style={{ width: 160 }} />
                        <col />
                        <col style={{ width: 180 }} />
                      </colgroup>
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="py-2 pr-3">Type</th>
                          <th className="py-2 pr-3">File</th>
                          <th className="py-2 pr-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedAttachments.map((a) => (
                          <tr key={a.id} className="border-t hover:bg-slate-50">
                            <td className="py-2 pr-3">{a.type}</td>
                            <td className="py-2 pr-3">
                              <div className="truncate">
                                {a.file_name ?? a.file_path.split("/").slice(-1)[0]}
                              </div>
                            </td>
                            <td className="py-2 pr-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  className="rounded-lg border bg-white px-3 py-1 text-sm"
                                  onClick={() => openAttachment(a)}
                                >
                                  Open
                                </button>
                                <button
                                  className="rounded-lg border bg-white px-3 py-1 text-sm"
                                  onClick={() => {
                                    setAttachmentEdit(a);
                                    setAttachmentEditName(a.file_name ?? "");
                                    setAttachmentDeleteConfirm("");
                                  }}
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {displayedAttachments.length === 0 ? (
                          <tr>
                            <td className="py-3 text-sm text-slate-500" colSpan={3}>
                              No attachments yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  {attachmentEdit ? (
                    <Modal
                      open={true}
                      title="Edit attachment"
                      onClose={() => {
                        setAttachmentEdit(null);
                        setAttachmentEditName("");
                        setAttachmentDeleteConfirm("");
                      }}
                    >
                      <div className="grid gap-3">
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700">Display name</span>
                          <input
                            className="h-10 rounded-lg border px-3 py-2"
                            value={attachmentEditName}
                            onChange={(e) => setAttachmentEditName(e.target.value)}
                            placeholder="Optional"
                          />
                        </label>

                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700">Type DELETE to confirm delete</span>
                          <input
                            className="h-10 rounded-lg border px-3 py-2"
                            value={attachmentDeleteConfirm}
                            onChange={(e) => setAttachmentDeleteConfirm(e.target.value)}
                            placeholder="DELETE"
                          />
                        </label>

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                          <button
                            className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold"
                            onClick={() => {
                              setAttachmentEdit(null);
                              setAttachmentEditName("");
                              setAttachmentDeleteConfirm("");
                            }}
                          >
                            Cancel
                          </button>

                          <button
                            className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold disabled:opacity-60"
                            disabled={busy}
                            onClick={() =>
                              renameAttachment(attachmentEdit.id, attachmentEditName || "")
                            }
                          >
                            Save
                          </button>

                          <button
                            className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                            disabled={busy || attachmentDeleteConfirm !== "DELETE"}
                            onClick={() =>
                              deleteAttachment(attachmentEdit.id, attachmentEdit.file_path)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </Modal>
                  ) : null}
                </div>
                </div>
            ) : null}
            {tab === "Documents" ? (
              <div className="grid gap-4">
                {/* Generate document */}
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Generate document</div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm sm:col-span-2">
                      <span className="text-slate-700">Template</span>
                      <select
                        className="rounded-lg border px-3 py-2"
                        value={selectedTemplateId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSelectedTemplateId(v);

                          const tmpl = templates.find((x) => x.id === v) ?? null;

                          // Reset preview then let effect rebuild
                          setPreviewHtml("");

                          // Auto-generate receipt number when selecting receipt template
                          if (tmpl?.doc_type === "receipt") {
                            setDocReceiptNo(generateReceiptNo());
                          } else {
                            setDocReceiptNo("");
                          }
                        }}
                      >
                        <option value="">Select</option>
                        {templates.map((t) => {
                          const label =
                            t.doc_type === "dental_certificate"
                              ? "Dental certificate"
                              : t.doc_type === "receipt"
                                ? "Receipt"
                                : t.name;
                          return (
                            <option key={t.id} value={t.id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    {selectedTemplate?.doc_type === "receipt" ? (
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-700">Receipt no</span>
                        <input
                          className="rounded-lg border px-3 py-2"
                          value={docReceiptNo}
                          onChange={(e) => setDocReceiptNo(e.target.value)}
                        />
                      </label>
                    ) : (
                      <div />
                    )}
                  </div>

                  {!selectedTemplateId ? (
                    <div className="mt-3 text-sm text-slate-600">
                      Select a template to show the form fields and preview.
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700">Visit date</span>
                          <input
                            type="date"
                            className="rounded-lg border px-3 py-2"
                            value={docVisitDate}
                            onChange={(e) => setDocVisitDate(e.target.value)}
                          />
                        </label>

                        <label className="grid gap-1 text-sm sm:col-span-2">
                          <span className="text-slate-700">Dentist</span>
                          <select
                            className="rounded-lg border px-3 py-2"
                            value={docDentistId}
                            onChange={(e) => setDocDentistId(e.target.value)}
                          >
                            <option value="">Select</option>
                            {dentists.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.full_name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {selectedTemplate?.doc_type === "receipt" ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="grid gap-1 text-sm sm:col-span-2">
                            <span className="text-slate-700">Items</span>
                            <textarea
                              className="rounded-lg border px-3 py-2"
                              rows={4}
                              value={docItems}
                              onChange={(e) => setDocItems(e.target.value)}
                              placeholder="One per line"
                            />
                          </label>

                          <div className="grid gap-3">
                            <label className="grid gap-1 text-sm">
                              <span className="text-slate-700">Amount paid</span>
                              <input
                                className="rounded-lg border px-3 py-2"
                                value={docAmountPaid}
                                onChange={(e) => setDocAmountPaid(e.target.value)}
                                placeholder="0.00"
                              />
                            </label>

                            <label className="grid gap-1 text-sm">
                              <span className="text-slate-700">Payment method</span>
                              <select
                                className="rounded-lg border px-3 py-2"
                                value={docPaymentMethod}
                                onChange={(e) => setDocPaymentMethod(e.target.value)}
                              >
                                {["Cash", "GCash", "Card", "Bank transfer", "Other"].map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="grid gap-1 text-sm">
                              <span className="text-slate-700">Balance</span>
                              <input
                                className="rounded-lg border px-3 py-2"
                                value={docBalance}
                                onChange={(e) => setDocBalance(e.target.value)}
                                placeholder="0.00"
                              />
                            </label>
                          </div>
                        </div>
                      ) : null}

                      {selectedTemplate?.doc_type === "dental_certificate" ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1 text-sm">
                            <span className="text-slate-700">Findings</span>
                            <textarea
                              className="rounded-lg border px-3 py-2"
                              rows={4}
                              value={docFindings}
                              onChange={(e) => setDocFindings(e.target.value)}
                              placeholder="Optional"
                            />
                          </label>

                          <label className="grid gap-1 text-sm">
                            <span className="text-slate-700">Treatment done</span>
                            <textarea
                              className="rounded-lg border px-3 py-2"
                              rows={4}
                              value={docTreatmentDone}
                              onChange={(e) => setDocTreatmentDone(e.target.value)}
                              placeholder="Optional"
                            />
                          </label>

                          <label className="grid gap-1 text-sm sm:col-span-2">
                            <span className="text-slate-700">Remarks</span>
                            <textarea
                              className="rounded-lg border px-3 py-2"
                              rows={3}
                              value={docRemarks}
                              onChange={(e) => setDocRemarks(e.target.value)}
                              placeholder="Optional"
                            />
                          </label>

                          <label className="grid gap-1 text-sm sm:col-span-2">
                            <span className="text-slate-700">Issued by</span>
                            <input
                              className="rounded-lg border px-3 py-2"
                              value={docIssuedBy}
                              onChange={(e) => setDocIssuedBy(e.target.value)}
                              placeholder="Optional"
                            />
                          </label>
                        </div>
                      ) : null}

                      {err ? <div className="text-sm text-rose-600">{err}</div> : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                          disabled={busy}
                          onClick={generateDocument}
                        >
                          Generate
                        </button>

                        <button
                          className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold disabled:opacity-60"
                          disabled={!previewHtml}
                          onClick={() => {
                            if (previewHtml) printHtml(previewHtml);
                          }}
                        >
                          Print
                        </button>
                      </div>

                      {/* Preview */}
                      <div className="mt-3 rounded-xl border bg-white p-3">
                        {previewHtml ? (
                          <div
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                          />
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                {/* Generated documents */}
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Generated documents</div>

                    <select
                      className="h-9 w-40 rounded-lg border bg-white px-2 text-sm"
                      value={docSort}
                      onChange={(e) => setDocSort(e.target.value as any)}
                    >
                      <option value="DATE_DESC">Newest</option>
                      <option value="DATE_ASC">Oldest</option>
                      <option value="TYPE_ASC">Type A–Z</option>
                    </select>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col style={{ width: 160 }} />
                        <col style={{ width: 200 }} />
                        <col />
                        <col style={{ width: 180 }} />
                      </colgroup>
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Type</th>
                          <th className="py-2 pr-3">Number</th>
                          <th className="py-2 pr-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedGeneratedDocs.map((d) => (
                          <tr key={d.id} className="border-t hover:bg-slate-50">
                            <td className="py-2 pr-3">{formatDateTimePH(d.created_at)}</td>
                            <td className="py-2 pr-3">{d.doc_type}</td>
                            <td className="py-2 pr-3">{d.doc_number ?? "—"}</td>
                            <td className="py-2 pr-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  className="rounded-lg border bg-white px-3 py-1 text-sm"
                                  onClick={() => {
                                    const html = d.payload?.rendered_html || d.payload?.renderedHtml || "";
                                    if (html) openHtml(html);
                                  }}
                                >
                                  Open
                                </button>
                                <button
                                  className="rounded-lg border bg-white px-3 py-1 text-sm"
                                  onClick={() => {
                                    setGenDocEdit(d);
                                    setGenDocEditNumber(d.doc_number ?? "");
                                    setGenDocDeleteConfirm("");
                                  }}
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {displayedGeneratedDocs.length === 0 ? (
                          <tr>
                            <td className="py-3 text-sm text-slate-500" colSpan={4}>
                              No generated documents yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  {genDocEdit ? (
                    <Modal
                      open={true}
                      title="Edit document"
                      onClose={() => {
                        setGenDocEdit(null);
                        setGenDocEditNumber("");
                        setGenDocDeleteConfirm("");
                      }}
                    >
                      <div className="grid gap-3">
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700">Document number</span>
                          <input
                            className="h-10 rounded-lg border px-3 py-2"
                            value={genDocEditNumber}
                            onChange={(e) => setGenDocEditNumber(e.target.value)}
                            placeholder="Optional"
                          />
                        </label>

                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700">Type DELETE to confirm delete</span>
                          <input
                            className="h-10 rounded-lg border px-3 py-2"
                            value={genDocDeleteConfirm}
                            onChange={(e) => setGenDocDeleteConfirm(e.target.value)}
                            placeholder="DELETE"
                          />
                        </label>

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                          <button
                            className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold"
                            onClick={() => {
                              setGenDocEdit(null);
                              setGenDocEditNumber("");
                              setGenDocDeleteConfirm("");
                            }}
                          >
                            Cancel
                          </button>

                          <button
                            className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold disabled:opacity-60"
                            disabled={busy}
                            onClick={() => updateGeneratedDocNumber(genDocEdit.id, genDocEditNumber || "")}
                          >
                            Save
                          </button>

                          <button
                            className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                            disabled={busy || genDocDeleteConfirm !== "DELETE"}
                            onClick={() => deleteGeneratedDoc(genDocEdit.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </Modal>
                  ) : null}
                </div>
              </div>
            ) : null}
            {tab === "Billing" ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold text-center">Billing overview</div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border bg-slate-50 p-3 text-center">
                      <div className="text-xs text-slate-600">Total</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {billingSummary.totalAll.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3 text-center">
                      <div className="text-xs text-slate-600">Paid</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {billingSummary.paidAll.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3 text-center">
                      <div className="text-xs text-slate-600">Balance</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {billingSummary.balanceAll.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Invoice</div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-lg border bg-white px-3 py-2 text-sm"
                        value={billingVisitDate}
                        onChange={async (e) => {
                          const nextDate = e.target.value;
                          setBillingVisitDate(nextDate);
                          if (!nextDate) return;
                          await openBillingForVisitDate(nextDate);
                        }}
                        disabled={busy}
                      >
                        <option value="">Select visit date</option>

                        {visitDates.map((d) => (
                          <option key={d} value={d}>
                            {formatDatePH(d)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold"
                        onClick={refreshActiveInvoiceFromTreatments}
                        disabled={busy || !activeInvoiceId}
                      >
                        Refresh from Treatments
                      </button>

                      <button
                        className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold"
                        onClick={() => {
                          setErr(null);
                          setDiscountOpen(true);
                        }}
                        disabled={busy || !activeInvoiceId}
                      >
                        Add discount
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-600">Subtotal</div>
                      <div className="text-lg font-semibold">
                        {invoiceSubtotalComputed.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-600">Paid</div>
                      <div className="text-lg font-semibold">{activePaid.toFixed(2)}</div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-600">Balance</div>
                      <div className="text-lg font-semibold">{activeBalance.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Invoice table with footer rows */}
                  
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="py-2 pr-3">Tooth</th>
                          <th className="py-2 pr-3">Item</th>
                          <th className="py-2 pr-3">Qty</th>
                          <th className="py-2 pr-3">Unit</th>
                          <th className="py-2 pr-3">Total</th>
                          <th className="py-2 pr-3"></th>
                        </tr>
                      </thead>
                      
                      <tbody>
                      {(() => {
                        const isDiscountItem = (it: any) => (it.service_name ?? "").toLowerCase() === "discount";

                        const normalItems = invoiceItems.filter((x) => !isDiscountItem(x));
                        const discountItems = invoiceItems.filter((x) => isDiscountItem(x));

                        const subtotalFromLines = normalItems.reduce((sum, x) => sum + num(x.line_total), 0);
                        const discountTotal = discountItems.reduce((sum, x) => sum + num(x.line_total), 0); // negative
                        const totalAfterDiscount = subtotalFromLines + discountTotal;

                        if (!invoiceItems.length) {
                          return (
                            <tr>
                              <td className="py-3 text-slate-500" colSpan={6}>
                                No invoice items yet.
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <>
                            {/* Procedure lines only */}
                            {normalItems.map((it) => (
                              <tr key={it.id} className="border-t">
                                <td className="py-2 pr-3">{it.tooth_number ?? "—"}</td>
                                <td className="py-2 pr-3">{it.service_name}</td>
                                <td className="py-2 pr-3">{it.qty}</td>
                                <td className="py-2 pr-3">{num(it.unit_price).toFixed(2)}</td>
                                <td className="py-2 pr-3">{num(it.line_total).toFixed(2)}</td>
                                <td className="py-2 pr-3 text-right">
                                  <button
                                    className="rounded-lg border bg-white px-3 py-1 text-sm"
                                    onClick={() => openEditItem(it)}
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))}

                            {/* Subtotal row */}
                            <tr className="border-t">
                              <td colSpan={4} className="py-2 pr-3 text-right font-semibold">
                                Subtotal
                              </td>
                              <td className="py-2 pr-3 font-semibold">{subtotalFromLines.toFixed(2)}</td>
                              <td />
                            </tr>

                            {/* Discount rows (after subtotal, before total) */}
                            {discountItems.map((it) => (
                              <tr key={it.id} className="border-t text-red-700 italic">
                                <td className="py-2 pr-3">—</td>
                                <td className="py-2 pr-3">{it.service_name}</td>
                                <td className="py-2 pr-3">{it.qty}</td>
                                <td className="py-2 pr-3">{num(it.unit_price).toFixed(2)}</td>
                                <td className="py-2 pr-3 font-semibold">{num(it.line_total).toFixed(2)}</td>
                                <td className="py-2 pr-3" />
                              </tr>
                            ))}

                            {/* Total row */}
                            <tr className="border-t">
                              <td colSpan={4} className="py-2 pr-3 text-right text-base font-semibold">
                                Total
                              </td>
                              <td className="py-2 pr-3 text-base font-semibold">{totalAfterDiscount.toFixed(2)}</td>
                              <td />
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Payments</div>

                  
                  <div className="mt-3 grid gap-3 sm:grid-cols-5 items-end">
                    <label className="grid gap-1 text-sm sm:col-span-1">
                      <span className="text-slate-700">Date</span>
                      <input
                        type="date"
                        className="h-10 rounded-lg border px-3 py-2"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                      />
                    </label>

                    <label className="grid gap-1 text-sm sm:col-span-1">
                      <span className="text-slate-700">Mode</span>
                      <input
                        className="h-10 rounded-lg border px-3 py-2"
                        value={payMode}
                        onChange={(e) => setPayMode(e.target.value)}
                      />
                    </label>

                    <label className="grid gap-1 text-sm sm:col-span-1">
                      <span className="text-slate-700">Reference</span>
                      <input
                        className="h-10 rounded-lg border px-3 py-2"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                      />
                    </label>

                    <label className="grid gap-1 text-sm sm:col-span-1">
                      <span className="text-slate-700">Amount</span>
                      <input
                        inputMode="decimal"
                        className="h-10 rounded-lg border px-3 py-2 text-right"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </label>

                    <button
                      disabled={busy || !activeInvoiceId}
                      className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                      onClick={addPayment}
                    >
                      Add payment
                    </button>
                  </div>
            
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col style={{ width: 140 }} />
                        <col style={{ width: 160 }} />
                        <col />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 100 }} />
                      </colgroup>
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Mode</th>
                          <th className="py-2 pr-3">Reference</th>
                          <th className="py-2 pr-3 text-right">Amount</th>
                          <th className="py-2 pr-3 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicePayments.map((p) => (
                          <tr key={p.id} className="border-t hover:bg-slate-50">
                            <td className="py-2 pr-3">{formatDatePH(p.payment_date)}</td>
                            <td className="py-2 pr-3">{p.mode}</td>
                            <td className="py-2 pr-3">{p.reference_no ?? "—"}</td>
                            <td className="py-2 pr-3 text-right">{num(p.amount).toFixed(2)}</td>
                            <td className="py-2 pr-3 text-right">
                              <button
                                className="rounded-lg border bg-white px-3 py-1 text-sm"
                                onClick={() => setPaymentView(p)}
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!invoicePayments.length ? (
                          <tr>
                            <td className="py-3 text-slate-500" colSpan={5}>
                              No payments yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  {paymentView ? (
                    <EditModal open={true} title="Payment" onClose={() => setPaymentView(null)}>
                      <div className="grid gap-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-slate-600">Date</div>
                          <div>{formatDatePH(paymentView.payment_date)}</div>

                          <div className="text-slate-600">Mode</div>
                          <div>{paymentView.mode}</div>

                          <div className="text-slate-600">Reference</div>
                          <div>{paymentView.reference_no ?? "—"}</div>

                          <div className="text-slate-600">Amount</div>
                          <div>{num(paymentView.amount).toFixed(2)}</div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold"
                            onClick={() => setPaymentView(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </EditModal>
                  ) : null}

                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
