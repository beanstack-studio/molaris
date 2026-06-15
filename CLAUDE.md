# Molaris — Dental Clinic Management SaaS

## Claude Instructions (read this before every task)

---

## What this app is

A multi-tenant SaaS PWA for dental clinics in the Philippines.

- **App name: Molaris** — never "matira-dental-studio", never "Matira Dental Studio" in code
- Each business is a **clinic** — fully isolated data via Supabase RLS
- Matira Dental Studio is Clinic #1. Other paying customers = Clinic #2, #3, etc.
- No App Store — installable as a **PWA** via browser
- Target devices: desktop/tablet (primary), mobile portrait (secondary)
- Users are non-technical clinic staff

---

## Tech stack

- **Next.js 16 + TypeScript** (strict mode, app router)
- **Tailwind CSS v4** — utility classes only, zero inline styles ever
- **Supabase** — Postgres + Auth + RLS + Storage
- **Recharts** — all charts
- **date-fns** — all date/time logic
- **Next PWA** — PWA/offline support via `next-pwa`

> Note: This is NOT a Vite/React app — it is Next.js with the App Router. No React Router, no Zustand.
> Supabase client lives at `app/src/lib/supabaseClient.ts`.

---

## Absolute code rules — never break these

1. **Zero inline styles.** Tailwind classes only. No `style={{}}` ever.
2. **One component per file.** Never export two components from one file.
3. **No `any`.** Every prop, variable, and return type must be explicitly typed. Use `unknown` + narrowing if needed.
4. **Named exports** for all components and hooks. Default export only for Next.js page/layout files.
5. **No logic in JSX.** Compute everything above the `return` statement.
6. **Supabase only in hooks or server actions.** Never call Supabase directly inside JSX.
7. **Conditional classes: `cn()` only.** Never string-concatenate Tailwind classes. Import from `@/lib/cn`.
8. **No duplicate code.** Before creating any component, function, hook, or type — scan the codebase. If it exists, extend or import it.
9. **All forms: controlled inputs with explicit state.** No uncontrolled inputs.
10. **Every data-fetching hook returns `{ data, isLoading, error }`.** Handle all three in UI.
11. **Always include `clinic_id`** in every insert and every query. RLS enforces isolation at DB level but the app must still pass `clinic_id` explicitly.
12. **Mobile-first.** Base = phone portrait. `md:` = tablet. `lg:` = desktop.

---

## Multi-tenancy — how it works

Every data table (except `clinics` itself) has a `clinic_id uuid` column.
Supabase RLS policies ensure users can only read/write their own clinic's data.
`clinic_id` is loaded from the user's profile on login and stored in context.

```typescript
// src/contexts/ClinicContext.tsx
interface ClinicContextValue {
  clinicId: string;
  clinicName: string;
  plan: "free" | "pro";
  role: "owner" | "staff";
  isOwner: boolean;
  isPro: boolean;
}
```

Always get `clinicId` from `useClinic()` — never hardcode it:

```typescript
const { clinicId } = useClinic()

// Every query:
.eq('clinic_id', clinicId)

// Every insert:
{ clinic_id: clinicId, ...formData }
```

---

## Folder structure

