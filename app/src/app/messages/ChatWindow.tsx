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
  createMessage,
} from "@/lib/messageHelpers";
import AppointmentModal from "./AppointmentModal";
import LinkPatientModal from "./LinkPatientModal";

const PAGE_SIZE  = 20;
const LOAD_MORE  = 10;

/* ── Helpers ──────────────────────────────────────────────── */
interface Attachment { type: string; url: string; name?: string }

function getAttachmentType(mimeType: string): "image" | "audio" | "video" | "file" {
  if (mimeType.startsWith("image/"))  return "image";
  if (mimeType.startsWith("audio/"))  return "audio";
  if (mimeType.startsWith("video/"))  return "video";
  return "file";
}

function attachmentFallback(type: string) {
  return ({ image: "📷 Photo", audio: "🎵 Audio message", video: "🎬 Video", file: "📎 File", sticker: "🎭 Sticker" } as Record<string, string>)[type] ?? "📎 Attachment";
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

/* ── Attachment renderer ──────────────────────────────────── */
function AttachmentBubble({ att, isStaff, onImageClick }: { att: Attachment; isStaff: boolean; onImageClick: (url: string) => void }) {
  if (att.type === "image" || att.type === "sticker") {
    return (
      <img
        src={att.url}
        alt="Attachment"
        onClick={() => onImageClick(att.url)}
        className={`rounded-xl max-h-60 object-contain cursor-zoom-in ${att.type === "sticker" ? "max-w-[120px]" : "max-w-full"}`}
      />
    );
  }
  if (att.type === "audio") {
    return <audio controls src={att.url} className="max-w-full mt-1" style={{ minWidth: 200 }} />;
  }
  if (att.type === "video") {
    return <video controls src={att.url} className="rounded-xl max-h-60 max-w-full mt-1" />;
  }
  // file
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 text-sm font-medium underline ${isStaff ? "text-white/90" : "text-violet-600"}`}
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      {att.name || "Download file"}
    </a>
  );
}

/* ══════════════════════════════════════════════════════════ */
interface ChatWindowProps {
  threadId: string;
  onThreadUpdated: () => void;
  onBack?: () => void;
  onOpenInfo?: () => void;
}

export default function ChatWindow({ threadId, onThreadUpdated, onBack, onOpenInfo }: ChatWindowProps) {
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
  const [uploadingFile, setUploadingFile]   = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [picError, setPicError]             = useState(false);
  const [lightboxUrl, setLightboxUrl]       = useState<string | null>(null);
  const [showApptModal, setShowApptModal]   = useState(false);
  const [showLinkModal, setShowLinkModal]   = useState(false);

  const messagesEndRef        = useRef<HTMLDivElement>(null);
  const messagesContainerRef  = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef   = useRef<number>(0);
  const latestMessageAtRef    = useRef<string | null>(null);
  const fileInputRef          = useRef<HTMLInputElement>(null);

  const loadLinkedPatients = useCallback(async () => {
    try {
      const res = await fetch(`/api/thread-patients?thread_id=${threadId}`);
      if (!res.ok) return;
      const rows: Array<{ patient_id: string; patients: Patient }> = await res.json();
      setLinkedPatients(rows.map((r) => r.patients));
    } catch { /* non-critical */ }
  }, [threadId]);

  useEffect(() => {
    setShowApptModal(false);
    setShowLinkModal(false);
  }, [threadId]);

  useEffect(() => {
    loadThreadData();
    loadLinkedPatients();
    const sub = supabase
      .channel(`thread:${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, appendNewMessage)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [threadId]);

  useEffect(() => {
    if (messages.length > 0) latestMessageAtRef.current = messages[messages.length - 1].created_at;
  }, [messages]);

  // 15-second polling fallback
  useEffect(() => {
    const poll = async () => {
      try {
        const since = latestMessageAtRef.current;
        let query = supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(10);
        if (since) query = (query as any).gt("created_at", since);
        const { data } = await query;
        if (!data || data.length === 0) return;
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newOnes = (data as Message[]).filter((m) => !existingIds.has(m.id));
          if (newOnes.length === 0) return prev;
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          return [...prev, ...newOnes];
        });
      } catch { /* non-critical */ }
    };
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [threadId]);

  useEffect(() => {
    if (prevScrollHeightRef.current && messagesContainerRef.current) {
      const c = messagesContainerRef.current;
      c.scrollTop = c.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [messages]);

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
      if (msgs.length === 0 && (t as any)?.channel === "messenger") autoSyncThread();
    } catch {
      setError("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }

  async function autoSyncThread() {
    setAutoSyncing(true);
    try {
      const res  = await fetch(`/api/admin/sync-thread?thread_id=${threadId}`, { method: "POST" });
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
      } else { setHasMore(false); }
    } finally { setLoadingMore(false); }
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (e.currentTarget.scrollTop < 80) loadMoreMessages();
  }

  async function appendNewMessage() {
    try {
      const newer = await getThreadMessagesPaginated(threadId, 1);
      if (newer.length > 0) {
        setMessages((prev) => {
          if (prev[prev.length - 1]?.id === newer[0].id) return prev;
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
    } finally { setSending(false); }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !thread) return;
    // Reset input so the same file can be re-selected
    e.target.value = "";

    setUploadingFile(true);
    setError(null);
    try {
      // 1. Upload to Supabase Storage
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/messages/upload", { method: "POST", body: form });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url, contentType, name } = await uploadRes.json();

      const attType = getAttachmentType(contentType || file.type);
      const recipientId = thread.external_thread_id || "";

      // 2. Send via Messenger API
      const sendRes = await fetch("/api/webhooks/messenger/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: recipientId, attachment: { type: attType, url } }),
      });
      if (!sendRes.ok) {
        const json = await sendRes.json();
        throw new Error(json.error || "Send failed");
      }

      // 3. Store in messages DB
      await createMessage(threadId, attachmentFallback(attType), "staff", undefined, "text", {
        channel: "messenger",
        recipient: recipientId,
        attachments: [{ type: attType, url, name: name || file.name }],
      });

      // 4. Bump thread last_message_at
      await supabase.from("message_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);
      onThreadUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to send attachment");
    } finally { setUploadingFile(false); }
  }

  async function handleConfirmAppt(date: string, time: string, patientId: string, dentistId?: string, concerns?: string) {
    try {
      setSending(true);
      setError(null);
      const appt = await createAppointment(patientId, date, time, dentistId || null, `Booked via ${thread?.channel}`, threadId, concerns);
      setShowApptModal(false);
      onThreadUpdated();
      const recipientId = thread?.external_thread_id || linkedPatients[0]?.phone || "";
      try {
        await sendAppointmentConfirmation(appt.id, threadId, date, time, thread?.channel as "sms" | "messenger", recipientId);
      } catch {
        setError("Appointment created, but confirmation message failed to send.");
      }
    } catch {
      setError("Failed to create appointment");
    } finally { setSending(false); }
  }

  if (loading)  return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
  if (!thread)  return <div className="flex-1 flex items-center justify-center"><p className="text-sm text-red-500">Failed to load conversation.</p></div>;

  const externalName = thread.external_user_name ?? null;
  const displayName  = externalName ?? linkedPatients[0]?.full_name ?? "Unknown";
  const color        = avatarColor(displayName);
  const initials     = getInitials(displayName);
  const hasPatients  = linkedPatients.length > 0;
  const isMessenger  = thread.channel === "messenger";

  const activePic = isMessenger && thread.external_thread_id && !picError
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
          {/* Avatar + name — tapping opens info panel */}
          <button
            onClick={onOpenInfo}
            disabled={!onOpenInfo}
            className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity disabled:cursor-default disabled:hover:opacity-100"
          >
            {activePic ? (
              <img src={activePic} alt={displayName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" onError={() => setPicError(true)} />
            ) : (
              <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{initials}</div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                {!hasPatients && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Not linked</span>}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {thread.channel.toUpperCase()}
                {linkedPatients[0]?.phone ? ` · ${formatPhoneLocal(linkedPatients[0].phone)}` : ""}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowLinkModal(true)} className="btn btn-secondary text-xs h-8 px-3">
              {hasPatients ? "+ Patient" : "Link Patient"}
            </button>
            {hasPatients && (
              <button onClick={() => setShowApptModal(true)} className="save-btn h-8 px-3 text-xs">New Appointment</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white/40"
      >
        {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}

        {loadingMore && <div className="flex justify-center py-2"><Spinner size="h-4 w-4" /></div>}
        {!loadingMore && hasMore && (
          <button onClick={loadMoreMessages} className="w-full py-2 text-xs text-slate-400 hover:text-violet-600 transition-colors">
            Scroll up or tap to load older messages
          </button>
        )}
        {!hasMore && messages.length > 0 && <p className="text-center text-xs text-slate-300 py-1">Beginning of conversation</p>}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            {autoSyncing ? (
              <><Spinner size="h-5 w-5" /><p className="text-slate-400 text-sm mt-3">Fetching messages from Messenger…</p></>
            ) : (
              <p className="text-slate-400 text-sm">No messages yet</p>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isStaff    = msg.sender_type === "staff";
            const attachments: Attachment[] = (msg.metadata as any)?.attachments ?? [];
            const hasAttachments = attachments.length > 0;
            const isSticker  = attachments.length === 1 && attachments[0].type === "sticker";

            return (
              <div key={msg.id} className={`flex gap-2 ${isStaff ? "justify-end" : "justify-start"}`}>
                {!isStaff && (
                  <div className={`w-7 h-7 rounded-full ${color} flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-0.5`}>
                    {initials}
                  </div>
                )}

                <div className="flex flex-col gap-1.5 max-w-[72%] sm:max-w-xs lg:max-w-sm">

                  {/* Attachments */}
                  {hasAttachments && attachments.map((att, i) => (
                    <div key={i} className={isSticker ? "" : `rounded-2xl px-3 py-2.5 ${
                      isStaff
                        ? "text-white rounded-br-sm"
                        : "bg-white border border-slate-200 shadow-sm rounded-bl-sm"
                    }`}
                      style={(!isSticker && isStaff) ? { background: "hsl(var(--accent-hue) var(--accent-sat) 52%)" } : undefined}
                    >
                      <AttachmentBubble att={att} isStaff={isStaff} onImageClick={setLightboxUrl} />
                    </div>
                  ))}

                  {/* Text (only if non-empty and not a pure fallback-emoji line) */}
                  {msg.content && !hasAttachments && (
                    <div
                      className={`rounded-2xl px-4 py-2.5 ${
                        isStaff
                          ? "text-white rounded-br-sm"
                          : "bg-white text-slate-800 border border-slate-200 shadow-sm rounded-bl-sm"
                      }`}
                      style={isStaff ? { background: "hsl(var(--accent-hue) var(--accent-sat) 52%)" } : undefined}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <p className={`text-[11px] mt-1 ${isStaff ? "text-white/70" : "text-slate-400"}`}>{formatDateTimePH(msg.created_at)}</p>
                    </div>
                  )}

                  {/* Timestamp under attachments */}
                  {hasAttachments && (
                    <p className={`text-[11px] px-1 ${isStaff ? "text-right text-slate-400" : "text-slate-400"}`}>{formatDateTimePH(msg.created_at)}</p>
                  )}
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

          {/* Attachment button — Messenger only */}
          {isMessenger && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile || sending}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 border border-slate-200 transition-colors disabled:opacity-40"
                title="Send image or file"
              >
                {uploadingFile ? <Spinner size="h-4 w-4" /> : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
              </button>
            </>
          )}

          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            disabled={sending || uploadingFile}
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
          <button onClick={handleSend} disabled={!replyText.trim() || sending || uploadingFile} className="save-btn h-10 px-4 flex-shrink-0">
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>

      {/* ── Image lightbox ────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition"
            onClick={() => setLightboxUrl(null)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showApptModal && (
        <AppointmentModal patients={linkedPatients} onConfirm={handleConfirmAppt} onCancel={() => setShowApptModal(false)} isSending={sending} />
      )}
      {showLinkModal && (
        <LinkPatientModal threadId={threadId} externalUserName={thread.external_user_name} onLinked={() => { loadLinkedPatients(); onThreadUpdated(); }} onCancel={() => setShowLinkModal(false)} />
      )}
    </div>
  );
}
