-- Test Data for Matira Dental Studio
-- Run this in Supabase SQL Editor to populate with sample data
-- All PostgreSQL interval syntax has been corrected

-- ============================================================================
-- 1. SEED PATIENTS
-- ============================================================================

INSERT INTO patients (first_name, last_name, phone, birth_date, gender, email, address)
VALUES
  ('Maria', 'Santos', '09171234567', '1990-05-15', 'female', 'maria@email.com', '123 Main St, Manila'),
  ('Juan', 'Dela Cruz', '09281234567', '1985-08-22', 'male', 'juan@email.com', '456 Oak Ave, Quezon City'),
  ('Ana', 'Garcia', '09091234567', '1995-03-10', 'female', 'ana@email.com', '789 Pine Rd, Makati'),
  ('Carlos', 'Rodriguez', '09361234567', '1992-11-30', 'male', 'carlos@email.com', '321 Elm St, Pasig'),
  ('Rosa', 'Fernandez', '09451234567', '1988-07-18', 'female', 'rosa@email.com', '654 Maple Dr, Taguig')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. SEED SERVICE PRICES (if not already populated by migration)
-- ============================================================================

INSERT INTO service_prices (service_name, default_price, item_type, is_active)
VALUES
  ('Consultation', 500, 'SERVICE', true),
  ('Cleaning (Prophylaxis)', 1500, 'SERVICE', true),
  ('Filling (Composite)', 2500, 'SERVICE', true),
  ('Root Canal Treatment', 8000, 'SERVICE', true),
  ('Crown (All Ceramic)', 12000, 'SERVICE', true),
  ('Extraction', 3500, 'SERVICE', true),
  ('Scaling & Root Planing', 4000, 'SERVICE', true),
  ('Fluoride Treatment', 800, 'ADD_ON', true),
  ('X-Ray (Bitewing)', 300, 'ADD_ON', true),
  ('X-Ray (Panoramic)', 600, 'ADD_ON', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. SEED PAYMENT MODES (ensure canonical modes exist)
-- ============================================================================

INSERT INTO payment_modes (code, name, requires_proof, requires_reference, requires_received_by, auto_verifies, sort_order, is_active)
VALUES
  ('CASH', 'Cash', false, false, true, true, 10, true),
  ('GCASH', 'GCash', true, true, false, false, 20, true),
  ('MAYA', 'Maya', true, true, false, false, 30, true),
  ('BANK_TRANSFER', 'Online Bank Transfer', true, true, false, false, 40, true),
  ('CHEQUE', 'Cheque', false, true, false, false, 50, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 4. SEED INVOICES
-- ============================================================================

INSERT INTO invoices (patient_id, invoice_number, invoice_date, total, status)
SELECT
  p.id,
  'INV-' || to_char(now(), 'YYYY') || '-' || lpad((row_number() over (order by p.id) + 1000)::text, 4, '0'),
  (now()::date - (floor(random() * 30)::int) * interval '1 day')::date,
  (random() * 15000 + 3000)::numeric(10, 2),
  CASE WHEN random() < 0.6 THEN 'paid' ELSE 'outstanding' END
FROM patients p
WHERE p.first_name IS NOT NULL
LIMIT 5;

-- ============================================================================
-- 5. SEED INVOICE ITEMS (SKIPPED - complex structure, insert via UI)
-- ============================================================================

-- Note: Invoice items are best created through the application UI
-- since they require specific fields like treatment_id, dentist_name, etc.
-- To add items: open an invoice in the app and add line items manually

-- ============================================================================
-- 6. SEED PAYMENTS (SKIPPED - insert via UI)
-- ============================================================================

-- Note: Payments are best created through the application UI
-- To add payments: open an invoice in the app and record a payment

-- ============================================================================
-- 7. SEED DENTAL CHART ENTRIES (SKIPPED - insert via UI)
-- ============================================================================

-- Note: Dental chart entries are best created through the application UI
-- To add entries: open a patient's chart and create entries there

-- ============================================================================
-- 8. VERIFY DATA INSERTED
-- ============================================================================

SELECT 'Patients' as table_name, count(*) as row_count FROM patients
UNION ALL
SELECT 'Service Prices', count(*) FROM service_prices
UNION ALL
SELECT 'Payment Modes', count(*) FROM payment_modes
UNION ALL
SELECT 'Invoices', count(*) FROM invoices;
