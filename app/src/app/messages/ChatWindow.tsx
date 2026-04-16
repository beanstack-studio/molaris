"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateTimePH, formatPhoneLocal } from "@/lib/helpers";
import { Spinner } from "@/components/Spinner";
import { Message, MessageThread, Patient } from "@/lib/types";
import {
  getMessageThread,
  getThreadMessages,
  sendThreadMessage,
  sendAppointmentConfirmation,
  createAppointment,
  getMessengerUserProfile,
} from "@/lib/messageHelpers";
import AppointmentModal from "./AppointmentModal";
import LinkPatientModal from "./LinkPatientModal";

interface ChatWindowProps {
  threadId: string;
  onThreadUpdated: () => void;
  onBack?: () => void; // mobile: go back to thread list
}

// Deterministic avatar color from a string seed
function avatarColor(seed: string) {
  const palette = [
    "bg-violet-500", "bg-blue-500", "bg-indigo-500", "bg-pink-500",
    "bg-teal-500",   "bg-amber-500", "bg-green-500", "bg-rose-500",
  ];
  return palette[seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return (parts.length > 1
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2)
  ).toUpperCase();
}

export default function ChatWindow({ threadId, onThreadUpdated, onBack }: ChatWindowProps) {
  const [thread, setThread]         = useState<(MessageThread & { patients: Patient }) | null>(null);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [replyText, setReplyText]   = useState("");
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [showApptModal, setShowApptModal]     = useState(false);
  const [showLinkModal, setShowLinkModal]     = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadThreadData();
    const sub = supabase
      .channel(`thread:${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, loadMessages)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadThreadData() {
    try {
      setLoading(true);
      const [t, msgs] = await Promise.all([getMessageThread(threadId), getThreadMessages(threadId)]);
      setThread(t);
      setMessages(msgs);
      // Fetch Messenger profile pic for unlinked threads
      if (t.channel === "messenger" && !t.patient_id && t.external_thread_id) {
        getMessengerUserProfile(t.external_thread_id)
          .then((p) => { if (p?.picture_url) setProfilePic(p.picture_url); })
          .catch(() => {});
      }
    } catch {
      setError("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    try {
      setMessages(await getThreadMessages(threadId));
    } catch {
      // non-critical
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!replyText.trim() || !thread) return;
    try {
      setSending(true);
      setError(null);
      const recipientId = thread.external_thread_id || thread.patients?.phone || "";
      await sendThreadMessage(threadId, replyText, thread.channel as "sms" | "messenger", recipientId);
      setReplyText("");
      await loadMessages();
      onThreadUpdated();
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleConfirmAppt(date: string, time: string, dentistId?: string, concerns?: string) {
    if (!thread?.patient_id) return;
    try {
      setSending(true);
      const appt = await createAppointment(thread.patient_id, date, time, dentistId || null, `Booked via ${thread.channel}`, threadId, concerns);
      const recipientId = thread.external_thread_id || thread.patients?.phone || "";
      await sendAppointmentConfirmation(appt.id, threadId, date, time, thread.channel as "sms" | "messenger", recipientId);
      setShowApptModal(false);
      await loadMessages();
      onThreadUpdated();
    } catch {
      setError("Failed to confirm appointment");
    } finally {
      setSending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-red-500">Failed to load conversation.</p>
      </div>
    );
  }

  const patientName   = thread.patients?.full_name ?? null;
  const externalName  = thread.external_user_name ?? null;
  const displayName   = patientName ?? externalName ?? "Unknown";
  const color         = avatarColor(displayName);
  const initials      = getInitials(displayName);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/60 bg-white/90 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3">

          {/* Mobile back button */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Back to conversations"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Avatar */}
          {profilePic ? (
            <img src={profilePic} alt={displayName} className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {initials}
            </div>
          )}

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
              {!thread.patient_id && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  Not linked
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {thread.channel.toUpperCase()}
              {thread.patients?.phone ? ` · ${formatPhoneLocal(thread.patients.phone)}` : ""}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!thread.patient_id && (
              <button onClick={() => setShowLinkModal(true)} className="btn btn-secondary text-xs h-8 px-3">
                Link Patient
              </button>
            )}
            {thread.patient_id && (
              <button onClick={() => setShowApptModal(true)} className="save-btn h-8 px-3 text-xs">
                + Appointment
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white/40">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <p className="text-slate-400 text-sm">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isStaff = msg.sender_type === "staff";
            return (
              <div key={msg.id} className={`flex gap-2 ${isStaff ? "justify-end" : "justify-start"}`}>

                {/* Patient avatar */}
                {!isStaff && (
                  <div className={`w-7 h-7 rounded-full ${color} flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-0.5`}>
                    {initials}
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[72%] sm:max-w-xs lg:max-w-sm rounded-2xl px-4 py-2.5 ${
                  isStaff
                    ? "text-white rounded-br-sm"
                    : "bg-white text-slate-800 border border-slate-200 shadow-sm rounded-bl-sm"
                }`}
                  style={isStaff ? {
                    background: "hsl(var(--accent-hue) var(--accent-sat) 52%)",
                  } : undefined}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-[11px] mt-1 ${isStaff ? "text-white/70" : "text-slate-400"}`}>
                    {formatDateTimePH(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Reply input ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-white/60 bg-white/90 backdrop-blur-sm px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm text-slate-700 transition field-textarea"
            style={{ maxHeight: "6rem", overflowY: "auto", minHeight: "unset" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className="save-btn h-10 px-4 flex-shrink-0"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showApptModal && thread.patient_id && (
        <AppointmentModal
          patientId={thread.patient_id}
          onConfirm={handleConfirmAppt}
          onCancel={() => setShowApptModal(false)}
          isSending={sending}
        />
      )}
      {showLinkModal && (
        <LinkPatientModal
          threadId={threadId}
          externalUserName={thread.external_user_name}
          onLinked={() => { setShowLinkModal(false); loadThreadData(); onThreadUpdated(); }}
          onCancel={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}
