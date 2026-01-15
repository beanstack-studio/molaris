-- Migration: Add clinic_hours column to clinic_profile
-- Version: 006
-- Date: 2026-01-15
-- Description: Store clinic hours as JSONB for flexibility

ALTER TABLE clinic_profile
ADD COLUMN clinic_hours jsonb DEFAULT '[]'::jsonb;

-- Example structure stored in clinic_hours:
-- [
--   { "id": "1", "day": "Sunday", "open_hour": 8, "close_hour": 11 },
--   { "id": "2", "day": "Weekdays (Mon-Fri)", "open_hour": 8, "close_hour": 17 }
-- ]
