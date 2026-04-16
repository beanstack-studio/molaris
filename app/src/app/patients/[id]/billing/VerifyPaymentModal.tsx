"use client";

import { formatMoney, formatDateStandard } from "@/lib/helpers";

interface Props {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  verifyingPaymentDetails: any | null;
  verificationConfirmation: string;
  setVerificationConfirmation: (v: string) => void;
  onVerify: () => void;
}

export function VerifyPaymentModal({
  open, onClose, busy,
  verifyingPaymentDetails,
  verificationConfirmation, setVerificationConfirmation,
  onVerify,
}: Props) {
  if (!open || !verifyingPaymentDetails) return null;

  return (
    <div
      className="modal-container"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onDoubleClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-panel">
        <h2 className="modal-title">Verify Payment</h2>

        <div className="modal-body">
          <div className="card-light grid gap-2 text-sm">
            <div className="detail-row">
              <span className="text-slate-600">Amount:</span>
              <span className="font-semibold text-green-700">{formatMoney(verifyingPaymentDetails.amount)}</span>
            </div>
            <div className="detail-row">
              <span className="text-slate-600">Payment Date:</span>
              <span>{formatDateStandard(verifyingPaymentDetails.payment_date)}</span>
            </div>
            <div className="detail-row">
              <span className="text-slate-600">Payment Mode:</span>
              <span>{verifyingPaymentDetails.details?.payment_mode_name || "—"}</span>
            </div>
            {verifyingPaymentDetails.details?.reference_number && (
              <div className="detail-row">
                <span className="text-slate-600">Reference:</span>
                <span className="font-mono text-xs">{verifyingPaymentDetails.details.reference_number}</span>
              </div>
            )}
            {verifyingPaymentDetails.details?.received_by && (
              <div className="detail-row">
                <span className="text-slate-600">Received By:</span>
                <span>{verifyingPaymentDetails.details.received_by}</span>
              </div>
            )}
          </div>

          {verifyingPaymentDetails.details?.proof_file_data && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
              <span className="text-sm text-slate-700 font-medium">
                📎 {verifyingPaymentDetails.details?.proof_file_name || "Proof attached"}
              </span>
              <button
                className="save-btn"
                onClick={() => {
                  const w = window.open();
                  if (w) {
                    w.document.write(`
                      <html>
                        <head>
                          <title>Payment Proof - ${verifyingPaymentDetails.details?.proof_file_name || "proof"}</title>
                          <style>
                            body { margin: 0; display: flex; align-items: center; justify-content: center; background: #f5f5f5; }
                            img { max-width: 95%; max-height: 95vh; object-fit: contain; }
                          </style>
                        </head>
                        <body>
                          <img src="${verifyingPaymentDetails.details?.proof_file_data}" alt="Payment proof" />
                        </body>
                      </html>
                    `);
                  }
                }}
              >
                View Proof
              </button>
            </div>
          )}

          <label className="form-field">
            <span className="text-slate-700 font-medium">Type "VERIFY" to confirm *</span>
            <input
              type="text"
              className="h-10 rounded-lg border border-slate-300 px-3 uppercase focus:outline-none"
              value={verificationConfirmation}
              onChange={(e) => setVerificationConfirmation(e.target.value)}
              placeholder="Type VERIFY"
              disabled={busy}
            />
            {verificationConfirmation.toUpperCase() === "VERIFY" && (
              <span className="text-xs text-green-700 font-semibold">✓ Ready to verify</span>
            )}
          </label>

          <div className="modal-footer mt-2">
            <button className="cancel-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              className="save-btn"
              disabled={busy || verificationConfirmation.toUpperCase() !== "VERIFY"}
              onClick={onVerify}
            >
              {busy ? "Verifying..." : "Verify Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
