-- Add multi-photo support to maintenance_logs
ALTER TABLE maintenance_logs
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT ARRAY[]::text[];
