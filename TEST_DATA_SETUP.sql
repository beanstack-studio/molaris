-- ============================================================================
-- APPOINTMENT & MESSAGING SYSTEM - TEST DATA SETUP
-- ============================================================================
-- Run this in Supabase SQL Editor to create test data for the /messages page
-- ============================================================================

-- Step 1: Get a patient (or create test patient if none exists)
-- First, let's see if you have any patients
-- Uncomment the line below to see existing patients:
-- SELECT id, full_name, phone FROM patients LIMIT 5;

-- If you have patients, copy one's ID and use it below
-- If not, create a test patient:
INSERT INTO patients (full_name, phone, email)
VALUES ('Test Patient SMS', '+639123456789', 'test@example.com')
ON CONFLICT DO NOTHING
RETURNING id;

-- Step 2: Get the patient ID you want to use
-- Run this to get the ID:
SELECT id, full_name, phone FROM patients WHERE phone = '+639123456789' LIMIT 1;

-- ============================================================================
-- IMPORTANT: Copy the patient ID from above, then replace PATIENT_ID_HERE below
-- ============================================================================

-- Step 3: Create test message thread
INSERT INTO message_threads (patient_id, channel, external_thread_id)
VALUES ('PATIENT_ID_HERE', 'sms', '+639123456789')
ON CONFLICT DO NOTHING
RETURNING id;

-- Step 4: Get the thread ID that was created
SELECT id, patient_id, channel FROM message_threads 
WHERE channel = 'sms' AND external_thread_id = '+639123456789'
ORDER BY created_at DESC LIMIT 1;

-- ============================================================================
-- IMPORTANT: Copy the thread ID from above, then replace THREAD_ID_HERE below
-- ============================================================================

-- Step 5: Create test messages
INSERT INTO messages (thread_id, sender_type, sender_name, content, message_type)
VALUES 
  ('THREAD_ID_HERE', 'patient', 'Test Patient', 'Hi, can I book an appointment?', 'text'),
  ('THREAD_ID_HERE', 'patient', 'Test Patient', 'I''m available Thursday at 2pm', 'text'),
  ('THREAD_ID_HERE', 'staff', 'Cel', 'Let me check our calendar', 'text'),
  ('THREAD_ID_HERE', 'staff', 'Cel', 'Thursday 2pm works! Confirmed with Dr. Maria', 'appointment_confirmed')
ON CONFLICT DO NOTHING;

-- Step 6: Verify data was created
SELECT t.id, t.patient_id, t.channel, COUNT(m.id) as message_count
FROM message_threads t
LEFT JOIN messages m ON t.id = m.thread_id
WHERE t.external_thread_id = '+639123456789'
GROUP BY t.id, t.patient_id, t.channel;

-- ============================================================================
-- DONE! Now refresh your /messages page to see the test thread
-- ============================================================================
