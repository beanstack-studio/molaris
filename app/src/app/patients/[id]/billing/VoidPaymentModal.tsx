"use client";

interface Props {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  voidReason: string;
  setVoidReason: (v: string) => void;
  onVoid: () => void;
}

export function VoidPaymentModal({
  open, onClose, busy,
  voidReason, setVoidReason,
  onVoid,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="modal-container"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onDoubleClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Void Payment</h2>
        </div>

        <div className="modal-body">
          <label className="form-field">
            <span className="text-slate-700 text-sm font-medium">Reason for voiding *</span>
            <textarea
              className="field-textarea"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="E.g., Duplicate payment, customer request, etc."
            />
          </label>

          <div className="modal-footer">
            <button
              className="cancel-btn"
              onClick={() => {
                onClose();
                setVoidReason("");
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="save-btn"
              disabled={busy || !voidReason.trim()}
              onClick={onVoid}
            >
              {busy ? "Voiding..." : "Void Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
