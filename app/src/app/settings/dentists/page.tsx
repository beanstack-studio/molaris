"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";

type DentistRow = {
  id: string;
  full_name: string;
  prc_number: string | null;
  is_active: boolean;
};

type DentistSort = "NAME_ASC" | "NAME_DESC";

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16">
      <img src="/loading.gif" alt="Loading" className="h-12 w-12 opacity-70" />
    </div>
  );
}

function TogglePill({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full transition",
        checked ? "bg-emerald-500" : "bg-slate-300",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
      aria-label={checked ? "Active" : "Inactive"}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-white transition",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

export default function DentistsSettingsPage() {
  const [rows, setRows] = useState<DentistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<DentistSort>("NAME_ASC");

  // Add form
  const [name, setName] = useState("");
  const [prc, setPrc] = useState("");

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<DentistRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrc, setEditPrc] = useState("");
  const [deleteText, setDeleteText] = useState("");

  async function load() {
    setLoading(true);
    const r = await supabase
      .from("dentists")
      .select("id, full_name, prc_number, is_active")
      .order("full_name", { ascending: true });
    setRows((r.data ?? []) as DentistRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) =>
      sort === "NAME_DESC"
        ? (b.full_name ?? "").localeCompare(a.full_name ?? "")
        : (a.full_name ?? "").localeCompare(b.full_name ?? "")
    );
    return out;
  }, [rows, sort]);

  async function addDentist() {
    if (!name.trim()) return;

    setBusy(true);
    await supabase.from("dentists").insert({
      full_name: name.trim(),
      prc_number: prc.trim() || null,
      is_active: true,
    });

    setName("");
    setPrc("");
    await load();
    setBusy(false);
  }

  async function toggleActive(id: string, next: boolean) {
    setBusy(true);
    await supabase.from("dentists").update({ is_active: next }).eq("id", id);
    setRows((p) => p.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
    setBusy(false);
  }

  function openEdit(r: DentistRow) {
    setEditRow(r);
    setEditName(r.full_name ?? "");
    setEditPrc(r.prc_number ?? "");
    setDeleteText("");
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditRow(null);
    setDeleteText("");
  }

  async function saveEdit() {
    if (!editRow) return;
    if (!editName.trim()) return;

    setBusy(true);
    await supabase
      .from("dentists")
      .update({
        full_name: editName.trim(),
        prc_number: editPrc.trim() || null,
      })
      .eq("id", editRow.id);

    await load();
    setBusy(false);
    closeEdit();
  }

  async function deleteDentist() {
    if (!editRow) return;
    if (deleteText !== "DELETE") return;

    setBusy(true);
    await supabase.from("dentists").delete().eq("id", editRow.id);
    await load();
    setBusy(false);
    closeEdit();
  }

  if (loading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Dentists</h1>

      {/* ADD BOX */}
      <div className="mt-4 rounded-xl border bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-slate-700">Add dentist</div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input
            className="h-10 w-full rounded-lg border px-3 text-sm sm:flex-1"
            placeholder="Dentist name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />

          <input
            className="h-10 w-full rounded-lg border px-3 text-sm sm:w-[200px]"
            placeholder="PRC number"
            value={prc}
            onChange={(e) => setPrc(e.target.value)}
            disabled={busy}
          />

          <button
            type="button"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            onClick={addDentist}
            disabled={busy}
          >
            Add
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="mt-4 rounded-xl border bg-white overflow-hidden">
        <div className="flex items-center bg-slate-100 px-4 py-2 text-sm font-semibold">
          <div>Dentists</div>

          <select
            className="ml-auto h-8 w-40 rounded-lg border bg-white px-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as DentistSort)}
            disabled={busy}
          >
            <option value="NAME_ASC">Name A–Z</option>
            <option value="NAME_DESC">Name Z–A</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[640px] divide-y">
            {sorted.map((d) => (
              <div
                key={d.id}
                className={[
                  "grid grid-cols-[240px_160px_1fr_120px_80px] items-center px-4 py-2.5 text-sm transition",
                  "hover:bg-slate-50",
                  d.is_active ? "" : "opacity-50",
                ].join(" ")}
              >
                <div className="truncate">{d.full_name}</div>

                <div className="text-right">PRC {d.prc_number ?? "—"}</div>

                <div />

                <div className="flex justify-center">
                  <TogglePill
                    checked={d.is_active}
                    disabled={busy}
                    onChange={(v) => toggleActive(d.id, v)}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-60"
                    onClick={() => openEdit(d)}
                    disabled={busy}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}

            {sorted.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">No dentists yet.</div>
            ) : null}
          </div>
        </div>
      </div>

      <EditModal open={editOpen} title="Edit dentist" onClose={closeEdit}>
        {!editRow ? null : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Full name</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">PRC number</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={editPrc}
                onChange={(e) => setEditPrc(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                onClick={closeEdit}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={saveEdit}
                disabled={busy || !editName.trim()}
              >
                Save
              </button>
            </div>

            <div className="delete-confirmation">
              <div className="delete-confirmation-title text-red-700">Delete dentist?</div>
              <div className="delete-confirmation-hint">
                Type <span className="delete-confirmation-code">DELETE</span> to confirm deletion
              </div>
              <input
                className="delete-confirmation-input"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="DELETE"
                disabled={busy}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="delete-btn"
                onClick={deleteDentist}
                disabled={busy || deleteText !== "DELETE"}
              >
                Delete
              </button>
              <div className="modal-actions-right">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeEdit}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
                  onClick={saveEdit}
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </EditModal>
    </div>
  );
}