```
molaris/
└── app/
    ├── public/
    │   ├── icons/               ← PWA icons (192, 512, maskable)
    │   └── manifest.json        ← PWA manifest
    ├── src/
    │   ├── app/                 ← Next.js App Router pages
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   ├── login/
    │   │   ├── dashboard/
    │   │   ├── patients/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/
    │   │   │       ├── layout.tsx
    │   │   │       ├── info/
    │   │   │       ├── medical/
    │   │   │       ├── chart/
    │   │   │       ├── treatments/
    │   │   │       ├── billing/
    │   │   │       ├── ortho/
    │   │   │       ├── documents/
    │   │   │       ├── attachments/
    │   │   │       └── print/
    │   │   ├── appointments/
    │   │   ├── reports/
    │   │   └── settings/
    │   │       ├── clinic-profile/
    │   │       ├── team/
    │   │       ├── services/
    │   │       ├── payment-modes/
    │   │       └── document-templates/
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── TopNav.tsx
    │   │   │   └── PatientTabs.tsx
    │   │   └── shared/
    │   │       ├── EditModal.tsx
    │   │       ├── DatePickerField.tsx
    │   │       ├── Spinner.tsx
    │   │       ├── Toggle.tsx
    │   │       ├── ToothChart.tsx
    │   │       ├── DocumentViewer.tsx
    │   │       └── DashboardCard.tsx
    │   ├── contexts/
    │   │   └── ClinicContext.tsx ← clinicId, clinicName, plan, role
    │   ├── hooks/               ← all Supabase data access
    │   │   ├── useClinic.ts
    │   │   ├── usePatients.ts
    │   │   ├── useAppointments.ts
    │   │   └── ...
    │   └── lib/
    │       ├── supabaseClient.ts
    │       ├── types.ts          ← all shared types (one source of truth)
    │       ├── helpers.ts        ← cn(), all formatters, pure utils
    │       ├── cn.ts
    │       └── ...generators/helpers (document, invoice, etc.)
    ├── supabase/
    │   └── migrations/
    ├── next.config.ts
    ├── package.json
    └── CLAUDE.md                ← this file
```

---

## Timezone — Philippine Standard Time (PST, UTC+8)

All displayed dates and times must be in PST. Non-negotiable.

```typescript
// Use date-fns (already installed)
import { format, parseISO } from "date-fns";
```

- Never display raw ISO strings
- Store in DB as UTC — Supabase handles this automatically
- For date-only fields (birth_date, appointment_date): parse as local, not UTC

---

## Formatting — all helpers live in `src/lib/helpers.ts`

**Use these everywhere — in table cells, form placeholders, read-only fields, document generators, everywhere. No one-off inline formatting.**

### Currency — ₱1,650.00

```typescript
export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
```

### Date — 15-Jun-2026

```typescript
export function formatDateStandard(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const d = Number(parts[2]);
  const m = Number(parts[1]);
  const y = Number(parts[0]);
  if (!d || !m || !y) return isoDate;
  return `${String(d).padStart(2, "0")}-${months[m - 1]}-${y}`;
}
```

### DateTime — 15-Jun-2026 4:30 PM

```typescript
export function formatDateTimePH(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}
```

### Phone — (0917) 123-4567

```typescript
export function formatPhoneLocal(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 4)}) ${digits.slice(4)}`;
  return `(${digits.slice(0, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
}
// Store raw digits only. Format on display only.
```

### Age — from birth_date

```typescript
export function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
```

### Patient full name — first + middle + last

```typescript
export function formatPatientName(
  first: string | null,
  middle: string | null,
  last: string | null,
): string {
  return [first, middle, last].filter(Boolean).join(" ").trim() || "—";
}

// For documents/labels: Last, First M.
export function formatPatientNameFormal(
  first: string | null,
  middle: string | null,
  last: string | null,
): string {
  const mi = middle?.trim() ? `${middle.trim()[0]}.` : "";
  const parts = [
    last?.trim(),
    [first?.trim(), mi].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.join(", ") || "—";
}
```

---

## Database schema — canonical table list

**These are the ONLY tables that exist. Do not reference any other table name.**

### Core / Multi-tenant

| Table            | Purpose                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `clinics`        | One row per clinic (tenant). `id`, `name`, `slug`, `plan`, `owner_id`, `created_at`                   |
| `clinic_profile` | Clinic display info: address, phones, contacts, logo, hours. FK → `clinics.id`                        |
| `profiles`       | One row per auth user. `id` (= auth.uid), `clinic_id`, `role` ('owner'/'staff'), `full_name`, `email` |

### Clinical

