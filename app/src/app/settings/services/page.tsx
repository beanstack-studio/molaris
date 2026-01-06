"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ServicePriceRow = {
  id: string;
  service_name: string;
  default_price: number;
  item_type: "SERVICE" | "ADD_ON";
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

function num(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export default function ServicesSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<ServicePriceRow[]>([]);

  // Add form
  const [itemType, setItemType] = useState<"SERVICE" | "ADD_ON">("SERVICE");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  const services = useMemo(
    () =>
      rows
        .filter((r) => r.item_type === "SERVICE")
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.service_name.localeCompare(b.service_name)),
    [rows]
  );

  const addons = useMemo(
    () =>
      rows
        .filter((r) => r.item_type === "ADD_ON")
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.service_name.localeCompare(b.service_name)),
    [rows]
  );

  async function load() {
    setLoading(true);
    setErr(null);

    const sm = await supabase
      .from("service_prices")
      .select("id, service_name, default_price, item_type, is_active, sort_order, created_at")
      .order("item_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("service_name", { ascending: true });

    if (sm.error) {
      setRows([]);
      setErr(sm.error.message);
    } else {
      setRows((sm.data ?? []) as ServicePriceRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem() {
    setBusy(true);
    setErr(null);

    const p = Number(price);
    const s = Number(sortOrder);

    if (!name.trim()) {
      setBusy(false);
      setErr("Name is required.");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      setBusy(false);
      setErr("Enter a valid price.");
      return;
    }

    const res = await supabase.from("service_prices").insert({
      service_name: name.trim(),
      default_price: p,
      item_type: itemType,
      is_active: active,
      sort_order: Number.isFinite(s) ? s : 0,
    });

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setName("");
    setPrice("");
    setItemType("SERVICE");
    setActive(true);
    setSortOrder("0");

    await load();
  }

  async function toggleActive(id: string, next: boolean) {
    setBusy(true);
    setErr(null);

    const res = await supabase.from("service_prices").update({ is_active: next }).eq("id", id);

    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
  }

  async function updateSort(id: string, nextSort: number) {
    setBusy(true);
    setErr(null);

    const res = await supabase.from("service_prices").update({ sort_order: nextSort }).eq("id", id);

    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, sort_order: nextSort } : r)));
  }

  async function updatePrice(id: string, nextPrice: number) {
    setBusy(true);
    setErr(null);

    const res = await supabase.from("service_prices").update({ default_price: nextPrice }).eq("id", id);

    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, default_price: nextPrice } : r)));
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

    const res = await supabase.from("service_prices").update({ service_name: cleaned }).eq("id", id);

    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, service_name: cleaned } : r)));
  }

  async function deleteItem(id: string, label: string) {
    const ok = window.confirm(`Delete "${label}"? This cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    setErr(null);

    const res = await supabase.from("service_prices").delete().eq("id", id);

    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading…</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Settings · Services</h1>
            <p className="text-sm text-slate-600">
              Manage your clinic’s service menu (services + add-ons). Treatments will use this dropdown.
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
          <div className="text-sm font-semibold">Add menu item</div>

          <div className="mt-3 grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium">Type</label>
              <select
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                value={itemType}
                onChange={(e) => setItemType(e.target.value as any)}
                disabled={busy}
              >
                <option value="SERVICE">Service</option>
                <option value="ADD_ON">Add-on</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-medium">Name</label>
              <input
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Oral prophylaxis"
                disabled={busy}
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-sm font-medium">Price (PHP)</label>
              <input
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
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

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Active</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={busy}
                />
                <span className="text-sm text-slate-700">{active ? "Active" : "Inactive"}</span>
              </div>
            </div>

            <div className="sm:col-span-4 flex items-end justify-end">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={busy}
                onClick={addItem}
              >
                {busy ? "Saving…" : "Add item"}
              </button>
            </div>
          </div>
        </div>

        {/* Lists */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MenuList
            title="Services"
            items={services}
            busy={busy}
            onToggleActive={toggleActive}
            onUpdateSort={updateSort}
            onUpdatePrice={updatePrice}
            onUpdateName={updateName}
            onDelete={deleteItem}
          />

          <MenuList
            title="Add-ons"
            items={addons}
            busy={busy}
            onToggleActive={toggleActive}
            onUpdateSort={updateSort}
            onUpdatePrice={updatePrice}
            onUpdateName={updateName}
            onDelete={deleteItem}
          />
        </div>
      </div>
    </main>
  );
}

function MenuList({
  title,
  items,
  busy,
  onToggleActive,
  onUpdateSort,
  onUpdatePrice,
  onUpdateName,
  onDelete,
}: {
  title: string;
  items: ServicePriceRow[];
  busy: boolean;
  onToggleActive: (id: string, next: boolean) => void;
  onUpdateSort: (id: string, nextSort: number) => void;
  onUpdatePrice: (id: string, nextPrice: number) => void;
  onUpdateName: (id: string, nextName: string) => void;
  onDelete: (id: string, label: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">{title} ({items.length})</div>

      {items.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-600">No items yet.</div>
      ) : (
        <div className="divide-y">
          {items.map((r) => (
            <div key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-[240px] flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold"
                      defaultValue={r.service_name}
                      disabled={busy}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== r.service_name) onUpdateName(r.id, next);
                      }}
                    />
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Price (PHP)</label>
                      <input
                        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        defaultValue={String(num(r.default_price))}
                        disabled={busy}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && Math.round(v * 100) !== Math.round(num(r.default_price) * 100)) {
                            onUpdatePrice(r.id, v);
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600">Sort</label>
                      <input
                        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        defaultValue={String(r.sort_order ?? 0)}
                        disabled={busy}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v !== (r.sort_order ?? 0)) onUpdateSort(r.id, v);
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600">Active</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!r.is_active}
                          disabled={busy}
                          onChange={(e) => onToggleActive(r.id, e.target.checked)}
                        />
                        <span className="text-sm text-slate-700">{r.is_active ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => onDelete(r.id, r.service_name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
