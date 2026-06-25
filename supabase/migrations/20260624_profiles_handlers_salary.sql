-- Run in Supabase SQL editor
-- Adds: profiles.avatar_url, dentist_handlers.staff_id + clinic_id, dentists.salary_rate, staff.salary_rate

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE dentists ADD COLUMN IF NOT EXISTS salary_rate numeric;
ALTER TABLE staff    ADD COLUMN IF NOT EXISTS salary_rate numeric;

-- dentist_handlers: add staff_id and clinic_id (required for handler assignment system)
ALTER TABLE dentist_handlers ADD COLUMN IF NOT EXISTS staff_id  uuid REFERENCES staff(id);
ALTER TABLE dentist_handlers ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id);

-- Backfill clinic_id from dentist row for existing handler rows
UPDATE dentist_handlers dh
SET clinic_id = d.clinic_id
FROM dentists d
WHERE dh.dentist_id = d.id
  AND dh.clinic_id IS NULL;

-- Storage bucket for clinic assets (run once — safe to re-run)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-assets', 'clinic-assets', true)
-- ON CONFLICT (id) DO NOTHING;
