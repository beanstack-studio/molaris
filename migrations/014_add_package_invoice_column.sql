-- Add package invoice tracking to ortho_entries table
-- This tracks whether the package was invoiced in this specific visit

ALTER TABLE ortho_entries
ADD COLUMN IF NOT EXISTS invoice_package BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for efficient filtering when checking if package already invoiced
CREATE INDEX IF NOT EXISTS idx_ortho_entries_invoice_package 
ON ortho_entries(ortho_case_id, invoice_package);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ortho_entries TO authenticated;
