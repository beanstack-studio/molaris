-- Add full_name to staff_invites so the invite flow can pass through the
-- invitee's display name into profiles.full_name on join-complete.
ALTER TABLE public.staff_invites ADD COLUMN IF NOT EXISTS full_name text;
