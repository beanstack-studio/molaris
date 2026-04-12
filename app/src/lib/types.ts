/* =========================
   Types
========================= */
export type GenderDB = "male" | "female" | null;

export type Patient = {
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

export type MedHist = {
  id: string;
  allergies: string | null;
  medications: string | null;
  blood_pressure: string | null;
  notes: string | null;
  conditions: any;
};

export type DentistRow = { id: string; full_name: string; color?: string | null };

export type ChartEntry = {
  id: string;
  tooth_number: number;
  surfaces: string | null;
  finding_code: string;
  finding_detail?: string | null;
  notes: string | null;
  recorded_at: string;
};

export type ToothStatusRow = {
  tooth_number: number;
  status: string;
  note: string | null;
  updated_at: string | null;
};

export type Treatment = {
  id: string;
  treatment_date: string;
  procedure: string;
  tooth_number: number | null;
  notes: string | null;
  visit_concern: string | null; // Chief complaint or concern from appointment/walk-in
  dentist_id: string | null;
  dentist_name: string | null;
  service_price_id: string | null;
  created_at: string | null;
};

export type ServicePriceRow = {
  id: string;
  service_name: string;
  default_price: number;
  price?: number; // For backward compatibility if alias works
  item_type: "SERVICE" | "ADD_ON";
  is_active: boolean;
  sort_order: number;
  category: "general" | "ortho"; // PART 1: Service categorization
  ortho_kind?: "package" | "addon"; // Optional ortho classification
  created_at: string;
};

export type InvoiceRow = {
  id: string;
  invoice_date: string;
  invoice_number?: string | null;
  status: string | null;
  discount_amount: number | null;
  total: number | null;
  notes: string | null;
  invoice_type?: "regular" | "ortho";
  created_at: string | null;
};

// Alias for backward compatibility
export type Invoice = InvoiceRow;

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  service_name: string;
  description?: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  tooth_number: number | null;
  dentist_name: string | null;
  source_type?: "treatment" | "ortho_package" | "ortho_entry" | null; // PART 6: Track source for idempotency
  source_id?: string | null; // PART 6: Track source ID
  created_at: string | null;
};

/**
 * Payment mode configuration from payment_modes table
 * Use with getPaymentModeConfig() and getActivePaymentModes()
 */
