-- Migration: Add Concern Field to Treatments
-- Version: 009
-- Date: 2026-02-18
-- Description:
--   Adds visit_concern column to treatments table to track patient concerns
--   at the time of visit/treatment. This allows prefilling from appointments
--   and capturing walk-in or retroactive concerns.

-- ============================================================================
-- ADD CONCERN COLUMN TO TREATMENTS TABLE
-- ============================================================================

ALTER TABLE treatments ADD COLUMN IF NOT EXISTS visit_concern text;

-- Add comment to describe the field
COMMENT ON COLUMN treatments.visit_concern IS 'Chief complaint or concern for the visit (from appointment, walk-in, or retroactive entry)';
