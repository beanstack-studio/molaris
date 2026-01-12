# Payment System Migration - Quick Start

## 📋 Files Created

This migration includes:

1. **[migrations/001_payment_system_schema.sql](../migrations/001_payment_system_schema.sql)** ← **RUN THIS FIRST**
   - Complete SQL migration script for Supabase
   - Idempotent (safe to re-run)
   - Creates new tables, adds columns, sets up triggers, RLS

2. **[PAYMENT_SYSTEM_MIGRATION.md](../PAYMENT_SYSTEM_MIGRATION.md)** ← READ THIS
   - Comprehensive guide explaining what changed
   - Workflow rules for each payment mode
   - Data dictionary with all columns
   - RLS policies explained
   - Future enhancement ideas

3. **[PAYMENT_SYSTEM_ARCHITECTURE.md](../PAYMENT_SYSTEM_ARCHITECTURE.md)** ← REFERENCE
   - Visual diagrams (ER, state machine, data flows)
   - Payment lifecycle
   - Query patterns
   - Performance considerations

4. **[PAYMENT_IMPLEMENTATION_QUICK_REF.md](../PAYMENT_IMPLEMENTATION_QUICK_REF.md)** ← CODE EXAMPLES
   - Ready-to-use TypeScript code snippets
   - Payment creation example
   - Verification workflow
   - Receipt generation
   - Void payment logic

---

## 🚀 Step-by-Step Execution

### Step 1: Backup (5 min)
```bash
# In Supabase Dashboard:
# Settings > Database > Backups > Create backup
# Wait for backup to complete
```

### Step 2: Run SQL Migration (5 min)
```bash
# In Supabase SQL Editor:
1. Open https://supabase.com → Your project → SQL Editor
2. Click "New Query"
3. Copy the entire content from: migrations/001_payment_system_schema.sql
4. Paste into the SQL Editor
5. Click "Run"
6. Wait for completion (should see no errors)
7. Check for success message
```

### Step 3: Verify Migration (5 min)
```sql
-- Run these checks in SQL Editor to verify:

-- Check new columns added to payment_modes
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'payment_modes';

-- Check new columns added to payments
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'payments';

-- Check new tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('staff', 'receipts');

-- Check canonical payment modes are seeded
SELECT code, name, requires_proof, auto_verifies FROM payment_modes;

-- All should return data without errors
```

### Step 4: Update App Code (30 min)

#### 4a. Update Types
```bash
# Edit app/src/lib/types.ts
# Add new types at the end:
# - PaymentModeRow
# - PaymentRowExtended
# - StaffRow
# - ReceiptRow
# (See PAYMENT_IMPLEMENTATION_QUICK_REF.md for full definitions)
```

#### 4b. Create Helper Files
```bash
# Create app/src/lib/paymentModeHelpers.ts
# - getPaymentModeConfig(modeCode)
# - getRequiredFields(mode)

# Create app/src/lib/receiptHelpers.ts
# - generateReceipt(paymentId, staffId, userId)
```

#### 4c. Minimal Changes to Existing Code
```bash
# app/src/app/patients/[id]/billing/page.tsx
# Update addPayment() function to:
# - Get payment mode config
# - Build details JSONB based on mode
# - Set status based on auto_verifies
# - Everything else stays the same!
```

### Step 5: Create New UI Pages (Optional but Recommended)

#### 5a. Staff Management
```bash
# Create: app/src/app/settings/staff/page.tsx
# CRUD for staff table
# Used by: payments.received_by, payments.verified_by
```

#### 5b. Payment Verification
```bash
# Create: app/src/app/settings/payment-verification/page.tsx
# List pending payments
# Review proof + reference
# Click to verify
# Updates payment.status='verified'
```

#### 5c. Receipt Issuance
```bash
# Add to: app/src/app/patients/[id]/billing/page.tsx
# (or separate modal)
# Button appears only when payment.status='verified'
# Calls generateReceipt()
```

### Step 6: Test (15 min)

