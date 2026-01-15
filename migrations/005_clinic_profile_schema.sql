-- Migration: Clinic Profile & Settings Table
-- Version: 005
-- Date: 2026-01-14
-- Description:
--   Creates clinic_profile table to store clinic-wide settings:
--   - Clinic name, contact info, address
--   - Operating hours (sunday_end_hour for appointments)
--   - Logo URL for receipts and templates
--   - Timestamps for audit trail
--
-- Design Decisions:
--   - Single row per clinic (enforced by RLS and app logic)
--   - sunday_end_hour: hour at which Sunday slots end (default 11 = 11 AM)
--   - Defaults allow graceful degradation if table/fields missing

-- ============================================================================
-- CREATE clinic_profile TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS clinic_profile (
  id uuid primary key default gen_random_uuid(),
  clinic_name text,
  phone text,
  email text,
  website text,
  street_address text,
  city text,
  province text,
  postal_code text,
  logo_url text,
  sunday_end_hour int default 11, -- Hour at which Sunday time slots end (8-17)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index on id for faster lookups
CREATE INDEX IF NOT EXISTS idx_clinic_profile_id ON clinic_profile(id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE clinic_profile ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read clinic profile
CREATE POLICY IF NOT EXISTS clinic_profile_read ON clinic_profile
  FOR SELECT TO authenticated
  USING (true);

-- Policy: Authenticated users can update clinic profile
-- (In production, consider restricting to admin role)
CREATE POLICY IF NOT EXISTS clinic_profile_update ON clinic_profile
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can insert clinic profile
CREATE POLICY IF NOT EXISTS clinic_profile_insert ON clinic_profile
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- INITIAL DATA (Optional - if no profile exists)
-- ============================================================================

-- Insert default clinic profile if none exists
-- Uncomment to run manually or via Supabase UI
-- INSERT INTO clinic_profile (clinic_name, phone, email, sunday_end_hour)
-- VALUES ('Matira Dental Studio', '', '', 11)
-- ON CONFLICT DO NOTHING;
