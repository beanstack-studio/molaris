"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";

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

function sortRows(list: ServicePriceRow[], sort: ServiceSort) {
  const out = [...list];
  out.sort((a, b) => {
    if (sort === "NAME_DESC") return b.service_name.localeCompare(a.service_name);
    if (sort === "FEE_ASC") return a.default_price - b.default_price;
    if (sort === "FEE_DESC") return b.default_price - a.default_price;
    return a.service_name.localeCompare(b.service_name);
  });
  return out;
}

export default function ServicesSettingsPage() {
  const [rows, setRows] = useState<ServicePriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<ServiceSort>("NAME_ASC");

  // Add form
  const [itemType, setItemType] = useState<"SERVICE" | "ADD_ON">("SERVICE");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ServicePriceRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [deleteText, setDeleteText] = useState("");

  async function load() {
    setLoading(true);
    const r = await supabase
      .from("service_prices")
      .select("id, service_name, default_price, item_type, is_active")
      .order("service_name", { ascending: true });

    setRows((r.data ?? []) as ServicePriceRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const services = useMemo(
    () => sortRows(rows.filter((r) => r.item_type === "SERVICE"), sort),
    [rows, sort]
  );

  const addOns = useMemo(
    () => sortRows(rows.filter((r) => r.item_type === "ADD_ON"), sort),
    [rows, sort]
  );

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

  function openEdit(r: ServicePriceRow) {
    setEditRow(r);
    setEditName(r.service_name ?? "");
    setEditPrice(String(r.default_price ?? 0));
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
      .from("service_prices")
      .update({
        service_name: editName.trim(),
        default_price: Number(editPrice) || 0,
      })
      .eq("id", editRow.id);

    await load();
    setBusy(false);
    closeEdit();
  }

  async function deleteItem() {
    if (!editRow) return;
    if (deleteText !== "DELETE") return;

    setBusy(true);
    await supabase.from("service_prices").delete().eq("id", editRow.id);
    await load();
    setBusy(false);
    closeEdit();
  }

  if (loading) return <LoadingBlock />;

  const Table = ({
    title,
    data,
  }: {
    title: string;
    data: ServicePriceRow[];
  }) => (
    <div className="mt-4 rounded-xl border bg-white overflow-hidden">
      <div className="flex items-center bg-slate-100 px-4 py-2 text-sm font-semibold">
        <div>{title}</div>
        <select
          className="ml-auto h-8 w-40 rounded-lg border bg-white px-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as ServiceSort)}
          disabled={busy}
        >
          <option value="NAME_ASC">Name A–Z</option>
          <option value="NAME_DESC">Name Z–A</option>
          <option value="FEE_ASC">Fee low → high</option>
          <option value="FEE_DESC">Fee high → low</option>
        </select>
      </div>

      {/* Mobile/tablet: allow horizontal scroll */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px] divide-y">
          {data.map((r) => (
            <div
              key={r.id}
              className={[
                "grid grid-cols-[240px_140px_1fr_120px_80px] items-center px-4 py-2.5 text-sm transition",
                "hover:bg-slate-50",
                r.is_active ? "" : "opacity-50",
              ].join(" ")}
            >
              <div className="truncate">{r.service_name}</div>

              <div className="text-right">PHP {Number(r.default_price || 0).toLocaleString()}</div>

              <div />

              <div className="flex justify-center">
                <TogglePill
                  checked={r.is_active}
                  disabled={busy}
                  onChange={(v) => toggleActive(r.id, v)}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-white"
                  onClick={() => openEdit(r)}
                  disabled={busy}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}

          {data.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600">No items yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Services</h1>

      {/* ADD BOX */}
      <div className="mt-4 rounded-xl border bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-slate-700">Add a service / add-on</div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <select
            className="h-10 rounded-lg border px-2 text-sm"
            value={itemType}
            onChange={(e) => setItemType(e.target.value as any)}
            disabled={busy}
          >
            <option value="SERVICE">Service</option>
            <option value="ADD_ON">Add-on</option>
          </select>

          <input
            className="h-10 w-full rounded-lg border px-3 text-sm sm:flex-1"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />

          <input
            className="h-10 w-full rounded-lg border px-3 text-sm sm:w-[160px]"
            placeholder="Fee"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={busy}
            inputMode="decimal"
          />

          <button
            type="button"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            onClick={addItem}
            disabled={busy}
          >
            Add
          </button>
        </div>
      </div>

      <Table title="Services" data={services} />
      <Table title="Add-ons" data={addOns} />

      <EditModal
        open={editOpen}
        title={editRow ? `Edit ${editRow.item_type === "ADD_ON" ? "Add-on" : "Service"}` : "Edit"}
        onClose={closeEdit}
      >
        {!editRow ? null : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Fee</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                disabled={busy}
                inputMode="decimal"
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

            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <div className="text-sm font-semibold text-rose-800">Delete</div>
              <div className="mt-1 text-sm text-rose-700">
                Type <span className="font-semibold">DELETE</span> to confirm.
              </div>
              <input
                className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-sm"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="DELETE"
                disabled={busy}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={deleteItem}
                  disabled={busy || deleteText !== "DELETE"}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </EditModal>
    </div>
  );
}