export type PaymentMode = {
  id: string;
  code: string;
  name: string;
  requires_proof: boolean;
  requires_reference: boolean;
  requires_received_by: boolean;
  auto_verifies: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/**
 * Legacy/simple payment structure (keep for backward compatibility)
 * Prefer PaymentRowExtended for new code
 */
export type PaymentRow = {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  mode: string;
  received_by: string | null;
  notes: string | null;
  created_at: string | null;
};

/**
 * Extended payment with all new fields from payment system
 */
export type PaymentRowExtended = {
  id: string;
  invoice_id: string;
  patient_id: string;
  transaction_id: string | null;
  payment_date: string;
  amount: number;
  status: "pending" | "verified" | "failed";
  reference_number: string | null;
  received_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  details: Record<string, any> | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Staff member (e.g., dentists, office staff)
 * Used for payment verification and receipt tracking
 */
export type StaffRow = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/**
 * Receipt with immutable payment snapshot
 * Use generateReceipt() to create
 */
export type ReceiptRow = {
  id: string;
  receipt_number: string;
  payment_id: string;
  invoice_id: string;
  patient_id: string;
  issued_by: string;
  issued_at: string;
  status: "issued" | "voided";
  snapshot: {
    amount: number;
    payment_mode_code: string;
    payment_mode_name: string;
    reference_number: string | null;
    paid_by: string;
    payment_date: string;
    received_by_staff: string | null;
  };
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  type: string;
  file_path: string;
  file_name: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
  notes?: string | null;
};

export type DocTemplate = {
  id: string;
  name: string;
  doc_type: string;
  content_html: string;
};

export type GeneratedDoc = {
  id: string;
  doc_type: string;
  doc_number: string | null;
  payload: any;
  created_at: string;
};

export type Document = {
  id: string;
  patient_id?: string;
  patient_name?: string;
  invoice_id?: string;
  payment_id?: string;
  visit_id?: string;
  doc_type: string; // INVOICE, PAYMENT_RECEIPT, ACCOUNT_STATEMENT, PRESCRIPTION, DENTAL_CERTIFICATE, REFERRAL_LETTER
  doc_code: string; // INV, PMT, SOA, RX, CER, REF
  doc_no: string; // INV26-0001, PMT26-0001, etc.
  payload: Record<string, any>; // Immutable snapshot
  clinic_meta?: Record<string, any>;
  dentist_name?: string;
  dentist_prc?: string;
  dentist_ptr?: string;
  issued_at: string;
  issued_by?: string;
  created_at: string;
  updated_at: string;
};

export type DraftLine = {
  id: string;
  tooth_number: number | null;
  service_price_id: string | null;
  procedure: string;
  note: string;
};

export const tabs = ["Info", "Medical", "Chart", "Treatments", "Attachments", "Documents", "Billing", "Ortho"] as const;
export type Tab = (typeof tabs)[number];

/* =========================
   Appointments & Messaging
========================= */

export type Appointment = {
  id: string;
  patient_id: string;
  dentist_id: string | null;
  appointment_date: string;
  appointment_time: string;
  status: "pending" | "confirmed" | "completed" | "no_show" | "cancelled";
  notes: string | null;
  message_thread_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  patient?: Patient;
  dentist?: DentistRow;
};

export type MessageThread = {
  id: string;
  patient_id: string | null; // NULL if not yet linked
  channel: "sms" | "messenger" | "whatsapp" | "email";
  external_thread_id: string | null;
  external_user_name: string | null; // FB name, WhatsApp name, etc.
  last_message_at: string | null;
  unread_count: number;
  subject: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  patient?: Patient;
};

export type Message = {
  id: string;
  thread_id: string;
  sender_type: "patient" | "staff";
  sender_id: string | null;
  sender_name: string | null;
  content: string;
  message_type: "text" | "appointment_confirmed" | "query" | "system";
  external_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  deleted_at: string | null;
};

export type MessageWithThread = Message & {
  thread?: MessageThread;
};
/* =========================
   Orthodontics (Ortho)
========================= */

export type OrthoCase = {
  id: string;
  patient_id: string;
  status: "active" | "on_hold" | "completed";
  start_date: string | null;
  end_date: string | null;
  provider_dentist_id: string | null;
  provider_name: string | null;
  package_fee: number | null;
  notes: string | null;
  // Ortho case fields
  package_service_id: string | null;
  phase: "braces" | "aligners" | "retainer" | "completed" | null;
  inclusions: Record<string, boolean> | null; // JSON object with inclusion flags
  created_at: string;
  updated_at: string;
};

export type OrthoEntry = {
  id: string;
  ortho_case_id: string;
  entry_date: string;
  concern_type: string | null;
  note: string | null;
  invoice_package: boolean;
  created_at: string;
  updated_at: string;
};

export type OrthoEntryItem = {
  id: string;
  ortho_entry_id: string;
  service_id: string;
  is_charged: boolean;
  amount_override: number | null;
  service_detail: string | null;
  created_at: string;
  updated_at: string;
};

export const orthoEntryTags = [
  "adjustment",
  "wire_change",
  "elastics",
  "bracket_repair",
  "retainer",
  "follow_up",
  "other",
] as const;

export const orthoArchOptions = ["upper", "lower", "both"] as const;

// PART 2C: New ortho constants
export const orthoApplianceTypes = [
  "metal_braces",
  "ceramic_braces",
  "self_ligating",
  "aligners",
  "retainer",
  "other",
] as const;

export const orthoVisitTypes = [
  "adjustment",
  "consultation",
  "emergency",
  "debond",
  "retainer_delivery",
] as const;