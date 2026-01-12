# Payment System Integration Guide - Billing Page

## Current State ✅
- ✅ Payment modes configured in Supabase (CASH, GCASH, MAYA, BANK_TRANSFER, CHEQUE, CREDIT_CARD)
- ✅ Billing page exists and has payment form
- ✅ Payment helper functions ready to use
- ✅ App builds successfully

## What Needs to Change

The billing page currently stores payments with:
- `mode: string` (payment mode name)
- `notes: string` (optional notes)

It needs to be updated to use the new payment system with:
- `status: "pending" | "verified" | "failed"` (based on mode.auto_verifies)
- `details: JSONB` (flexible mode-specific data)
- `reference_number: string` (transaction ID, cheque #, etc.)
- `proof_file_id: string` (proof upload)
- `received_by: string` (staff ID)
- `verified_by: string` (who verified, null initially)

## Step-by-Step Integration

### 1. Update Imports (top of billing/page.tsx)

```typescript
import { 
  getActivePaymentModes, 
  getPaymentModeConfig 
} from "@/lib/paymentModeHelpers";
import { 
  generateReceipt, 
  getTotalPaid, 
  getActivePayments 
} from "@/lib/receiptHelpers";
import type { 
  PaymentMode, 
  PaymentRowExtended 
} from "@/lib/types";
```

### 2. Update State Variables

Replace:
```typescript
const [paymentModes, setPaymentModes] = useState<Array<{ id: string; name: string }>>([]);
const [paymentMode, setPaymentMode] = useState<string>("");
const [paymentNotes, setPaymentNotes] = useState("");
```

With:
```typescript
const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode | null>(null);
const [payments, setPayments] = useState<PaymentRowExtended[]>([]);

// Optional fields based on mode selection
const [paymentReference, setPaymentReference] = useState("");
const [paymentReceivedBy, setPaymentReceivedBy] = useState("");
const [proofFile, setProofFile] = useState<File | null>(null);
```

### 3. Update loadData Function

In the `loadData()` function where it fetches payment modes, change:

```typescript
// OLD
const { data: modes } = await supabase
  .from("payment_modes")
  .select("id, name")
  .eq("is_active", true);
setPaymentModes(modes || []);

// NEW
const modes = await getActivePaymentModes();
setPaymentModes(modes);
```

### 4. Update Payment Mode Selection Handler

Add this new function:

```typescript
async function onPaymentModeSelected(modeCode: string) {
  try {
    const mode = await getPaymentModeConfig(modeCode);
    setSelectedPaymentMode(mode);
    // Clear conditional fields when mode changes
    setPaymentReference("");
    setPaymentReceivedBy("");
    setProofFile(null);
  } catch (err) {
    setErr(`Failed to load mode config: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
```

### 5. Update addPayment Function

Replace the entire function with:

```typescript
async function addPayment() {
  if (!id) return;
  setErr(null);

  if (!paymentInvoiceId) return setErr("Select an invoice.");
  if (!paymentAmount) return setErr("Enter payment amount.");
  if (!selectedPaymentMode) return setErr("Select payment mode.");

  // Validate required fields based on mode
  if (selectedPaymentMode.requires_reference && !paymentReference) {
    return setErr("Reference number required for this payment mode.");
  }
  if (selectedPaymentMode.requires_proof && !proofFile) {
    return setErr("Proof file required for this payment mode.");
  }
  if (selectedPaymentMode.requires_received_by && !paymentReceivedBy) {
    return setErr("Staff member required for this payment mode.");
  }

  setBusy(true);

  try {
    // Upload proof if required
    let proofFileId = null;
    let proofStoragePath = null;
    if (proofFile) {
      const fileName = `payment_proof_${Date.now()}_${proofFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("patient-files")
        .upload(`${id}/payments/${fileName}`, proofFile);
      
      if (uploadError) throw uploadError;
      proofFileId = fileName;
      proofStoragePath = uploadData.path;
    }

    // Build payment details with mode-specific data
    const paymentDetails: Record<string, any> = {
      payment_mode_code: selectedPaymentMode.code,
      payment_mode_name: selectedPaymentMode.name,
    };

    // Insert payment using new schema
    const { data: paymentData, error: insertError } = await supabase
      .from("payments")
      .insert({
        patient_id: id,
        invoice_id: paymentInvoiceId,
        payment_date: paymentDate,
        amount: parseFloat(paymentAmount),
        status: selectedPaymentMode.auto_verifies ? "verified" : "pending",
        reference_number: paymentReference || null,
        received_by: paymentReceivedBy || null,
        proof_file_id: proofFileId,
        proof_storage_path: proofStoragePath,
        details: paymentDetails,
        created_by: id, // or use actual user ID from auth
      })
      .select();

    if (insertError) throw insertError;

    // Recalculate invoice totals
    await supabase.rpc("recalc_invoice", { invoice_id: paymentInvoiceId });

    // If CASH (auto-verifies), optionally generate receipt
    if (selectedPaymentMode.auto_verifies && paymentData && paymentData[0]) {
      try {
        const receipt = await generateReceipt(
          paymentData[0].id,
          paymentReceivedBy || "system",
          id
        );
        // Optionally show receipt number to user
        console.log("Receipt generated:", receipt.receipt_number);
      } catch (receiptErr) {
        console.warn("Could not auto-generate receipt:", receiptErr);
      }
    }

    // Reset form
    setShowAddPayment(false);
    setPaymentInvoiceId("");
    setPaymentAmount("");
    setSelectedPaymentMode(null);
    setPaymentReference("");
    setPaymentReceivedBy("");
    setProofFile(null);
    
    // Reload data
    await loadData();
  } catch (err) {
    setErr(err instanceof Error ? err.message : "Failed to add payment");
  } finally {
    setBusy(false);
  }
}
```

### 6. Update Add Payment Modal

Replace the entire add payment modal JSX (lines ~735-810) with:

```typescript
{showAddPayment ? (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" 
    onClick={(e) => e.target === e.currentTarget && setShowAddPayment(false)}
  >
    <div className="w-full max-w-md rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-semibold">Add payment</h2>

      <div className="mt-4 grid gap-4">
        {/* Invoice Selection */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700 font-medium">Invoice</span>
          <select
            className="h-10 rounded-lg border bg-white px-3"
            value={paymentInvoiceId}
            onChange={(e) => setPaymentInvoiceId(e.target.value)}
            disabled={busy}
          >
            <option value="">Select invoice</option>
            {invoices.map((inv: any) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number} ({formatMoney(inv.total ?? 0)})
              </option>
            ))}
          </select>
        </label>

        {/* Payment Amount */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700 font-medium">Amount</span>
          <input
            type="number"
            step="0.01"
            className="h-10 rounded-lg border px-3"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0.00"
            disabled={busy}
          />
        </label>

        {/* Payment Date */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700 font-medium">Payment date</span>
          <input 
            type="date" 
            className="h-10 rounded-lg border px-3" 
            value={paymentDate} 
            onChange={(e) => setPaymentDate(e.target.value)}
            disabled={busy}
          />
        </label>

        {/* Payment Mode Selection */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700 font-medium">Payment mode</span>
          <select
            className="h-10 rounded-lg border bg-white px-3"
            value={selectedPaymentMode?.code || ""}
            onChange={(e) => onPaymentModeSelected(e.target.value)}
            disabled={busy}
          >
            <option value="">Select mode</option>
            {paymentModes.map((mode) => (
              <option key={mode.id} value={mode.code}>
                {mode.name}
                {!mode.auto_verifies && " (verify later)"}
              </option>
            ))}
          </select>
        </label>

        {/* Conditional Fields Based on Selected Mode */}
        {selectedPaymentMode && (
          <>
            {/* Proof Upload (if required) */}
            {selectedPaymentMode.requires_proof && (
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700 font-medium">Proof file *</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="h-10 rounded-lg border px-3"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  disabled={busy}
                />
                <span className="text-xs text-slate-500">Upload receipt, screenshot, etc.</span>
              </label>
            )}

            {/* Reference Number (if required) */}
            {selectedPaymentMode.requires_reference && (
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700 font-medium">Reference # *</span>
                <input
                  type="text"
                  className="h-10 rounded-lg border px-3"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder={`e.g., ${selectedPaymentMode.code === "CHEQUE" ? "Cheque #" : "Transaction ID"}`}
                  disabled={busy}
                />
              </label>
            )}

            {/* Staff Member (if required) */}
            {selectedPaymentMode.requires_received_by && (
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700 font-medium">Received by *</span>
                <input
                  type="text"
                  className="h-10 rounded-lg border px-3"
                  value={paymentReceivedBy}
                  onChange={(e) => setPaymentReceivedBy(e.target.value)}
                  placeholder="Staff member name"
                  disabled={busy}
                />
              </label>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-4">
          <button 
            className="cancel-btn" 
            onClick={() => setShowAddPayment(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button 
            className="save-btn" 
            disabled={busy || !selectedPaymentMode} 
            onClick={addPayment}
          >
            {busy ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  </div>
) : null}
```

### 7. Update Payments Display Table

Update how payments are displayed to show status and new fields:

```typescript
{/* Payments Table */}
<div className="border-t pt-4">
  <div className="text-sm font-semibold mb-3">Payments</div>
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-slate-600 bg-slate-50">
          <th className="py-2 px-3">Date</th>
          <th className="py-2 px-3">Mode</th>
          <th className="py-2 px-3">Amount</th>
          <th className="py-2 px-3">Status</th>
          <th className="py-2 px-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {payments
          .filter((p: any) => !p.voided_at && p.invoice_id === viewingInvoice.id)
          .map((payment: any, idx: number) => (
            <tr key={payment.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              <td className="py-2 px-3">{formatDatePH(payment.payment_date)}</td>
              <td className="py-2 px-3">
                {payment.details?.payment_mode_name || "Unknown"}
              </td>
              <td className="py-2 px-3 font-semibold">
                {formatMoney(payment.amount)}
              </td>
              <td className="py-2 px-3">
                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                  payment.status === "verified" ? "bg-green-100 text-green-700" :
                  payment.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {payment.status}
                </span>
              </td>
              <td className="py-2 px-3 text-right space-x-2">
                {payment.status === "verified" && (
                  <button 
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => issueReceipt(payment.id)}
                  >
                    Receipt
                  </button>
                )}
                <button 
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => deletePayment(payment.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  </div>
</div>
```

### 8. Add Helper Functions

Add these new functions to the component:

```typescript
async function issueReceipt(paymentId: string) {
  try {
    setBusy(true);
    const receipt = await generateReceipt(paymentId, "", id);
    alert(`Receipt ${receipt.receipt_number} issued successfully!`);
    await loadData();
  } catch (err) {
    setErr(`Failed to issue receipt: ${err instanceof Error ? err.message : "Unknown error"}`);
  } finally {
    setBusy(false);
  }
}

async function deletePayment(paymentId: string) {
  if (!confirm("Delete this payment?")) return;
  
  try {
    setBusy(true);
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);
    
    if (error) throw error;
    await loadData();
  } catch (err) {
    setErr(`Failed to delete payment: ${err instanceof Error ? err.message : "Unknown error"}`);
  } finally {
    setBusy(false);
  }
}
```

---

## Testing Checklist

After making these changes:

1. ✅ **Build succeeds**: `npm run build`
2. ✅ **App starts**: `npm run dev`
3. ✅ **Payments dropdown loads**: Check that payment modes appear
4. ✅ **Form fields show/hide**: 
   - Select CASH → see "Received by" field
   - Select GCASH → see Proof + Reference fields
5. ✅ **Payment created**: 
   - Select invoice, amount, mode, required fields
   - Click "Add" → payment appears in table
6. ✅ **Status is correct**: 
   - CASH payment → status "verified"
   - GCASH payment → status "pending"
7. ✅ **Receipt can be issued**: Click "Receipt" button on verified payment

---

## Quick Reference: Payment Modes

| Mode | requires_proof | requires_reference | requires_received_by | auto_verifies |
|------|---|---|---|---|
| CASH | ❌ | ❌ | ✅ | ✅ |
| GCASH | ✅ | ✅ | ❌ | ❌ |
| MAYA | ✅ | ✅ | ❌ | ❌ |
| BANK_TRANSFER | ✅ | ✅ | ❌ | ❌ |
| CHEQUE | ❌ | ✅ | ❌ | ❌ |
| CREDIT_CARD | ❌ | ❌ | ❌ | ❌ |

---

## Troubleshooting

**Q: Payment mode dropdown is empty?**
A: Check that payment modes were seeded. Go to Settings > Payment Modes. Should see 6 modes.

**Q: "Requires reference/proof/staff" validation keeps failing?**
A: Double-check the mode config in your database. View the payment_modes table directly.

**Q: Proof file upload fails?**
A: Ensure the `patient-files` bucket exists in Supabase Storage, and RLS policies allow write.

**Q: Receipt generation fails?**
A: Make sure the `receipts` table exists and the payment status is exactly "verified" (case-sensitive).

---

## Next Steps (Optional Enhancements)

1. **Payment Verification Page**: Create UI to manually verify pending (GCash/Maya/Bank) payments
2. **Receipt Templates**: Customize receipt format with clinic details
3. **Payment Reports**: Export payment history by date range, mode
4. **Staff Management**: Add page to manage staff members for received_by tracking
5. **Bulk Upload**: Import payments from CSV with proof batch upload

---

**Questions?** Check PAYMENT_QUICK_START.md or PAYMENT_IMPLEMENTATION_EXAMPLE.ts for more examples!
