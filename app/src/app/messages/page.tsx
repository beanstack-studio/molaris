"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { MessageThread, Patient } from "@/lib/types";
import ChatWindow from "./ChatWindow";
import { Spinner } from "@/components/Spinner";

// ── Helpers ──────────────────────────────────────────────────────────────────

function channelBadge(channel: string) {
  const map: Record<string, { label: string; cls: string }> = {
    sms:       { label: "SMS", cls: "bg-violet-100 text-violet-700" },
    messenger: { label: "FB",  cls: "bg-blue-100 text-blue-700" },
    whatsapp:  { label: "WA",  cls: "bg-green-100 text-green-700" },
    email:     { label: "Email", cls: "bg-slate-100 text-slate-500" },
  };
  const cfg = map[channel] ?? map.sms;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function ThreadAvatar({ name }: { name: string | null }) {
  const palette = [
    "bg-violet-500", "bg-blue-500", "bg-indigo-500", "bg-pink-500",
    "bg-teal-500",   "bg-amber-500", "bg-green-500", "bg-rose-500",
  ];
  const seed = name ?? "?";
  const color = palette[seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
      {initials}
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

type Thread = MessageThread & { patients: Patient | null };

export default function MessagesPage() {
  const router = useRouter();
  const [threads, setThreads]             = useState<Thread[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [showChat, setShowChat]           = useState(false); // mobile toggle

  // Redirect to settings if Messenger is not connected
  useEffect(() => {
    supabase.from("facebook_pages").select("page_id").maybeSingle().then(({ data }) => {
      if (!data) router.replace("/settings/website-controls");
    });
  }, [router]);

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("message_threads")
        .select("*, patients(id, full_name, phone, email)")
        .is("deleted_at", null)
        .order("last_message_at", { ascending: false });
      if (err) throw err;
      setThreads((data as Thread[]) ?? []);
    } catch {
      setError("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Auto-select first thread on desktop after load
  useEffect(() => {
    if (!selectedId && threads.length > 0) setSelectedId(threads[0].id);
  }, [threads, selectedId]);

  // Realtime: refresh thread list on any change
  useEffect(() => {
    const sub = supabase
      .channel("msg_threads_list")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_threads" }, loadThreads)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [loadThreads]);

  function selectThread(id: string) {
    setSelectedId(id);
    setShowChat(true);
  }

  function getDisplayName(t: Thread) {
    return t.patients?.full_name ?? t.external_user_name ?? "Unknown";
  }

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
        <div className="px-4 py-4 border-b border-slate-100/80 flex-shrink-0">
          <h1 className="card-title leading-tight">Messages</h1>
          <p className="text-xs text-slate-400 mt-0.5">SMS &amp; Messenger inbox</p>
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
          ) : (
            threads.map((t) => {
              const name    = getDisplayName(t);
              const active  = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  className={[
                    "w-full px-4 py-3 text-left flex items-center gap-3 transition-colors",
                    "border-b border-slate-100/60 border-l-2",
                    active
                      ? "bg-violet-50 border-l-violet-500"
                      : "border-l-transparent hover:bg-white/60",
                  ].join(" ")}
                >
                  <ThreadAvatar name={name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold truncate ${active ? "text-violet-700" : "text-slate-800"}`}>
                        {name}
                      </p>
                      {t.last_message_at && (
                        <span className="text-[11px] text-slate-400 flex-shrink-0">
                          {relativeTime(t.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {channelBadge(t.channel)}
                      {!t.patient_id && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                          Unlinked
                        </span>
                      )}
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
