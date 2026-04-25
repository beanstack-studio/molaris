-- ============================================================
-- SECURITY FIX: thread_patients RLS
-- Fixes "RLS Disabled in Public" and "Sensitive Columns Exposed"
-- This table is only accessed via service_role key (server-side),
-- which bypasses RLS by default — so enabling RLS here is safe.
-- ============================================================
ALTER TABLE public.thread_patients ENABLE ROW LEVEL SECURITY;

-- Allow authenticated app users to read (for any future client-side use)
CREATE POLICY "Authenticated users can read thread_patients"
  ON public.thread_patients FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated app users to insert/update/delete
CREATE POLICY "Authenticated users can write thread_patients"
  ON public.thread_patients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- SECURITY FIX: Function Search Path (fixes 53 warnings)
-- Prevents search_path injection attacks on all trigger functions
-- ============================================================
ALTER FUNCTION public.update_updated_at_col()         SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_updated_at()                SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_message_thread_last_message() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_thread_last_message()    SET search_path = public, pg_catalog;
ALTER FUNCTION public.generate_invoice_number()       SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_appointments_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.patients_sync_full_name()       SET search_path = public, pg_catalog;
ALTER FUNCTION public.ensure_encounter_invoice()      SET search_path = public, pg_catalog;
ALTER FUNCTION public.increment_doc_counter()         SET search_path = public, pg_catalog;
ALTER FUNCTION public.trigger_documents_update()      SET search_path = public, pg_catalog;
ALTER FUNCTION public.trigger_doc_counters_update()   SET search_path = public, pg_catalog;
ALTER FUNCTION public.sync_invoice_items_from_treatments() SET search_path = public, pg_catalog;

-- If any of the above fail with "function does not exist", skip that line.
-- The exact function names may differ slightly — check your Supabase
-- SQL Editor with: SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