| Table                       | Purpose                                       |
| --------------------------- | --------------------------------------------- |
| `patients`                  | Core patient record                           |
| `patient_medical_histories` | Allergies, medications, conditions, BP, notes |
| `dental_chart_entries`      | Per-tooth findings                            |
| `tooth_statuses`            | Per-tooth current status                      |
| `treatments`                | Visit treatment records                       |
| `ortho_cases`               | Orthodontic cases                             |
| `ortho_entries`             | Per-visit ortho log                           |
| `ortho_entry_items`         | Line items per ortho entry                    |
| `attachments`               | Patient file uploads                          |

### Scheduling

| Table               | Purpose                          |
| ------------------- | -------------------------------- |
| `appointments`      | Appointment records              |
| `dentists`          | Dentist roster                   |
| `dentist_schedules` | Per-dentist weekly availability  |
| `dentist_blockouts` | Per-dentist leave/blockout dates |
| `holiday_overrides` | Clinic-wide holidays             |

### Billing / Financial

| Table            | Purpose                     |
| ---------------- | --------------------------- |
| `invoices`       | Invoice header              |
| `invoice_items`  | Invoice line items          |
| `payments`       | Payment records             |
| `receipts`       | Immutable receipt snapshots |
| `service_prices` | Service catalog             |
| `payment_modes`  | Payment method config       |

### Documents / Settings

| Table                | Purpose                      |
| -------------------- | ---------------------------- |
| `documents`          | Generated document snapshots |
| `document_templates` | HTML templates for documents |
| `staff`              | Non-dentist staff members    |

### ❌ DELETED — do not reference these tables anywhere

```
message_threads        ← REMOVED
messages               ← REMOVED
thread_patients        ← REMOVED
facebook_pages         ← REMOVED
google_calendar_connections ← REMOVED
```

---

## `patients` table — canonical columns

```sql
patients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES clinics(id),   -- ← NEW (multi-tenant)
  first_name       text,
  middle_name      text,                                    -- ← NEW
  last_name        text,
  full_name        text,    -- kept for doc compat; auto-synced by trigger
  phone            text,    -- stored as digits only, formatted on display
  birth_date       date,
  gender           text CHECK (gender IN ('male', 'female')),
  address          text,
  occupation       text,
  email            text,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
)
```

**Removed from patients:** any messaging/thread columns (e.g. `messenger_id`, `fb_thread_id`).

---

## `appointments` table — canonical columns

```sql
appointments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES clinics(id),
  patient_id       uuid NOT NULL REFERENCES patients(id),
  dentist_id       uuid REFERENCES dentists(id),
  appointment_date date NOT NULL,
  appointment_time time,
  status           text CHECK (status IN ('pending','confirmed','completed','no_show','cancelled')),
  notes            text,
  -- NO message_thread_id — removed
  created_by       uuid REFERENCES profiles(id),
  updated_by       uuid REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz  -- soft delete
)
```

---

## TypeScript types — `src/lib/types.ts`

**Single source of truth for all types. Never redefine a type locally in a page or component — always import from here.**

```typescript
// Patient — matches DB exactly
export type Patient = {
  id: string;
  clinic_id: string;
  first_name: string | null;
  middle_name: string | null; // ← NEW
  last_name: string | null;
  full_name: string | null; // auto-synced by trigger
  phone: string | null; // digits only in DB
  birth_date: string | null; // YYYY-MM-DD
  gender: "male" | "female" | null;
  address: string | null;
  occupation: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Appointment — NO message_thread_id
export type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  dentist_id: string | null;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string | null;
  status: "pending" | "confirmed" | "completed" | "no_show" | "cancelled";
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  patient?: Patient;
  dentist?: DentistRow;
};

// MessageThread, Message, MessageWithThread — DELETED, do not add back
```

**All other existing types (Treatment, Invoice, Payment, etc.) remain — just add `clinic_id: string` to each.**

---

## User roles & feature gates

```typescript
// src/contexts/ClinicContext.tsx
const { isOwner, isPro } = useClinic();

// Owner-only features: clinic settings, staff management, reports, billing config
// Pro-only features: [TBD — gate with isPro check]
// Staff can: view patients, record treatments, schedule appointments
```

