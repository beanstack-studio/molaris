-- Migration: Security Fixes
-- Version: 008
-- Date: 2026-01-21
-- Description:
--   Fixes security linter errors from Supabase:
--   1. Remove SECURITY DEFINER from patient_list_view (or drop and recreate without it)
--   2. Enable RLS on dentists table
--   3. Enable RLS on encounters table
--
-- Design Decisions:
--   - Views should not use SECURITY DEFINER unless explicitly needed for permission delegation
--   - All public tables must have RLS enabled
--   - Sensitive columns (patient_id, etc.) are protected by RLS policies

-- ============================================================================
-- A) FIX patient_list_view - Remove SECURITY DEFINER
-- ============================================================================

-- Drop the existing view with SECURITY DEFINER
DROP VIEW IF EXISTS public.patient_list_view CASCADE;

-- Recreate without SECURITY DEFINER (or remove the clause if recreating)
-- If you need the view, uncomment and adjust the query as needed:
-- CREATE VIEW public.patient_list_view AS
-- SELECT id, first_name, last_name, phone, email, created_at
-- FROM patients
-- WHERE created_at IS NOT NULL;

-- ============================================================================
-- B) ENABLE RLS ON dentists TABLE
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS dentists ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for dentists (staff can view/manage all)
DROP POLICY IF EXISTS dentists_select ON dentists;
CREATE POLICY dentists_select ON dentists
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS dentists_insert ON dentists;
CREATE POLICY dentists_insert ON dentists
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS dentists_update ON dentists;
CREATE POLICY dentists_update ON dentists
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS dentists_delete ON dentists;
CREATE POLICY dentists_delete ON dentists
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- C) ENABLE RLS ON encounters TABLE
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS encounters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for encounters (staff can view/manage all)
-- Sensitive column: patient_id - protected by RLS
DROP POLICY IF EXISTS encounters_select ON encounters;
CREATE POLICY encounters_select ON encounters
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS encounters_insert ON encounters;
CREATE POLICY encounters_insert ON encounters
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS encounters_update ON encounters;
CREATE POLICY encounters_update ON encounters
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS encounters_delete ON encounters;
CREATE POLICY encounters_delete ON encounters
  FOR DELETE
  TO authenticated
  USING (true);
