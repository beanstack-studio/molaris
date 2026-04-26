"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatPhoneLocal } from "@/lib/helpers";

/* ── Types ──────────────────────────────────────────────── */
interface LinkedPatient {
  id: string;        // patient UUID — sourced from patient_id on the join row
  full_name: string;
}

interface ThreadInfo {
  id: string;
  channel: string;
  external_user_name: string | null;
  external_thread_id: string | null;
  metadata: Record<string, any>;
}
interface AttachmentItem {
  type: string;
  url: string;
  name?: string;
  created_at: string;
}

interface Props {
  threadId: string;
  onBack: () => void;
  refreshKey?: number;
}

/* ══════════════════════════════════════════════════════════ */
export default function ThreadInfoPanel({ threadId, onBack, refreshKey }: Props) {
  const [thread, setThread]               = useState<ThreadInfo | null>(null);
  const [linkedPatients, setLinkedPatients] = useState<LinkedPatient[]>([]);
  const [photos, setPhotos]               = useState<AttachmentItem[]>([]);
  const [files, setFiles]                 = useState<AttachmentItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [picError, setPicError]           = useState(false);
  const [lightbox, setLightbox]           = useState<string | null>(null);
  const [tab, setTab]                     = useState<"photos" | "files">("photos");

  useEffect(() => {
    setLoading(true);
    setPicError(false);
    loadData();
  }, [threadId, refreshKey]);

  async function loadData() {
    try {
      const [threadRes, linkedRes, msgRes] = await Promise.all([
        supabase
          .from("message_threads")
          .select("id, channel, external_user_name, external_thread_id, metadata")
          .eq("id", threadId)
          .single(),
        fetch(`/api/thread-patients?thread_id=${threadId}`),
        supabase
          .from("messages")
          .select("id, created_at, metadata")
          .eq("thread_id", threadId)
          .not("metadata", "is", null)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (threadRes.data) setThread(threadRes.data as ThreadInfo);

      if (linkedRes.ok) {
        const rows: any[] = await linkedRes.json();
        // Build from the flat join-row fields — never trust nested object id
        setLinkedPatients(
          rows
            .filter((r) => r.patient_id)
            .map((r) => {
              const p = Array.isArray(r.patients) ? r.patients[0] : r.patients;
              return {
                id: r.patient_id as string,
                full_name: p?.full_name ?? "Unknown",
              };
            })
        );
      }

      const allPhotos: AttachmentItem[] = [];
      const allFiles:  AttachmentItem[] = [];
      for (const msg of msgRes.data ?? []) {
        const atts: any[] = (msg.metadata as any)?.attachments ?? [];
        for (const a of atts) {
          const item = { type: a.type, url: a.url, name: a.name, created_at: msg.created_at };
          if (a.type === "image" || a.type === "sticker") allPhotos.push(item);
          else allFiles.push(item);
        }
      }
      setPhotos(allPhotos);
      setFiles(allFiles);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }

  const displayName = thread?.external_user_name ?? "Unknown";
  const avatarSrc = thread?.channel === "messenger" && thread.external_thread_id && !picError
    ? `/api/messenger/profile-pic?psid=${encodeURIComponent(thread.external_thread_id)}`
    : null;

  const initials = displayName
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden border-l border-white/60 bg-white/85 backdrop-blur-sm">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-100/80">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="text-sm font-semibold text-slate-700">Details</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <svg className="w-5 h-5 animate-spin text-slate-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          ) : (
            <>
              {/* ── Profile ──────────────────────────────────────── */}
              <div className="flex flex-col items-center px-4 pt-5 pb-4 border-b border-slate-100">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={displayName} className="w-16 h-16 rounded-full object-cover mb-3"
                    onError={() => setPicError(true)} />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-violet-500 flex items-center justify-center text-white text-xl font-bold mb-3">
                    {initials}
                  </div>
                )}
                <p className="text-sm font-bold text-slate-900 text-center">{displayName}</p>
                <span className="mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wide">
                  {thread?.channel}
                </span>
              </div>

              {/* ── Linked patients ───────────────────────────────── */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="dash-month-label mb-2">Linked Patients</p>
                {linkedPatients.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No patients linked</p>
                ) : (
                  <div className="space-y-1.5">
                    {linkedPatients.filter((p) => p.id).map((p) => (
                      <a
                        key={p.id}
                        href={`/patients/${p.id}/info`}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-violet-50 hover:bg-violet-100 hover:text-violet-700 transition-colors group"
                      >
                        <span className="truncate">{p.full_name}</span>
                        <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Media tabs ────────────────────────────────────── */}
              <div className="px-4 pt-3">
                <div className="flex gap-1 p-1 rounded-lg bg-slate-100 mb-3">
                  {(["photos", "files"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors capitalize ${
                        tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {t === "photos" ? `Photos (${photos.length})` : `Files (${files.length})`}
                    </button>
                  ))}
                </div>

                {/* Photos grid */}
                {tab === "photos" && (
                  photos.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8 italic">No photos yet</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      {photos.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => setLightbox(p.url)}
                          className="aspect-square rounded-lg overflow-hidden bg-slate-100 hover:opacity-90 transition-opacity"
                        >
                          <img src={p.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )
                )}

                {/* Files list */}
                {tab === "files" && (
                  files.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8 italic">No files yet</p>
                  ) : (
                    <div className="space-y-1">
                      {files.map((f, i) => (
                        <a
                          key={i}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-50 transition-colors">
                            {f.type === "audio" ? (
                              <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            ) : f.type === "video" ? (
                              <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.72v6.56a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{f.name || f.type}</p>
                            <p className="text-[11px] text-slate-400 capitalize">{f.type}</p>
                          </div>
                          <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition" onClick={() => setLightbox(null)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img src={lightbox} alt="Full size" className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
