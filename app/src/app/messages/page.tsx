"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { MessageThread } from "@/lib/types";
import ChatWindow from "./ChatWindow";
import { Spinner } from "@/components/Spinner";

// ── Helpers ──────────────────────────────────────────────────────────────────

function channelBadge(channel: string) {
  if (channel === "messenger") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
          <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.327 5.502 3.414 7.271V22l3.107-1.707A11.05 11.05 0 0012 20.486c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.07 12.447l-2.545-2.713-4.963 2.713 5.461-5.797 2.607 2.713 4.9-2.713-5.46 5.797z"/>
        </svg>
        Messenger
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string }> = {
    sms:      { label: "SMS",   cls: "bg-violet-100 text-violet-700" },
    whatsapp: { label: "WA",    cls: "bg-green-100 text-green-700" },
    email:    { label: "Email", cls: "bg-slate-100 text-slate-500" },
  };
  const cfg = map[channel] ?? map.sms;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const CHANNEL_BADGE: Record<string, { bg: string; icon: React.ReactNode }> = {
  messenger: {
    bg: "bg-blue-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-2 h-2">
        <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.327 5.502 3.414 7.271V22l3.107-1.707A11.05 11.05 0 0012 20.486c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.07 12.447l-2.545-2.713-4.963 2.713 5.461-5.797 2.607 2.713 4.9-2.713-5.46 5.797z"/>
      </svg>
    ),
  },
  sms: {
    bg: "bg-violet-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-2 h-2">
        <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
      </svg>
    ),
  },
};

