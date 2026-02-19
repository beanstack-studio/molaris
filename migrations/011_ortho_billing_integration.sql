-- Migration 011: Ortho + Billing Integration (Cleaner Version)
-- Adds service categorization, ortho-specific billing, and invoice item tracking

/* ============================================================
   PART 1: SERVICE CATEGORIZATION
   ============================================================ */

-- Add category column to services table
ALTER TABLE public.service_prices
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
CHECK (category IN ('general', 'ortho'));

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_service_prices_category 
ON public.service_prices(category);

/* ============================================================
   PART 2: ORTHO CASE ENHANCEMENTS (SIMPLIFIED)
   ============================================================ */

-- Add new fields to ortho_cases table
ALTER TABLE public.ortho_cases
ADD COLUMN IF NOT EXISTS package_service_id UUID REFERENCES public.service_prices(id),
ADD COLUMN IF NOT EXISTS phase TEXT CHECK (
  phase IS NULL OR 
  phase IN ('braces', 'aligners', 'retainer', 'completed')
),
ADD COLUMN IF NOT EXISTS inclusions JSONB DEFAULT '{}';

-- Indexes for ortho_cases
CREATE INDEX IF NOT EXISTS idx_ortho_cases_package_service_id 
ON public.ortho_cases(package_service_id);
CREATE INDEX IF NOT EXISTS idx_ortho_cases_phase 
ON public.ortho_cases(phase);

/* ============================================================
   PART 3: ORTHO ENTRY ENHANCEMENTS
   ============================================================ */

-- Add new fields to ortho_entries table
ALTER TABLE public.ortho_entries
ADD COLUMN IF NOT EXISTS visit_type TEXT CHECK (
  visit_type IS NULL OR 
  visit_type IN ('adjustment', 'emergency', 'rebond', 'install', 'debond', 'retainer', 'consultation')
),
ADD COLUMN IF NOT EXISTS lost_bracket BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS broken_bracket BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS poked_wire BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS addon_service_id UUID REFERENCES public.service_prices(id),
ADD COLUMN IF NOT EXISTS amount_override NUMERIC(10, 2);

-- Indexes for ortho_entries
CREATE INDEX IF NOT EXISTS idx_ortho_entries_visit_type 
ON public.ortho_entries(visit_type);
CREATE INDEX IF NOT EXISTS idx_ortho_entries_addon_service_id 
ON public.ortho_entries(addon_service_id);
CREATE INDEX IF NOT EXISTS idx_ortho_entries_is_billable 
ON public.ortho_entries(is_billable);

/* ============================================================
   PART 4: INVOICE BILLING TYPE
   ============================================================ */

-- Add invoice_type column to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'regular'
CHECK (invoice_type IN ('regular', 'ortho'));

-- Index for filtering by invoice type
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type 
ON public.invoices(invoice_type);

/* ============================================================
   PART 5: INVOICE ITEMS IDEMPOTENCY TRACKING
   ============================================================ */

-- Add source tracking to invoice_items for idempotency
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (
  source_type IS NULL OR 
  source_type IN ('treatment', 'ortho_package', 'ortho_entry')
),
ADD COLUMN IF NOT EXISTS source_id UUID;

-- Indexes for efficient upsert on source_type + source_id
CREATE INDEX IF NOT EXISTS idx_invoice_items_source 
ON public.invoice_items(invoice_id, source_type, source_id);

-- Composite index for fast idempotency checks during billing refresh
CREATE INDEX IF NOT EXISTS idx_invoice_items_source_lookup 
ON public.invoice_items(source_type, source_id);
