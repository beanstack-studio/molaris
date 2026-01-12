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

export type DentistRow = { id: string; full_name: string };

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
  visit_date: string; // renamed from treatment_date
  treatment_date: string; // database column name
  procedure: string;
  tooth_number: number | null;
  notes: string | null;
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
  created_at: string;
};

export type InvoiceRow = {
  id: string;
  invoice_date: string;
  invoice_number?: string | null;
  dentist_name?: string | null;
  status: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total: number | null;
  notes: string | null;
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
  reference_no: string | null;
  notes: string | null;
  created_at: string | null;
};

/**
 * Extended payment with all new fields from payment system
 * Used with getActivePayments(), getVerifiedPayments()
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
  proof_file_id: string | null;
  proof_storage_path: string | null;
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

export type DraftLine = {
  id: string;
  tooth_number: number | null;
  service_price_id: string | null;
  procedure: string;
  note: string;
};

export const tabs = ["Info", "Medical", "Chart", "Treatments", "Attachments", "Documents", "Billing"] as const;
export type Tab = (typeof tabs)[number];
