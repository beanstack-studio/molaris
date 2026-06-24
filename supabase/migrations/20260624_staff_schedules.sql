-- Staff schedules — run in Supabase SQL editor
-- Mirrors dentist_schedules but for non-dentist staff members

CREATE TABLE IF NOT EXISTS staff_schedules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES clinics(id),
  staff_id       uuid NOT NULL REFERENCES staff(id),
  day_of_week    smallint NOT NULL, -- 0=Sunday, 1=Monday … 6=Saturday
  is_working     boolean NOT NULL DEFAULT false,
  start_time     numeric,           -- hours as decimal, e.g. 8.0 = 8:00 AM, 8.5 = 8:30 AM
  end_time       numeric,
  UNIQUE(staff_id, day_of_week)
);

ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_schedules' AND policyname = 'staff_sched_select') THEN
    CREATE POLICY staff_sched_select ON staff_schedules FOR SELECT USING (
      clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_schedules' AND policyname = 'staff_sched_insert') THEN
    CREATE POLICY staff_sched_insert ON staff_schedules FOR INSERT WITH CHECK (
      clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_schedules' AND policyname = 'staff_sched_update') THEN
    CREATE POLICY staff_sched_update ON staff_schedules FOR UPDATE USING (
      clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_schedules' AND policyname = 'staff_sched_delete') THEN
    CREATE POLICY staff_sched_delete ON staff_schedules FOR DELETE USING (
      clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END
$$;
