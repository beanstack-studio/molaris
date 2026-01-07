"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ServicePriceRow = {
  id: string;
  service_name: string;
  default_price: number;
  item_type: "SERVICE" | "ADD_ON";
  is_active: boolean;
};

type ServiceSort = "NAME_ASC" | "NAME_DESC" | "FEE_ASC" | "FEE_DESC";

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

export default function ServicesSettingsPage() {
  const [rows, setRows] = useState<ServicePriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<ServiceSort>("NAME_ASC");

  // add form
  const [itemType, setItemType] = useState<"SERVICE" | "ADD_ON">("SERVICE");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  async function load() {
    setLoading(true);
    const r = await supabase
      .from("service_prices")
      .select("id, service_name, default_price, item_type, is_active");
    setRows((r.data ?? []) as ServicePriceRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const services = useMemo(() => {
    const out = rows.filter((r) => r.item_type === "SERVICE");
    out.sort((a, b) => {
      if (sort === "NAME_DESC") return b.service_name.localeCompare(a.service_name);
      if (sort === "FEE_ASC") return a.default_price - b.default_price;
      if (sort === "FEE_DESC") return b.default_price - a.default_price;
      return a.service_name.localeCompare(b.service_name);
    });
    return out;
  }, [rows, sort]);

  const addOns = useMemo(() => {
    const out = rows.filter((r) => r.item_type === "ADD_ON");
    out.sort((a, b) => {
      if (sort === "NAME_DESC") return b.service_name.localeCompare(a.service_name);
      if (sort === "FEE_ASC") return a.default_price - b.default_price;
      if (sort === "FEE_DESC") return b.default_price - a.default_price;
      return a.service_name.localeCompare(b.service_name);
    });
    return out;
  }, [rows, sort]);

  async function addItem() {
    if (!name.trim()) return;
    setBusy(true);
    await supabase.from("service_prices").insert({
      service_name: name.trim(),
      default_price: Number(price) || 0,
      item_type: itemType,
      is_active: true,
    });
    setName("");
    setPrice("");
    await load();
    setBusy(false);
  }

  async function toggleActive(id: string, next: boolean) {
    setBusy(true);
    await supabase.from("service_prices").update({ is_active: next }).eq("id", id);
    setRows((p) => p.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
    setBusy(false);
  }

  if (loading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Services</h1>

      {/* ADD BOX */}
      <div className="mt-4 rounded-xl border bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          Add a service / add-on
        </div>      
        <div className="flex items-end gap-2">
          <select
            className="h-10 rounded-lg border px-2 text-sm"
            value={itemType}
            onChange={(e) => setItemType(e.target.value as any)}
          >
            <option value="SERVICE">Service</option>
            <option value="ADD_ON">Add-on</option>
          </select>
          <input
            className="h-10 flex-1 rounded-lg border px-3 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="h-10 w-[140px] rounded-lg border px-3 text-sm"
            placeholder="Fee"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <button
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            onClick={addItem}
            disabled={busy}
          >
            Add
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="mt-4 rounded-xl border bg-white overflow-hidden">
        <div className="flex items-center bg-slate-100 px-4 py-2 text-sm font-semibold">
          <div>Services</div>
          <select
            className="ml-auto h-8 w-40 rounded-lg border bg-white px-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as ServiceSort)}
          >
            <option value="NAME_ASC">Name A–Z</option>
            <option value="NAME_DESC">Name Z–A</option>
            <option value="FEE_ASC">Fee low → high</option>
            <option value="FEE_DESC">Fee high → low</option>
          </select>
        </div>

        <div className="divide-y">
          {services.map((r) => (
            <div
              key={r.id}
              className={[
                "grid grid-cols-[240px_140px_1fr_120px_80px] items-center px-4 py-2.5 text-sm transition hover:bg-slate-50",
                "hover:bg-slate-50",
                r.is_active ? "" : "opacity-50",
              ].join(" ")}
            >
              <div className="w-[240px] truncate">{r.service_name}</div>
              <div className="w-[120px] text-right">PHP {r.default_price.toLocaleString()}</div>

              <div className="ml-auto flex items-center gap-3">
                <TogglePill
                  checked={r.is_active}
                  disabled={busy}
                  onChange={(v) => toggleActive(r.id, v)}
                />
                <button className="rounded-lg border px-3 py-1.5 text-xs font-semibold">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* ADD-ONS TABLE */}
      <div className="mt-6 rounded-xl border bg-white overflow-hidden">
        <div className="flex items-center bg-slate-100 px-4 py-2 text-sm font-semibold">
          <div>Add-ons</div>
          <select
            className="ml-auto h-8 w-40 rounded-lg border bg-white px-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as ServiceSort)}
          >
            <option value="NAME_ASC">Name A–Z</option>
            <option value="NAME_DESC">Name Z–A</option>
            <option value="FEE_ASC">Fee low → high</option>
            <option value="FEE_DESC">Fee high → low</option>
          </select>
        </div>

        <div className="divide-y">
          {addOns.map((r) => (
            <div
              key={r.id}
              className={[
                "grid grid-cols-[240px_140px_1fr_120px_80px]",
                "items-center px-4 py-2.5 text-sm transition hover:bg-slate-50",
                r.is_active ? "" : "opacity-50",
              ].join(" ")}
            >
              {/* Name */}
              <div className="truncate">{r.service_name}</div>

              {/* Fee */}
              <div className="text-right">
                PHP {r.default_price.toLocaleString()}
              </div>

              {/* Spacer */}
              <div />

              {/* Active */}
              <div className="flex justify-center">
                <TogglePill
                  checked={r.is_active}
                  disabled={busy}
                  onChange={(v) => toggleActive(r.id, v)}
                />
              </div>

              {/* Edit */}
              <div className="flex justify-end">
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
