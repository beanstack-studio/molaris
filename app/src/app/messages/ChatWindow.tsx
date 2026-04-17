"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateTimePH, formatPhoneLocal } from "@/lib/helpers";
import { Spinner } from "@/components/Spinner";
import { Message, MessageThread, Patient } from "@/lib/types";
import {
  getMessageThread,
  getThreadMessagesPaginated,
  sendThreadMessage,
  sendAppointmentConfirmation,
  createAppointment,
} from "@/lib/messageHelpers";
import AppointmentModal from "./AppointmentModal";
import LinkPatientModal from "./LinkPatientModal";

const PAGE_SIZE  = 20;
const LOAD_MORE  = 10;

interface ChatWindowProps {
  threadId: string;
  onThreadUpdated: () => void;
  onBack?: () => void;
}

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
  const [thread, setThread]                 = useState<(MessageThread & { patients: Patient }) | null>(null);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [linkedPatients, setLinkedPatients] = useState<Patient[]>([]);
  const [replyText, setReplyText]           = useState("");
  const [loading, setLoading]               = useState(true);
  const [autoSyncing, setAutoSyncing]       = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [hasMore, setHasMore]               = useState(false);
  const [oldestAt, setOldestAt]             = useState<string | null>(null);
  const [sending, setSending]               = useState(false);
  const [unlinkingId, setUnlinkingId]       = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [picError, setPicError]             = useState(false);
  const [showApptModal, setShowApptModal]   = useState(false);
  const [showLinkModal, setShowLinkModal]   = useState(false);
  const messagesEndRef      = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Track scroll position before prepending so we can restore it
  const prevScrollHeightRef = useRef<number>(0);

  const loadLinkedPatients = useCallback(async () => {
    try {
      const res = await fetch(`/api/thread-patients?thread_id=${threadId}`);
      if (!res.ok) return;
      const rows: Array<{ patient_id: string; patients: Patient }> = await res.json();
      setLinkedPatients(rows.map((r) => r.patients));
    } catch { /* non-critical */ }
  }, [threadId]);

  async function unlinkPatient(patientId: string) {
    setUnlinkingId(patientId);
    try {
      await fetch("/api/thread-patients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, patient_id: patientId }),
      });
      await loadLinkedPatients();
      onThreadUpdated();
    } catch { /* non-critical */ }
    finally { setUnlinkingId(null); }
  }


  useEffect(() => {
    loadThreadData();
    loadLinkedPatients();
    const sub = supabase
      .channel(`thread:${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, appendNewMessage)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [threadId]);

  // Restore scroll position after prepending older messages
  useEffect(() => {
    if (prevScrollHeightRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [messages]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading) messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [loading]);

  async function loadThreadData() {
    try {
      setLoading(true);
      const t = await getMessageThread(threadId);
      setThread(t);
      setPicError(false);

      const msgs = await getThreadMessagesPaginated(threadId, PAGE_SIZE);
      setMessages(msgs);
      setHasMore(msgs.length === PAGE_SIZE);
      if (msgs.length > 0) setOldestAt(msgs[0].created_at);

      // Auto-sync if this is a Messenger thread with no messages yet
      if (msgs.length === 0 && (t as any)?.channel === "messenger") {
        autoSyncThread();
      }
    } catch {
      setError("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }

  async function autoSyncThread() {
    setAutoSyncing(true);
    try {
      const res = await fetch(`/api/admin/sync-thread?thread_id=${threadId}`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.messages > 0) {
        const msgs = await getThreadMessagesPaginated(threadId, PAGE_SIZE);
        setMessages(msgs);
        setHasMore(msgs.length === PAGE_SIZE);
        if (msgs.length > 0) setOldestAt(msgs[0].created_at);
      }
    } catch { /* non-critical */ }
    finally { setAutoSyncing(false); }
  }

  async function loadMoreMessages() {
    if (!hasMore || loadingMore || !oldestAt) return;
    setLoadingMore(true);
    try {
      const container = messagesContainerRef.current;
      if (container) prevScrollHeightRef.current = container.scrollHeight;

      const older = await getThreadMessagesPaginated(threadId, LOAD_MORE, oldestAt);
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setOldestAt(older[0].created_at);
        setHasMore(older.length === LOAD_MORE);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (e.currentTarget.scrollTop < 80) loadMoreMessages();
  }

  async function appendNewMessage() {
    // Pull only the latest message to append (realtime insert)
    try {
      const newer = await getThreadMessagesPaginated(threadId, 1);
      if (newer.length > 0) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === newer[0].id) return prev;
          return [...prev, newer[0]];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch { /* non-critical */ }
  }

  async function handleSend() {
    if (!replyText.trim() || !thread) return;
    try {
      setSending(true);
      setError(null);
      const recipientId = thread.external_thread_id || linkedPatients[0]?.phone || "";
      await sendThreadMessage(threadId, replyText, thread.channel as "sms" | "messenger", recipientId);
      setReplyText("");
      onThreadUpdated();
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleConfirmAppt(date: string, time: string, patientId: string, dentistId?: string, concerns?: string) {
    try {
      setSending(true);
      const appt = await createAppointment(patientId, date, time, dentistId || null, `Booked via ${thread?.channel}`, threadId, concerns);
      const recipientId = thread?.external_thread_id || linkedPatients[0]?.phone || "";
      await sendAppointmentConfirmation(appt.id, threadId, date, time, thread?.channel as "sms" | "messenger", recipientId);
      setShowApptModal(false);
      onThreadUpdated();
    } catch {
      setError("Failed to confirm appointment");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
  }

  if (!thread) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-sm text-red-500">Failed to load conversation.</p></div>;
  }

  const externalName = thread.external_user_name ?? null;
  const displayName  = externalName ?? linkedPatients[0]?.full_name ?? "Unknown";
  const color        = avatarColor(displayName);
  const initials     = getInitials(displayName);
  const hasPatients  = linkedPatients.length > 0;

  const activePic = thread.channel === "messenger" && thread.external_thread_id && !picError
    ? `/api/messenger/profile-pic?psid=${encodeURIComponent(thread.external_thread_id)}`
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/60 bg-white/90 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3">

          {onBack && (
            <button onClick={onBack} className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" aria-label="Back">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {activePic ? (
            <img src={activePic} alt={displayName} className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              onError={() => setPicError(true)} />
          ) : (
            <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
              {!hasPatients && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Not linked</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {thread.channel.toUpperCase()}
              {linkedPatients[0]?.phone ? ` · ${formatPhoneLocal(linkedPatients[0].phone)}` : ""}
              {linkedPatients.length > 1 ? ` · +${linkedPatients.length - 1} more` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {hasPatients && (
              <button onClick={() => setShowApptModal(true)} className="save-btn h-8 px-3 text-xs">
                + Appt
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Linked Patients ──────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/60 bg-white/80 px-4 py-3 space-y-2">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
          Linked Patients ({linkedPatients.length}/5)
        </p>

        {linkedPatients.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{p.full_name}</p>
              {p.phone && (
                <p className="text-xs text-slate-400">{formatPhoneLocal(p.phone)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => unlinkPatient(p.id)}
              disabled={unlinkingId === p.id}
              className="flex-shrink-0 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {unlinkingId === p.id ? "…" : "Unlink"}
            </button>
          </div>
        ))}

        {linkedPatients.length < 5 && (
          <button
            type="button"
            onClick={() => setShowLinkModal(true)}
            className="w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 py-2.5 text-sm font-medium text-slate-400 hover:text-violet-600 transition-colors"
          >
            + Link Patient
          </button>
        )}
      </div>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white/40"
      >
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* Load more indicator at top */}
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Spinner size="h-4 w-4" />
          </div>
        )}
        {!loadingMore && hasMore && (
          <button
            onClick={loadMoreMessages}
            className="w-full py-2 text-xs text-slate-400 hover:text-violet-600 transition-colors"
          >
            Scroll up or tap to load older messages
          </button>
        )}
        {!hasMore && messages.length > 0 && (
          <p className="text-center text-xs text-slate-300 py-1">Beginning of conversation</p>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            {autoSyncing ? (
              <>
                <Spinner size="h-5 w-5" />
                <p className="text-slate-400 text-sm mt-3">Fetching messages from Messenger…</p>
              </>
            ) : (
              <p className="text-slate-400 text-sm">No messages yet</p>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isStaff = msg.sender_type === "staff";
            return (
              <div key={msg.id} className={`flex gap-2 ${isStaff ? "justify-end" : "justify-start"}`}>
                {!isStaff && (
                  <div className={`w-7 h-7 rounded-full ${color} flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-0.5`}>
                    {initials}
                  </div>
                )}
                <div
                  className={`max-w-[72%] sm:max-w-xs lg:max-w-sm rounded-2xl px-4 py-2.5 ${
                    isStaff
                      ? "text-white rounded-br-sm"
                      : "bg-white text-slate-800 border border-slate-200 shadow-sm rounded-bl-sm"
                  }`}
                  style={isStaff ? { background: "hsl(var(--accent-hue) var(--accent-sat) 52%)" } : undefined}
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            disabled={sending}
            id="message-reply"
            name="message-reply"
            className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm text-slate-700 transition field-textarea"
            style={{ maxHeight: "6rem", overflowY: "auto", minHeight: "unset" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
            }}
          />
          <button onClick={handleSend} disabled={!replyText.trim() || sending} className="save-btn h-10 px-4 flex-shrink-0">
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showApptModal && (
        <AppointmentModal
          patients={linkedPatients}
          onConfirm={handleConfirmAppt}
          onCancel={() => setShowApptModal(false)}
          isSending={sending}
        />
      )}
      {showLinkModal && (
        <LinkPatientModal
          threadId={threadId}
          externalUserName={thread.external_user_name}
          onLinked={() => { loadLinkedPatients(); onThreadUpdated(); }}
          onCancel={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}
