# Payment System Architecture & Data Flow

## System Overview

This document provides a visual guide to the enhanced payment system architecture for Matira Dental Studio.

---

## 1. Entity Relationship Diagram (Simplified)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT SYSTEM                                 │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  PATIENTS    │          │  INVOICES    │          │PAYMENT_MODES │
│              │          │              │          │              │
│ id (uuid)    │◄─────────│ id (uuid)    │          │ id (uuid)    │
│ first_name   │          │ patient_id   │◄─────┐   │ code (text)  │
│ last_name    │          │ invoice_date │      │   │ name (text)  │
│ ...          │          │ total_amount │      │   │ requires_*   │
└──────────────┘          │ ...          │      │   │ auto_verifies│
       ▲                   └──────────────┘      │   │ sort_order   │
       │                         ▲               │   │ is_active    │
       │                         │               │   └──────────────┘
       └─────────────────────────┴───────────────┘
                                  (patient_id)           │
                                                         │
                                     ┌───────────────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │     PAYMENTS         │
                          │                      │
                          │ id (uuid)            │
                          │ patient_id ────────► patients
                          │ invoice_id ────────► invoices
                          │ payment_mode_id ───► payment_modes
                          │ amount (numeric)     │
                          │ payment_date (date)  │
                          │ status (text)        │
                          │ reference_number     │
                          │ received_by ───────┐ │
                          │ verified_by ───────┼─┼──► STAFF
                          │ verified_at        │ │
                          │ voided_by ─────────┘ │
                          │ voided_at            │
                          │ void_reason          │
                          │ proof_file_id        │
                          │ proof_storage_path   │
                          │ details (jsonb)      │
                          │ created_by           │
                          │ created_at           │
                          │ updated_at           │
                          └──────────┬───────────┘
                                     │
                                     │ (1:1)
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │    RECEIPTS          │
                          │                      │
                          │ id (uuid)            │
                          │ receipt_number       │
                          │ payment_id ────────► payments
                          │ invoice_id           │
                          │ patient_id           │
                          │ issued_by ──────────► staff
                          │ issued_at            │
                          │ status (text)        │
                          │ voided_at            │
                          │ voided_by ──────────► staff
                          │ void_reason          │
                          │ snapshot (jsonb)     │
                          │ created_by           │
                          │ created_at           │
                          │ updated_at           │
                          └──────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                      SUPPORTING TABLE: STAFF                             │
│                                                                          │
│ id (uuid) | full_name (text) | role (text) | is_active (boolean)      │
│ created_by (uuid) | created_at (ts) | updated_at (ts)                 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Payment Lifecycle State Machine

