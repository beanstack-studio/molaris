-- Migration: Payment System Schema Enhancement & Future-Proofing
-- Version: 001
-- Date: 2026-01-12
-- Description:
--   Extends the payment system with:
--   - Enhanced payment_modes with flags for cash/proof/reference requirements
--   - Extended payments table with verification, status, voiding, and proof tracking
--   - New staff table for tracking staff who received cash/verified payments
--   - New receipts table for stable receipt snapshots and issuance tracking
--   - Updated_at triggers for all mutable tables
--   - RLS policies for security
--   - Indexes for performance
--
-- Design Decisions:
--   - Uses JSONB 'details' field for mode-specific info (bank name, cheque number, etc.)
--   - Minimal required fields; flexible for future methods
--   - Cash auto-verifies; other modes require manual staff verification
--   - Proof uploads optional per mode flag (GCash/Maya/Bank Transfer require, Cash doesn't)
--   - Receipts store snapshot of payment info to prevent old receipts from changing
--   - Soft voiding (void timestamps) instead of deletion for audit trail
--   - RLS enabled on user-owned tables with created_by auth.uid()

-- ============================================================================
-- A) UPDATE payment_modes TABLE
-- ============================================================================

-- Add new columns to payment_modes if they don't exist
ALTER TABLE payment_modes ADD COLUMN IF NOT EXISTS code text unique;
ALTER TABLE payment_modes ADD COLUMN IF NOT EXISTS requires_proof boolean not null default false;
ALTER TABLE payment_modes ADD COLUMN IF NOT EXISTS requires_reference boolean not null default false;
ALTER TABLE payment_modes ADD COLUMN IF NOT EXISTS requires_received_by boolean not null default false;
ALTER TABLE payment_modes ADD COLUMN IF NOT EXISTS auto_verifies boolean not null default false;
ALTER TABLE payment_modes ADD COLUMN IF NOT EXISTS sort_order int not null default 0;
ALTER TABLE payment_modes ADD COLUMN IF NOT EXISTS is_active boolean not null default true;

-- Backfill 'code' for existing modes matching by name (case-insensitive, idempotent)
UPDATE payment_modes 
SET code = 'CASH' 
WHERE code IS NULL AND lower(name) = 'cash';

UPDATE payment_modes 
SET code = 'GCASH' 
WHERE code IS NULL AND lower(name) = 'gcash';

UPDATE payment_modes 
SET code = 'MAYA' 
WHERE code IS NULL AND lower(name) = 'maya';

UPDATE payment_modes 
SET code = 'BANK_TRANSFER' 
WHERE code IS NULL AND lower(name) in ('bank transfer', 'online bank transfer', 'bank');

UPDATE payment_modes 
SET code = 'CHEQUE' 
WHERE code IS NULL AND lower(name) in ('cheque', 'check');

UPDATE payment_modes 
SET code = 'CREDIT_CARD' 
WHERE code IS NULL AND lower(name) in ('credit card', 'credit');

-- Upsert canonical modes (idempotent via ON CONFLICT)
INSERT INTO payment_modes (code, name, requires_proof, requires_reference, requires_received_by, auto_verifies, sort_order, is_active)
VALUES 
  ('CASH', 'Cash', false, false, true, true, 10, true),
  ('GCASH', 'GCash', true, true, false, false, 20, true),
  ('MAYA', 'Maya', true, true, false, false, 30, true),
  ('BANK_TRANSFER', 'Online bank transfer', true, true, false, false, 40, true),
  ('CHEQUE', 'Cheque', false, true, false, false, 50, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  requires_proof = EXCLUDED.requires_proof,
  requires_reference = EXCLUDED.requires_reference,
  requires_received_by = EXCLUDED.requires_received_by,
  auto_verifies = EXCLUDED.auto_verifies,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- B) EXTEND payments TABLE
-- ============================================================================

-- Add new columns to payments if they don't exist
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status text not null default 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS received_by uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_file_id uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_storage_path text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS details jsonb not null default '{}'::jsonb;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_by uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by uuid default auth.uid();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

-- Data migration: backfill status based on existing mode flags
-- Conservative: set to 'pending' if mode requires verification, else 'verified'
-- (Run this only once; subsequent migrations should use INSERT logic)
UPDATE payments p
SET status = 'verified'
WHERE p.status = 'pending' 
  AND EXISTS (
    SELECT 1 FROM payment_modes pm
    WHERE pm.id = p.payment_mode_id
      AND (pm.auto_verifies = true OR pm.code = 'CASH')
  );

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_mode_id ON payments(payment_mode_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_verified_at ON payments(verified_at);
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by);

