"use client";

import { useEffect, useState } from "react";
import { EditModal } from "@/components/EditModal";
import { formatMoney, formatPhoneLocal } from "@/lib/helpers";
import { sendThreadMessage } from "@/lib/messageHelpers";

interface Props {
  open: boolean;
  patient: { id: string; full_name?: string | null; phone?: string | null } | null;
  balance: number;
  onClose: () => void;
}

export function PaymentReminderModal({ open, patient, balance, onClose }: Props) {
  const [threadInfo, setThreadInfo]       = useState<{ threadId: string; psid: string } | null>(null);
  const [messengerOpen, setMessengerOpen] = useState(false); // within Facebook 24h window
  const [loadingThread, setLoadingThread] = useState(false);
  const [channel, setChannel]             = useState<"messenger" | "sms">("sms");
  const [msgType, setMsgType]             = useState<"reminder" | "custom">("reminder");
  const [text, setText]                   = useState("");
  const [sending, setSending]             = useState(false);
  const [success, setSuccess]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const firstName    = patient?.full_name?.split(" ")[0] ?? "";
  const reminderText = `Hi ${firstName}! This is a friendly reminder from Matira Dental Studio. Your account has an outstanding balance of ${formatMoney(balance)}. Please settle at your earliest convenience. Thank you! 😊`;

  // Reset + fetch Messenger thread whenever modal opens
  useEffect(() => {
    if (!open || !patient) return;
    setSuccess(false);
    setError(null);
    setMsgType("reminder");
    setText(reminderText);
    setThreadInfo(null);

    setLoadingThread(true);
    fetch(`/api/thread-patients?patient_id=${patient.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ thread_id: string; external_thread_id: string; last_message_at: string | null }>) => {
        const first = rows.find((r) => r.external_thread_id);
        if (first) {
          setThreadInfo({ threadId: first.thread_id, psid: first.external_thread_id });
          // Facebook 24-hour window: can only reply within 24h of last patient message
          const withinWindow = first.last_message_at
            ? Date.now() - new Date(first.last_message_at).getTime() < 24 * 60 * 60 * 1000
            : false;
          setMessengerOpen(withinWindow);
          setChannel(withinWindow ? "messenger" : "sms");
        } else {
          setMessengerOpen(false);
          setChannel("sms");
        }
      })
      .catch(() => { setMessengerOpen(false); setChannel("sms"); })
      .finally(() => setLoadingThread(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patient?.id]);

  // Swap template when message type changes
  useEffect(() => {
    setText(msgType === "reminder" ? reminderText : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgType]);

  // Auto-close 1.5 s after success
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [success, onClose]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      if (channel === "messenger" && threadInfo) {
        await sendThreadMessage(threadInfo.threadId, text, "messenger", threadInfo.psid);
      } else if (channel === "sms" && patient?.phone) {
        const res = await fetch("/api/webhooks/bulksms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: patient.phone, message: text }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Failed to send SMS");
        }
      } else {
        throw new Error("No contact method available");
      }
      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  const hasMessenger = !!threadInfo && messengerOpen;
  const noMethods    = !loadingThread && !hasMessenger;

  const avatarInitials = (patient?.full_name ?? "?")
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <EditModal open={open} title="Send Payment Reminder" onClose={onClose}>
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

        {/* Outstanding balance chip */}
        <div className="appt-context-chip">
          Outstanding balance:{" "}
          <span className="font-semibold text-red-600">{formatMoney(balance)}</span>
        </div>

        {/* Channel selector */}
        {!loadingThread && (
          <div className="grid gap-1.5">
            <p className="text-field-label">Send via</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => hasMessenger && setChannel("messenger")}
                disabled={!hasMessenger}
                title={
                  !threadInfo
                    ? "Patient has no Messenger thread linked"
                    : !messengerOpen
                    ? "24-hour reply window closed — patient must message first"
                    : undefined
                }
                className={`channel-pill ${
                  hasMessenger
                    ? channel === "messenger"
                      ? "channel-pill-active-blue"
                      : "channel-pill-inactive"
                    : "channel-pill-inactive opacity-40 cursor-not-allowed"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                  <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.327 5.502 3.414 7.271V22l3.107-1.707A11.05 11.05 0 0012 20.486c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.07 12.447l-2.545-2.713-4.963 2.713 5.461-5.797 2.607 2.713 4.9-2.713-5.46 5.797z"/>
                </svg>
                Messenger
                {!threadInfo && <span className="text-[10px] ml-1 text-slate-400">(not linked)</span>}
                {threadInfo && !messengerOpen && <span className="text-[10px] ml-1 text-amber-500">(24h closed)</span>}
              </button>

              <button
                type="button"
                disabled
                className="channel-pill channel-pill-inactive opacity-50 cursor-not-allowed"
                title="SMS integration coming soon"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                  <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
                </svg>
                SMS
                <span className="text-[10px] ml-1 font-semibold text-amber-500">(soon)</span>
              </button>
            </div>
          </div>
        )}

        {loadingThread ? (
          <p className="text-xs text-slate-400 text-center py-2">Checking contact options…</p>
        ) : noMethods ? (
          <div className="alert-warning">
            {threadInfo && !messengerOpen
              ? "Messenger 24-hour window is closed — the patient must message the clinic first before you can reply. SMS coming soon."
              : "No Messenger thread linked to this patient. Link them from the Messages page. SMS coming soon."}
          </div>
        ) : (
          <>
            {/* Message type */}
            <div className="grid gap-1.5">
              <p className="text-field-label">Message type</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMsgType("reminder")}
                  className={`type-pill ${msgType === "reminder" ? "type-pill-active" : "type-pill-inactive"}`}
                >
                  Payment Reminder
                </button>
                <button
                  type="button"
                  onClick={() => setMsgType("custom")}
                  className={`type-pill ${msgType === "custom" ? "type-pill-active" : "type-pill-inactive"}`}
                >
                  Custom Message
                </button>
              </div>
            </div>

            {/* Message text */}
            <label className="grid gap-1 text-sm">
              <span className="text-field-label">Message</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="textarea-input w-full"
                placeholder="Type your message…"
              />
            </label>
          </>
        )}

        {error && <div className="alert-error">{error}</div>}
        {success && <div className="alert-success">Reminder sent! Closing…</div>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button onClick={onClose} className="cancel-btn">Close</button>
          {!success && !noMethods && !loadingThread && (
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="save-btn"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      </div>
    </EditModal>
  );
}