```bash
# 1. Start dev server
npm run dev

# 2. Create a CASH payment
#    - Should immediately be status='verified'
#    - Should show "Issue Receipt" button

# 3. Create a GCASH payment
#    - Should be status='pending'
#    - Should NOT show "Issue Receipt" button yet

# 4. (If you created verification page)
#    - Go to Settings > Payment Verification
#    - Find the pending GCASH payment
#    - Click verify
#    - Should update to status='verified'

# 5. Issue receipt
#    - Click "Issue Receipt"
#    - Receipt number created
#    - Snapshot immutable copy stored

# 6. Void payment
#    - Should prevent recalc
#    - Should void receipt too
#    - Audit trail preserved
```

### Step 7: Deploy (follow your CI/CD)

```bash
# Standard Next.js deploy
npm run build
# Deploy to your platform (Vercel, etc.)
```

---

## 📊 Schema Changes Summary

### payment_modes (Enhanced)
```sql
-- NEW COLUMNS:
code text unique                    -- CASH, GCASH, MAYA, BANK_TRANSFER, CHEQUE
requires_proof boolean              -- Does this need screenshot?
requires_reference boolean          -- Does this need ref #?
requires_received_by boolean        -- Does this need staff?
auto_verifies boolean               -- Verify immediately?
sort_order int                      -- UI display order
is_active boolean                   -- Toggle on/off
```

### payments (Extended)
```sql
-- NEW COLUMNS:
status text (default 'pending')     -- pending → verified → (rejected)
reference_number text               -- Cheque #, GCash ref, etc.
received_by uuid (FK staff)         -- Who received cash
verified_by uuid (FK staff)         -- Who verified payment
verified_at timestamptz             -- When verified
verification_notes text             -- Why verified/rejected
proof_file_id uuid                  -- Link to proof file
proof_storage_path text             -- Supabase Storage path
details jsonb (default '{}')        -- Mode-specific JSON
voided_at timestamptz               -- When voided (soft delete)
voided_by uuid (FK staff)           -- Who voided it
void_reason text                    -- Why voided
created_by uuid (default auth.uid()) -- User who created
updated_at timestamptz              -- Auto-updated on change

-- INDEXES ADDED:
idx_payments_invoice_id
idx_payments_patient_id
idx_payments_status
idx_payments_verified_at
idx_payments_created_by
```

### staff (NEW)
```sql
id uuid pk
full_name text not null
role text not null          -- Dentist, Assistant, Admin, etc.
is_active boolean (default true)
created_by uuid (default auth.uid())
created_at timestamptz (default now())
updated_at timestamptz (default now())
```

### receipts (NEW)
```sql
id uuid pk
receipt_number text unique  -- RCP-2026-000001
payment_id uuid FK          -- Link to payment
invoice_id uuid FK
patient_id uuid FK
issued_by uuid FK staff
issued_at timestamptz
status text (default 'issued') -- issued or voided
voided_at, voided_by, void_reason
snapshot jsonb              -- Immutable copy
created_by uuid
created_at, updated_at timestamptz
```

---

## 🔄 Backward Compatibility

**Your existing code will continue to work!**

- Old `mode` column (text) still exists
- Old `received_by_staff` column still exists
- Old `notes` column still exists
- Old queries like `.insert({ mode, notes })` still work
- New fields have defaults and are optional

**However**, to leverage new features, update billing page to:
1. Check `mode.requires_proof`, `requires_reference`, etc. before showing fields
2. Build `details` JSONB based on mode
3. Set `status` based on `auto_verifies` flag

---

## 💡 Usage Examples

### Insert a CASH payment (auto-verified)
```typescript
const { error } = await supabase
  .from('payments')
  .insert({
    patient_id: '123',
    invoice_id: '456',
    payment_mode_id: cashModeId,
    amount: 5000,
    payment_date: '2026-01-12',
    received_by: staffId,
    status: 'verified', // Auto-set because mode.auto_verifies=true
    details: { received_by_staff: 'Maria' },
    created_by: userId,
  });
```

