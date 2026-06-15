# Molaris — Migration & Cleanup Guide

## Code cleanup + database migration: single-tenant → multi-tenant SaaS + PWA

---

## Overview

This document is the step-by-step execution plan to transform the existing
`matira-dental-studio` codebase into **Molaris** — a properly structured
multi-tenant SaaS PWA. Follow the steps in order. Each step is independently
verifiable before moving to the next.

**You are doing this locally first. Do not push to Vercel or run DB migrations
on production until Step 6 says so.**

---

## Before you start — take a snapshot

```bash
# 1. Tag the current state so you can always roll back
git add -A && git commit -m "chore: pre-migration snapshot"
git tag v0-pre-migration

# 2. Confirm the Supabase project URL
# gigjvywfqguqpipovfyd.supabase.co
# Keep the Supabase dashboard open in a tab throughout
```

---

## Step 1 — File deletions (dead feature removal)

Delete these files and folders entirely. They relate to Messaging, Messenger,
BulkSMS, Google Calendar, and Website Controls — all being removed.

```bash
cd app

# ── API routes ──────────────────────────────────────────────
rm -rf src/app/api/messages/
rm -rf src/app/api/messenger/
rm -rf src/app/api/admin/load-threads-stream/
rm -rf src/app/api/admin/sync-messenger/
rm -rf src/app/api/admin/sync-thread/
rm -rf src/app/api/auth/facebook/
rm -rf src/app/api/webhooks/bulksms/
rm -rf src/app/api/webhooks/messenger/
rm -rf src/app/api/thread-patients/
rm -rf src/app/api/auth/google/
rm -rf src/app/api/cron/gc-sync/
rm -rf src/app/api/google-calendar/

# ── Pages ────────────────────────────────────────────────────
rm -rf src/app/messages/
rm -rf src/app/settings/website-controls/

# ── Components ───────────────────────────────────────────────
rm src/app/appointments/ContactPatientModal.tsx

# ── Lib helpers ──────────────────────────────────────────────
rm src/lib/messageHelpers.ts

# ── Root scripts (cleanup scripts, not app code) ─────────────
rm -f cleanup-invoices.js direct-delete.js verify-and-delete.js
```

**Verify:** `find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "message_thread\|facebook\|messenger\|bulksms\|google.calendar" 2>/dev/null`
Should return zero results after this step (TopNav.tsx will still have it — fix in Step 3).

---

## Step 2 — `vercel.json` — remove dead cron

Edit `app/vercel.json`. Remove the `gc-sync` cron entry. Keep only `ping`:

```json
{
  "crons": [
    {
      "path": "/api/ping",
      "schedule": "0 6 * * *"
    }
  ]
}
```

---

## Step 3 — `types.ts` cleanup

Open `app/src/lib/types.ts` and make these changes:

**A. Remove these type definitions entirely:**

- `MessageThread`
- `Message`
- `MessageWithThread`

**B. Update `Patient` — add `clinic_id` and `middle_name`, remove any messenger fields:**

```typescript
export type Patient = {
  id: string;
  clinic_id: string; // ← ADD
  first_name: string | null;
  middle_name: string | null; // ← ADD
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  occupation: string | null;
  email: string | null;
  gender: GenderDB;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
```

**C. Update `Appointment` — remove `message_thread_id`, add `clinic_id`:**

```typescript
export type Appointment = {
  id: string;
  clinic_id: string; // ← ADD
  patient_id: string;
  dentist_id: string | null;
  appointment_date: string;
  appointment_time: string | null; // change from separate time field if needed
  status: "pending" | "confirmed" | "completed" | "no_show" | "cancelled";
  notes: string | null;
  // message_thread_id REMOVED
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  patient?: Patient;
  dentist?: DentistRow;
};
```

**D. Add `clinic_id: string` to ALL other types** that correspond to DB tables:
`Treatment`, `InvoiceRow`, `InvoiceItemRow`, `PaymentRow`, `PaymentRowExtended`,
`ReceiptRow`, `ServicePriceRow`, `PaymentMode`, `StaffRow`, `DocTemplate`,
`GeneratedDoc`, `Document`, `Attachment`, `OrthoCase`, `OrthoEntry`,
`OrthoEntryItem`, `ChartEntry`, `ToothStatusRow`, `MedHist`

