/**
 * Payment System Quick Reference
 * Implementation guide for app/src/app and components
 */

// ============================================================================
// 1. PAYMENT MODE REQUIREMENTS CHECK
// ============================================================================

/**
 * Helper to check what a payment mode requires
 * Use in billing UI to show/hide fields based on selected mode
 */

// app/src/lib/paymentModeHelpers.ts (create this file)
export async function getPaymentModeConfig(modeCode: string) {
  const { data, error } = await supabase
    .from('payment_modes')
    .select('*')
    .eq('code', modeCode)
    .single();

  if (error) throw error;
  return data;
}

// Example usage in billing form:
const modeConfig = await getPaymentModeConfig(selectedPaymentCode);

{modeConfig.requires_proof && (
  <input type="file" accept="image/*" onChange={handleProofUpload} />
)}

{modeConfig.requires_reference && (
  <input placeholder={`Enter ${modeConfig.code} reference`} />
)}

{modeConfig.requires_received_by && (
  <select>
    {staff.map(s => <option value={s.id}>{s.full_name}</option>)}
  </select>
)}

// ============================================================================
// 2. PAYMENT INSERTION (Billing Page)
// ============================================================================

async function addPayment() {
  if (!id) return;
  setErr(null);

  if (!paymentInvoiceId) return setErr("Select an invoice.");
  if (!paymentAmount) return setErr("Enter payment amount.");
  if (!paymentMode) return setErr("Select payment mode.");

  setBusy(true);

  // Get mode config to determine status and requirements
  const { data: mode } = await supabase
    .from('payment_modes')
    .select('*')
    .eq('name', paymentMode)
    .single();

  if (!mode) return setErr("Invalid payment mode");

  // Build details object based on mode
  const details: Record<string, any> = {};

  if (mode.code === 'GCASH') {
    details.payer_mobile = paymentGCashMobile || null;
    details.gcash_ref = paymentGCashRef || null;
  } else if (mode.code === 'MAYA') {
    details.maya_ref = paymentMayaRef || null;
    details.payer_email = paymentMayaEmail || null;
  } else if (mode.code === 'BANK_TRANSFER') {
    details.bank_name = paymentBankName || null;
    details.account_name = paymentAccountName || null;
    details.transfer_ref = paymentTransferRef || null;
  } else if (mode.code === 'CHEQUE') {
    details.cheque_bank = paymentChequeBank || null;
    details.cheque_date = paymentChequeDate || null;
  } else if (mode.code === 'CASH') {
    details.received_by_staff = paymentReceivedByStaffName || null;
  }

  const payment = {
    patient_id: id,
    invoice_id: paymentInvoiceId,
    payment_mode_id: mode.id,
    amount: parseFloat(paymentAmount),
    payment_date: paymentDate,
    reference_number: mode.requires_reference ? paymentReferenceNumber : null,
    received_by: mode.requires_received_by ? paymentReceivedByStaffId : null,
    proof_storage_path: proofUploadPath || null,
    status: mode.auto_verifies ? 'verified' : 'pending',
    details: details,
    notes: paymentNotes.trim() || null,
    created_by: currentUserId, // from auth context
  };

  const ins = await supabase.from('payments').insert([payment]);
  setBusy(false);

  if (ins.error) return setErr(ins.error.message);

  // Recalculate invoice totals
  await supabase.rpc('recalc_invoice', { invoice_id: paymentInvoiceId });

  setShowAddPayment(false);
  // Reset form fields...
  await loadData();
}

// ============================================================================
// 3. PAYMENT VERIFICATION (Staff Admin UI)
// ============================================================================

// app/src/app/settings/payments-verification/page.tsx (create new page)

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatMoney, formatDatePH } from '@/lib/helpers';

