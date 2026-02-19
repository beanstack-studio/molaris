-- Clean up ortho_entries table - drop any remaining unused columns
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

-- Clean up ortho_entry_items table - drop any unused columns
ALTER TABLE ortho_entry_items
  DROP COLUMN IF EXISTS service_note,
  DROP COLUMN IF EXISTS details;

-- Verify final schema for ortho_entries
-- Expected columns: id, ortho_case_id, entry_date, visit_type, note, created_at, updated_at

-- Verify final schema for ortho_entry_items
-- Expected columns: id, ortho_entry_id, service_id, is_charged, amount_override, service_detail, created_at, updated_at