```
                            ┌──────────────────────────────┐
                            │   PAYMENT CREATED            │
                            │   status = 'pending' | 'verified'
                            │   (depends on auto_verifies) │
                            └──────────────┬───────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        │                                     │
                        ▼                                     ▼
            ┌─────────────────────┐         ┌────────────────────────┐
            │  AUTO-VERIFY MODES  │         │  MANUAL VERIFY MODES   │
            │  (e.g., CASH)       │         │  (e.g., GCASH, BANK)   │
            │                     │         │                        │
            │ status='verified'   │         │ status='pending'       │
            │ auto_verifies=true  │         │ auto_verifies=false    │
            │                     │         │                        │
            │ ✓ Ready for receipt │         │ ⏳ Waiting for proof  │
            │                     │         │                        │
            └────────────┬────────┘         └──────────┬─────────────┘
                         │                             │
                         │                             ▼
                         │                   ┌──────────────────────┐
                         │                   │  STAFF REVIEWS       │
                         │                   │  - Checks proof      │
                         │                   │  - Matches ref #     │
                         │                   │ - Adds notes         │
                         │                   └──────┬───────────────┘
                         │                          │
                         │                   ┌──────┴──────────┐
                         │                   │                 │
                         │                   ▼                 ▼
                         │           ┌──────────────┐  ┌─────────────┐
                         │           │  VERIFIED    │  │ REJECTED    │
                         │           │              │  │ (future)    │
                         │           │ status=      │  │ status=     │
                         │           │ 'verified'   │  │ 'rejected'  │
                         │           │              │  │             │
                         │           └──────┬───────┘  └─────────────┘
                         │                  │
                         └──────────────────┴──────────────┐
                                                          │
                                                          ▼
                                            ┌─────────────────────┐
                                            │  RECEIPT ISSUABLE   │
                                            │  (status='verified')│
                                            │                     │
                                            │ ✓ Staff issues      │
                                            │   receipt           │
                                            │ ✓ Snapshot created  │
                                            │                     │
                                            └────────┬────────────┘
                                                     │
                                     ┌───────────────┴───────────────┐
                                     │                               │
                                     ▼                               ▼
                                ┌─────────────┐           ┌──────────────┐
                                │ RECEIPT     │           │  VOID        │
                                │ ISSUED      │           │  PAYMENT     │
                                │             │           │              │
                                │ Normal flow │           │ voided_at ✓  │
                                │             │           │ voided_by ✓  │
                                │             │           │ void_reason ✓│
                                │             │           │              │
                                │ receipt:    │           │ Archived for │
                                │ status=     │           │ audit trail  │
                                │ 'issued'    │           │              │
                                └─────────────┘           └──────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │ RECEIPT VOIDED   │
                            │ (if requested)   │
                            │ receipt.status = │
                            │ 'voided'         │
                            │ voided_at ✓      │
                            │ voided_by ✓      │
                            │ void_reason ✓    │
                            └──────────────────┘
```

---

## 3. Payment Mode Requirements Matrix

```
┌────────────────────┬──────────────┬──────────────────┬──────────────────┐
│ PAYMENT MODE       │ CASH         │ GCASH/MAYA       │ BANK TRANSFER    │
├────────────────────┼──────────────┼──────────────────┼──────────────────┤
│ requires_proof     │ ❌ false     │ ✅ true          │ ✅ true          │
│ requires_reference │ ❌ false     │ ✅ true          │ ✅ true          │
│ requires_received_ │ ✅ true      │ ❌ false         │ ❌ false         │
│ by                 │              │                  │                  │
│ auto_verifies      │ ✅ true      │ ❌ false         │ ❌ false         │
│ sort_order         │ 10           │ 20/30            │ 40               │
├────────────────────┼──────────────┼──────────────────┼──────────────────┤
│ UI Fields          │              │                  │                  │
│ amount             │ ✅ required  │ ✅ required      │ ✅ required      │
│ date               │ ✅ required  │ ✅ required      │ ✅ required      │
│ staff selection    │ ✅ required  │ ❌ hidden        │ ❌ hidden        │
│ reference #        │ ❌ hidden    │ ✅ required      │ ✅ required      │
│ proof file         │ ❌ hidden    │ ✅ required      │ ✅ required      │
├────────────────────┼──────────────┼──────────────────┼──────────────────┤
│ Initial Status     │ verified     │ pending          │ pending          │
│ Receipt Ready?     │ ✅ yes       │ ⏳ after verify  │ ⏳ after verify  │
└────────────────────┴──────────────┴──────────────────┴──────────────────┘

CHEQUE:
├─ requires_proof: ❌ false
├─ requires_reference: ✅ true (cheque number)
├─ requires_received_by: ❌ false
├─ auto_verifies: ❌ false (staff verifies after clearing)
└─ Initial Status: pending (until cleared/verified)
```

---

## 4. Data Flow: Creating & Verifying a Payment

