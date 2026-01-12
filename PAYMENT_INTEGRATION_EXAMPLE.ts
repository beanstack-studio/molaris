/**
 * PAYMENT SYSTEM INTEGRATION EXAMPLE
 * 
 * This shows how to integrate payment modes into your billing page.
 * Paste/adapt these code snippets into app/src/app/patients/[id]/billing/page.tsx
 */

// ============================================================================
// STEP 1: IMPORTS (Add these to the top of your billing page)
// ============================================================================
import { getActivePaymentModes, getPaymentModeConfig } from "@/lib/paymentModeHelpers";
import { generateReceipt, voidPayment, getTotalPaid, getActivePayments } from "@/lib/receiptHelpers";
import { PaymentMode, PaymentRowExtended } from "@/lib/types";

// ============================================================================
// STEP 2: COMPONENT STATE (Add to your component)
// ============================================================================
const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode | null>(null);
const [payments, setPayments] = useState<PaymentRowExtended[]>([]);
const [totalPaid, setTotalPaid] = useState(0);

// ============================================================================
// STEP 3: LOAD PAYMENT MODES (Call in useEffect or when component mounts)
// ============================================================================
async function loadPaymentModes() {
  try {
    const modes = await getActivePaymentModes();
    setPaymentModes(modes);
  } catch (err) {
    console.error("Failed to load payment modes:", err);
  }
}

// ============================================================================
// STEP 4: HANDLE MODE SELECTION (Call when user picks a mode)
// ============================================================================
async function onPaymentModeSelected(modeCode: string) {
  try {
    const mode = await getPaymentModeConfig(modeCode);
    setSelectedPaymentMode(mode);
    
    // Show/hide form fields based on mode requirements
    // This is where you'd conditionally render:
    // - File upload if requires_proof
    // - Reference number field if requires_reference
    // - Staff dropdown if requires_received_by
  } catch (err) {
    console.error("Failed to load mode config:", err);
  }
}

// ============================================================================
// STEP 5: CREATE PAYMENT (Replace your existing addPayment function)
// ============================================================================
async function addPayment(
  paymentAmount: number,
  paymentDate: string,
  paymentInvoiceId: string,
  paymentPatientId: string,
  currentUserId: string
) {
  if (!selectedPaymentMode) {
    setErr("Please select a payment mode");
    return;
  }

  setBusy(true);
  setErr(null);

  try {
    // Prepare payment details (can store mode-specific data here)
    const paymentDetails: Record<string, any> = {
      payment_mode_code: selectedPaymentMode.code,
      payment_mode_name: selectedPaymentMode.name,
    };

    // Add reference if required and provided
    if (selectedPaymentMode.requires_reference && paymentReference) {
      paymentDetails.reference_number = paymentReference;
    }

    // Insert payment with NEW payment system fields
    const { data: paymentData, error: insertError } = await supabase
      .from("payments")
      .insert({
        invoice_id: paymentInvoiceId,
        patient_id: paymentPatientId,
        payment_date: paymentDate,
        amount: paymentAmount,
        
        // NEW: Use auto_verifies flag from mode
        status: selectedPaymentMode.auto_verifies ? "verified" : "pending",
        
        // NEW: Store flexible mode-specific data
        details: paymentDetails,
        
        // Existing fields
        created_by: currentUserId,
      })
      .select();

    if (insertError) {
      throw insertError;
    }

    // If payment auto-verified (CASH mode), optionally generate receipt
    if (selectedPaymentMode.auto_verifies && paymentData && paymentData[0]) {
      try {
        const receipt = await generateReceipt(
          paymentData[0].id,
          currentUserId, // Use actual staff ID if available
          currentUserId
        );
        console.log("Receipt generated:", receipt.receipt_number);
      } catch (receiptErr) {
        console.warn("Could not auto-generate receipt:", receiptErr);
        // Not critical if receipt fails
      }
    }

    // Reload data
    await loadPayments();
    
    // Clear form
    setPaymentAmount("");
    setPaymentDate("");
    setSelectedPaymentMode(null);
  } catch (err) {
    setErr(err instanceof Error ? err.message : "Failed to add payment");
  } finally {
    setBusy(false);
  }
}

// ============================================================================
// STEP 6: LOAD PAYMENTS WITH MODE INFO
// ============================================================================
async function loadPayments() {
  try {
    // Use helper that joins payment_modes table
    const paymentsData = await getActivePayments(invoiceId);
    setPayments(paymentsData);

    // Update total paid
    const total = await getTotalPaid(invoiceId);
    setTotalPaid(total);
  } catch (err) {
    console.error("Failed to load payments:", err);
  }
}

// ============================================================================
// STEP 7: RENDER PAYMENT MODE DROPDOWN
// ============================================================================
// In your JSX:
// <select onChange={(e) => onPaymentModeSelected(e.target.value)}>
//   <option value="">Select payment mode...</option>
//   {paymentModes.map(mode => (
//     <option key={mode.id} value={mode.code}>
//       {mode.name}
//       {!mode.auto_verifies && " (needs verification)"}
//     </option>
//   ))}
// </select>