**E. Add these new types (if not already present):**

```typescript
export type Clinic = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro";
  owner_id: string;
  created_at: string;
};

export type ClinicProfile = {
  id: string;
  clinic_id: string;
  clinic_name: string | null;
  street_address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  logo_url: string | null;
  phones: Array<{ type: string; number: string }> | null;
  contacts: Array<{ type: string; value: string }> | null;
  clinic_hours: Array<{
    id: string;
    day: string;
    open_hour: number;
    close_hour: number;
  }> | null;
  updated_at: string;
};

export type UserProfile = {
  id: string; // = auth.uid
  clinic_id: string;
  role: "owner" | "staff";
  full_name: string | null;
  email: string | null;
  created_at: string;
};
```

---

## Step 4 — `helpers.ts` — consolidate and add new formatters

Open `app/src/lib/helpers.ts`.

**A. Add `formatPatientName` and `formatPatientNameFormal`** (uses middle_name):

```typescript
export function formatPatientName(
  first: string | null,
  middle: string | null,
  last: string | null,
): string {
  return [first, middle, last].filter(Boolean).join(" ").trim() || "—";
}

export function formatPatientNameFormal(
  first: string | null,
  middle: string | null,
  last: string | null,
): string {
  const mi = middle?.trim() ? `${middle.trim()[0]}.` : "";
  const full = [first?.trim(), mi].filter(Boolean).join(" ");
  const parts = [last?.trim(), full].filter(Boolean);
  return parts.join(", ") || "—";
}
```

**B. Remove the inline `combineFullName` from `patients/page.tsx`** — it already
exists in `helpers.ts`. The page version is a duplicate. After removing, import
from helpers instead.

**C. Ensure these all exist (add if missing):**

- `formatMoney(amount)` → ₱1,650.00
- `formatDateStandard(isoDate)` → 15-Jun-2026
- `formatDateTimePH(iso)` → 15-Jun-2026 4:30 PM
- `formatPhoneLocal(raw)` → (0917) 123-4567
- `calcAge(birthDate)` → number | null
- `formatGenderLabel(g)` → 'Male' | 'Female' | 'Not specified'
- `formatGenderShort(g)` → 'M' | 'F' | '—'

---

## Step 5 — Create `ClinicContext`

Create `app/src/contexts/ClinicContext.tsx`:

```typescript
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Clinic, UserProfile } from '@/lib/types'

interface ClinicContextValue {
  clinicId: string
  clinicName: string
  plan: 'free' | 'pro'
  role: 'owner' | 'staff'
  isOwner: boolean
  isPro: boolean
  isLoading: boolean
}

const ClinicContext = createContext<ClinicContextValue | null>(null)

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ClinicContextValue>({
    clinicId: '',
    clinicName: '',
    plan: 'free',
    role: 'staff',
    isOwner: false,
    isPro: false,
    isLoading: true,
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id, role')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const { data: clinic } = await supabase
        .from('clinics')
        .select('name, plan')
        .eq('id', profile.clinic_id)
        .single()

      setValue({
        clinicId: profile.clinic_id,
        clinicName: clinic?.name ?? 'Clinic',
        plan: (clinic?.plan ?? 'free') as 'free' | 'pro',
        role: profile.role as 'owner' | 'staff',
        isOwner: profile.role === 'owner',
        isPro: clinic?.plan !== 'free',
        isLoading: false,
      })
    }
    load()
  }, [])

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic(): ClinicContextValue {
  const ctx = useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic must be used within ClinicProvider')
  return ctx
}
```

Add `<ClinicProvider>` to `app/src/app/layout.tsx` wrapping the children (inside auth check).

---

## Step 6 — TopNav cleanup

Open `app/src/components/TopNav.tsx`:

**Remove:**

