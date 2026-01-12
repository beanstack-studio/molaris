# Payment System - One-Page Visual Summary

## 🎯 What Changed

```
BEFORE                          AFTER
─────────────────────────────   ─────────────────────────────────
payments.mode (text)      →     payments.payment_mode_id (FK)
                                payments.status (pending/verified)
                                payments.reference_number
                                payments.received_by (staff)
                                payments.verified_by (staff)
                                payments.verified_at
                                payments.proof_file_id
                                payments.details (JSONB)
                                payments.voided_at (soft delete)

payment_modes                 →  payment_modes (enhanced)
  - id, name, is_active          - code (unique)
  - sort_order                   - requires_proof, requires_reference
                                 - requires_received_by, auto_verifies

─ No staff table             →  staff (new)
                                - id, full_name, role, is_active

─ No receipts                →  receipts (new)
                                - receipt_number, payment_id
                                - snapshot (immutable copy)
                                - status (issued/voided)
```

---

## 📊 Payment Mode Matrix

```
┌──────────────┬──────────┬──────────────┬──────────────┬──────────┐
│ MODE         │ CASH     │ GCASH/MAYA   │ BANK TRANSFER│ CHEQUE   │
├──────────────┼──────────┼──────────────┼──────────────┼──────────┤
│ Proof        │ ❌       │ ✅ Required  │ ✅ Required  │ ❌       │
│ Reference    │ ❌       │ ✅ Required  │ ✅ Required  │ ✅ Req.  │
│ Received By  │ ✅ Req.  │ ❌           │ ❌           │ ❌       │
│ Auto Verify  │ ✅ YES   │ ❌ NO        │ ❌ NO        │ ❌ NO    │
│ Status Flow  │ → VERIFY │ → PENDING    │ → PENDING    │ → PENDING│
│ Receipt      │ ✅ Ready │ ⏳ After OK  │ ⏳ After OK  │ ⏳ Later │
└──────────────┴──────────┴──────────────┴──────────────┴──────────┘
```

---

## 🔄 Payment Lifecycle

```
CREATE PAYMENT
    │
    ├─ Auto-verify mode (CASH)?
    │   YES → status = 'VERIFIED' ✓ Ready for receipt
    │   NO  → status = 'PENDING'  (Staff reviews)
    │
    └─ If PENDING:
       Staff verifies proof/reference
       → status = 'VERIFIED' ✓ Ready for receipt
       
ISSUE RECEIPT (only if verified)
    │
    └─ Create immutable snapshot
       → receipt.snapshot = { amount, mode, ref, date }
       → receipt.status = 'ISSUED'
       
VOID (if needed)
    │
    └─ payments.voided_at = now()
       payments.voided_by = staff_id
       (Audit trail preserved)
```

---

## 🗄️ New Tables at a Glance

### staff
```
┌─────────────────────────────────────────┐
│ Who received cash / verified payments   │
├─────────────────────────────────────────┤
│ id (pk)                                 │
│ full_name (e.g., "Maria Santos")       │
│ role (e.g., "Assistant")               │
│ is_active (true/false)                 │
│ created_at, updated_at                 │
└─────────────────────────────────────────┘
```

### receipts
```
┌─────────────────────────────────────────┐
│ Immutable receipt records               │
├─────────────────────────────────────────┤
│ receipt_number (RCP-2026-000001)       │
│ payment_id → payments                   │
│ invoice_id → invoices                   │
│ patient_id → patients                   │
│ issued_by → staff                       │
│ issued_at (when created)                │
│ snapshot: {amount, mode, ref, date}    │
│ status (issued/voided)                  │
│ voided_at, voided_by, void_reason      │
└─────────────────────────────────────────┘
```

---

## 📝 JSONB Details Examples

```json
CASH:
{ "received_by_staff": "Maria", "time": "14:30" }

GCASH:
{ "payer_mobile": "09171234567", "gcash_ref": "ABC123DEF" }

BANK TRANSFER:
{ "bank_name": "BDO", "account": "Clinic", "ref": "TXN001" }

CHEQUE:
{ "cheque_bank": "PNB", "cheque_number": "CHQ-001234" }
```

---

## 🔐 Security (RLS)

```
┌────────────────┬──────────────┬────────────────────────┐
│ Table          │ Can View     │ Can Edit               │
├────────────────┼──────────────┼────────────────────────┤
│ payment_modes  │ Everyone     │ Admin only             │
│ payments       │ Everyone     │ Creator only           │
│ staff          │ Everyone     │ Creator / Admin        │
│ receipts       │ Everyone     │ Creator only           │
└────────────────┴──────────────┴────────────────────────┘
```

