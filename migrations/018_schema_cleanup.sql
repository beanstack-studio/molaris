-- Migration 018: Schema Cleanup
-- Date: 2026-04-06
-- Description:
--   Removes all deprecated columns and dead tables identified in the
--   full codebase audit. None of these columns or tables are referenced
--   anywhere in the application code.
--
-- ⚠️  BEFORE RUNNING: verify no active integrations write to these columns.
-- ⚠️  The payments.mode and payments.notes columns are NOT dropped here —
--     they are still read/written by the bulk-payments UI. Clean those up
--     separately after migrating bulkPaymentHelpers to use details JSONB.

-- ============================================================================
-- STEP 1: DROP DEAD TABLES
-- ============================================================================

-- encounters: planned abstraction, never implemented in UI
DROP TABLE IF EXISTS public.encounters CASCADE;

-- generated_documents: replaced by the documents table (migration 017)
DROP TABLE IF EXISTS public.generated_documents CASCADE;

-- dentist_schedules: never queried or displayed anywhere in code
DROP TABLE IF EXISTS public.dentist_schedules CASCADE;

-- staff_schedules: never queried or displayed anywhere in code
DROP TABLE IF EXISTS public.staff_schedules CASCADE;

-- audit_logs: never written to or read anywhere in code
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- doc_counters: created in migration 017 but numberGenerationHelpers.ts
--   counts records directly — increment_doc_counter is never called
DROP TABLE IF EXISTS public.doc_counters CASCADE;

-- document_templates: settings page says "we'll connect this later" — never wired up
DROP TABLE IF EXISTS public.document_templates CASCADE;


-- ============================================================================
-- STEP 2: DROP DEAD COLUMNS — payments
-- ============================================================================

-- method: original payment method text, superseded by payment_mode_id concept
ALTER TABLE public.payments DROP COLUMN IF EXISTS method;

-- received_at: original receipt timestamp, superseded by payment_date
ALTER TABLE public.payments DROP COLUMN IF EXISTS received_at;

-- reference_no: renamed to reference_number in migration 001
ALTER TABLE public.payments DROP COLUMN IF EXISTS reference_no;

-- is_installment + installment_note: installment feature never implemented
ALTER TABLE public.payments DROP COLUMN IF EXISTS is_installment;
ALTER TABLE public.payments DROP COLUMN IF EXISTS installment_note;

-- verification_notes: in PaymentRowExtended type but never written or read in code
ALTER TABLE public.payments DROP COLUMN IF EXISTS verification_notes;

-- proof_file_id + proof_storage_path: proof upload feature never implemented
ALTER TABLE public.payments DROP COLUMN IF EXISTS proof_file_id;
ALTER TABLE public.payments DROP COLUMN IF EXISTS proof_storage_path;


-- ============================================================================
-- STEP 3: DROP DEAD COLUMNS — patients
-- ============================================================================

-- sex: original gender field, superseded by gender column
ALTER TABLE public.patients DROP COLUMN IF EXISTS sex;

-- patient_no: never referenced in any page, form, or query
ALTER TABLE public.patients DROP COLUMN IF EXISTS patient_no;

-- guardian/emergency contact fields: never used in UI or queries
ALTER TABLE public.patients DROP COLUMN IF EXISTS guardian_name;
ALTER TABLE public.patients DROP COLUMN IF EXISTS guardian_phone;
ALTER TABLE public.patients DROP COLUMN IF EXISTS emergency_contact_name;
ALTER TABLE public.patients DROP COLUMN IF EXISTS emergency_contact_phone;
ALTER TABLE public.patients DROP COLUMN IF EXISTS referred_by;


-- ============================================================================
-- STEP 4: DROP DEAD COLUMNS — treatments
-- ============================================================================