export default function PaymentVerificationPage() {
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [currentStaff, setCurrentStaff] = useState<string>('');

  useEffect(() => {
    loadPendingPayments();
    loadStaff();
  }, []);

  async function loadPendingPayments() {
    const { data } = await supabase
      .from('payments')
      .select(`
        *,
        invoices!inner(invoice_number, patient_id),
        patients!inner(first_name, last_name),
        payment_modes(name, code, requires_proof),
        proof_file:proof_file_id(file_name, file_path)
      `)
      .eq('status', 'pending')
      .is('voided_at', null)
      .order('payment_date', { ascending: false });

    setPendingPayments(data || []);
  }

  async function loadStaff() {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('is_active', true);

    setStaff(data || []);
  }

  async function verifyPayment(paymentId: string) {
    if (!currentStaff) return setErr('Select staff member');

    setErr(null);
    setBusy(true);

    const { error } = await supabase
      .from('payments')
      .update({
        status: 'verified',
        verified_by: currentStaff,
        verified_at: new Date().toISOString(),
        verification_notes: verifyNotes || null,
      })
      .eq('id', paymentId)
      .eq('status', 'pending');

    setBusy(false);

    if (error) return setErr(error.message);

    setVerifyingId(null);
    setVerifyNotes('');
    await loadPendingPayments();
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-bold mb-6">Verify Pending Payments</h1>

      {err && <div className="rounded-lg bg-red-50 p-3 text-red-700 mb-4">{err}</div>}

      {pendingPayments.length === 0 ? (
        <div className="text-center py-8 text-slate-500">No pending payments.</div>
      ) : (
        <div className="space-y-4">
          {pendingPayments.map((payment) => (
            <div key={payment.id} className="rounded-lg border p-4 bg-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-lg">
                    Invoice {payment.invoices.invoice_number}
                  </h3>
                  <p className="text-sm text-slate-600">
                    Patient: {payment.patients.first_name} {payment.patients.last_name}
                  </p>
                </div>
                <span className="text-xl font-bold">{formatMoney(payment.amount)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-3 bg-slate-50 p-2 rounded">
                <div>
                  <span className="text-slate-600">Mode:</span> {payment.payment_modes.name}
                </div>
                <div>
                  <span className="text-slate-600">Date:</span> {formatDatePH(payment.payment_date)}
                </div>
                {payment.reference_number && (
                  <div>
                    <span className="text-slate-600">Ref:</span> {payment.reference_number}
                  </div>
                )}
                {payment.proof_file && (
                  <div>
                    <a href={payment.proof_file.file_path} className="text-blue-600 underline">
                      View proof
                    </a>
                  </div>
                )}
              </div>

              {verifyingId === payment.id ? (
                <div className="bg-slate-50 p-3 rounded mb-3 space-y-3">
                  <div>
                    <label className="text-sm font-medium">Verified By (Staff)</label>
                    <select
                      className="w-full h-10 rounded-lg border px-3"
                      value={currentStaff}
                      onChange={(e) => setCurrentStaff(e.target.value)}
                    >
                      <option value="">Select staff</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Notes (optional)</label>
                    <textarea
                      className="w-full h-20 rounded-lg border px-3 py-2 text-sm"
                      placeholder="e.g., Screenshot verified, matches bank statement"
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="flex-1 h-10 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                      onClick={() => verifyPayment(payment.id)}
                      disabled={busy || !currentStaff}
                    >
                      Verify Payment
                    </button>
                    <button
                      className="flex-1 h-10 rounded-lg bg-slate-200 text-slate-900 font-semibold hover:bg-slate-300 disabled:opacity-50"
                      onClick={() => setVerifyingId(null)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full h-10 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                  onClick={() => setVerifyingId(payment.id)}
                >
                  Review & Verify
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. RECEIPT GENERATION (After Payment Verified)
// ============================================================================

// app/src/lib/receiptHelpers.ts (create this file)

export async function generateReceipt(paymentId: string, staffId: string, currentUserId: string) {
  // Fetch payment with related data
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select(`
      *,
      patient_id,
      invoice_id,
      payment_modes(name, code),
      patients(first_name, last_name),
      staff(full_name)
    `)
    .eq('id', paymentId)
    .single();

  if (paymentError) throw paymentError;

  // Guard: only verified payments
  if (payment.status !== 'verified') {
    throw new Error('Payment must be verified before issuing receipt');
  }

  // Generate unique receipt number (e.g., RCP-2026-000001)
  const { data: lastReceipt } = await supabase
    .from('receipts')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1);

  const nextNumber = (lastReceipt && lastReceipt[0] ? parseInt(lastReceipt[0].id.substring(0, 8)) + 1 : 1)
    .toString()
    .padStart(6, '0');
  const receiptNumber = `RCP-${new Date().getFullYear()}-${nextNumber}`;

  // Create snapshot
  const snapshot = {
    amount: payment.amount,
    payment_mode_code: payment.payment_modes.code,
    payment_mode_name: payment.payment_modes.name,
    reference_number: payment.reference_number || null,
    paid_by: `${payment.patients.first_name} ${payment.patients.last_name}`,
    payment_date: payment.payment_date,
    received_by_staff: payment.staff?.full_name || null,
  };

  // Insert receipt
  const { data, error } = await supabase
    .from('receipts')
    .insert({
      receipt_number,
      payment_id,
      invoice_id: payment.invoice_id,
      patient_id: payment.patient_id,
      issued_by: staffId,
      snapshot,
      created_by: currentUserId,
    })
    .select();

  if (error) throw error;

  return data[0];
}

// Usage in billing page modal:
{payment.status === 'verified' && !receipt && (
  <button
    className="bg-green-600 text-white px-4 py-2 rounded"
    onClick={async () => {
      const receipt = await generateReceipt(payment.id, currentStaffId, currentUserId);
      setReceiptNumber(receipt.receipt_number);
    }}
  >
    Issue Receipt
  </button>
)}

// ============================================================================
// 5. VOID PAYMENT & RECEIPT
// ============================================================================

async function voidPayment(paymentId: string, staffId: string, reason: string) {
  setErr(null);
  setBusy(true);

  // Void payment
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      voided_at: new Date().toISOString(),
      voided_by: staffId,
      void_reason: reason,
    })
    .eq('id', paymentId);

  if (updateError) {
    setBusy(false);
    return setErr(updateError.message);
  }

  // Void related receipt if exists
  await supabase
    .from('receipts')
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      voided_by: staffId,
      void_reason: `Payment voided: ${reason}`,
    })
    .eq('payment_id', paymentId)
    .eq('status', 'issued');

  setBusy(false);
  await loadData();
}

// ============================================================================
// 6. QUERY PATTERNS
// ============================================================================

// Get all active (non-voided) payments for an invoice
async function getActivePayments(invoiceId: string) {
  const { data } = await supabase
    .from('payments')
    .select(`
      *,
      payment_modes(name, code),
      verified_staff:verified_by(full_name),
      received_staff:received_by(full_name)
    `)
    .eq('invoice_id', invoiceId)
    .is('voided_at', null)
    .order('payment_date', { ascending: false });

  return data || [];
}

// Get verified payments only (ready for receipt)
async function getVerifiedPayments(invoiceId: string) {
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('status', 'verified')
    .is('voided_at', null);

  return data || [];
}

// Get total paid amount (sum active payments)
async function getTotalPaid(invoiceId: string) {
  const payments = await getActivePayments(invoiceId);
  return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
}

// ============================================================================
// 7. UI STATE EXAMPLE (Extended Billing Page)
// ============================================================================

/*
State needed in billing page:

// For payment creation
const [paymentReferenceNumber, setPaymentReferenceNumber] = useState('');
const [paymentReceivedByStaffId, setPaymentReceivedByStaffId] = useState('');
const [paymentReceivedByStaffName, setPaymentReceivedByStaffName] = useState('');
const [paymentGCashMobile, setPaymentGCashMobile] = useState('');
const [paymentGCashRef, setPaymentGCashRef] = useState('');
const [paymentMayaRef, setPaymentMayaRef] = useState('');
const [paymentMayaEmail, setPaymentMayaEmail] = useState('');
const [paymentBankName, setPaymentBankName] = useState('');
const [paymentAccountName, setPaymentAccountName] = useState('');
const [paymentTransferRef, setPaymentTransferRef] = useState('');
const [paymentChequeBank, setPaymentChequeBank] = useState('');
const [paymentChequeDate, setPaymentChequeDate] = useState('');
const [proofFile, setProofFile] = useState<File | null>(null);
const [proofUploadPath, setProofUploadPath] = useState<string>('');
const [staff, setStaff] = useState<any[]>([]);

// Load staff on mount
useEffect(() => {
  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*').eq('is_active', true);
    setStaff(data || []);
  }
  loadStaff();
}, []);
*/

// ============================================================================
// 8. TYPES (Update app/src/lib/types.ts)
// ============================================================================

/*
Add these types:

export type PaymentModeRow = {
  id: string;
  code: string;
  name: string;
  requires_proof: boolean;
  requires_reference: boolean;
  requires_received_by: boolean;
  auto_verifies: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentRowExtended = PaymentRow & {
  status: string;
  reference_number: string | null;
  received_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  proof_file_id: string | null;
  proof_storage_path: string | null;
  details: Record<string, any>;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string;
  updated_at: string;
};

export type StaffRow = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ReceiptRow = {
  id: string;
  receipt_number: string;
  payment_id: string;
  invoice_id: string;
  patient_id: string;
  issued_by: string | null;
  issued_at: string;
  status: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  snapshot: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
};
*/

// ============================================================================
// SUMMARY
// ============================================================================
/*
Key Implementation Steps:

1. Run SQL migration (001_payment_system_schema.sql)
2. Create receiptHelpers.ts and paymentModeHelpers.ts
3. Extend types.ts with new types
4. Update billing page to:
   - Check mode requirements before rendering fields
   - Build details JSONB based on selected mode
   - Set status based on auto_verifies flag
5. Create new staff management page (CRUD)
6. Create new payment verification page (for pending payments)
7. Add "Issue Receipt" button to verified payments
8. Add "Void Payment" button with reason modal
9. Update all payment queries to filter: is('voided_at', null)
10. Test end-to-end: create payment → verify → issue receipt → void

Optional: Add receipt printing/PDF generation later using snapshot data
*/
