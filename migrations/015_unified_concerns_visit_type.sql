-- Migration 015: Unified Concerns & Visit Type Schema
-- Merges appointment concerns and ortho visit_type into a single standardized data type
-- Date: 2026-02-25
-- Description: Creates a visit_reason_type enum and updates both appointments and ortho_entries

/* ============================================================
   PART 1: CREATE visit_reason_type ENUM
   ============================================================ */

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_reason_type') THEN
    CREATE TYPE visit_reason_type AS ENUM (
      -- General/Dental section
      'consultation',
      'routine_checkup',
      'cleaning',
      'filling',
      'extraction',
      'root_canal',
      'crown_bridge',
      'denture',
      'emergency',
      -- Ortho section
      'ortho_consultation',
      'braces_installation',
      'adjustment',
      'ortho_emergency',
      'debonding',
      'retainer_delivery'
    );
  END IF;
END $$;

/* ============================================================
   PART 2: UPDATE appointments TABLE
   ============================================================ */

-- Add concern_type column if it doesn't exist
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS concern_type visit_reason_type DEFAULT NULL;

-- Create index for filtering by concern_type
CREATE INDEX IF NOT EXISTS idx_appointments_concern_type 
ON public.appointments(concern_type);

-- Note: The concerns (text) column is retained for backwards compatibility
-- but will be deprecated in favor of concern_type

/* ============================================================
   PART 3: UPDATE ortho_entries TABLE
   ============================================================ */

-- First, create a mapping from old visit_type to new concern_type
--  'adjustment' -> 'adjustment'
--  'consultation' -> 'ortho_consultation'
--  'emergency' -> 'ortho_emergency'
--  'rebond' -> 'debonding' (treat rebond as debonding)
--  'install' -> 'braces_installation'
--  'debond' -> 'debonding'
--  'retainer' -> 'retainer_delivery'

-- Add concern_type column to ortho_entries
ALTER TABLE public.ortho_entries
ADD COLUMN IF NOT EXISTS concern_type visit_reason_type DEFAULT NULL;

-- Migrate existing visit_type data to concern_type (optional, for backwards compatibility)
UPDATE public.ortho_entries
SET concern_type = CASE 
  WHEN visit_type = 'adjustment' THEN 'adjustment'::visit_reason_type
  WHEN visit_type = 'consultation' THEN 'ortho_consultation'::visit_reason_type
  WHEN visit_type = 'emergency' THEN 'ortho_emergency'::visit_reason_type
  WHEN visit_type = 'rebond' THEN 'debonding'::visit_reason_type
  WHEN visit_type = 'install' THEN 'braces_installation'::visit_reason_type
  WHEN visit_type = 'debond' THEN 'debonding'::visit_reason_type
  WHEN visit_type = 'retainer' THEN 'retainer_delivery'::visit_reason_type
  ELSE NULL
END
WHERE concern_type IS NULL AND visit_type IS NOT NULL;

-- Create index for filtering by concern_type
CREATE INDEX IF NOT EXISTS idx_ortho_entries_concern_type 
ON public.ortho_entries(concern_type);

-- Note: The visit_type column is retained for backwards compatibility
-- but will be deprecated in favor of concern_type

/* ============================================================
   PART 4: RLS POLICIES (if needed)
   ============================================================ */

-- No additional RLS needed as we're using existing table policies
