-- Migration: Appointments & Unified Messaging Schema
-- Version: 003
-- Date: 2026-01-13
-- Description:
--   Extends the system with:
--   - appointments table for scheduling (dentist, patient, date/time, status)
--   - message_threads table (conversations grouped by patient, channel-agnostic)
--   - messages table (unified SMS/Messenger/future channels)
--   - RLS policies for security
--   - Indexes for performance
--   - Future-proof for WhatsApp, Email, etc.
--
-- Design Decisions:
--   - channel field supports: 'sms', 'messenger', 'whatsapp', 'email' (extensible)
--   - external_id tracks message ID from Bulksms/Messenger for sync/deduplication
--   - message_type allows marking special messages (appointment_confirmed, query_response)
--   - Appointments linked to message_thread for context tracking
--   - Soft deletes (deleted_at) instead of hard deletion for audit trail

-- ============================================================================
-- A) CREATE appointments TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  dentist_id uuid,
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'pending', -- pending, confirmed, completed, no_show, cancelled
  notes text,
  message_thread_id uuid, -- Link to message thread if booked via messaging
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist_id ON appointments(dentist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_message_thread_id ON appointments(message_thread_id);

-- ============================================================================
-- B) CREATE message_threads TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_threads (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  channel text not null, -- 'sms', 'messenger', 'whatsapp', 'email', etc.
  external_thread_id text, -- From Messenger (PSID) or SMS (phone number)
  last_message_at timestamptz,
  unread_count int default 0,
  subject text, -- For email threads
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  
  unique(patient_id, channel, external_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_message_threads_patient_id ON message_threads(patient_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_channel ON message_threads(channel);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message_at ON message_threads(last_message_at DESC);

-- ============================================================================
-- C) CREATE messages TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_type text not null, -- 'patient' or 'staff'
  sender_id uuid, -- patient_id or staff user_id (if known)
  sender_name text, -- Display name fallback
  content text not null,
  message_type text default 'text', -- 'text', 'appointment_confirmed', 'query', 'system'
  external_id text, -- From Bulksms/Messenger for deduplication
  metadata jsonb default '{}'::jsonb, -- Channel-specific data (phone number for SMS, PSID for Messenger, etc.)
  created_at timestamptz default now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages(external_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================================================
-- D) ENABLE RLS (Row Level Security)
-- ============================================================================

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- E) RLS POLICIES
-- ============================================================================

-- Appointments: Staff can view/edit all, patients can only view their own
CREATE POLICY "staff_can_manage_appointments" ON appointments
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "patients_can_view_own_appointments" ON appointments
  USING (patient_id = auth.uid());

-- Message threads: Staff can view all, patients can view their own
CREATE POLICY "staff_can_view_all_threads" ON message_threads
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "patients_can_view_own_threads" ON message_threads
  USING (patient_id = auth.uid());

-- Messages: Staff can view all, patients can view their own threads
CREATE POLICY "staff_can_view_all_messages" ON messages
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "patients_can_view_own_messages" ON messages
  USING (
    thread_id IN (
      SELECT id FROM message_threads WHERE patient_id = auth.uid()
    )
  );

-- ============================================================================
-- F) TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointments_updated_at();

CREATE OR REPLACE FUNCTION update_message_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_message_threads_updated_at
  BEFORE UPDATE ON message_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_message_threads_updated_at();

-- Update thread's last_message_at when new message added
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_update_thread
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_last_message();

-- ============================================================================
-- G) SAMPLE DATA (For testing - can be deleted)
-- ============================================================================

-- Note: Uncomment below for testing, then delete before production merge
-- INSERT INTO message_threads (patient_id, channel, external_thread_id)
-- SELECT id, 'sms', SUBSTRING(phone, 1, 11) 
-- FROM patients LIMIT 3;
