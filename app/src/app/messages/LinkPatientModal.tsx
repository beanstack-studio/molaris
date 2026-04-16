"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Patient } from "@/lib/types";
import { linkThreadToPatient } from "@/lib/messageHelpers";
import { formatPhoneLocal } from "@/lib/helpers";

interface Props {
  threadId: string;
  externalUserName: string | null;
  /** Currently linked patient ID (if any) */
  currentPatientId?: string | null;
  onLinked: () => void;
  onCancel: () => void;
}

export default function LinkPatientModal({
  threadId,
  externalUserName,
  currentPatientId,
  onLinked,
  onCancel,
}: Props) {
  const [patients, setPatients]         = useState<Patient[]>([]);
  const [search, setSearch]             = useState("");
  const [showDrop, setShowDrop]         = useState(false);
  const [selected, setSelected]         = useState<Patient | null>(null);
  const [loading, setLoading]           = useState(true);
  const [linking, setLinking]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [confirmed, setConfirmed]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("patients")
      .select("id, full_name, first_name, last_name, phone")
      .is("deleted_at", null)
      .order("full_name", { ascending: true })
      .then(({ data, error: err }) => {
        if (err) { setError("Failed to load patients"); return; }
        setPatients((data as Patient[]) ?? []);
        // Pre-fill if already linked
        if (currentPatientId) {
          const existing = (data as Patient[]).find((p) => p.id === currentPatientId);
          if (existing) setSelected(existing);
        }
      })
      .finally(() => setLoading(false));
  }, [currentPatientId]);

  const filtered = search.length >= 1
    ? patients.filter((p) => {
        const q = search.toLowerCase();
        return (
          (p.full_name ?? "").toLowerCase().includes(q) ||
          (p.phone ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        );
      })
    : [];

  function pickPatient(p: Patient) {
    setSelected(p);
    setSearch(p.full_name ?? "");
    setShowDrop(false);
    setConfirmed(false);
  }

  async function handleLink() {
    if (!selected) { setError("Please select a patient first"); return; }
    try {
      setLinking(true);
      setError(null);
      await linkThreadToPatient(threadId, selected.id);
      onLinked();
    } catch {
      setError("Failed to link patient. Please try again.");
    } finally {
      setLinking(false);
    }
  }

  const initials = externalUserName
    ? externalUserName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="modal-container">
      <div className="modal-panel">

        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">Link to Patient</h3>
        </div>

        <div className="modal-body">
          {error && <p className="error-banner">{error}</p>}

          {/* Who sent the message */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{externalUserName ?? "Unknown"}</p>
              <p className="text-xs text-slate-400">Messenger</p>
            </div>
          </div>

          {/* Searchable patient picker */}
          <div className="grid gap-1 text-sm">
            <span className="field-label-text">
              {currentPatientId ? "Change linked patient" : "Search patient"}
            </span>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDrop(true); setSelected(null); }}
                onFocus={() => { if (search) setShowDrop(true); }}
                onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                placeholder="Start typing name or phone…"
                className="field-input w-full"
                disabled={loading}
              />

              {showDrop && search.length >= 1 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-violet-100 rounded-xl shadow-lg z-10 max-h-52 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-slate-400 text-center">
                      No patients matching &ldquo;{search}&rdquo;
                    </div>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => pickPatient(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-violet-50 flex items-center justify-between gap-2 border-b border-slate-50 last:border-0"
                      >
                        <span className="text-sm text-slate-800 font-medium">{p.full_name}</span>
                        {p.phone && (
                          <span className="text-xs text-slate-400 flex-shrink-0">{formatPhoneLocal(p.phone)}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected patient confirmation card */}
            {selected && (
              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {selected.full_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{selected.full_name}</p>
                    <p className="text-xs text-slate-400">
                      {selected.phone ? formatPhoneLocal(selected.phone) : "No phone"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelected(null); setSearch(""); inputRef.current?.focus(); }}
                  className="text-slate-300 hover:text-slate-500 text-lg leading-none flex-shrink-0"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Warning */}
          {selected && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-700">
                All messages in this conversation will be associated with{" "}
                <strong>{selected.full_name}</strong>. You can change this later.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onCancel} disabled={linking}>
            Cancel
          </button>
          <button
            className="save-btn"
            onClick={handleLink}
            disabled={!selected || linking}
          >
            {linking ? "Linking…" : currentPatientId ? "Update Link" : "Link Patient"}
          </button>
        </div>
      </div>
    </div>
  );
}
