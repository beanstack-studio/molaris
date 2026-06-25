-- ============================================================
-- Expense tables: operating expenses, bills, payroll runs
-- ============================================================

-- Operating expenses (daily / petty cash)
CREATE TABLE IF NOT EXISTS clinic_operating_expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  expense_date date NOT NULL,
  category     text NOT NULL CHECK (category IN ('Supplies', 'Gasoline', 'Maintenance', 'Other')),
  description  text,
  amount       numeric(12,2) NOT NULL,
  payment_mode text,  -- null = Unpaid
  status       text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  date_paid    date,
  remarks      text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE clinic_operating_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_operating_expenses_clinic_isolation"
  ON clinic_operating_expenses
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "clinic_operating_expenses_insert"
  ON clinic_operating_expenses FOR INSERT
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "clinic_operating_expenses_update"
  ON clinic_operating_expenses FOR UPDATE
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "clinic_operating_expenses_delete"
  ON clinic_operating_expenses FOR DELETE
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Bills (recurring: electricity, rent, etc.)
CREATE TABLE IF NOT EXISTS clinic_bills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category     text NOT NULL CHECK (category IN ('Electricity', 'Rent', 'Water', 'Internet', 'Cable', 'Other')),
  due_date     date,
  date_paid    date,
  amount       numeric(12,2) NOT NULL,
  payment_mode text,
  remarks      text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE clinic_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_bills_clinic_isolation"
  ON clinic_bills
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "clinic_bills_insert"
  ON clinic_bills FOR INSERT
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "clinic_bills_update"
  ON clinic_bills FOR UPDATE
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "clinic_bills_delete"
  ON clinic_bills FOR DELETE
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Payroll runs header
CREATE TABLE IF NOT EXISTS payroll_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  period_start   date NOT NULL,
  period_end     date NOT NULL,
  payment_date   date NOT NULL,
  payment_mode   text,
  total_amount   numeric(12,2) NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_runs_clinic_isolation"
  ON payroll_runs
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "payroll_runs_insert"
  ON payroll_runs FOR INSERT
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "payroll_runs_delete"
  ON payroll_runs FOR DELETE
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Payroll run line items (per person)
CREATE TABLE IF NOT EXISTS payroll_run_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  clinic_id      uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  person_type    text NOT NULL CHECK (person_type IN ('dentist', 'staff')),
  person_id      uuid NOT NULL,  -- dentists.id or staff.id
  person_name    text NOT NULL,
  salary_rate    numeric(12,2),  -- snapshot at time of run
  daily_rate     numeric(12,2),  -- salary_rate / 22
  days_worked    numeric(5,2) NOT NULL DEFAULT 0,
  total_amount   numeric(12,2) NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE payroll_run_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_run_entries_clinic_isolation"
  ON payroll_run_entries
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "payroll_run_entries_insert"
  ON payroll_run_entries FOR INSERT
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));
