-- Create the patient_list_view for better performance and computed fields
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE VIEW patient_list_view AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.first_name || ' ' || p.last_name as full_name,
  p.phone,
  p.birth_date,
  p.gender,
  p.created_at,
  (
    SELECT MAX(i.created_at::date)
    FROM invoices i
    WHERE i.patient_id = p.id
  ) as last_visit_date,
  COALESCE((
    SELECT SUM(i.total_amount - COALESCE(i.paid_amount, 0))
    FROM invoices i
    WHERE i.patient_id = p.id AND i.status != 'paid'
  ), 0) as balance
FROM patients p;

-- Grant permissions
GRANT SELECT ON patient_list_view TO authenticated;
GRANT SELECT ON patient_list_view TO anon;