// ============================================================================
// STEP 8: CONDITIONAL FORM FIELDS
// ============================================================================
// In your JSX, show/hide based on selectedPaymentMode:

// {selectedPaymentMode?.requires_reference && (
//   <input
//     type="text"
//     placeholder="Transaction ID / Reference"
//     value={paymentReference}
//     onChange={(e) => setPaymentReference(e.target.value)}
//   />
// )}

// {selectedPaymentMode?.requires_proof && (
//   <input
//     type="file"
//     accept="image/*,.pdf"
//     onChange={(e) => handleProofUpload(e.files?.[0])}
//   />
// )}

// {selectedPaymentMode?.requires_received_by && (
//   <select value={receivedByStaffId} onChange={(e) => setReceivedByStaffId(e.target.value)}>
//     <option value="">Select staff member...</option>
//     {staff.map(s => (
//       <option key={s.id} value={s.id}>{s.full_name}</option>
//     ))}
//   </select>
// )}

// ============================================================================
// STEP 9: DISPLAY PAYMENTS TABLE
// ============================================================================
// In your JSX:
// <table>
//   <thead>
//     <tr>
//       <th>Date</th>
//       <th>Mode</th>
//       <th>Amount</th>
//       <th>Status</th>
//       <th>Actions</th>
//     </tr>
//   </thead>
//   <tbody>
//     {payments.map(payment => (
//       <tr key={payment.id}>
//         <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
//         <td>{payment.payment_modes?.name || 'Unknown'}</td>
//         <td>₱{payment.amount}</td>
//         <td>
//           <span className={`badge badge-${payment.status}`}>
//             {payment.status}
//           </span>
//         </td>
//         <td>
//           {payment.status === 'verified' && (
//             <button onClick={() => issueReceipt(payment.id)}>Issue Receipt</button>
//           )}
//           {!payment.voided_at && (
//             <button onClick={() => voidPaymentClick(payment.id)}>Void</button>
//           )}
//         </td>
//       </tr>
//     ))}
//   </tbody>
// </table>

// ============================================================================
// STEP 10: ISSUE RECEIPT (Optional - for verified payments)
// ============================================================================
async function issueReceipt(paymentId: string) {
  try {
    const receipt = await generateReceipt(paymentId, staffId, currentUserId);
    alert(`Receipt ${receipt.receipt_number} issued successfully!`);
    await loadPayments(); // Refresh to show receipt status
  } catch (err) {
    alert(`Failed to issue receipt: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// ============================================================================
// STEP 11: VOID PAYMENT (Optional - if needed)
// ============================================================================
async function voidPaymentClick(paymentId: string) {
  const reason = prompt("Reason for voiding this payment:");
  if (!reason) return;

  try {
    await voidPayment(paymentId, staffId, reason);
    alert("Payment voided successfully");
    await loadPayments(); // Refresh
  } catch (err) {
    alert(`Failed to void payment: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// ============================================================================
// QUICK REFERENCE: WHAT EACH MODE DOES
// ============================================================================
/*

CASH:
  - Auto-verifies (status immediately set to "verified")
  - Requires received_by (staff member name)
  - No proof needed
  - Use case: Payment in-clinic

GCASH:
  - Requires proof upload (screenshot)
  - Requires reference number (transaction ID)
  - Auto-verifies: false (manual verification needed)
  - Use case: Mobile payment, verify later

MAYA:
  - Same as GCash
  - Use case: Maya app payment

BANK_TRANSFER:
  - Requires proof (bank receipt)
  - Requires reference (transaction reference)
  - Auto-verifies: false
  - Use case: Online bank payment

CHEQUE:
  - Requires reference (cheque number)
  - No proof needed
  - Auto-verifies: false
  - Use case: Cheque payment

CREDIT_CARD:
  - No proof required
  - No reference required
  - Auto-verifies: false (depends on processor)
  - Use case: Credit/debit card payment

*/

// ============================================================================
// PAYMENT FLOW SUMMARY
// ============================================================================
/*

1. User selects payment mode from dropdown
   → onPaymentModeSelected(modeCode)
   → Load mode config
   → Show/hide form fields based on requirements

2. User fills in amount, date, and any required fields
   → Form fields shown: proof, reference, staff (based on mode)

3. User clicks "Add Payment"
   → Call addPayment()
   → Insert to payments table with status='pending' or 'verified'
   → If auto_verifies=true (CASH), optionally generate receipt

4. Display payment in table
   → Show mode name, amount, status
   → If status='verified', show "Issue Receipt" button
   → Show "Void" button if not already voided

5. User clicks "Issue Receipt" (optional)
   → generateReceipt(paymentId, staffId, userId)
   → Creates immutable snapshot in receipts table
   → Show receipt number

6. If needed, user clicks "Void"
   → voidPayment(paymentId, staffId, reason)
   → Soft-delete (sets voided_at, voided_by)
   → Also voids related receipt (cascade)

*/