Role is stored in `profiles.role`. Gate UI with `isOwner` from context — never re-fetch role inside components.

---

## PWA setup

- Install `next-pwa` package
- Configure in `next.config.ts`
- `public/manifest.json` — app name: "Molaris", short_name: "Molaris", theme_color: clinic's brand color
- Icons: 192×192, 512×512, maskable variant
- Service worker caches: shell + static assets (offline-first for clinic use)
- Add `<meta name="theme-color">` and `<link rel="manifest">` in `app/layout.tsx`

---

## Naming conventions

| Thing                   | Pattern                                 | Example                                 |
| ----------------------- | --------------------------------------- | --------------------------------------- |
| Components              | PascalCase                              | `PatientModal.tsx`                      |
| Hooks                   | camelCase + `use` prefix                | `usePatients.ts`                        |
| Types/Interfaces        | PascalCase                              | `Patient`, `InvoiceRow`                 |
| Context files           | PascalCase + Context                    | `ClinicContext.tsx`                     |
| Non-component lib files | camelCase                               | `helpers.ts`, `supabaseClient.ts`       |
| DB tables               | snake_case plural                       | `patients`, `invoices`                  |
| DB columns              | snake_case                              | `clinic_id`, `first_name`, `birth_date` |
| Query aliases           | never use — always use real column name | ❌ `p.id` ✅ `patients.id`              |

---

## UI/UX standards

- Empty list → show empty state (icon + message + CTA), not blank space
- Async fetch → show `<Spinner />` or skeleton, not nothing
- Error → inline error banner (`error-banner` CSS class), not `console.log`
- Delete → confirm dialog (`window.confirm` or modal) before executing
- Success → brief inline success banner (`success-banner` CSS class), auto-dismiss after 3s
- No full page reloads — reload section data via `loadData()` after mutations
- Transitions: subtle only — no animation on data tables

---

## Responsive design & visual consistency

### Every UI must work on all three breakpoints — no exceptions

| Breakpoint       | Target                                  | Tailwind prefix |
| ---------------- | --------------------------------------- | --------------- |
| Base (no prefix) | Mobile portrait — 390px wide            | (none)          |
| `md:`            | Tablet portrait / small laptop — 768px+ | `md:`           |
| `lg:`            | Desktop / tablet landscape — 1024px+    | `lg:`           |

- **Never build for one size only.** If you write a layout, test it mentally at all three widths.
- Tables on mobile: use horizontal scroll (`overflow-x-auto` wrapper) — never let a table break the layout.
- Modals on mobile: full-width, max-height `90dvh`, scrollable inside.
- Grids: `grid-cols-1` base → `md:grid-cols-2` → `lg:grid-cols-3` or `lg:grid-cols-4` as appropriate.
- Font sizes: never fixed large sizes on mobile. Use responsive variants: `text-sm md:text-base`.
- Tap targets: minimum `h-10` (40px) for all buttons and interactive elements on mobile.

### Visual cohesion — the theme is a system, not decoration

The app has a theme system (`ThemeLoader`, `ThemeBackground`, `ThemePicker`). The theme will be updated — all visual decisions must plug into it, not hardcode colors.

**Rules:**

1. **No hardcoded colors.** Use CSS variables or Tailwind semantic classes (`text-slate-700`, `bg-white`, `border-slate-200`) — never `text-[#334155]` or `style={{ color: '#334155' }}`.
2. **Identical elements must look identical.** If two pages both have a "Save" button, they must use the same `save-btn` class. If two pages show a data table, both use `data-table`. No one-off styling of things that already have a class.
3. **Shadows and borders are consistent.** Cards use `card`. Inputs use `field-input`. Do not mix `shadow-md` on one card and `shadow-sm` on another — pick what `globals.css` defines and use it everywhere.
4. **Typography is consistent.** Page titles use `card-title`. Field labels use `field-label-text`. Table headers use `data-table-head-cell`. Do not set custom font sizes or weights outside of these classes unless you are adding a new class to `globals.css` for all similar elements.
5. **Spacing rhythm.** Vertical spacing between sections uses `spacing-vertical-lg`. Between form fields uses the same gap as existing forms. Do not mix `mt-4` in one place and `mt-6` in another for the same type of spacing — check what's already used and match it.
6. **Icons, if used, must be consistent** — same icon library, same size convention throughout.
7. **When the theme is updated later**, it will only require changes to `globals.css` and CSS variables — not hunting through individual components. This only works if all components use the shared classes correctly now.