- `messengerConnected` state and the `facebook_pages` query
- The Messages nav link
- The `clinicName` default prop value `"Matira Dental Studio"` → change to `"Molaris"`
- Import and use `useClinic()` to get `clinicName` instead of fetching it again from `clinic_profile` directly (ClinicContext already fetches it)

**Keep:**

- Logo display logic (fetches from clinic_profile)
- Theme/background logic
- All other nav links

---

## Step 7 — Patient pages — add middle_name

**`patients/page.tsx` (patient list):**

- The `PatientRow` local type: add `middle_name: string | null`
- The select query: add `middle_name` to the field list
- Display column: replace `full_name` display with `formatPatientName(first_name, middle_name, last_name)` — import from helpers
- Remove the locally-defined `combineFullName` (duplicate — use helpers.ts version)
- Add `clinic_id` filter: `.eq('clinic_id', clinicId)` using `useClinic()`

**`patients/[id]/info/page.tsx`:**

- Add `middle_name` field in the edit form between First Name and Last Name
- Update the select query to include `middle_name`
- Update the upsert payload to include `middle_name`
- All display references to patient name → use `formatPatientName()`
- Update `patients_sync_full_name` trigger will handle `full_name` automatically

**All other `patients/[id]/` pages:**

- Add `clinic_id` to all Supabase queries on patient-related tables
- Ensure the patient header/breadcrumb shows `formatPatientName()` not `full_name`

---

## Step 8 — All pages — add `clinic_id` to every query

Run this search to find every Supabase `.from()` call missing a `clinic_id` filter:

```bash
grep -rn "\.from(" src/app/ src/lib/ | grep -v "clinic_profile\|clinics\|profiles\|auth\|node_modules"
```

For each result:

1. Import `useClinic` at the top of the file
2. Get `const { clinicId } = useClinic()`
3. Add `.eq('clinic_id', clinicId)` to every select/update/delete
4. Add `clinic_id: clinicId` to every insert