---

## ⚡ Performance Indexes

```
✅ idx_payments_invoice_id    (Fast: filter by invoice)
✅ idx_payments_status        (Fast: pending vs verified)
✅ idx_payments_verified_at   (Fast: range queries)
✅ idx_receipts_patient_id    (Fast: receipt history)
✅ idx_staff_is_active        (Fast: active staff lookup)
```

---

## 🚀 Quick Implementation

### 1. Run Migration (5 min)
```sql
-- Copy migrations/001_payment_system_schema.sql
-- Paste in Supabase SQL Editor
-- Click "Run"
```

### 2. Update Billing Page (30 min)
```typescript
// Before insert, check mode flags:
if (mode.requires_proof) { show file input }
if (mode.requires_reference) { show ref input }
if (mode.requires_received_by) { show staff dropdown }

// Set status based on mode:
status: mode.auto_verifies ? 'verified' : 'pending'

// Build details JSONB based on mode:
details: { ...mode_specific_fields }
```

### 3. Create Payment Verification (30 min)
```typescript
// Settings > Payment Verification page
// List pending payments
// Staff reviews proof
// Click verify → status='verified'
```

### 4. Add Receipt Issuance (20 min)
```typescript
// Add button "Issue Receipt" (only if status='verified')
// Creates snapshot of payment data
// Generates receipt_number
// Inserts into receipts table
```

---

## 📚 Documents Included

| File | Purpose | Read Time |
|------|---------|-----------|
| `migrations/001_payment_system_schema.sql` | SQL to run | 5 min |
| `PAYMENT_MIGRATION_QUICKSTART.md` | Step-by-step guide | 10 min |
| `PAYMENT_SYSTEM_MIGRATION.md` | Detailed explanations | 30 min |
| `PAYMENT_SYSTEM_ARCHITECTURE.md` | Visual diagrams | 20 min |
| `PAYMENT_IMPLEMENTATION_QUICK_REF.md` | Code examples | 15 min |

---

## ✅ Verification Checklist

After running migration:

```
☐ Run SQL migration without errors
☐ New columns visible on payments table
☐ New tables exist (staff, receipts)
☐ Canonical payment modes seeded (CASH, GCASH, etc.)
☐ Old data still accessible
☐ Triggers created (update_*_updated_at)
☐ RLS policies active
☐ Indexes created
☐ App code doesn't break
☐ Can create payments (backward compat)
☐ Can create CASH payment (auto-verified)
☐ Can create GCASH payment (pending)
☐ Can verify pending payment
☐ Can issue receipt
☐ Can void payment
```

---

## 🎓 Key Concepts

**Status Flow:** `pending` (needs review) → `verified` (ready for receipt)

**Auto-Verify:** CASH payments skip pending state (staff trust, immediate receipt)

**Proof:** GCash/Maya/Bank require screenshot; Cash doesn't

**Reference:** Cheque #, GCash ref, bank txn ID; stored in `reference_number`

**Snapshot:** Immutable copy of payment data at receipt creation time

**Soft Delete:** Voiding uses timestamps, not deletion (audit trail)

**JSONB Details:** Flexible field for mode-specific data (no schema migration needed)

**Staff Tracking:** Links who received cash and who verified payments

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Payment modes empty | Check migration ran, modes should be auto-seeded |
| Receipt button missing | Check payment.status='verified' |
| Can't verify payment | Check permission & payment.status='pending' |
| Staff dropdown empty | Create staff records first |
| voided_at set but still showing | Filter `.is('voided_at', null)` in queries |
| Proof upload failing | Check file size <5MB, S3 bucket permissions |

---

## 💡 Next Steps

1. **Run migration** (migrations/001_payment_system_schema.sql)
2. **Create staff records** (Settings > Staff or via SQL)
3. **Update billing page** to handle mode requirements
4. **Create verification page** for pending payments
5. **Add receipt issuance** UI
6. **Test end-to-end**
7. **Deploy** (standard Next.js build)

---

## 🎉 You're Future-Proof!

This schema supports:
- ✅ Multiple payment methods (extensible)
- ✅ Verification workflows
- ✅ Receipt generation
- ✅ Audit trails
- ✅ Future modes (no schema migration)
- ✅ Multi-user security (RLS)
- ✅ Performance optimization (indexes)

**Happy coding! 🚀**
