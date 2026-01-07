"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
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

  const [name, setName] = useState("");
  const [prc, setPrc] = useState("");

  async function load() {
    setLoading(true);
    const r = await supabase
      .from("dentists")
      .select("id, full_name, prc_number, is_active");
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
        ? b.full_name.localeCompare(a.full_name)
        : a.full_name.localeCompare(b.full_name)
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

  if (loading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Dentists</h1>

      {/* ADD BOX */}
      <div className="mt-4 rounded-xl border bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          Add dentist
        </div>
        <div className="flex items-end gap-2">
          <input
            className="h-10 flex-1 rounded-lg border px-3 text-sm"
            placeholder="Dentist name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="h-10 w-[160px] rounded-lg border px-3 text-sm"
            placeholder="PRC number"
            value={prc}
            onChange={(e) => setPrc(e.target.value)}
          />
          <button
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
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
          >
            <option value="NAME_ASC">Name A–Z</option>
            <option value="NAME_DESC">Name Z–A</option>
          </select>
        </div>

        <div className="divide-y">
          {sorted.map((d) => (
            <div
              key={d.id}
              className={[
                "grid grid-cols-[240px_160px_1fr_120px_80px] items-center px-4 py-2.5 text-sm transition hover:bg-slate-50",
                "hover:bg-slate-50",
                d.is_active ? "" : "opacity-50",
              ].join(" ")}
            >
              <div className="w-[240px] truncate">{d.full_name}</div>
              <div className="w-[160px] text-right">PRC {d.prc_number ?? "—"}</div>

              <div className="ml-auto flex items-center gap-3">
                <TogglePill
                  checked={d.is_active}
                  disabled={busy}
                  onChange={(v) => toggleActive(d.id, v)}
                />
                <button className="rounded-lg border px-3 py-1.5 text-xs font-semibold">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
