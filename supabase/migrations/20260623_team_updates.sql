-- Team page updates — run in Supabase SQL editor
-- Order matters: column additions before backfills/policies

-- ── Photo upload columns ──────────────────────────────────────────────────────
ALTER TABLE dentists ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE staff    ADD COLUMN IF NOT EXISTS photo_url text;

-- ── Dentist fields ────────────────────────────────────────────────────────────
ALTER TABLE dentists ADD COLUMN IF NOT EXISTS specialty text;
ALTER TABLE dentists ADD COLUMN IF NOT EXISTS phone text;

-- ── Staff fields ──────────────────────────────────────────────────────────────
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone text;

-- ── dentist_blockouts: reason + clinic_id + staff support ─────────────────────
ALTER TABLE dentist_blockouts ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE dentist_blockouts ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id);

-- staff_id — allows staff members to have off-day blockouts too
-- Must allow dentist_id to be null for staff-only rows
ALTER TABLE dentist_blockouts ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES staff(id);
ALTER TABLE dentist_blockouts ALTER COLUMN dentist_id DROP NOT NULL;

-- Backfill clinic_id from the dentist row (for existing dentist blockouts)
UPDATE dentist_blockouts db
SET clinic_id = d.clinic_id
FROM dentists d
WHERE db.dentist_id = d.id
  AND db.clinic_id IS NULL;

-- Backfill clinic_id for staff blockouts once staff_id is populated
UPDATE dentist_blockouts db
SET clinic_id = s.clinic_id
FROM staff s
WHERE db.staff_id = s.id
  AND db.clinic_id IS NULL;

-- ── RLS on dentist_blockouts ──────────────────────────────────────────────────
ALTER TABLE dentist_blockouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dentist_blockouts' AND policyname = 'clinic_blockouts_select'
  ) THEN
    CREATE POLICY clinic_blockouts_select ON dentist_blockouts
      FOR SELECT USING (
        clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dentist_blockouts' AND policyname = 'clinic_blockouts_insert'
  ) THEN
    CREATE POLICY clinic_blockouts_insert ON dentist_blockouts
      FOR INSERT WITH CHECK (
        clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dentist_blockouts' AND policyname = 'clinic_blockouts_update'
  ) THEN
    CREATE POLICY clinic_blockouts_update ON dentist_blockouts
      FOR UPDATE USING (
        clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dentist_blockouts' AND policyname = 'clinic_blockouts_delete'
  ) THEN
    CREATE POLICY clinic_blockouts_delete ON dentist_blockouts
      FOR DELETE USING (
        clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
      );
  END IF;
END
$$;
