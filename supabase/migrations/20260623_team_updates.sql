-- Team page updates: photo URLs, dentist specialty, blockouts clinic_id
-- Run in Supabase SQL editor

-- Photo upload columns
ALTER TABLE dentists ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url text;

-- Dentist specialty / role
ALTER TABLE dentists ADD COLUMN IF NOT EXISTS specialty text;

-- Ensure dentist_blockouts has clinic_id for RLS isolation
ALTER TABLE dentist_blockouts ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id);

-- Backfill clinic_id on dentist_blockouts from the dentist row
UPDATE dentist_blockouts db
SET clinic_id = d.clinic_id
FROM dentists d
WHERE db.dentist_id = d.id
  AND db.clinic_id IS NULL;

-- Ensure reason column exists
ALTER TABLE dentist_blockouts ADD COLUMN IF NOT EXISTS reason text;

-- RLS policies for dentist_blockouts (create if not already present)
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
