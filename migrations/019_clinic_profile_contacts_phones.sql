-- Migration 019: Clinic Profile — Phones & Contacts JSONB columns
-- Date: 2026-04-06
-- Description:
--   The clinic profile UI was updated to store multiple phone numbers and
--   contact/online entries (email, website, social links) as JSONB arrays.
--   The old single-value `phone`, `email`, and `website` columns are no
--   longer referenced anywhere in the application code.

-- ============================================================================
-- STEP 1: ADD NEW JSONB COLUMNS
-- ============================================================================

-- phones: array of { type: "Mobile"|"Landline"|"WhatsApp"|"Viber", number: string }
ALTER TABLE public.clinic_profile
  ADD COLUMN IF NOT EXISTS phones jsonb DEFAULT '[]'::jsonb;

-- contacts: array of { type: "Email"|"Website"|"Instagram"|..., value: string }
ALTER TABLE public.clinic_profile
  ADD COLUMN IF NOT EXISTS contacts jsonb DEFAULT '[]'::jsonb;

-- ============================================================================
-- STEP 2: MIGRATE EXISTING SINGLE-VALUE DATA INTO JSONB ARRAYS
-- ============================================================================

-- Migrate existing `phone` value into the new phones array
UPDATE public.clinic_profile
SET phones = jsonb_build_array(
  jsonb_build_object('type', 'Mobile', 'number', phone)
)
WHERE phone IS NOT NULL AND phone <> '' AND (phones IS NULL OR phones = '[]'::jsonb);

-- Migrate existing `email` value into the new contacts array
UPDATE public.clinic_profile
SET contacts = jsonb_build_array(
  jsonb_build_object('type', 'Email', 'value', email)
)
WHERE email IS NOT NULL AND email <> '' AND (contacts IS NULL OR contacts = '[]'::jsonb);

-- Migrate existing `website` value by appending to contacts array
UPDATE public.clinic_profile
SET contacts = contacts || jsonb_build_array(
  jsonb_build_object('type', 'Website', 'value', website)
)
WHERE website IS NOT NULL AND website <> '';

-- ============================================================================
-- STEP 3: DROP DEPRECATED SINGLE-VALUE COLUMNS
-- ============================================================================

-- phone: replaced by phones JSONB array
ALTER TABLE public.clinic_profile DROP COLUMN IF EXISTS phone;

-- email: replaced by contacts JSONB array
ALTER TABLE public.clinic_profile DROP COLUMN IF EXISTS email;

-- website: replaced by contacts JSONB array
ALTER TABLE public.clinic_profile DROP COLUMN IF EXISTS website;
