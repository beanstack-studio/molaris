-- Drop and recreate ortho_entry_items table for add-ons used during visits
DROP TABLE IF EXISTS ortho_entry_items CASCADE;

CREATE TABLE ortho_entry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_entry_id UUID NOT NULL REFERENCES ortho_entries(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES service_prices(id),
  is_charged BOOLEAN NOT NULL DEFAULT FALSE,
  amount_override DECIMAL(10, 2),
  service_detail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure ortho_entries has the fields we need
ALTER TABLE ortho_entries
  DROP COLUMN IF EXISTS appointment_id,
  DROP COLUMN IF EXISTS tag,
  DROP COLUMN IF EXISTS arch,
  DROP COLUMN IF EXISTS teeth,
  DROP COLUMN IF EXISTS wire_details,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS addon_service_id,
  DROP COLUMN IF EXISTS amount_override,
  DROP COLUMN IF EXISTS is_billable,
  DROP COLUMN IF EXISTS lost_bracket,
  DROP COLUMN IF EXISTS broken_bracket,
  DROP COLUMN IF EXISTS poked_wire;

-- Add or update the fields we need
ALTER TABLE ortho_entries
  ADD COLUMN IF NOT EXISTS visit_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Update services table to support ortho category and kind
ALTER TABLE service_prices
  ADD COLUMN IF NOT EXISTS ortho_kind TEXT;

-- Update invoices table to support ortho invoice type
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(50) DEFAULT 'regular' CHECK (invoice_type IN ('regular', 'ortho'));

-- Update invoice_items to track source and enable upsert-by-source
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);

-- Create unique index to prevent duplicate invoice items by source
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_source 
  ON invoice_items(invoice_id, source_type, source_id) 
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

-- Enable RLS on new table
ALTER TABLE ortho_entry_items ENABLE ROW LEVEL SECURITY;

-- RLS policies: Staff can view/manage all entry items
DROP POLICY IF EXISTS ortho_entry_items_select ON ortho_entry_items;
CREATE POLICY ortho_entry_items_select ON ortho_entry_items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS ortho_entry_items_insert ON ortho_entry_items;
CREATE POLICY ortho_entry_items_insert ON ortho_entry_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS ortho_entry_items_update ON ortho_entry_items;
CREATE POLICY ortho_entry_items_update ON ortho_entry_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS ortho_entry_items_delete ON ortho_entry_items;
CREATE POLICY ortho_entry_items_delete ON ortho_entry_items
  FOR DELETE
  TO authenticated
  USING (true);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON ortho_entry_items TO authenticated;