-- fee + default_fee + fee_note + service_name: old fee tracking system,
--   superseded by service_price_id FK to service_prices table
--   NOTE: 7 rows have data in fee — this is orphaned data, safe to discard
ALTER TABLE public.treatments DROP COLUMN IF EXISTS fee;
ALTER TABLE public.treatments DROP COLUMN IF EXISTS default_fee;
ALTER TABLE public.treatments DROP COLUMN IF EXISTS fee_note;
ALTER TABLE public.treatments DROP COLUMN IF EXISTS service_name;

-- diagnosis: never written or displayed anywhere in code
ALTER TABLE public.treatments DROP COLUMN IF EXISTS diagnosis;

-- surfaces: dental chart tracks surfaces in dental_chart_entries.surfaces
ALTER TABLE public.treatments DROP COLUMN IF EXISTS surfaces;

-- encounter_id + appointment_id: old linking FKs, never queried
ALTER TABLE public.treatments DROP COLUMN IF EXISTS encounter_id;
ALTER TABLE public.treatments DROP COLUMN IF EXISTS appointment_id;


-- ============================================================================
-- STEP 5: DROP DEAD COLUMNS — invoices
-- ============================================================================

-- discount: original single discount column, superseded by discount_amount
ALTER TABLE public.invoices DROP COLUMN IF EXISTS discount;

-- discount_type + discount_value: zero references in all code files
ALTER TABLE public.invoices DROP COLUMN IF EXISTS discount_type;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS discount_value;

-- subtotal: never written on insert; code calculates subtotal client-side
--   from invoice_items and never stores it back
ALTER TABLE public.invoices DROP COLUMN IF EXISTS subtotal;

-- encounter_id: old linking FK to dropped encounters table
ALTER TABLE public.invoices DROP COLUMN IF EXISTS encounter_id;


-- ============================================================================
-- STEP 6: DROP DEAD COLUMNS — invoice_items
-- ============================================================================

-- source: original source text field, superseded by source_type + source_id
ALTER TABLE public.invoice_items DROP COLUMN IF EXISTS source;

-- amount: never written on insert (code uses line_total); invoice PDF generator
--   was incorrectly reading this (bug fixed in code, always showed 0)
ALTER TABLE public.invoice_items DROP COLUMN IF EXISTS amount;

-- service_price_id: never set in any insert — code looks up price via
--   service_price_id on treatments but doesn't copy it to invoice_items
ALTER TABLE public.invoice_items DROP COLUMN IF EXISTS service_price_id;


-- ============================================================================
-- STEP 7: DROP DEAD COLUMNS — patient_medical_histories
-- ============================================================================

-- pregnancy_status, physician_name, physician_contact: never written or read
ALTER TABLE public.patient_medical_histories DROP COLUMN IF EXISTS pregnancy_status;
ALTER TABLE public.patient_medical_histories DROP COLUMN IF EXISTS physician_name;
ALTER TABLE public.patient_medical_histories DROP COLUMN IF EXISTS physician_contact;


-- ============================================================================
-- STEP 8: DROP DEAD COLUMNS — ortho_entries
-- ============================================================================

-- visit_type: deprecated in migration 015, superseded by concern_type enum
--   Data was migrated to concern_type in migration 015 UPDATE statement
ALTER TABLE public.ortho_entries DROP COLUMN IF EXISTS visit_type;


-- ============================================================================
-- STEP 9: DROP DEAD COLUMNS — dental_chart_entries
-- ============================================================================

-- arch: never written on insert, never read in any query or display
ALTER TABLE public.dental_chart_entries DROP COLUMN IF EXISTS arch;

-- recorded_by: never written on insert (chart page skips it)
ALTER TABLE public.dental_chart_entries DROP COLUMN IF EXISTS recorded_by;


-- ============================================================================
-- STEP 10: DROP OLD SEQUENCES (superseded by numberGenerationHelpers.ts)
-- ============================================================================

DROP SEQUENCE IF EXISTS public.invoice_number_seq;
DROP SEQUENCE IF EXISTS public.transaction_number_seq;
DROP SEQUENCE IF EXISTS public.receipt_number_seq;