function ThreadAvatar({ name, channel, psid }: { name: string | null; channel: string; psid?: string | null }) {
  const [imgError, setImgError] = React.useState(false);
  const palette = [
    "bg-violet-500", "bg-blue-500", "bg-indigo-500", "bg-pink-500",
    "bg-teal-500",   "bg-amber-500", "bg-green-500", "bg-rose-500",
  ];
  const seed = name ?? "?";
  const color = palette[seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const badge = CHANNEL_BADGE[channel];
  // Use profile-pic proxy for messenger threads (always fresh, never expires)
  const picSrc = channel === "messenger" && psid && !imgError
    ? `/api/messenger/profile-pic?psid=${encodeURIComponent(psid)}`
    : null;
  return (
    <div className="relative flex-shrink-0">
      {picSrc ? (
        <img
          src={picSrc}
          alt={name ?? "User"}
          className="w-10 h-10 rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold`}>
          {initials}
        </div>
      )}
      {badge && (
        <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${badge.bg} border-2 border-white flex items-center justify-center text-white`}>
          {badge.icon}
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return d.toLocaleDateString("en-PH", { weekday: "short" });
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// ── Main component ────────────────────────────────────────────────────────────

type Thread = MessageThread;

export default function MessagesPage() {
  const router = useRouter();
  const [threads, setThreads]             = useState<Thread[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [showChat, setShowChat]           = useState(false); // mobile toggle
  const [syncing, setSyncing]             = useState(false);
  const [syncResult, setSyncResult]       = useState<string | null>(null);
  const [search, setSearch]               = useState("");

  // Redirect to settings if Messenger is not connected
  useEffect(() => {
    supabase.from("facebook_pages").select("page_id").maybeSingle().then(({ data }) => {
      if (!data) router.replace("/settings/website-controls");
    });
  }, [router]);

  // Fetch threads from DB — silent=true skips the full-page spinner (used for realtime refreshes)
  const fetchThreads = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data, error: err } = await supabase
        .from("message_threads")
        .select("*")
        .is("deleted_at", null)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (err) throw err;
      setThreads((data as Thread[]) ?? []);
    } catch {
      if (!silent) setError("Failed to load messages");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Alias used by Load Threads button and other explicit refreshes
  const loadThreads = useCallback(() => fetchThreads(false), [fetchThreads]);

  useEffect(() => { fetchThreads(false); }, [fetchThreads]);

  // Auto-select first thread on desktop after load
  useEffect(() => {
    if (!selectedId && threads.length > 0) setSelectedId(threads[0].id);
  }, [threads, selectedId]);

  // Realtime: silent refresh when message_threads OR messages change
  useEffect(() => {
    const silentRefresh = () => fetchThreads(true);
    const sub = supabase
      .channel("msg_threads_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_threads" }, silentRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, silentRefresh)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [fetchThreads]);

  async function loadAllThreads() {
    setSyncing(true);
    setSyncResult("Connecting to Facebook…");
    try {
      const res = await fetch("/api/admin/load-threads-stream", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start stream");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) { setSyncResult(`Error: ${data.error}`); return; }
            if (data.total != null) {
              setSyncResult(
                data.done
                  ? `Done — loaded ${data.upserted} threads`
                  : `Loading threads… ${data.upserted} / ${data.total}`
              );
            }
          } catch { /* ignore malformed line */ }
        }
      }
    } catch (e: any) {
      setSyncResult(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  function selectThread(id: string) {
    setSelectedId(id);
    setShowChat(true);
  }

  function getDisplayName(t: Thread) {
    return t.external_user_name ?? "Unknown";
  }

  const filteredThreads = search.trim().length === 0
    ? threads
    : threads.filter((t) => {
        const q = search.toLowerCase();
        return (t.external_user_name ?? "").toLowerCase().includes(q);
      });

  return (
    // Fill viewport below sticky TopNav (3.5rem ≈ 56 px)
    <div className="flex overflow-hidden" style={{ height: "calc(100dvh - 3.5rem)" }}>

      {/* ── Thread list sidebar ──────────────────────────────────── */}
      <aside className={[
        "flex-col flex-shrink-0 border-r border-white/60 bg-white/85 backdrop-blur-sm",
        "w-full md:w-72 lg:w-80",
        showChat ? "hidden md:flex" : "flex",
      ].join(" ")}>

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100/80 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h1 className="card-title leading-tight">Messages</h1>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={loadAllThreads}
                disabled={syncing}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                title="Load all threads from Facebook (streams in — no page refresh needed)"
              >
                <svg className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncing ? "Loading…" : "Load Threads"}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">SMS &amp; Messenger inbox</p>
          {syncResult && (
            <p className={`text-xs mt-1.5 font-medium ${syncResult.startsWith("Error") ? "text-red-500" : "text-emerald-600"}`}>
              {syncResult}
            </p>
          )}
          {/* Search */}
          <div className="relative mt-2">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white/80 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner size="h-7 w-7" />
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-red-600">{error}</p>
          ) : threads.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Messages from SMS &amp; Messenger will appear here
              </p>
            </div>
          ) : filteredThreads.length === 0 && search ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">No results for &ldquo;{search}&rdquo;</p>
          ) : (
            filteredThreads.map((t) => {
              const name    = getDisplayName(t);
              const active  = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  className={[
                    "w-full px-4 py-3 text-left flex items-center gap-3 transition-colors",
                    "border-b border-slate-100/60 border-l-[3px]",
                    active
                      ? "bg-violet-100 border-l-violet-600 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.08)]"
                      : "border-l-transparent hover:bg-white/60",
                  ].join(" ")}
                >
                  <ThreadAvatar name={name} channel={t.channel} psid={t.external_thread_id} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${active ? "text-violet-800 font-bold" : (t.unread_count ?? 0) > 0 ? "text-slate-900 font-bold" : "text-slate-700 font-normal"}`}>
                        {name}
                      </p>
                      {t.last_message_at && (
                        <span className={`text-[11px] flex-shrink-0 ${active ? "text-violet-500" : "text-slate-400"}`}>
                          {relativeTime(t.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {channelBadge(t.channel)}
                      {(t.unread_count ?? 0) > 0 && (
                        <span className="ml-auto bg-violet-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                          {t.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Chat area ────────────────────────────────────────────── */}
      <main className={[
        "flex-1 flex-col overflow-hidden bg-white/70 backdrop-blur-sm",
        showChat ? "flex" : "hidden md:flex",
      ].join(" ")}>
        {selectedId ? (
          <ChatWindow
            threadId={selectedId}
            onThreadUpdated={loadThreads}
            onBack={() => setShowChat(false)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="font-semibold text-slate-700">Select a conversation</p>
              <p className="text-sm text-slate-400 mt-1">
                Messages from SMS &amp; Messenger will appear here
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
