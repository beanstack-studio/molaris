"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Patient } from "@/lib/types";
import { formatPhoneLocal } from "@/lib/helpers";
import { EditModal } from "@/components/EditModal";

interface LinkedPatient {
  id: string; // thread_patients row id
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
  const [search, setSearch]                 = useState("");
  const [showSearch, setShowSearch]         = useState(false);
  const [showDrop, setShowDrop]             = useState(false);
  const [loadingAll, setLoadingAll]         = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [removing, setRemoving]             = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadLinked = useCallback(async () => {
    const res = await fetch(`/api/thread-patients?thread_id=${threadId}`);
    if (res.ok) setLinkedPatients(await res.json());
  }, [threadId]);

  useEffect(() => {
    // Load all patients (admin API, bypasses RLS)
    fetch("/api/patients")
      .then((r) => r.json())
      .then((data) => setAllPatients(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load patients"))
      .finally(() => setLoadingAll(false));

    loadLinked();
  }, [loadLinked]);

  // Focus search input when it appears
  useEffect(() => {
    if (showSearch) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showSearch]);

  const linkedIds = new Set(linkedPatients.map((lp) => lp.patient_id));

  const filtered = search.length >= 1
    ? allPatients.filter((p) => {
        if (linkedIds.has(p.id)) return false; // already linked
        const q = search.toLowerCase();
        return (
          (p.full_name ?? "").toLowerCase().includes(q) ||
          (p.phone ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        );
      })
    : [];

  async function addPatient(p: Patient) {
    setShowDrop(false);
    setSearch("");
    setShowSearch(false);
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

  const initials = externalUserName
    ? externalUserName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <EditModal open={true} title="Link to Patient" onClose={onCancel}>
      <div className="grid gap-4">
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

        {/* Linked patients list */}
        <div className="grid gap-2">
          {linkedPatients.length > 0 && (
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Linked patients</p>
          )}

          {linkedPatients.map((lp) => {
            const p = lp.patients;
            const initials2 = p.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
            return (
              <div key={lp.patient_id} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials2}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.full_name}</p>
                    <p className="text-xs text-slate-400">{p.phone ? formatPhoneLocal(p.phone) : "No phone"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePatient(lp)}
                  disabled={removing === lp.patient_id}
                  className="text-slate-300 hover:text-red-400 text-lg leading-none flex-shrink-0 disabled:opacity-50 transition-colors"
                  title="Remove link"
                >
                  {removing === lp.patient_id ? "…" : "×"}
                </button>
              </div>
            );
          })}

          {/* Add patient — search or dashed button */}
          {showSearch ? (
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDrop(true); }}
                onBlur={() => setTimeout(() => { setShowDrop(false); if (!search) setShowSearch(false); }, 150)}
                placeholder={loadingAll ? "Loading patients…" : "Search name or phone…"}
                className="input-standard w-full"
                disabled={loadingAll || saving}
              />
              {showDrop && search.length >= 1 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-violet-100 rounded-xl shadow-lg z-10 max-h-52 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-slate-400 text-center">
                      {allPatients.length === 0
                        ? "No patients found in database"
                        : `No patients matching "${search}" (${allPatients.length} total loaded)`}
                    </div>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => addPatient(p)}
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
          ) : (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              disabled={saving || loadingAll}
              className="w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 py-3 text-sm font-medium text-slate-400 hover:text-violet-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Linking…" : linkedPatients.length === 0 ? "+ Link Patient" : "+ Link Another Patient"}
            </button>
          )}
        </div>

        {/* Note */}
        {linkedPatients.length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
            <p className="text-xs text-amber-700">
              {linkedPatients.length === 1
                ? "Messages will be associated with this patient. You can link additional patients above."
                : `${linkedPatients.length} patients are linked to this conversation.`}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button className="cancel-btn" onClick={onCancel}>
            Done
          </button>
        </div>
      </div>
    </EditModal>
  );
}
