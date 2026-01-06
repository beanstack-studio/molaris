"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DentistRow = {
  id: string;
  full_name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export default function DentistsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<DentistRow[]>([]);

  // Add form
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  const sorted = useMemo(() => {
    return [...rows].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.full_name.localeCompare(b.full_name)
    );
  }, [rows]);

  async function load() {
    setLoading(true);
    setErr(null);

    const r = await supabase
      .from("dentists")
      .select("id, full_name, is_active, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });

    if (r.error) {
      setRows([]);
      setErr(r.error.message);
    } else {
      setRows((r.data ?? []) as DentistRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addDentist() {
    setBusy(true);
    setErr(null);

    const cleaned = name.trim();
    const s = Number(sortOrder);

    if (!cleaned) {
      setBusy(false);
      setErr("Name is required.");
      return;
    }

    const r = await supabase.from("dentists").insert({
      full_name: cleaned,
      is_active: active,
      sort_order: Number.isFinite(s) ? s : 0,
    });

    setBusy(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }

    setName("");
    setActive(true);
    setSortOrder("0");
    await load();
  }

  async function toggleActive(id: string, next: boolean) {
    setBusy(true);
    setErr(null);

    const r = await supabase.from("dentists").update({ is_active: next }).eq("id", id);

    setBusy(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }

    setRows((prev) => prev.map((d) => (d.id === id ? { ...d, is_active: next } : d)));
  }

  async function updateSort(id: string, nextSort: number) {
    setBusy(true);
    setErr(null);

    const r = await supabase.from("dentists").update({ sort_order: nextSort }).eq("id", id);

    setBusy(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }

    setRows((prev) => prev.map((d) => (d.id === id ? { ...d, sort_order: nextSort } : d)));
  }

  async function updateName(id: string, nextName: string) {
    setBusy(true);
    setErr(null);

    const cleaned = nextName.trim();
    if (!cleaned) {
      setBusy(false);
      setErr("Name cannot be empty.");
      return;
    }

    const r = await supabase.from("dentists").update({ full_name: cleaned }).eq("id", id);

    setBusy(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }

    setRows((prev) => prev.map((d) => (d.id === id ? { ...d, full_name: cleaned } : d)));
  }

  async function deleteDentist(id: string, label: string) {
    const ok = window.confirm(`Delete "${label}"? This cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    setErr(null);

    const r = await supabase.from("dentists").delete().eq("id", id);

    setBusy(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }

    setRows((prev) => prev.filter((d) => d.id !== id));
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading…</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Settings · Dentists</h1>
            <p className="text-sm text-slate-600">
              Dentist dropdown options used across the app.
            </p>
          </div>

          <button
            type="button"
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
            disabled={busy}
            onClick={load}
          >
            Refresh
          </button>
        </div>

        {err ? <div className="mt-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        {/* Add form */}
        <div className="mt-4 rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold">Add dentist</div>

          <div className="mt-3 grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-4">
              <label className="block text-sm font-medium">Full name</label>
              <input
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dr. Firstname Lastname"
                disabled={busy}
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-sm font-medium">Sort</label>
              <input
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
                disabled={busy}
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-sm font-medium">Active</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={busy}
                />
                <span className="text-sm text-slate-700">{active ? "Active" : "Inactive"}</span>
              </div>
            </div>

            <div className="sm:col-span-6 flex items-end justify-end">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={busy}
                onClick={addDentist}
              >
                {busy ? "Saving…" : "Add dentist"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border bg-white overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">Dentists ({sorted.length})</div>

          {sorted.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600">No dentists yet.</div>
          ) : (
            <div className="divide-y">
              {sorted.map((d) => (
                <div key={d.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-[240px] flex-1">
                      <input
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold"
                        defaultValue={d.full_name}
                        disabled={busy}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next && next !== d.full_name) updateName(d.id, next);
                        }}
                      />

                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600">Sort</label>
                          <input
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                            defaultValue={String(d.sort_order ?? 0)}
                            disabled={busy}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v !== (d.sort_order ?? 0)) updateSort(d.id, v);
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600">Active</label>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!d.is_active}
                              disabled={busy}
                              onChange={(e) => toggleActive(d.id, e.target.checked)}
                            />
                            <span className="text-sm text-slate-700">{d.is_active ? "Active" : "Inactive"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      disabled={busy}
                      onClick={() => deleteDentist(d.id, d.full_name)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
