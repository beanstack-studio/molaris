-- Add vendor/technician field to general expenses
ALTER TABLE clinic_operating_expenses
  ADD COLUMN IF NOT EXISTS vendor text;
