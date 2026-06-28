"use client";

import { useEffect, useState } from "react";
import { EditModal } from "@/components/EditModal";
import { formatMoney, formatPhoneLocal } from "@/lib/helpers";
import { useClinic } from "@/contexts/ClinicContext";

interface Props {
  open: boolean;
  patient: { id: string; full_name?: string | null; phone?: string | null } | null;
  balance: number;
  onClose: () => void;
}

export function PaymentReminderModal({ open, patient, balance, onClose }: Props) {
  const { clinicName } = useClinic();
  const [copied, setCopied] = useState(false);

  const firstName = patient?.full_name?.split(" ")[0] ?? "";
  const reminderText = `Hi ${firstName}! This is a friendly reminder from ${clinicName}. Your account has an outstanding balance of ${formatMoney(balance)}. Please settle at your earliest convenience. Thank you!`;

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reminderText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text in textarea
    }
  }

  const avatarInitials = (patient?.full_name ?? "?")
    .split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <EditModal open={open} title="Payment Reminder" onClose={onClose}>
      <div className="grid gap-4">

        {/* Patient + balance summary */}
        <div className="patient-summary-card">
          <div className="patient-avatar">{avatarInitials}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{patient?.full_name ?? "—"}</p>
            {patient?.phone && (
              <p className="text-xs text-slate-400">{formatPhoneLocal(patient.phone)}</p>
            )}
          </div>
        </div>

        {/* Outstanding balance */}
        <div className="appt-context-chip">
          Outstanding balance:{" "}
          <span className="font-semibold text-red-600">{formatMoney(balance)}</span>
        </div>

        {/* Reminder text */}
        <label className="grid gap-1 text-sm">
          <span className="text-field-label">Reminder message</span>
          <textarea
            readOnly
            value={reminderText}
            rows={5}
            className="textarea-input w-full"
          />
        </label>

        <p className="text-xs text-slate-400">
          Copy this message and send it to the patient via SMS or any messaging platform.
        </p>

        <div className="modal-footer-buttons border-t border-slate-100 pt-3">
          <button onClick={onClose} className="cancel-btn">Close</button>
          <button onClick={handleCopy} className="save-btn">
            {copied ? "Copied!" : "Copy message"}
          </button>
        </div>
      </div>
    </EditModal>
  );
}
