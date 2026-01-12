# Payment System Schema Migration Guide

## Overview

This migration updates your Matira Dental Studio Supabase database to a future-proof, flexible payment system that supports:

- **Cash, GCash, Maya, Online Bank Transfer, Cheque** payment modes
- **Proof verification** (screenshots for digital payments)
- **Staff-based verification** with audit trail
- **Receipt generation** with stable snapshots
- **Payment voiding** (soft-delete with audit trail)
- **Flexible mode-specific data** via JSONB `details` field

---

## What Changed

### 1. **payment_modes Table (Enhanced)**

New columns added:
- `code` (text, unique): Standardized code (CASH, GCASH, MAYA, BANK_TRANSFER, CHEQUE)
- `requires_proof` (boolean): Does this mode require a proof file (screenshot)?
- `requires_reference` (boolean): Does this mode require a reference number (GCash ref, cheque #)?
- `requires_received_by` (boolean): Does this mode require staff name (mainly for cash)?
- `auto_verifies` (boolean): Auto-verify on insert? (true for CASH only)
- `sort_order` (int): UI display order
- `is_active` (boolean): Toggle payment mode on/off

**Backfill Strategy**: Existing modes are matched by name and assigned codes. You can safely add custom modes.

---

### 2. **payments Table (Extended)**

New columns added:
- `status` (text, default 'pending'): 'pending' → staff verifies → 'verified' (or 'rejected' in future)
- `reference_number` (text, nullable): Cheque #, GCash ref, bank transfer ID, etc.
- `received_by` (uuid, nullable): FK to staff—who physically received the cash
- `verified_by` (uuid, nullable): FK to staff—who verified the payment
- `verified_at` (timestamptz, nullable): When payment was verified
- `verification_notes` (text, nullable): Why verified/rejected
- `proof_file_id` (uuid, nullable): FK to file/attachment if uploaded
- `proof_storage_path` (text, nullable): Supabase Storage path if using direct storage
- `details` (jsonb, default '{}'): Mode-specific info (bank name, payer mobile, etc.)
- `voided_at` (timestamptz, nullable): When payment was voided
- `voided_by` (uuid, nullable): FK to staff—who voided it
- `void_reason` (text, nullable): Why voided
- `created_by` (uuid, default auth.uid()): User who created payment
- `updated_at` (timestamptz, default now()): Auto-updated on every change

**Data Migration**: Existing payments get `status = 'verified'` if their mode auto-verifies (CASH), else `'pending'`.

**Indexes**: Added on `invoice_id`, `patient_id`, `payment_mode_id`, `status`, `verified_at`, `created_by` for fast queries.

**Auto-Update Trigger**: `updated_at` is automatically set on every update.

---

### 3. **staff Table (New)**

Simple table to track clinic staff:
- `id` (uuid, pk)
- `full_name` (text, not null)
- `role` (text, not null): e.g., 'Dentist', 'Assistant', 'Receptionist', 'Admin'
- `is_active` (boolean, default true)
- `created_by` (uuid, default auth.uid()): Which clinic user created this staff record
- `created_at`, `updated_at` (timestamptz)

**Optional Enhancement**: If you already have a `profiles` or `users` table for staff, you can reference that instead of duplicating. For now, this simple table works for multi-clinic scenarios.

**Indexes**: On `is_active`, `created_by` for lookups.

---

### 4. **receipts Table (New)**

Track receipt issuance and voiding:
- `id` (uuid, pk)
- `receipt_number` (text, unique): Sequential or formatted receipt ID
- `payment_id` (uuid, FK to payments)
- `invoice_id`, `patient_id` (uuids, FKs)
- `issued_by` (uuid, FK to staff): Who issued the receipt
- `issued_at` (timestamptz, default now())
- `status` (text, default 'issued'): 'issued' or 'voided'
- `voided_at`, `voided_by`, `void_reason` (timestamptz, uuid, text): Audit trail
- `snapshot` (jsonb): **Immutable copy** of payment info (amount, mode name, reference, payment date)
- `created_by` (uuid, default auth.uid())
- `created_at`, `updated_at` (timestamptz)

**Key Design**: The `snapshot` field stores a JSON snapshot of the payment at issuance time. This ensures that if you later edit the payment (e.g., change reference or amount), the receipt remains unchanged.

Example snapshot:
```json
{
  "amount": 15000,
  "payment_mode_name": "GCash",
  "reference_number": "ABC123DEF456",
  "paid_by_name": "John Doe",
  "payment_date": "2026-01-12",
  "received_by_staff": "Maria"
}
```

---

## Workflow Rules by Payment Mode

### Cash
- **requires_proof**: ❌ false
- **requires_reference**: ❌ false
- **requires_received_by**: ✅ true (must record staff who received it)
- **auto_verifies**: ✅ true (verified immediately upon insert)
- **App Logic**: No proof upload needed. On insert, `status='verified'` automatically.

### GCash
- **requires_proof**: ✅ true (screenshot)
- **requires_reference**: ✅ true (GCash reference ID)
- **requires_received_by**: ❌ false
- **auto_verifies**: ❌ false (staff reviews proof later)
- **App Logic**: Insert with status='pending'. Staff verifies after reviewing screenshot.

### Maya
- Same as GCash.

### Online Bank Transfer
- **requires_proof**: ✅ true (bank screenshot)
- **requires_reference**: ✅ true (transaction reference)
- **requires_received_by**: ❌ false
- **auto_verifies**: ❌ false
- **App Logic**: Insert with status='pending'. Staff verifies after reviewing proof.

### Cheque
- **requires_proof**: ❌ false
- **requires_reference**: ✅ true (cheque number)
- **requires_received_by**: ❌ false
- **auto_verifies**: ❌ false
- **App Logic**: Insert with status='pending'. Cheque # stored in `reference_number`. Staff verifies after cheque clears.

---

## Application Implementation

### 1. Insert Payment (Billing Page)

```typescript
// Fetch payment mode config
const { data: mode } = await supabase
  .from('payment_modes')
  .select('*')
  .eq('code', 'GCASH')
  .single();

// Build payment row
const payment = {
  patient_id: patientId,
  invoice_id: invoiceId,
  payment_mode_id: mode.id,
  amount: 15000,
  payment_date: '2026-01-12',
  reference_number: mode.requires_reference ? 'ABC123DEF456' : null,
  received_by: mode.requires_received_by ? staffId : null,
  proof_storage_path: mode.requires_proof ? 'patient-files/proof_...' : null,
  status: mode.auto_verifies ? 'verified' : 'pending',
  details: {
    payer_mobile: '09171234567',
    gcash_ref: 'ABC123DEF456'
  },
  created_by: currentUserId
};

const { data, error } = await supabase.from('payments').insert([payment]);
```

### 2. Verify Payment (Staff Admin Interface)

Only staff with `verified_by` permission should do this:

```typescript
const { error } = await supabase
  .from('payments')
  .update({
    status: 'verified',
    verified_by: staffId,
    verified_at: new Date().toISOString(),
    verification_notes: 'Screenshot reviewed and matches bank statement'
  })
  .eq('id', paymentId)
  .eq('status', 'pending');

if (error) {
  // Handle rejection or already verified
}

// Only NOW can receipt be issued
```

### 3. Issue Receipt

```typescript
// Get the payment to snapshot
const { data: payment } = await supabase
  .from('payments')
  .select('*, payment_modes(name), patients(first_name, last_name), staff(full_name)')
  .eq('id', paymentId)
  .single();

// Guard: can only issue if verified
if (payment.status !== 'verified') {
  throw new Error('Payment not verified yet');
}

// Generate receipt number (e.g., RCP-2026-001234)
const receiptNumber = `RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

// Create snapshot
const snapshot = {
  amount: payment.amount,
  payment_mode_name: payment.payment_modes.name,
  reference_number: payment.reference_number,
  paid_by_name: `${payment.patients.first_name} ${payment.patients.last_name}`,
  payment_date: payment.payment_date,
  received_by_staff: payment.staff?.full_name
};

// Insert receipt
const { data: receipt, error } = await supabase
  .from('receipts')
  .insert({
    receipt_number: receiptNumber,
    payment_id: paymentId,
    invoice_id: payment.invoice_id,
    patient_id: payment.patient_id,
    issued_by: staffId,
    snapshot: snapshot,
    created_by: currentUserId
  });
```

### 4. Void Payment & Receipt

```typescript
// Void the payment
await supabase
  .from('payments')
  .update({
    voided_at: new Date().toISOString(),
    voided_by: staffId,
    void_reason: 'Duplicate entry'
  })
  .eq('id', paymentId);

// Void related receipt (if exists)
await supabase
  .from('receipts')
  .update({
    status: 'voided',
    voided_at: new Date().toISOString(),
    voided_by: staffId,
    void_reason: 'Associated payment voided'
  })
  .eq('payment_id', paymentId)
  .eq('status', 'issued');
```

### 5. Safely Query Payments (Exclude Voided)

```typescript
// Get active (non-voided) payments for an invoice
const { data: payments } = await supabase
  .from('payments')
  .select('*, payment_modes(name, code)')
  .eq('invoice_id', invoiceId)
  .is('voided_at', null);

// Calculate total paid (from non-voided payments)
const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
```

---

## Migration Steps

### Step 1: Backup
Create a Supabase backup before running the migration:
1. Go to **Settings > Database > Backups** in Supabase dashboard
2. Click **Create backup**

### Step 2: Run SQL Migration
In **Supabase SQL Editor**:
1. Open the SQL Editor
2. Paste the contents of `migrations/001_payment_system_schema.sql`
3. Run the entire script

The script is idempotent:
- `ADD COLUMN IF NOT EXISTS` won't error if columns exist
- `CREATE TABLE IF NOT EXISTS` won't error if table exists
- `ON CONFLICT ... DO UPDATE` for upserts is safe to re-run
- `DROP POLICY IF EXISTS ... CREATE POLICY` recreates RLS safely

### Step 3: Update Client Code (Optional)

The new fields are optional. Existing code will continue to work:
- `status` defaults to 'pending'
- All new fields are nullable or have safe defaults
- Triggers auto-manage `updated_at`

However, to leverage the new features:
1. Update billing page to handle `requires_proof`, `requires_reference`, `requires_received_by` flags
2. Create staff admin UI for verifying payments
3. Create receipt issuance UI (only when `status='verified'`)

### Step 4: Test
1. Log in to the app
2. Create a new payment (should work as before)
3. Verify the payment appears in the database
4. Check that `status` is correctly set based on payment mode

---

## Data Dictionary

### payment_modes

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | ❌ | gen_random_uuid() | PK |
| code | text | ❌ | — | CASH, GCASH, MAYA, BANK_TRANSFER, CHEQUE, CREDIT_CARD |
| name | text | ❌ | — | Display name for UI |
| requires_proof | boolean | ❌ | false | Does this need screenshot/proof file? |
| requires_reference | boolean | ❌ | false | Does this need reference # (GCash ref, cheque #)? |
| requires_received_by | boolean | ❌ | false | Does this need staff name (mainly cash)? |
| auto_verifies | boolean | ❌ | false | Verify immediately on insert? (CASH only) |
| sort_order | int | ❌ | 0 | Display order in dropdowns |
| is_active | boolean | ❌ | true | Enable/disable mode |
| created_at | timestamptz | ❌ | now() | — |
| updated_at | timestamptz | ❌ | now() | — |

### payments (extended)

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|-----|-------|
| id | uuid | ❌ | gen_random_uuid() | — | PK |
| patient_id | uuid | ❌ | — | patients | — |
| invoice_id | uuid | ❌ | — | invoices | — |
| payment_mode_id | uuid | ❌ | — | payment_modes | — |
| amount | numeric | ❌ | — | — | Amount in PHP |
| payment_date | date | ❌ | — | — | When payment was made |
| status | text | ❌ | 'pending' | — | 'pending' or 'verified' (extensible) |
| reference_number | text | ✅ | null | — | Cheque #, GCash ref, bank txn ID |
| received_by | uuid | ✅ | null | staff | Who physically received cash |
| verified_by | uuid | ✅ | null | staff | Who verified the payment |
| verified_at | timestamptz | ✅ | null | — | When payment was verified |
| verification_notes | text | ✅ | null | — | Why verified/rejected |
| proof_file_id | uuid | ✅ | null | attachments/files | FK to proof file |
| proof_storage_path | text | ✅ | null | — | Supabase Storage path |
| details | jsonb | ❌ | '{}' | — | Mode-specific data (bank_name, payer_mobile, etc.) |
| voided_at | timestamptz | ✅ | null | — | When voided (null = active) |
| voided_by | uuid | ✅ | null | staff | Who voided it |
| void_reason | text | ✅ | null | — | Why voided |
| created_by | uuid | ❌ | auth.uid() | auth.users | User who created |
| created_at | timestamptz | ❌ | now() | — | Created timestamp |
| updated_at | timestamptz | ❌ | now() | — | Auto-updated on change |
| notes | text | ✅ | null | — | (Existing) General notes |
| mode | text | ✅ | null | — | (Existing, legacy) Payment mode name string |
| reference_no | text | ✅ | null | — | (Existing, legacy) Reference |
| received_by_staff | text | ✅ | null | — | (Existing, legacy) Staff name string |

### staff (new)

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|-----|-------|
| id | uuid | ❌ | gen_random_uuid() | — | PK |
| full_name | text | ❌ | — | — | Staff full name |
| role | text | ❌ | — | — | 'Dentist', 'Assistant', 'Receptionist', 'Admin' |
| is_active | boolean | ❌ | true | — | Toggle active/inactive |
| created_by | uuid | ❌ | auth.uid() | auth.users | Clinic user who created |
| created_at | timestamptz | ❌ | now() | — | — |
| updated_at | timestamptz | ❌ | now() | — | Auto-updated on change |

### receipts (new)

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|-----|-------|
| id | uuid | ❌ | gen_random_uuid() | — | PK |
| receipt_number | text | ❌ | — | — | Unique receipt ID (e.g., RCP-2026-001234) |
| payment_id | uuid | ❌ | — | payments | The payment this receipt covers |
| invoice_id | uuid | ❌ | — | invoices | Associated invoice |
| patient_id | uuid | ❌ | — | patients | Associated patient |
| issued_by | uuid | ✅ | null | staff | Who issued the receipt |
| issued_at | timestamptz | ❌ | now() | — | When receipt was issued |
| status | text | ❌ | 'issued' | — | 'issued' or 'voided' |
| voided_at | timestamptz | ✅ | null | — | When voided |
| voided_by | uuid | ✅ | null | staff | Who voided the receipt |
| void_reason | text | ✅ | null | — | Why voided |
| snapshot | jsonb | ❌ | '{}' | — | Immutable copy of payment data (amount, mode, ref, date, etc.) |
| created_by | uuid | ❌ | auth.uid() | auth.users | User who created |
| created_at | timestamptz | ❌ | now() | — | — |
| updated_at | timestamptz | ❌ | now() | — | Auto-updated on change |

---

## RLS Policies

All tables have Row-Level Security enabled:

### payment_modes
- **SELECT**: Authenticated users can view all modes (needed for dropdowns)
- **INSERT/UPDATE/DELETE**: Admin only (controlled by `auth.jwt()->>'role' = 'admin'`)

### payments
- **SELECT**: Authenticated users can view all payments (clinics are single-tenant per auth user)
- **INSERT/UPDATE/DELETE**: Only the user who created (`created_by = auth.uid()`)

### staff
- **SELECT**: Authenticated users can view all staff (for dropdowns, assignments)
- **INSERT/UPDATE/DELETE**: Created user only, or admin

### receipts
- **SELECT**: Authenticated users can view all receipts
- **INSERT/UPDATE/DELETE**: Created user only

---

## Future Enhancements

1. **Installment Plans**: Add `installment_plan_id` to payments; link to a new `installment_plans` table
2. **Refunds**: Add `refund_amount`, `refund_date`, `refunded_to_mode` to payments
3. **Payment Reconciliation**: Add `reconciled_at`, `reconciled_by` to track bank/payment processor matching
4. **Detailed Proof Tracking**: Enhance `proof_file_id` to support multiple proofs (1:N relationship)
5. **Receipt Customization**: Add clinic logo, letterhead, terms to receipt snapshot
6. **Audit Log Table**: Create separate `audit_logs` table to track all payment state changes

All these can be added without breaking existing data, thanks to nullable fields and JSONB flexibility.

---

## Troubleshooting

### Q: I have existing payments. Will they work?
**A:** Yes. The migration backfills `status='verified'` for payments with auto-verify modes (CASH). Others get `status='pending'`. Existing `mode`, `notes`, `reference_no` columns remain unchanged. The UI should continue to work.

### Q: What if I don't want to use the staff table?
**A:** Optional. You can leave it empty or reference your existing `profiles`/`users` table instead. Just update `received_by` and `verified_by` to point to auth.users or your staff table.

### Q: How do I add new payment modes?
**A:** INSERT into `payment_modes`:
```sql
INSERT INTO payment_modes (code, name, requires_proof, requires_reference, auto_verifies, sort_order, is_active)
VALUES ('INSTALLMENT', 'Installment Plan', false, false, false, 60, true);
```

### Q: Can I use details JSONB for any data?
**A:** Yes. Validate and use it freely. Example: cheque payments can store `{ cheque_bank: 'PNB', cheque_date: '2026-01-20' }`. No schema change needed.

### Q: Can I undo the migration?
**A:** Yes. You can create a rollback migration that:
- DROP NEW columns/tables (carefully, or just leave them unused)
- Delete triggers
- Drop RLS policies

For production, test on a backup first.

---

## Summary

This migration provides a **future-proof, flexible** payment system that:
- ✅ Supports multiple payment modes with mode-specific requirements
- ✅ Tracks verification status and audit trail
- ✅ Generates stable receipt snapshots
- ✅ Uses JSONB for extensible data (no schema migrations for new fields)
- ✅ Soft-deletes (voiding) for audit compliance
- ✅ RLS for multi-user security
- ✅ Auto-triggers for updated_at timestamps
- ✅ Indexes for performance

Your app will continue to work without changes, but you now have the foundation to build robust payment verification and receipt workflows. 🎉
