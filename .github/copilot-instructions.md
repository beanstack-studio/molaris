# Copilot / Agent Guidance — matira-dental-studio

Quick orientation
- This is a Next.js 13 TypeScript app (app folder). Frontend code lives under `app/src/app` and small UI components under `app/src/components`.
- Supabase is the primary backend: DB + Auth + Storage. Client is created in `app/src/lib/supabaseClient.ts` and used directly from client components (e.g. patient pages).

Run / build
- Install and run from the `app` folder:
  - Install: `npm install`
  - Dev: `npm run dev`
  - Build: `npm run build`
  - Start (prod): `npm run start`
  - Lint: `npm run lint`

Environment & integration
- Required env vars (at minimum): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `app/src/lib/supabaseClient.ts`).
- Supabase usage patterns:
  - Storage bucket used: `patient-files` (upload/delete/createSignedUrl in pages).
  - RPC calls: `recalc_invoice` is called from the UI to recalculate invoice totals.
  - Many pages call Supabase directly from client code (no separate API server in this repo).

Conventions & patterns to follow
- State refresh: many mutation helpers call a central `loadAll()` after success — preserve or reuse this pattern to keep UI in sync (see `app/src/app/patients/[id]/page.tsx`).
- Busy / error handling: before async mutations code sets `setBusy(true); setErr(null);` and clears `setBusy(false)` after. Follow this order and preserve error messages returned from Supabase for UX.
- File uploads: sanitize filenames with `safeFileName()` and use `crypto.randomUUID()` + patient id + date to build unique storage paths.
- Deleting files: two-step removal — delete from storage bucket, then delete DB record. If storage removal fails, abort and return the Supabase error message to the UI.
- Defensive DB access: some queries use `.select("*")` or compare error text to detect missing optional columns. If changing schema, ensure UI code handles missing columns gracefully.

Key files to inspect when changing features
- `app/package.json` — scripts and dependencies
- `app/src/lib/supabaseClient.ts` — Supabase client construction
- `app/src/app/patients/[id]/page.tsx` — largest single page with data fetching patterns, uploads, invoices, templates, and business rules
- `app/src/components/ToothChart.tsx` — domain-specific UI logic for dental charting

Database & domain notes (discoverable from code)
- Tables referenced in UI: `patients`, `attachments` / `files`, `dental_chart_entries`, `tooth_statuses`, `treatments`, `service_prices`, `invoices`, `invoice_items`, `payments`, `document_templates`, `generated_documents`.
- Follow patterns in `page.tsx` for invoice flow: create invoice → `recalc_invoice` RPC → load details.

When you edit code
- Keep changes small and run `npm run dev` to verify UI flows.
- If you modify DB columns, update all places that `select()` those columns and add defensive checks (use `select("*")` as a safe-first read or handle missing-column errors).

If anything is unclear, ask for the area to iterate (UI flows, specific DB tables, or Supabase rules). Request example data or a DB schema dump when making schema changes.