-- ============================================================================
-- C) CREATE staff TABLE (new, if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text not null,  -- e.g., 'Dentist', 'Assistant', 'Admin', 'Receptionist'
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_staff_is_active ON staff(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_created_by ON staff(created_by);

-- Enable RLS on staff table
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- RLS Policy: authenticated users can see all staff (lookups)
-- Admin/managers can insert/update/delete
DROP POLICY IF EXISTS "Allow authenticated to view staff" ON staff;
CREATE POLICY "Allow authenticated to view staff" ON staff
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow users to manage staff" ON staff;
CREATE POLICY "Allow users to manage staff" ON staff
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR auth.jwt()->>'role' = 'admin')
  WITH CHECK (created_by = auth.uid() OR auth.jwt()->>'role' = 'admin');

-- ============================================================================
-- D) CREATE receipts TABLE (new, if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique not null,
  payment_id uuid not null references payments(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  issued_by uuid references staff(id) on delete set null,
  issued_at timestamptz not null default now(),
  status text not null default 'issued',  -- 'issued' or 'voided'
  voided_at timestamptz,
  voided_by uuid references staff(id) on delete set null,
  void_reason text,
  -- Snapshot of payment info to prevent old receipts from changing
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_patient_id ON receipts(patient_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_issued_at ON receipts(issued_at);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_created_by ON receipts(created_by);

-- Enable RLS on receipts table
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to view receipts" ON receipts;
CREATE POLICY "Allow authenticated to view receipts" ON receipts
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow users to manage receipts" ON receipts;
CREATE POLICY "Allow users to manage receipts" ON receipts
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ============================================================================
-- E) CREATE/UPDATE TRIGGER FUNCTIONS for updated_at
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on payments table
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger on staff table
DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
CREATE TRIGGER update_staff_updated_at
BEFORE UPDATE ON staff
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger on receipts table
DROP TRIGGER IF EXISTS update_receipts_updated_at ON receipts;
CREATE TRIGGER update_receipts_updated_at
BEFORE UPDATE ON receipts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- E) CREATE SEQUENCES FOR SEQUENTIAL NUMBER GENERATION
-- ============================================================================

-- Create sequences for invoice, transaction, and receipt numbers (start from 1)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS transaction_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;

-- ============================================================================
-- E2) CREATE RPC FUNCTIONS FOR SEQUENTIAL NUMBER GENERATION
-- ============================================================================

-- Function to get next invoice number (I260001, I260002, etc.)
CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS text AS $$
DECLARE
  seq_val bigint;
  year_suffix text;
BEGIN
  seq_val := nextval('invoice_number_seq');
  year_suffix := to_char(now(), 'YY'); -- "26" for 2026
  RETURN 'I' || year_suffix || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to get next transaction number (T260001, T260002, etc.)
CREATE OR REPLACE FUNCTION get_next_transaction_number()
RETURNS text AS $$
DECLARE
  seq_val bigint;
  year_suffix text;
BEGIN
  seq_val := nextval('transaction_number_seq');
  year_suffix := to_char(now(), 'YY'); -- "26" for 2026
  RETURN 'T' || year_suffix || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to get next receipt number (R260001, R260002, etc.)
CREATE OR REPLACE FUNCTION get_next_receipt_number()
RETURNS text AS $$
DECLARE
  seq_val bigint;
  year_suffix text;
BEGIN
  seq_val := nextval('receipt_number_seq');
  year_suffix := to_char(now(), 'YY'); -- "26" for 2026
  RETURN 'R' || year_suffix || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- F) ENABLE RLS ON EXISTING TABLES & ADD POLICIES
-- ============================================================================

-- Enable RLS on payments (likely already enabled, but ensure it)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to view payments" ON payments;
CREATE POLICY "Allow authenticated to view payments" ON payments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow users to manage their payments" ON payments;
CREATE POLICY "Allow users to manage their payments" ON payments
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Enable RLS on payment_modes (lookup table)
ALTER TABLE payment_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to view payment modes" ON payment_modes;
CREATE POLICY "Allow authenticated to view payment modes" ON payment_modes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin to manage payment modes" ON payment_modes;
CREATE POLICY "Allow admin to manage payment modes" ON payment_modes
  FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

-- ============================================================================
-- G) USAGE GUIDELINES (as SQL comments for reference)
-- ============================================================================

/*
WORKFLOW USAGE GUIDELINES:

1. PAYMENT CREATION (client side, e.g., billing page):
   - Check payment_modes table for requires_proof, requires_reference, requires_received_by, auto_verifies
   - INSERT into payments with:
     * status: 'verified' if auto_verifies=true (e.g., CASH), else 'pending'
     * received_by: staff uuid if cash payment (required for cash)
     * reference_number: cheque #, GCash ref, etc. (required if requires_reference=true)
     * proof_file_id or proof_storage_path: only if requires_proof=true
     * details: JSONB with mode-specific info (bank_name, payer_mobile, cheque_bank, etc.)
     * created_by: current auth user

2. PAYMENT VERIFICATION (staff admin interface):
   - Can only issue receipt when payment.status='verified' or verified_at is not null
   - To verify a payment:
     UPDATE payments SET status='verified', verified_by=<staff_uuid>, verified_at=now(), verification_notes=<notes>
     WHERE id=<payment_id> AND status='pending'
   - Update verify_by and verified_at fields

3. RECEIPT GENERATION:
   - Only generate receipt after payment.verified_at is set (payment.status='verified')
   - Create receipts with snapshot of key info at issuance time:
     snapshot: { amount, payment_mode_name, reference_number, paid_by_name, payment_date }
   - This prevents old receipts from changing if payment edits later

4. VOIDING PAYMENTS:
   - Set payments.voided_at, voided_by, void_reason (soft delete, keep audit trail)
   - If receipt exists, void it too: set receipts.voided_at, voided_by, void_reason
   - Do NOT delete rows; use voided_at for filtering

5. DETAILS JSONB FIELD (flexible, mode-specific):
   Examples:
   - CASH: { received_by_staff_name: "Maria" }
   - GCASH: { payer_mobile: "09171234567", gcash_ref: "ABC123DEF456" }
   - MAYA: { maya_ref: "MY123XYZ", payer_email: "user@example.com" }
   - BANK_TRANSFER: { bank_name: "BDO", account_name: "Clinic", transfer_ref: "TXN123" }
   - CHEQUE: { cheque_bank: "PNB", cheque_number: "CHQ-001234" } -- or use reference_number for cheque #

6. INDEXES:
   - Query by invoice_id, patient_id, status, created_date frequently
   - Indexes on those columns enable fast lookups

7. FUTURE EXTENSIONS:
   - details jsonb can store new fields without schema migration
   - Add more payment modes by inserting into payment_modes
   - Add more staff roles as needed
   - Receipts snapshot ensures historical accuracy even if payment mode name changes

*/
