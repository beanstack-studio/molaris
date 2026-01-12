-- Migration: Add RLS policies for service_prices table
-- Version: 002
-- Date: 2026-01-12
-- Description: Enable RLS on service_prices and add necessary policies

-- Enable RLS on service_prices table if not already enabled
ALTER TABLE service_prices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all service prices
DROP POLICY IF EXISTS "Allow authenticated to view service_prices" ON service_prices;
CREATE POLICY "Allow authenticated to view service_prices" ON service_prices
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create service prices
DROP POLICY IF EXISTS "Allow authenticated to create service_prices" ON service_prices;
CREATE POLICY "Allow authenticated to create service_prices" ON service_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update service prices
DROP POLICY IF EXISTS "Allow authenticated to update service_prices" ON service_prices;
CREATE POLICY "Allow authenticated to update service_prices" ON service_prices
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete service prices
DROP POLICY IF EXISTS "Allow authenticated to delete service_prices" ON service_prices;
CREATE POLICY "Allow authenticated to delete service_prices" ON service_prices
  FOR DELETE
  TO authenticated
  USING (true);
