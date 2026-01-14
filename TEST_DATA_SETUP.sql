-- ============================================================================
-- APPOINTMENT & MESSAGING SYSTEM - TEST DATA SETUP
-- ============================================================================
-- Run this entire script in Supabase SQL Editor to create test data
-- ============================================================================

-- Patient info (from your clinic)
-- Full name: Test only Aaa
-- Phone: 0912 345 6789
-- Patient UUID: c1b1e2f8-fb45-4903-8310-fb75dec99615

-- Step 1: Create test message thread (linked to your patient)
INSERT INTO message_threads (patient_id, channel, external_thread_id)
VALUES ('c1b1e2f8-fb45-4903-8310-fb75dec99615', 'sms', '0912 345 6789')
ON CONFLICT DO NOTHING
RETURNING id;

-- Step 2: Get the thread ID that was created
SELECT id, patient_id, channel FROM message_threads 
WHERE channel = 'sms' AND external_thread_id = '0912 345 6789'
ORDER BY created_at DESC LIMIT 1;

-- Step 3: Create test messages
-- (Use the thread ID from step 2 if you want to add more messages manually)
-- For now, we'll get the thread ID and insert messages automatically

INSERT INTO messages (thread_id, sender_type, sender_name, content, message_type)
SELECT 
  (SELECT id FROM message_threads WHERE channel = 'sms' AND external_thread_id = '0912 345 6789' LIMIT 1),
  sender_type,
  sender_name,
  content,
  message_type
FROM (VALUES
  ('patient', 'Test only Aaa', 'Hi, can I book an appointment?', 'text'),
  ('patient', 'Test only Aaa', 'I''m available Thursday at 2pm', 'text'),
  ('staff', 'Cel', 'Let me check our calendar', 'text'),
  ('staff', 'Cel', 'Thursday 2pm works! Confirmed with Dr. Maria', 'appointment_confirmed')
) AS messages(sender_type, sender_name, content, message_type)
ON CONFLICT DO NOTHING;

-- Step 4: Verify all data was created
SELECT t.id, t.patient_id, t.channel, COUNT(m.id) as message_count
FROM message_threads t
LEFT JOIN messages m ON t.id = m.thread_id
WHERE t.external_thread_id = '0912 345 6789'
GROUP BY t.id, t.patient_id, t.channel;

-- ============================================================================
-- DONE! Now refresh your /messages page to see the test thread
-- ============================================================================