```
CLIENT (Billing Page)
│
├─ 1. User selects payment mode ──────────┐
│                                         │
├─ 2. Mode lookup (payment_modes table)   │
│     - Check requires_proof              │
│     - Check requires_reference          │
│     - Check requires_received_by        │
│     - Check auto_verifies               │
│     - Show/hide form fields accordingly │
│                                         │
├─ 3. User fills payment details:         │
│     - Amount                            │
│     - Payment date                      │
│     - Reference # (if required)         │
│     - Proof upload (if required)        │
│     - Staff name (if cash)              │
│     - Other details (JSONB)             │
│                                         │
├─ 4. Upload proof file (if needed)       │
│     - Sanitize filename                 │
│     - Upload to Supabase Storage        │
│     - Get file path/ID                  │
│                                         │
├─ 5. INSERT into payments table          │
│     status = auto_verifies ? 'verified' : 'pending'
│     details = { mode-specific data }    │
│     created_by = current_user_id        │
│                                         ▼
│                                  DATABASE
│
├─ 6. RPC call: recalc_invoice()          │
│     (recalculate invoice totals)        │
│                                         │
└─ 7. Refresh UI                          │
    └─ If status='verified':              │
       Display "Issue Receipt" button      │
    └─ If status='pending':               │
       Display "Pending verification"     │
       (show to admins/staff list)        │

STAFF VERIFICATION (Admin Page - Pending Payments)
│
├─ 1. Load pending payments                    │
│     SELECT * FROM payments                   │
│     WHERE status='pending'                   │
│     AND voided_at IS NULL                    │
│     ORDER BY payment_date DESC               │
│                                             │
├─ 2. Display payment with:                   │
│     - Invoice #, Patient, Amount            │
│     - Payment mode, Reference #             │
│     - Proof file link (if any)              │
│                                             │
├─ 3. Staff reviews:                          │
│     - Views proof screenshot (if digital)   │
│     - Checks reference # against bank/app   │
│     - Enters verification notes             │
│                                             │
├─ 4. Click "Verify Payment"                  │
│                                             ▼
│                                     DATABASE
│
├─ 5. UPDATE payments                         │
│     SET status='verified'                   │
│     SET verified_by=staff_id                │
│     SET verified_at=now()                   │
│     SET verification_notes=...              │
│     WHERE id=payment_id                     │
│                                             │
└─ 6. Refresh UI                              │
    └─ Payment moves to "verified"            │
    └─ "Issue Receipt" button now active      │

RECEIPT ISSUANCE (After Payment Verified)
│
├─ 1. Staff views payment (status='verified') │
│                                             │
├─ 2. Click "Issue Receipt"                  │
│                                             │
├─ 3. Build snapshot JSONB                   │
│     {                                       │
│       amount: payment.amount,               │
│       mode_name: payment.mode.name,         │
│       ref: payment.reference_number,        │
│       patient: patient.full_name,           │
│       payment_date: payment.date            │
│     }                                       │
│                                             ▼
│                                     DATABASE
│
├─ 4. INSERT into receipts                   │
│     receipt_number = 'RCP-2026-000001'     │
│     payment_id = payment.id                │
│     snapshot = {...immutable copy...}      │
│     issued_by = staff_id                   │
│     status = 'issued'                      │
│                                             │
└─ 5. Return receipt_number                  │
    └─ Print/email to patient                │
    └─ Store in patient file                 │

VOID PAYMENT (Emergency/Correction)
│
├─ 1. Staff enters void reason               │
│                                             │
├─ 2. Confirm void action                    │
│                                             ▼
│                                     DATABASE
│
├─ 3. UPDATE payments                        │
│     SET voided_at=now()                    │
│     SET voided_by=staff_id                 │
│     SET void_reason='...'                  │
│     WHERE id=payment_id                    │
│                                             │
├─ 4. UPDATE receipts (if any)               │
│     SET status='voided'                    │
│     SET voided_at=now()                    │
│     WHERE payment_id=payment_id             │
│                                             │
├─ 5. Recalculate invoice                   │
│     RPC recalc_invoice(invoice_id)         │
│                                             │
└─ 6. Refresh UI                            │
    └─ Payment shows "Voided" status         │
    └─ Audit trail preserved (no deletion)   │
```

---

## 5. JSONB Details Field Schema by Mode

