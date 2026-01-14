-- Migration: Add service duration for scheduling
-- Version: 004
-- Date: 2026-01-13
-- Description: Add optional duration_minutes field to service_prices for appointment scheduling

-- Add duration_minutes column (optional, 15-min increments)
ALTER TABLE service_prices
ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 60;

-- Add comment for clarity
COMMENT ON COLUMN service_prices.duration_minutes IS 'Estimated appointment duration in minutes (15-min increments). Used for scheduling. Optional.';

-- Create index for reference
CREATE INDEX IF NOT EXISTS idx_service_prices_duration ON service_prices(duration_minutes);

-- Add constraint to ensure 15-min increments (0, 15, 30, 45, 60, 75, 90, etc.)
ALTER TABLE service_prices
ADD CONSTRAINT ck_duration_15min CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes % 15 = 0));

-- Sample update (if needed): Set common durations
-- UPDATE service_prices SET duration_minutes = 30 WHERE service_name LIKE '%cleaning%';
-- UPDATE service_prices SET duration_minutes = 60 WHERE service_name LIKE '%root%';