Tables that do NOT need `clinic_id` (they're scoped by other FK or are global):

- `clinics` (is the tenant table)
- `clinic_profile` (scoped by `clinic_id` but fetched via context)
- `profiles` (scoped by user `id`)
- `invoice_items` (scoped through invoice → patient → clinic)
- `ortho_entry_items` (scoped through ortho_entry → ortho_case → patient → clinic)
- `tooth_statuses` (scoped through patient)
- `dental_chart_entries` (scoped through patient)
- `patient_medical_histories` (scoped through patient)

---

## Step 9 — Settings pages cleanup

**`settings/clinic-profile/page.tsx`:**

- Remove hardcoded `"Matira Dental Studio"` string (line ~140 in `loadProfile`)
- Replace with `clinicName` from `useClinic()` context as the fallback display label
- Add `clinic_id` filter to all `clinic_profile` queries

**`settings/team/page.tsx`:**

- Add `clinic_id` to all `dentists` and `staff` queries and inserts
- Add `clinic_id` to `dentist_schedules` and `dentist_blockouts` queries

**`settings/services/page.tsx`:**

- Add `clinic_id` to all `service_prices` queries and inserts

**`settings/payment-modes/page.tsx`:**

- Add `clinic_id` to all `payment_modes` queries and inserts

**Delete:** `settings/website-controls/` (already done in Step 1)

---

## Step 10 — Appointments page cleanup

Open `appointments/page.tsx` and all appointment modals:

- Remove all `message_thread_id` references
- Remove `ContactPatientModal` import and usage (already deleted in Step 1)
- Remove `holiday_overrides` fetch if it's currently broken — re-add `clinic_id` filter
- Add `clinic_id` to all appointment queries and inserts
- `CreateAppointmentModal` and `EditAppointmentModal`: remove Google Calendar sync calls

---

## Step 11 — Document generators — update for middle_name

Open each generator in `src/lib/`:

- `prescriptionGenerator.ts`
- `certificateGenerator.ts`
- `referralGenerator.ts`
- `soaGenerator.ts`
- `patientRecordGenerator.ts`
- `invoiceReceiptGenerators.ts`

Wherever patient name is rendered, change from:

```typescript
patient.full_name; // OLD
```

to:

```typescript
formatPatientNameFormal(
  patient.first_name,
  patient.middle_name,
  patient.last_name,
); // NEW
```

Import `formatPatientNameFormal` from `@/lib/helpers`.

---

## Step 12 — `api/clinic-info/route.ts` — update for multi-tenant

This route is used by the login page. It currently fetches from `clinic_profile`
with no tenant filter. For now, keep it returning the first row (it's used
pre-auth on the login page). After full multi-tenant rollout, this will need
a `slug` query param — but leave that for later.

---

## Step 13 — PWA setup

```bash
cd app
npm install next-pwa
```

Update `next.config.ts`:

```typescript
import withPWA from "next-pwa";

const nextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})({});

export default nextConfig;
```

Create `app/public/manifest.json`:

```json
{
  "name": "Molaris",
  "short_name": "Molaris",
  "description": "Dental Clinic Management",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "orientation": "any",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icons/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

Add to `app/src/app/layout.tsx` inside `<head>` (or as Next.js metadata):

```typescript
export const metadata: Metadata = {
  title: "Molaris — Clinic Portal",
  description: "Dental clinic management by Molaris",
  manifest: "/manifest.json",
  themeColor: "#0f172a",
};
```

Generate PWA icons (192×192, 512×512, maskable) from the Molaris logo and place
in `app/public/icons/`.

---

## Step 14 — Local build verification

```bash
cd app
npm run build
```

Fix any TypeScript errors before proceeding. Common ones after this migration:

- `Property 'middle_name' does not exist` → added in Step 3/7
- `Property 'message_thread_id' does not exist` → removed in Step 3/10
- `Property 'clinic_id' missing in type` → added in Step 3/8

Run dev server and manually verify:

- [ ] Login works
- [ ] Patient list loads, shows names correctly
- [ ] Patient info page shows/edits middle_name
- [ ] Appointments page loads, no messaging references
- [ ] Settings pages load
- [ ] No 404 on nav — messages link is gone
- [ ] PWA manifest accessible at `/manifest.json`

---

## Step 15 — DATABASE MIGRATION (run in Supabase SQL editor)

**Run this in the Supabase SQL editor for project `gigjvywfqguqpipovfyd`.**
**Run each section separately. Read the output before moving to the next.**

---

### 15-A: Create `clinics` table and seed Matira

```sql
-- Create clinics table
CREATE TABLE IF NOT EXISTS public.clinics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  plan       text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  owner_id   uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Owners can read their own clinic
CREATE POLICY "Users can read their own clinic"
  ON public.clinics FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Insert Matira Dental Studio as Clinic #1
-- NOTE: Run this, then copy the generated id — you'll need it below
INSERT INTO public.clinics (name, slug, plan)
VALUES ('Matira Dental Studio', 'matira-dental-studio', 'pro')
ON CONFLICT (slug) DO NOTHING;

-- See the new clinic id:
SELECT id, name, slug, plan FROM public.clinics WHERE slug = 'matira-dental-studio';
```

**→ Copy the `id` value from the result. Paste it as `MATIRA_CLINIC_ID` in the next sections.**

---

### 15-B: Create `profiles` table

```sql
-- Replace YOUR_MATIRA_CLINIC_ID with the actual uuid from 15-A

CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id  uuid NOT NULL REFERENCES public.clinics(id),
  role       text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
  full_name  text,
  email      text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Seed: insert all existing auth users as owner/staff of Matira
-- Run this to see existing users first:
SELECT id, email FROM auth.users ORDER BY created_at;

-- Then for each user, insert a profile row. Example:
-- INSERT INTO public.profiles (id, clinic_id, role, email)
-- VALUES ('<user-uuid>', '<matira-clinic-uuid>', 'owner', 'owner@matira.com')
-- ON CONFLICT (id) DO NOTHING;
```

---

### 15-C: Add `clinic_id` to all tables + backfill

```sql
-- Replace 'YOUR_MATIRA_CLINIC_ID' with the actual uuid

DO $$
DECLARE
  matira_id uuid := 'YOUR_MATIRA_CLINIC_ID';
BEGIN

  -- patients
  ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.patients SET clinic_id = matira_id WHERE clinic_id IS NULL;
  ALTER TABLE public.patients ALTER COLUMN clinic_id SET NOT NULL;

  -- appointments
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.appointments SET clinic_id = matira_id WHERE clinic_id IS NULL;
  ALTER TABLE public.appointments ALTER COLUMN clinic_id SET NOT NULL;

  -- treatments
  ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.treatments SET clinic_id = matira_id WHERE clinic_id IS NULL;
  ALTER TABLE public.treatments ALTER COLUMN clinic_id SET NOT NULL;

  -- invoices
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.invoices SET clinic_id = matira_id WHERE clinic_id IS NULL;
  ALTER TABLE public.invoices ALTER COLUMN clinic_id SET NOT NULL;

  -- payments
  ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.payments SET clinic_id = matira_id WHERE clinic_id IS NULL;
  ALTER TABLE public.payments ALTER COLUMN clinic_id SET NOT NULL;

  -- receipts
  ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.receipts SET clinic_id = matira_id WHERE clinic_id IS NULL;

  -- documents
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.documents SET clinic_id = matira_id WHERE clinic_id IS NULL;

  -- service_prices
  ALTER TABLE public.service_prices ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.service_prices SET clinic_id = matira_id WHERE clinic_id IS NULL;
  ALTER TABLE public.service_prices ALTER COLUMN clinic_id SET NOT NULL;

  -- payment_modes
  ALTER TABLE public.payment_modes ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.payment_modes SET clinic_id = matira_id WHERE clinic_id IS NULL;

  -- dentists
  ALTER TABLE public.dentists ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.dentists SET clinic_id = matira_id WHERE clinic_id IS NULL;
  ALTER TABLE public.dentists ALTER COLUMN clinic_id SET NOT NULL;

  -- staff
  ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.staff SET clinic_id = matira_id WHERE clinic_id IS NULL;

  -- ortho_cases
  ALTER TABLE public.ortho_cases ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.ortho_cases SET clinic_id = matira_id WHERE clinic_id IS NULL;

  -- document_templates
  ALTER TABLE public.document_templates ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.document_templates SET clinic_id = matira_id WHERE clinic_id IS NULL;

  -- holiday_overrides
  ALTER TABLE public.holiday_overrides ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.holiday_overrides SET clinic_id = matira_id WHERE clinic_id IS NULL;

  -- clinic_profile: add clinic_id FK (it already exists as a single-row table)
  ALTER TABLE public.clinic_profile ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
  UPDATE public.clinic_profile SET clinic_id = matira_id WHERE clinic_id IS NULL;

  RAISE NOTICE 'All tables backfilled with clinic_id = %', matira_id;
END $$;
```

**Verify backfill:**

```sql
SELECT 'patients' AS tbl, COUNT(*) AS total, COUNT(clinic_id) AS with_clinic_id FROM patients
UNION ALL
SELECT 'appointments', COUNT(*), COUNT(clinic_id) FROM appointments
UNION ALL
SELECT 'treatments', COUNT(*), COUNT(clinic_id) FROM treatments
UNION ALL
SELECT 'invoices', COUNT(*), COUNT(clinic_id) FROM invoices;
-- total and with_clinic_id should match for every row
```

---

### 15-D: Add `middle_name` to patients

```sql
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS middle_name text;

-- Update the full_name sync trigger to include middle_name
CREATE OR REPLACE FUNCTION public.patients_sync_full_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.full_name := TRIM(
    CONCAT_WS(' ',
      NULLIF(TRIM(NEW.first_name), ''),
      NULLIF(TRIM(NEW.middle_name), ''),
      NULLIF(TRIM(NEW.last_name), '')
    )
  );
  RETURN NEW;
END;
$$;
```

---

### 15-E: Remove messaging columns from appointments

```sql
-- Remove message_thread_id from appointments if it exists
ALTER TABLE public.appointments DROP COLUMN IF EXISTS message_thread_id;
```

---

### 15-F: Drop messaging tables

```sql
-- Drop in dependency order
DROP TABLE IF EXISTS public.thread_patients CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.message_threads CASCADE;
DROP TABLE IF EXISTS public.facebook_pages CASCADE;
DROP TABLE IF EXISTS public.google_calendar_connections CASCADE;
```

---

### 15-G: Drop messaging-related functions

```sql
DROP FUNCTION IF EXISTS public.update_message_thread_last_message() CASCADE;
DROP FUNCTION IF EXISTS public.update_thread_last_message() CASCADE;
```

---

### 15-H: Add RLS policies — clinic_id isolation

Add RLS policies for the most critical tables. Pattern is always the same:

```sql
-- PATIENTS
CREATE POLICY "Clinic isolation — patients"
  ON public.patients FOR ALL
  TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- APPOINTMENTS
CREATE POLICY "Clinic isolation — appointments"
  ON public.appointments FOR ALL
  TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- Repeat this pattern for:
-- treatments, invoices, invoice_items (via invoice), payments, receipts,
-- documents, service_prices, payment_modes, dentists, staff,
-- ortho_cases, ortho_entries, ortho_entry_items,
-- document_templates, holiday_overrides, clinic_profile
-- dental_chart_entries, tooth_statuses, patient_medical_histories, attachments
```

> Note: `invoice_items`, `ortho_entries`, `ortho_entry_items`, `dental_chart_entries`,
> `tooth_statuses`, `patient_medical_histories`, `attachments` — these are scoped
> through their parent FK. You can either add `clinic_id` or join to the parent.
> Simplest: add `clinic_id` to each with the same backfill pattern as 15-C.

---

### 15-I: Create indexes for clinic_id

```sql
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id        ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id    ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_clinic_id      ON public.treatments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_id        ON public.invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payments_clinic_id        ON public.payments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_service_prices_clinic_id  ON public.service_prices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_dentists_clinic_id        ON public.dentists(clinic_id);
```

---

### 15-J: Final verification

```sql
-- Confirm new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Confirm deleted tables are gone
-- (these should return "relation does not exist" errors)
SELECT COUNT(*) FROM public.message_threads;
SELECT COUNT(*) FROM public.messages;
SELECT COUNT(*) FROM public.facebook_pages;

-- Confirm middle_name column exists on patients
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'middle_name';

-- Confirm clinic_id exists on patients
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'clinic_id';

-- Confirm all 7k patients have clinic_id
SELECT COUNT(*) AS total, COUNT(clinic_id) AS with_clinic FROM public.patients;
```

---

## Step 16 — Deploy to Vercel

Once local build passes and DB migration is verified:

```bash
git add -A
git commit -m "feat: Molaris — multi-tenant restructure, PWA, remove messaging"
git push origin main
```

Vercel will auto-deploy from the `main` branch push.

Verify on production:

- [ ] Login redirects to `/dashboard`
- [ ] Patient list loads with correct names
- [ ] No broken nav links
- [ ] PWA install prompt appears in browser (Chrome/Edge → address bar install icon)
- [ ] `/manifest.json` returns valid JSON
- [ ] No console errors about missing tables or columns

---

## What to do if something breaks

**If DB migration step fails mid-way:**

- All the `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements are safe to re-run
- The `UPDATE ... SET clinic_id = matira_id WHERE clinic_id IS NULL` is idempotent
- The DROP TABLE statements are irreversible — only run 15-F after verifying 15-C

**If the app breaks after code changes:**

- `git stash` to test if it was a code change
- Check browser console for `clinic_id` or `middle_name` column errors
- Run `npm run build` locally and fix TypeScript errors first

**Roll back to pre-migration:**

```bash
git checkout v0-pre-migration
```

(DB changes are not rolled back by this — only code. If you need to roll back DB,
you'd need to re-add the dropped tables from the pre-migration Supabase backup.)
