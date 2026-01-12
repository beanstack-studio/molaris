# Payment System - Quick Start Guide

## 🚀 Ready to Test

Everything is set up! The payment system is ready for integration into your billing page.

### 1. Start the app
```bash
cd app
npm run dev
```

### 2. Login
- Uses your existing Supabase auth
- Payment modes auto-seed on login (check Supabase tables)

### 3. Integration Checklist for Billing Page

Your next step is updating `app/src/app/patients/[id]/billing/page.tsx`.

**3a. Import the helpers**
```typescript
import { getActivePaymentModes, getPaymentModeConfig } from "@/lib/paymentModeHelpers";
import { generateReceipt, voidPayment, getTotalPaid } from "@/lib/receiptHelpers";
```

**3b. Load payment modes when component mounts**
```typescript
const modes = await getActivePaymentModes();
// Use in dropdown: modes.map(m => ({ label: m.name, value: m.code }))
```

**3c. When user selects a payment mode**
```typescript
const selectedMode = await getPaymentModeConfig(selectedPaymentCode);

// Show/hide form fields based on mode requirements
if (selectedMode.requires_proof) {
  // Show file upload input for proof
}
if (selectedMode.requires_reference) {
  // Show reference number input
}
if (selectedMode.requires_received_by) {
  // Show staff dropdown
}
```

**3d. When creating a payment**
```typescript
const { data: payment, error } = await supabase
  .from("payments")
  .insert({
    invoice_id: invoiceId,
    patient_id: patientId,
    payment_date: new Date().toISOString(),
    amount: paymentAmount,
    
    // NEW: Use mode config to set status
    status: selectedMode.auto_verifies ? "verified" : "pending",
    
    // NEW: Store mode-specific data
    details: {
      payment_mode_code: selectedMode.code,
      // Add any mode-specific fields here
    },
    
    // Existing fields still work:
    created_by: currentUserId,
  });
```

**3e. Show total paid (updated)**
```typescript
const totalPaid = await getTotalPaid(invoiceId);
// Display in UI
```

**3f. Issue receipt (optional, when payment is verified)**
```typescript
const receipt = await generateReceipt(paymentId, staffId, currentUserId);
console.log("Receipt issued:", receipt.receipt_number);
```

**3g. Void a payment (optional, if needed)**
```typescript
await voidPayment(paymentId, staffId, "Reason for voiding");
// This also voids any related receipt
```

---

## 📋 Payment Modes Reference

| Mode | Code | Auto-Verify | Requires | Use Case |
|------|------|-------------|----------|----------|
| Cash | CASH | ✅ Yes | Staff name | Immediate payment in-clinic |
| GCash | GCASH | ❌ No | Proof + Ref | Mobile payment (verify later) |
| Maya | MAYA | ❌ No | Proof + Ref | Mobile payment (verify later) |
| Bank Transfer | BANK_TRANSFER | ❌ No | Proof + Ref | Online payment (verify later) |
| Cheque | CHEQUE | ❌ No | Ref # | Post-dated or delayed |
| Credit Card | CREDIT_CARD | ❌ No | None | Credit/card payment |

**Requires breakdown:**
- **Proof**: File upload (receipt, screenshot, etc.)
- **Ref**: Reference number (transaction ID, etc.)
- **Staff name**: Who received the payment

---

## 🔧 Helper Functions Cheat Sheet

### Mode Lookup
```typescript
// Get single mode
const mode = await getPaymentModeConfig("GCASH");
// Result: { id, code, name, requires_proof, requires_reference, ... }

// Get all active modes (for dropdown)
const modes = await getActivePaymentModes();
// Result: Array of PaymentMode objects
```

### Payment Operations
```typescript
// Create receipt for verified payment
const receipt = await generateReceipt(paymentId, staffId, userId);
// Result: { id, receipt_number, payment_id, ... }

// Void payment and related receipt
await voidPayment(paymentId, staffId, "Duplicate transaction");

// Get active payments for invoice
const payments = await getActivePayments(invoiceId);
// Result: Array of non-voided payments with mode info

// Get total paid amount
const total = await getTotalPaid(invoiceId);
// Result: number (sum of active payments)
```

---

## 🗂️ File Structure

```
app/src/lib/
├─ paymentModeHelpers.ts       ← Mode lookup (getActivePaymentModes, getPaymentModeConfig)
├─ receiptHelpers.ts           ← Receipt & voiding (generateReceipt, voidPayment, getTotalPaid)
├─ initPaymentModes.ts         ← Seeding (called on login)
├─ types.ts                    ← Types (PaymentMode, PaymentRowExtended, etc.)
└─ supabaseClient.ts           ← Existing

app/src/app/patients/[id]/billing/
└─ page.tsx                    ← Update this to use the helpers

migrations/
└─ 001_payment_system_schema.sql ← Database schema (already applied)
```

---

## 📚 Documentation Files

- **PAYMENT_SYSTEM_SETUP_STATUS.md** ← You are here (overview + next steps)
- **PAYMENT_SYSTEM_README.md** ← Navigation hub
- **PAYMENT_IMPLEMENTATION_QUICK_REF.md** ← Full code examples & patterns
- **PAYMENT_MIGRATION_QUICKSTART.md** ← 7-step setup checklist
- **PAYMENT_SYSTEM_ARCHITECTURE.md** ← Diagrams & flows
- **PAYMENT_SYSTEM_ONE_PAGER.md** ← Visual summary

---

## ❓ FAQ

**Q: Do I need to create staff members before testing?**
A: Not for CASH mode testing. For other modes, you can hardcode a staff ID in the function call for now, or add staff management UI later.

**Q: How do I verify a GCash/Maya payment?**
A: Create payment with `status: "pending"`, then later update it to `status: "verified"` when you check the proof file. (UI component for this can be added to billing page).

**Q: How do receipts work?**
A: When payment is `verified`, call `generateReceipt()`. This captures a snapshot of payment data at that moment (immutable). If payment is voided later, the receipt is also voided (cascade).

**Q: What if I need to add a new payment mode?**
A: Add it to the `payment_modes` table via Supabase UI or with an INSERT statement. No code change needed. The JSONB `details` field handles any mode-specific data.

**Q: Are there any RLS/security policies I need to know about?**
A: Yes! All tables have RLS enabled. Users can only see/modify their own clinic's data. Payment modes are readable by all authenticated users.

---

## ✅ Next Steps

1. **Update billing page** (REQUIRED) - Add getActivePaymentModes() to dropdown, getPaymentModeConfig() for form fields
2. **Test payment creation** - Create a payment with CASH mode (auto-verifies)
3. **Test GCash payment** - Create with status='pending', then manually verify
4. **Add staff management** (OPTIONAL) - Or hardcode staff ID for testing
5. **Add receipt UI** (OPTIONAL) - Show receipt number when issued

---

**Questions?** See PAYMENT_IMPLEMENTATION_QUICK_REF.md for detailed code examples!