```
CASH:
{
  "received_by_staff": "Maria Santos",
  "payment_method": "Hand-to-hand",
  "received_time": "14:30"
}

GCASH:
{
  "payer_mobile": "09171234567",
  "gcash_ref": "ABC123DEF456",
  "payer_name": "John Doe",
  "timestamp_received": "2026-01-12T14:30:00Z"
}

MAYA:
{
  "maya_ref": "MY123XYZ",
  "payer_email": "john@example.com",
  "maya_account": "9876543210",
  "timestamp_received": "2026-01-12T14:30:00Z"
}

BANK_TRANSFER:
{
  "bank_name": "BDO",
  "account_name": "Matira Dental Studio",
  "account_number": "1234567890",
  "transfer_ref": "TXN20260112001",
  "payer_bank": "BPI",
  "transfer_date": "2026-01-12"
}

CHEQUE:
{
  "cheque_bank": "PNB",
  "cheque_number": "CHQ-001234",
  "drawer_name": "ABC Company",
  "cheque_date": "2026-01-20",
  "status_tracking": "Pending clearance"
}

CREDIT_CARD:
{
  "last_4_digits": "4567",
  "card_type": "Visa",
  "approval_code": "ABC123",
  "auth_timestamp": "2026-01-12T14:30:00Z"
}
```

---

## 6. Query Patterns (Performance-Optimized)

```sql
-- Get verified (receipt-ready) payments for patient
SELECT p.* FROM payments p
WHERE p.patient_id = $1
  AND p.status = 'verified'
  AND p.voided_at IS NULL
ORDER BY p.payment_date DESC;

-- Get all active payments (non-voided) for invoice
SELECT p.*, pm.name as mode_name, pm.code as mode_code
FROM payments p
LEFT JOIN payment_modes pm ON p.payment_mode_id = pm.id
WHERE p.invoice_id = $1
  AND p.voided_at IS NULL
ORDER BY p.payment_date DESC;

-- Calculate total paid (active payments only)
SELECT COALESCE(SUM(amount), 0) as total_paid
FROM payments
WHERE invoice_id = $1
  AND voided_at IS NULL;

-- Find pending payments needing staff review
SELECT p.*, pm.name as mode_name, pat.first_name, pat.last_name
FROM payments p
LEFT JOIN payment_modes pm ON p.payment_mode_id = pm.id
LEFT JOIN patients pat ON p.patient_id = pat.id
WHERE p.status = 'pending'
  AND p.voided_at IS NULL
ORDER BY p.created_at ASC;

-- Get receipt history for patient
SELECT r.*, p.amount, pm.name as mode_name
FROM receipts r
LEFT JOIN payments p ON r.payment_id = p.id
LEFT JOIN payment_modes pm ON p.payment_mode_id = pm.id
WHERE r.patient_id = $1
  AND r.status = 'issued'
ORDER BY r.issued_at DESC;

-- Audit trail: find voided payments
SELECT p.*, v.full_name as voided_by_name, pm.name as mode_name
FROM payments p
LEFT JOIN staff v ON p.voided_by = v.id
LEFT JOIN payment_modes pm ON p.payment_mode_id = pm.id
WHERE p.voided_at IS NOT NULL
ORDER BY p.voided_at DESC;
```

---

## 7. RLS (Row-Level Security) Model

```
TABLE: payment_modes (Lookup)
├─ SELECT: ✅ All authenticated users (read all modes)
├─ INSERT: ❌ Admin only
├─ UPDATE: ❌ Admin only
└─ DELETE: ❌ Admin only

TABLE: payments (User-owned)
├─ SELECT: ✅ All authenticated users (see all clinic's payments)
├─ INSERT: ✅ Authenticated (created_by = current_user)
├─ UPDATE: ✅ Created user only (created_by = current_user)
└─ DELETE: ❌ Not permitted (soft-delete via voided_at)

TABLE: staff (Lookup + Editable)
├─ SELECT: ✅ All authenticated users (see all staff)
├─ INSERT: ✅ Authenticated (created_by = current_user)
├─ UPDATE: ✅ Created user or admin
└─ DELETE: ❌ Not permitted (soft-delete via is_active=false)

TABLE: receipts (User-owned)
├─ SELECT: ✅ All authenticated users (see all receipts)
├─ INSERT: ✅ Authenticated (created_by = current_user)
├─ UPDATE: ✅ Created user only
└─ DELETE: ❌ Not permitted (soft-delete via status='voided')
```