### Insert a GCASH payment (pending verification)
```typescript
const { error } = await supabase
  .from('payments')
  .insert({
    patient_id: '123',
    invoice_id: '456',
    payment_mode_id: gcashModeId,
    amount: 5000,
    payment_date: '2026-01-12',
    reference_number: 'ABC123DEF456',
    proof_storage_path: 'patient-files/proof_20260112_123.jpg',
    status: 'pending', // Staff must verify
    details: { 
      payer_mobile: '09171234567',
      gcash_ref: 'ABC123DEF456'
    },
    created_by: userId,
  });
```

### Verify a payment (staff only)
```typescript
const { error } = await supabase
  .from('payments')
  .update({
    status: 'verified',
    verified_by: staffId,
    verified_at: new Date().toISOString(),
    verification_notes: 'Screenshot reviewed, matches statement',
  })
  .eq('id', paymentId)
  .eq('status', 'pending');
```

### Issue a receipt
```typescript
const { error } = await supabase
  .from('receipts')
  .insert({
    receipt_number: 'RCP-2026-000001',
    payment_id: paymentId,
    invoice_id: invoiceId,
    patient_id: patientId,
    issued_by: staffId,
    snapshot: {
      amount: payment.amount,
      payment_mode_name: 'GCash',
      reference_number: 'ABC123DEF456',
      paid_by: 'John Doe',
      payment_date: '2026-01-12'
    },
    created_by: userId,
  });
```

### Void a payment
```typescript
const { error } = await supabase
  .from('payments')
  .update({
    voided_at: new Date().toISOString(),
    voided_by: staffId,
    void_reason: 'Duplicate entry',
  })
  .eq('id', paymentId);

// Also void any related receipts
await supabase
  .from('receipts')
  .update({
    status: 'voided',
    voided_at: new Date().toISOString(),
    voided_by: staffId,
    void_reason: 'Associated payment voided',
  })
  .eq('payment_id', paymentId);
```

### Query active payments (exclude voided)
```typescript
const { data } = await supabase
  .from('payments')
  .select('*, payment_modes(name, code)')
  .eq('invoice_id', invoiceId)
  .is('voided_at', null)
  .order('payment_date', { ascending: false });
```

---

## ⚠️ Common Gotchas

| Issue | Solution |
|-------|----------|
| Payment modes not appearing in dropdown | Run migration, check `is_active=true` |
| Old payments show status 'pending' | Expected behavior. Backfill set to 'verified' only for auto_verify modes. |
| proof_file_id always null | You must upload file first and store path/id in payments row |
| Receipt generation fails | Guard: payment.status must be 'verified' |
| Can't void payment | voided_at is set but query still returns it | Always filter: `.is('voided_at', null)` |
| Indexes not being used | Check query uses indexed columns (invoice_id, status, etc.) |

---

## 🆘 Rollback (if something goes wrong)

```sql
-- Create a new migration to rollback
-- (Don't delete tables, just disable triggers and policies)

-- Drop triggers
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
DROP TRIGGER IF EXISTS update_receipts_updated_at ON receipts;

-- Disable RLS temporarily
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_modes DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipts DISABLE ROW LEVEL SECURITY;

-- App will still work with old code, new features just disabled
```

Or restore from backup (safest option).

---

## 📚 Full Documentation

| Document | Purpose |
|----------|---------|
| [PAYMENT_SYSTEM_MIGRATION.md](../PAYMENT_SYSTEM_MIGRATION.md) | Detailed guide & data dictionary |
| [PAYMENT_SYSTEM_ARCHITECTURE.md](../PAYMENT_SYSTEM_ARCHITECTURE.md) | Visual diagrams & workflows |
| [PAYMENT_IMPLEMENTATION_QUICK_REF.md](../PAYMENT_IMPLEMENTATION_QUICK_REF.md) | Code examples & patterns |

---

## ✅ Success Criteria

After migration, your app should:
- ✅ Create payments as before (backward compatible)
- ✅ CASH payments auto-verified (status='verified')
- ✅ GCASH payments pending (status='pending')
- ✅ Staff can verify pending payments
- ✅ Receipts can only be issued for verified payments
- ✅ Payments can be voided with audit trail
- ✅ All old data preserved
- ✅ No breaking changes to existing features

---

**Ready? Start with Step 1! 🎉**
