-- ============================================================
-- Maintenance logs + receipt_url columns on expense tables
-- Run in Supabase SQL editor after 20260624_expense_tables.sql
-- ============================================================

-- Add receipt_url to operating expenses
ALTER TABLE clinic_operating_expenses
  ADD COLUMN IF NOT EXISTS receipt_url text;

-- Add receipt_url to bills
ALTER TABLE clinic_bills
  ADD COLUMN IF NOT EXISTS receipt_url text;

-- Maintenance logs table
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  equipment        text NOT NULL,
  issue_work_done  text NOT NULL,
  service_date     date NOT NULL,
  cost             numeric(12,2),
  technician       text,
  photo_url        text,
  expense_id       uuid REFERENCES clinic_operating_expenses(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_logs_select"
  ON maintenance_logs FOR SELECT
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "maintenance_logs_insert"
  ON maintenance_logs FOR INSERT
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "maintenance_logs_update"
  ON maintenance_logs FOR UPDATE
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "maintenance_logs_delete"
  ON maintenance_logs FOR DELETE
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Storage bucket: clinic-files (run separately in Supabase Storage UI or via API)
-- CREATE POLICY for clinic-files bucket if not already done:
-- Allow authenticated users to upload to their own clinic folder.
-- Bucket: clinic-files (public or authenticated-only as preferred)
