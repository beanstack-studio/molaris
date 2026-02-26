-- Migration: Documents System Schema
-- Version: 017
-- Date: 2026-02-25
-- Description:
--   Implements unified document numbering and management system:
--   - doc_counters table for concurrent-safe document number generation
--   - documents table unifying all document types (INV, PMT, SOA, RX, CER, REF)
--   - Replaces old generated_documents table
--   - Provides SQL function for atomic counter increment
--   - added triggers for updated_at tracking

-- ============================================================================
-- A) CREATE doc_counters TABLE (concurrent-safe number generation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS doc_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_code text NOT NULL,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(doc_code, year)
);

-- Seed initial counters for all document types at year 2026
INSERT INTO doc_counters (doc_code, year, last_number)
VALUES 
  ('INV', 2026, 0),
  ('PMT', 2026, 0),
  ('SOA', 2026, 0),
  ('RX', 2026, 0),
  ('CER', 2026, 0),
  ('REF', 2026, 0)
ON CONFLICT (doc_code, year) DO NOTHING;

-- ============================================================================
-- B) CREATE FUNCTION for atomic counter increment (transaction-safe)
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_doc_counter(p_doc_code TEXT, p_year INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_num INT;
BEGIN
  -- Upsert: increment or initialize if row doesn't exist
  INSERT INTO doc_counters (doc_code, year, last_number)
  VALUES (p_doc_code, p_year, 1)
  ON CONFLICT (doc_code, year) 
  DO UPDATE SET 
    last_number = doc_counters.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO v_next_num;
  
  RETURN v_next_num;
END;
$$;

-- ============================================================================
-- C) CREATE documents TABLE (unified document storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Patient reference
  patient_id uuid,
  patient_name text,
  -- Related entity references
  invoice_id uuid,
  payment_id uuid,
  visit_id uuid,
  -- Document identification
  doc_type text NOT NULL,
    -- Valid values: INVOICE, PAYMENT_RECEIPT, ACCOUNT_STATEMENT, PRESCRIPTION, DENTAL_CERTIFICATE, REFERRAL_LETTER
  doc_code text NOT NULL,
    -- Code portion: INV, PMT, SOA, RX, CER, REF
  doc_no text NOT NULL UNIQUE,
    -- Full number: INV26-0001, PMT26-0001, etc.
  -- Immutable snapshot
  payload jsonb NOT NULL,
    -- Immutable snapshot of all document data for consistent rendering
  -- Clinic metadata (for templating)
  clinic_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Clinic name, address, contact, logo_url, TIN, DTI, BIR placeholders
  -- Dentist information
  dentist_name text,
  dentist_prc text,
  dentist_ptr text,
  -- Issuance tracking
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by text,
    -- staff full_name or user email; helps with audit trail
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Constraint to reference patient if available
  CONSTRAINT fk_patient 
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_documents_patient_id ON documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_doc_code ON documents(doc_code);
CREATE INDEX IF NOT EXISTS idx_documents_doc_no ON documents(doc_no);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_invoice_id ON documents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_documents_payment_id ON documents(payment_id);

-- ============================================================================
-- D) TRIGGER for updated_at on documents
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_updated_at_trigger ON documents;
CREATE TRIGGER documents_updated_at_trigger
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION trigger_documents_updated_at();

-- ============================================================================
-- E) CREATE FUNCTION for updated_at on doc_counters (BEFORE trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_doc_counters_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- F) TRIGGER for updated_at on doc_counters (AFTER function)
-- ============================================================================

DROP TRIGGER IF EXISTS doc_counters_updated_at_trigger ON doc_counters;
CREATE TRIGGER doc_counters_updated_at_trigger
BEFORE UPDATE ON doc_counters
FOR EACH ROW
EXECUTE FUNCTION trigger_doc_counters_updated_at();

-- ============================================================================
-- G) OPTIONAL: RLS (Row-Level Security) - permissive for now
-- ============================================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_counters ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all documents (clinic-wide)
CREATE POLICY "Allow authenticated read" ON documents
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert documents
CREATE POLICY "Allow authenticated insert" ON documents
  FOR INSERT TO authenticated WITH CHECK (true);

-- Prevent updates to documents (immutable)
CREATE POLICY "Prevent updates" ON documents
  FOR UPDATE USING (false);

-- Allow soft-delete (update voided_at if column exists in future)
CREATE POLICY "Allow soft delete via tombstone" ON documents
  FOR DELETE USING (false); -- Prevent hard DELETE; use soft-delete pattern if needed

-- Counter operations (internal only, but keep open for now)
CREATE POLICY "Allow counter operations" ON doc_counters
  FOR ALL TO authenticated USING (true);