---

## CSS class conventions (globals.css)

The app uses semantic CSS utility classes defined in `globals.css`. Use these — do not invent new ones or inline Tailwind for things these cover.

**Always use the existing class. Scan `globals.css` before adding a new Tailwind class combination.**

Key classes in use:

```
card, card-header, card-title, card-light
field-label, field-label-text, field-input, field-textarea
save-btn, cancel-btn, delete-btn, add-row-btn
data-table, data-table-head, data-table-head-cell, data-table-head-cell-right
data-table-row, data-table-row-even, data-table-row-odd
data-table-cell, data-table-cell-right, data-table-btn, data-table-btn-danger
data-table-empty, table-wrapper
error-banner, success-banner
modal-footer-buttons, modal-actions, modal-actions-right
entry-row, entry-row-select, entry-row-input
form-grid-3, spacing-vertical-lg
hint-text, readonly-input, input-xs, input-standard
action-row, col-10 … col-40
```

---

## ⚠️ PRE-IMPLEMENTATION SCAN — MANDATORY BEFORE EVERY SINGLE TASK ⚠️

**BEFORE WRITING A SINGLE LINE OF CODE, SCAN THE ENTIRE CODEBASE FOR:**

1. **EXISTING SHARED COMPONENTS** — Is there already a `DatePickerField`? An `EditModal`? A `Toggle`? A `Spinner`? **USE THE EXISTING ONE. DO NOT CREATE A NEW ONE. DO NOT INLINE IT. IMPORT IT.**
   - Date fields → ALWAYS `<DatePickerField>` from `@/components/shared/DatePickerField`
   - Modals → ALWAYS `<EditModal>` from `@/components/shared/EditModal`
   - Spinners/loading → ALWAYS `<Spinner />` or `<PageLoader />` from `@/components/shared/Spinner`
   - Toggles → ALWAYS `<Toggle>` from `@/components/shared/Toggle`
   - Never invent a new UI pattern for something that already exists.

2. **DATABASE COLUMN NAMES** — Grep existing pages/hooks before naming any column in a select or insert. Column names must exactly match what is already in the codebase and schema. **NEVER GUESS OR INVENT A COLUMN NAME.**

3. **EXISTING HELPERS** — Check `src/lib/helpers.ts` first. Do not reimplement `formatMoney`, `formatDateStandard`, `formatPhoneLocal`, `calcAge`, `cn()`, etc. Do not write these inline.

4. **EXISTING TYPES** — Import from `src/lib/types.ts`. Do not redeclare types locally.

5. **DUPLICATE FUNCTIONS** — `combineFullName` exists in both `helpers.ts` AND is inlined in `patients/page.tsx`. After migration there must be ONE canonical version in `helpers.ts`. Same for any other duplicate.

6. **`clinic_id` in every query/insert** — Search for any `.from(...)` call missing `.eq('clinic_id', clinicId)`. Flag it.

**VIOLATION OF THIS RULE IS THE #1 SOURCE OF BUGS.** Column name mismatches, duplicate UI patterns, and missing `clinic_id` break the app silently.

---

## Pre-flight checklist — before every code generation

