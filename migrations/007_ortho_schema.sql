-- Migration: Orthodontics (Ortho) Schema
-- Version: 007
-- Date: 2026-01-15
-- Description:
--   Extends the system with:
--   - ortho_patient boolean flag on patients table
--   - ortho_cases table for tracking active/historical ortho treatments
--   - ortho_entries table for adjustment log (wire changes, bracket repairs, elastics, etc.)
--   - RLS policies for security
--   - Indexes for performance
--
-- Design Decisions:
--   - ortho_patient flag controls tab visibility in UI (one active case per patient for v1)
--   - Cases link to optional provider dentist_id; fallback to provider_name if dentist not in system
--   - Entries tagged by type (adjustment, wire_change, etc.) for reporting/filtering
--   - Arch (upper/lower/both) + teeth/wire_details as free text for flexibility
--   - Future-proof: can extend with tooth_movements, force_levels, appointment_link later

-- ============================================================================
-- A) UPDATE patients TABLE with ortho_patient flag
-- ============================================================================

ALTER TABLE patients ADD COLUMN IF NOT EXISTS ortho_patient boolean not null default false;

CREATE INDEX IF NOT EXISTS idx_patients_ortho_patient ON patients(ortho_patient) WHERE ortho_patient = true;

-- ============================================================================
-- B) CREATE ortho_cases TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ortho_cases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  status text not null default 'active', -- active, on_hold, completed
  start_date date,
  end_date date,
  provider_dentist_id uuid references dentists(id) on delete set null,
  provider_name text, -- Fallback if dentist_id not available
  package_fee numeric(10, 2),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_ortho_cases_patient_id ON ortho_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_ortho_cases_status ON ortho_cases(status);
CREATE INDEX IF NOT EXISTS idx_ortho_cases_provider_dentist_id ON ortho_cases(provider_dentist_id);

-- ============================================================================
-- C) CREATE ortho_entries TABLE (Adjustment Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ortho_entries (
  id uuid primary key default gen_random_uuid(),
  ortho_case_id uuid not null references ortho_cases(id) on delete cascade,
  entry_date date not null,
  appointment_id uuid, -- nullable fk for future appointment linking
  tag text not null default 'adjustment', -- adjustment, wire_change, elastics, bracket_repair, retainer, follow_up, other
  note text not null,
  arch text, -- upper, lower, both
  teeth text, -- free text (e.g., "1.1, 1.2, 1.3")
  wire_details text, -- free text (e.g., "0.016 NiTi upper, 0.014 lower")
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_ortho_entries_ortho_case_id ON ortho_entries(ortho_case_id);
CREATE INDEX IF NOT EXISTS idx_ortho_entries_entry_date ON ortho_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ortho_entries_tag ON ortho_entries(tag);
CREATE INDEX IF NOT EXISTS idx_ortho_entries_appointment_id ON ortho_entries(appointment_id);

-- ============================================================================
-- D) ENABLE RLS
-- ============================================================================

ALTER TABLE ortho_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ortho_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- E) RLS POLICIES (authenticated users = clinic staff)
-- ============================================================================

-- ortho_cases: all authenticated users can read/write
DROP POLICY IF EXISTS ortho_cases_select ON ortho_cases;
CREATE POLICY ortho_cases_select ON ortho_cases
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS ortho_cases_insert ON ortho_cases;
CREATE POLICY ortho_cases_insert ON ortho_cases
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS ortho_cases_update ON ortho_cases;
CREATE POLICY ortho_cases_update ON ortho_cases
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS ortho_cases_delete ON ortho_cases;
CREATE POLICY ortho_cases_delete ON ortho_cases
  FOR DELETE
  TO authenticated
  USING (true);

-- ortho_entries: all authenticated users can read/write
DROP POLICY IF EXISTS ortho_entries_select ON ortho_entries;
CREATE POLICY ortho_entries_select ON ortho_entries
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS ortho_entries_insert ON ortho_entries;
CREATE POLICY ortho_entries_insert ON ortho_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS ortho_entries_update ON ortho_entries;
CREATE POLICY ortho_entries_update ON ortho_entries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS ortho_entries_delete ON ortho_entries;
CREATE POLICY ortho_entries_delete ON ortho_entries
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- F) UPDATED_AT TRIGGERS
-- ============================================================================

-- Trigger for ortho_cases.updated_at
DROP TRIGGER IF EXISTS ortho_cases_updated_at_trigger ON ortho_cases;
CREATE TRIGGER ortho_cases_updated_at_trigger
BEFORE UPDATE ON ortho_cases
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for ortho_entries.updated_at
DROP TRIGGER IF EXISTS ortho_entries_updated_at_trigger ON ortho_entries;
CREATE TRIGGER ortho_entries_updated_at_trigger
BEFORE UPDATE ON ortho_entries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