---

## 8. Error Handling & Validation

```
CLIENT-SIDE (Before Insert)
├─ Validate amount > 0
├─ Validate payment date ≤ today
├─ If requires_reference: validate reference not empty
├─ If requires_proof: validate file uploaded and <5MB
├─ If requires_received_by: validate staff selected

SERVER-SIDE (Database Triggers & RLS)
├─ Ensure invoice_id exists (FK constraint)
├─ Ensure patient_id exists (FK constraint)
├─ Ensure payment_mode_id exists (FK constraint)
├─ RLS: Verify created_by = auth.uid()
├─ Verify payment.status in ('pending', 'verified')

VERIFICATION (Staff Only)
├─ Verify payment.status = 'pending' before updating
├─ Verify verified_by FK exists in staff table
├─ Prevent double-verification (check verified_at NULL)

RECEIPT ISSUANCE
├─ Guard: payment.status = 'verified'
├─ Guard: issued_by FK exists in staff table
├─ Guard: receipt_number is unique
├─ Create immutable snapshot (validate JSON)

VOIDING
├─ Verify voided_by FK exists in staff table
├─ Update all related receipts to 'voided'
└─ Recalculate invoice totals after void
```

---

## 9. Performance Considerations

```
INDEXES CREATED:
├─ idx_payments_invoice_id       (frequent filter: "payments for invoice")
├─ idx_payments_patient_id       (frequent filter: "payments for patient")
├─ idx_payments_payment_mode_id  (frequent filter: "by mode")
├─ idx_payments_status           (frequent filter: "pending" vs "verified")
├─ idx_payments_verified_at      (range queries: "payments verified after X")
├─ idx_payments_created_by       (multi-tenant filter)
├─ idx_receipts_invoice_id       (lookup receipts by invoice)
├─ idx_receipts_patient_id       (lookup receipts by patient)
├─ idx_receipts_payment_id       (FK join)
├─ idx_receipts_status           (filter issued vs voided)
├─ idx_staff_is_active           (lookup active staff)
└─ idx_staff_created_by          (multi-tenant)

QUERY OPTIMIZATION:
├─ Always filter by voided_at IS NULL for active records
├─ Use indexes for ORDER BY payment_date
├─ Join payment_modes for display (uses id FK)
├─ Aggregate SUM(amount) with proper indexes
├─ Cache payment_modes in app (rarely changes)
└─ Use SELECT specific columns (avoid *)
```

---

## 10. Migration Checklist

```
Pre-Migration:
☐ Backup database
☐ Review existing payment_modes data
☐ Review existing payments data
☐ Test on staging environment

Migration:
☐ Run SQL migration script
☐ Verify new columns exist
☐ Verify new tables created
☐ Verify triggers created
☐ Verify RLS policies created
☐ Verify backfill successful

Post-Migration:
☐ Update TypeScript types
☐ Update billing page UI
☐ Create staff management page
☐ Create payment verification page
☐ Create receipt issuance workflow
☐ Update queries to filter voided_at
☐ Test payment creation (all modes)
☐ Test payment verification
☐ Test receipt issuance
☐ Test payment void
☐ Test backward compatibility (old code still works)
☐ Deploy to production

Rollback Plan (if needed):
☐ Restore backup
☐ Revert TypeScript code
☐ Disable new features in UI
```

---

This architecture is **future-proof**, **flexible**, and **audit-ready**. 🎯
