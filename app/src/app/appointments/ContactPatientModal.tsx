"use client";

import { useEffect, useState } from "react";
import { EditModal } from "@/components/EditModal";
import { formatPhoneLocal } from "@/lib/helpers";
import { sendThreadMessage } from "@/lib/messageHelpers";

interface Props {
  open: boolean;
  patient: { id: string; full_name?: string | null; phone?: string | null } | null;
  appointment: { appointment_date: string; appointment_time: string } | null;
  onClose: () => void;
}

function fmt12Hr(time: string) {
  const t = time.substring(0, 5); // strip seconds
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDateLong(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

export function ContactPatientModal({ open, patient, appointment, onClose }: Props) {
  const [threadInfo, setThreadInfo]     = useState<{ threadId: string; psid: string } | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [channel, setChannel]           = useState<"messenger" | "sms">("sms");
  const [msgType, setMsgType]           = useState<"reminder" | "custom">("reminder");
  const [text, setText]                 = useState("");
  const [sending, setSending]           = useState(false);
  const [success, setSuccess]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const firstName = patient?.full_name?.split(" ")[0] ?? "";
  const reminderText = appointment
    ? `Hi ${firstName}! This is a reminder for your appointment at Matira Dental Studio on ${fmtDateLong(appointment.appointment_date)} at ${fmt12Hr(appointment.appointment_time)}. Please come on time. Thank you! 😊`
    : "";

  // Reset and fetch thread info whenever modal opens
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
      .then((rows: Array<{ thread_id: string; external_thread_id: string }>) => {
        const first = rows.find((r) => r.external_thread_id);
        if (first) {
          setThreadInfo({ threadId: first.thread_id, psid: first.external_thread_id });
          setChannel("messenger");
        } else {
          setChannel("sms");
        }
      })
      .catch(() => setChannel("sms"))
      .finally(() => setLoadingThread(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patient?.id]);

  // Swap text when message type changes
  useEffect(() => {
    setText(msgType === "reminder" ? reminderText : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgType]);

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

  const hasMessenger = !!threadInfo;
  const hasSMS       = !!patient?.phone;
  const noMethods    = !loadingThread && !hasMessenger && !hasSMS;

  return (
    <EditModal open={open} title="Contact Patient" onClose={onClose}>
      <div className="grid gap-4">
        {/* Patient summary */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {(patient?.full_name ?? "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{patient?.full_name ?? "—"}</p>
            {patient?.phone && (
              <p className="text-xs text-slate-400">{formatPhoneLocal(patient.phone)}</p>
            )}
          </div>
        </div>

        {/* Appointment context */}
        {appointment && (
          <div className="text-xs bg-violet-50 rounded-lg px-3 py-2 text-slate-600">
            Appointment: <span className="font-semibold text-slate-800">
              {fmtDateLong(appointment.appointment_date)} at {fmt12Hr(appointment.appointment_time)}
            </span>
          </div>
        )}

        {loadingThread ? (
          <p className="text-xs text-slate-400 text-center py-2">Checking contact options…</p>
        ) : noMethods ? (
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
            <p className="text-sm text-amber-700">No contact methods available for this patient. Add a phone number or link them to a Messenger thread.</p>
          </div>
        ) : (
          <>
            {/* Channel selector */}
            <div className="grid gap-1.5">
              <p className="text-field-label">Send via</p>
              <div className="flex gap-2">
                {hasMessenger && (
                  <button
                    type="button"
                    onClick={() => setChannel("messenger")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      channel === "messenger"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.327 5.502 3.414 7.271V22l3.107-1.707A11.05 11.05 0 0012 20.486c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.07 12.447l-2.545-2.713-4.963 2.713 5.461-5.797 2.607 2.713 4.9-2.713-5.46 5.797z"/>
                    </svg>
                    Messenger
                  </button>
                )}
                {hasSMS && (
                  <button
                    type="button"
                    onClick={() => setChannel("sms")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      channel === "sms"
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                      <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
                    </svg>
                    SMS
                  </button>
                )}
              </div>
            </div>

            {/* Message type */}
            <div className="grid gap-1.5">
              <p className="text-field-label">Message type</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMsgType("reminder")}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                    msgType === "reminder"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
                >
                  Appointment Reminder
                </button>
                <button
                  type="button"
                  onClick={() => setMsgType("custom")}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                    msgType === "custom"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
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
                rows={4}
                className="input-standard resize-none"
                placeholder="Type your message…"
              />
            </label>
          </>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-100 p-3">
            <p className="text-sm text-green-700">Message sent successfully!</p>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button onClick={onClose} className="cancel-btn">{success ? "Close" : "Cancel"}</button>
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