1. Inline styles? → Never. Tailwind + `globals.css` classes only.
2. `clinic_id` included in every Supabase query and insert?
3. Loading + error + empty states handled?
4. No `any` types?
5. Works on mobile portrait AND desktop?
6. Modal closes on backdrop click AND Escape key?
7. All dates formatted with `formatDateStandard()` — 15-Jun-2026?
8. All currency formatted with `formatMoney()` — ₱1,234.00?
9. All phone numbers stored as digits, displayed with `formatPhoneLocal()`?
10. Patient name uses `first_name + middle_name + last_name` — not `full_name` for display?
11. No reference to deleted tables: `message_threads`, `messages`, `thread_patients`, `facebook_pages`, `google_calendar_connections`?
12. No reference to deleted features: Messages page, Messenger integration, BulkSMS, Google Calendar sync, website controls?
13. Role check before owner-only UI (`isOwner` from `useClinic()`)?
14. Using existing CSS class from `globals.css` — not inventing new Tailwind combos?
15. Using `formatPatientName(first, middle, last)` — not `patient.full_name` — for all display?
16. Responsive at all three breakpoints? Base (mobile) → `md:` (tablet) → `lg:` (desktop)?
17. No hardcoded colors? Using Tailwind semantic classes or CSS variables only?
18. All similar elements (buttons, cards, inputs, tables) using the same shared class as elsewhere in the app?
19. Tap targets at least `h-10` (40px) on mobile?
20. Tables wrapped in `overflow-x-auto` for mobile scroll?

---

## Features to REMOVE — complete list

Delete all code, routes, API handlers, DB tables, and type definitions for:

| Feature               | Files/Folders to delete                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Messages / inbox      | `app/messages/` (entire folder)                                                                                                                            |
| Messenger (Facebook)  | `api/auth/facebook/`, `api/messenger/`, `api/admin/sync-messenger/`, `api/admin/load-threads-stream/`, `api/admin/sync-thread/`, `api/webhooks/messenger/` |
| BulkSMS               | `api/webhooks/bulksms/`                                                                                                                                    |
| Message upload        | `api/messages/upload/`                                                                                                                                     |
| Thread patients API   | `api/thread-patients/`                                                                                                                                     |
| Google Calendar sync  | `api/auth/google/`, `api/cron/gc-sync/`, `api/google-calendar/`                                                                                            |
| Website controls page | `settings/website-controls/`                                                                                                                               |
| `messageHelpers.ts`   | `lib/messageHelpers.ts`                                                                                                                                    |
| Vercel cron gc-sync   | Remove from `vercel.json`                                                                                                                                  |
| Messenger in TopNav   | Remove `messengerConnected` state and nav link                                                                                                             |
| `ContactPatientModal` | `appointments/ContactPatientModal.tsx` (uses messaging)                                                                                                    |

Remove from `types.ts`: `MessageThread`, `Message`, `MessageWithThread`
Remove from `Appointment` type: `message_thread_id`
Remove from `vercel.json`: `gc-sync` cron entry

---

## Features to KEEP — do not touch

- Patients (all tabs: Info, Medical, Chart, Treatments, Billing, Ortho, Documents, Attachments, Print)
- Appointments (without messaging/contact-via-messenger)
- Reports (all sub-pages)
- Settings: Clinic Profile, Team, Services, Payment Modes, Document Templates
- All billing/invoice/payment/receipt logic
- All document generators (prescription, certificate, referral, SOA, invoice)
- Theme system (ThemeLoader, ThemeBackground, ThemePicker)
- `holiday_overrides` — kept, used by appointments calendar

---

## Run / build

All commands run from the `app/` folder:

```bash
npm install
npm run dev      # development
npm run build    # production build
npm run start    # production server
npm run lint
```

Required env vars (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Key files to inspect when changing features

- `app/src/lib/types.ts` — all shared types
- `app/src/lib/helpers.ts` — all formatters and utilities
- `app/src/lib/supabaseClient.ts` — Supabase client
- `app/src/contexts/ClinicContext.tsx` — multi-tenant context
- `app/src/app/patients/[id]/billing/page.tsx` — invoice/payment flow
- `app/src/components/shared/ToothChart.tsx` — dental charting logic
- `app/src/app/globals.css` — all shared CSS classes

When changing schema: update types.ts first, then grep for every usage of that column, then update all pages. Never update a page in isolation.
