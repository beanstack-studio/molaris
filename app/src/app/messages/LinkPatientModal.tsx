"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Patient } from "@/lib/types";
import { combineFullName, formatPhoneLocal } from "@/lib/helpers";
import { EditModal } from "@/components/EditModal";

interface LinkedPatient {
  id: string;
  patient_id: string;
  patients: Patient;
}

interface Props {
  threadId: string;
  externalUserName: string | null;
  onLinked: () => void;
  onCancel: () => void;
}

export default function LinkPatientModal({ threadId, externalUserName, onLinked, onCancel }: Props) {
  const [allPatients, setAllPatients]       = useState<Patient[]>([]);
  const [linkedPatients, setLinkedPatients] = useState<LinkedPatient[]>([]);
  const [addingRow, setAddingRow]           = useState(false);
  const [search, setSearch]                 = useState("");
  const [saving, setSaving]                 = useState(false);
  const [removing, setRemoving]             = useState<string | null>(null);
  const [loadingAll, setLoadingAll]         = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadLinked = useCallback(async () => {
    const res = await fetch(`/api/thread-patients?thread_id=${threadId}`);
    if (res.ok) setLinkedPatients(await res.json());
  }, [threadId]);

  // Paginated load — exact same logic as CreateAppointmentModal / appointments page
  useEffect(() => {
    (async () => {
      try {
        let all: Patient[] = [];
        let offset = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error: err } = await supabase
            .from("patients")
            .select("id, full_name, first_name, last_name, phone")
            .range(offset, offset + pageSize - 1);
          if (err || !data || data.length === 0) break;
          const normalized = data.map((p: any) => ({
            ...p,
            full_name: p.full_name?.trim() || combineFullName(p.first_name, p.last_name),
          }));
          all = [...all, ...normalized];
          if (data.length < 1000) break;
          offset += data.length;
        }
        all.sort((a, b) => {
          const al = (a.last_name ?? "").toLowerCase();
          const bl = (b.last_name ?? "").toLowerCase();
          if (al !== bl) return al.localeCompare(bl);
          return (a.first_name ?? "").toLowerCase().localeCompare((b.first_name ?? "").toLowerCase());
        });
        setAllPatients(all);
      } catch {
        setAllPatients([]);
      } finally {
        setLoadingAll(false);
      }
    })();
    loadLinked();
  }, [loadLinked]);

  // Focus search input when row opens
  useEffect(() => {
    if (addingRow) setTimeout(() => inputRef.current?.focus(), 50);
  }, [addingRow]);

  const linkedIds = new Set(linkedPatients.map((lp) => lp.patient_id));

  // Exact same filter as CreateAppointmentModal
  const filtered = search.length >= 3
    ? allPatients.filter((p) => {
        if (linkedIds.has(p.id)) return false;
        const q     = search.toLowerCase();
        const full  = (p.full_name ?? "").toLowerCase();
        const first = (p.first_name ?? "").toLowerCase();
        const last  = (p.last_name ?? "").toLowerCase();
        return full.includes(q) || first.includes(q) || last.includes(q);
      })
    : [];

  async function addPatient(p: Patient) {
    setSearch("");
    setAddingRow(false);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/thread-patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, patient_id: p.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to link");
      await loadLinked();
      onLinked();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removePatient(lp: LinkedPatient) {
    setRemoving(lp.patient_id);
    setError(null);
    try {
      const res = await fetch("/api/thread-patients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, patient_id: lp.patient_id }),
      });
      if (!res.ok) throw new Error("Failed to unlink");
      await loadLinked();
      onLinked();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRemoving(null);
    }
  }

  function cancelAdd() {
    setAddingRow(false);
    setSearch("");
  }

  const initials = externalUserName
    ? externalUserName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <EditModal open={true} title="Link to Patient" onClose={onCancel}>
      <div className="grid gap-3">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Messenger sender */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{externalUserName ?? "Unknown"}</p>
            <p className="text-xs text-slate-400">Messenger</p>
          </div>
        </div>

        {/* Linked patients — one row per patient [name · 80%] [Unlink · 20%] */}
        {linkedPatients.length > 0 && (
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Linked patients ({linkedPatients.length}/5)
          </p>
        )}
        {linkedPatients.map((lp) => (
          <div key={lp.patient_id} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{lp.patients.full_name}</p>
              {lp.patients.phone && (
                <p className="text-xs text-slate-400">{formatPhoneLocal(lp.patients.phone)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removePatient(lp)}
              disabled={removing === lp.patient_id}
              className="flex-shrink-0 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {removing === lp.patient_id ? "…" : "Unlink"}
            </button>
          </div>
        ))}

        {/* Search row — appears only after clicking + Link Patient */}
        {addingRow && (
          <div>
            {/* [search 80%] [Cancel 20%] */}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={loadingAll ? "Loading patients…" : "Start typing to search"}
                className="input-standard flex-[4]"
                disabled={loadingAll || saving}
              />
              <button
                type="button"
                onClick={cancelAdd}
                className="flex-[1] text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 py-2.5 rounded-lg transition-colors text-center"
              >
                Cancel
              </button>
            </div>

            {/* Inline results (no absolute — avoids overflow clipping) */}
            {search.length >= 3 && (
              <div className="mt-1 bg-white border border-violet-100 rounded-xl shadow-sm max-h-48 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-slate-400 text-center">
                    No patients matching &ldquo;{search}&rdquo;
                  </div>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addPatient(p)}
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
            {search.length > 0 && search.length < 3 && (
              <p className="text-xs text-slate-400 mt-1 px-1">Type at least 3 characters to search</p>
            )}
          </div>
        )}

        {/* + Link Patient — always visible when slots remain */}
        {linkedPatients.length < 5 && (
          <button
            type="button"
            onClick={() => { if (!addingRow) setAddingRow(true); }}
            disabled={saving || loadingAll || addingRow}
            className="w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 py-3 text-sm font-medium text-slate-400 hover:text-violet-600 transition-colors disabled:opacity-50"
          >
            {saving ? "Linking…" : loadingAll ? "Loading…" : "+ Link Patient"}
          </button>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button className="cancel-btn" onClick={onCancel}>Done</button>
        </div>
      </div>
    </EditModal>
  );
}
