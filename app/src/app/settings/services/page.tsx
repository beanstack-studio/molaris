"use client";

import { FeatureGate } from "@/components/shared/FeatureGate";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";
import { EditModal } from "@/components/EditModal";
import { formatMoney } from "@/lib/helpers";
import { PageLoader } from "@/components/Spinner";
import { Toggle } from "@/components/Toggle";

type ServicePriceRow = {
  id: string;
  service_name: string;
  default_price: number;
  item_type: "SERVICE" | "ADD_ON";
  is_active: boolean;
  duration_minutes?: number;
  category?: "general" | "ortho"; // PART 1: Service categorization
};

type ServiceSort = "NAME_ASC" | "NAME_DESC" | "FEE_ASC" | "FEE_DESC";

const TogglePill = Toggle;

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


function ServicesSettingsPage() {
  const { clinicId, isLoading: clinicLoading } = useClinic();
  const [rows, setRows] = useState<ServicePriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const sort: ServiceSort = "NAME_ASC";

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [itemType, setItemType] = useState<"SERVICE" | "ADD_ON">("SERVICE");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState<string>("");
  const [addCategory, setAddCategory] = useState<"general" | "ortho">("general"); // PART 1

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ServicePriceRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState<string>("");
  const [editCategory, setEditCategory] = useState<"general" | "ortho">("general");
  const [editItemType, setEditItemType] = useState<"SERVICE" | "ADD_ON">("SERVICE");
  const [deleteText, setDeleteText] = useState("");

  async function load() {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No session - user should be redirected to login, just return
        setLoading(false);
        return;
      }
      
      const r = await supabase
        .from("service_prices")
        .select("id, service_name, default_price, item_type, is_active, duration_minutes, category")
        .eq("clinic_id", clinicId)
        .order("service_name", { ascending: true });

      setRows((r.data ?? []) as ServicePriceRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    load();
  }, [clinicLoading, clinicId]);

  // Services first, extras last — within each group sort by chosen sort
  const combinedRows = useMemo(() => {
    const svc = sortRows(rows.filter((r) => r.item_type === "SERVICE"), sort);
    const addOn = sortRows(rows.filter((r) => r.item_type === "ADD_ON"), sort);
    return [...svc, ...addOn];
  }, [rows, sort]);

  async function addItem() {
    if (!name.trim()) return;

    setBusy(true);
    const { error } = await supabase.from("service_prices").insert({
      clinic_id: clinicId,
      service_name: name.trim(),
      default_price: Number(price) || 0,
      item_type: itemType,
      is_active: true,
      duration_minutes: duration ? Number(duration) : null,
      category: addCategory, // PART 1
    });

    if (error) {
      console.error("Add item error:", error);
      setBusy(false);
      alert("Failed to add item: " + error.message);
      return;
    }

    await load();
    setBusy(false);
    closeAdd();
  }

  function openEdit(r: ServicePriceRow) {
    setEditRow(r);
    setEditName(r.service_name ?? "");
    setEditPrice(String(r.default_price ?? 0));
    setEditDuration(String(r.duration_minutes ?? ""));
    setEditCategory(r.category ?? "general");
    setEditItemType(r.item_type);
    setDeleteText("");
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditRow(null);
    setDeleteText("");
    setEditItemType("SERVICE");
  }

  function openAdd() {
    setItemType("SERVICE");
    setName("");
    setPrice("");
    setDuration("");
    setAddCategory("general");
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
    setItemType("SERVICE");
    setName("");
    setPrice("");
    setDuration("");
    setAddCategory("general");
  }

  async function toggleActive(id: string, current: boolean) {
    const next = !current;
    setBusy(true);
    await supabase.from("service_prices").update({ is_active: next }).eq("id", id).eq("clinic_id", clinicId);
    setRows((p) => p.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
    setBusy(false);
  }

  async function saveEdit() {
    if (!editRow) return;
    if (!editName.trim()) return;

    setBusy(true);
    const { error } = await supabase
      .from("service_prices")
      .update({
        service_name: editName.trim(),
        default_price: Number(editPrice) || 0,
        duration_minutes: editDuration ? Number(editDuration) : null,
        category: editCategory,
        item_type: editItemType,
      })
      .eq("id", editRow.id)
      .eq("clinic_id", clinicId);

    if (error) {
      console.error("Save error:", error);
      setBusy(false);
      alert("Failed to save: " + error.message);
      return;
    }

    await load();
    setBusy(false);
    closeEdit();
  }

  async function deleteItem() {
    if (!editRow) return;
    if (deleteText !== "DELETE") return;

    setBusy(true);
    
    const { error, data } = await supabase
      .from("service_prices")
      .delete()
      .eq("id", editRow.id)
      .eq("clinic_id", clinicId);
    
    
    if (error) {
      console.error("Delete error:", error);
      setBusy(false);
      alert("Failed to delete: " + (error.message || JSON.stringify(error)));
      return;
    }

    await load();
    setBusy(false);
    closeEdit();
  }

  if (loading)
    return (
      <PageLoader />
    );

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Services &amp; Extras</div>
          <button type="button" className="save-btn" onClick={openAdd} disabled={busy}>
            Add
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <colgroup>
              <col className="col-40" />
              <col className="col-15" />
              <col className="col-20" />
              <col className="col-15" />
              <col className="col-10" />
            </colgroup>
            <thead className="data-table-head">
              <tr>
                <th className="data-table-head-cell">Name</th>
                <th className="data-table-head-cell">Type</th>
                <th className="data-table-head-cell-right">Duration</th>
                <th className="data-table-head-cell-right">Fee</th>
                <th className="data-table-head-cell-right">Active</th>
              </tr>
            </thead>
            <tbody>
              {combinedRows.map((r, index) => (
                <tr
                  key={r.id}
                  className={`data-table-row cursor-pointer hover:bg-slate-50 ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                  onClick={() => openEdit(r)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(r); } }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Edit ${r.service_name}`}
                >
                  <td className="data-table-cell">{r.service_name}</td>
                  <td className="data-table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.item_type === "ADD_ON" ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300" : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"}`}>
                      {r.item_type === "ADD_ON" ? "Extra" : "Service"}
                    </span>
                  </td>
                  <td className="data-table-cell-right">{r.duration_minutes ? `${r.duration_minutes} min` : "—"}</td>
                  <td className="data-table-cell-right">{formatMoney(r.default_price)}</td>
                  <td className="data-table-cell-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      <TogglePill
                        checked={r.is_active}
                        disabled={busy}
                        onChange={() => toggleActive(r.id, r.is_active)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {combinedRows.length === 0 ? (
                <tr>
                  <td className="data-table-empty" colSpan={5}>No services or extras yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <EditModal
        open={addOpen}
        title="Add Service / Extra"
        onClose={closeAdd}
      >
        <div className="spacing-vertical-lg">
          <label className="field-label">
            <span className="field-label-text">Type</span>
            <select
              className="field-input"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as "SERVICE" | "ADD_ON")}
              disabled={busy}
            >
              <option value="SERVICE">Service</option>
              <option value="ADD_ON">Extra</option>
            </select>
          </label>

          <label className="field-label">
            <span className="field-label-text">Name</span>
            <input
              className="field-input"
              placeholder={itemType === "ADD_ON" ? "Extra name" : "Service name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="field-label">
              <span className="field-label-text">Fee</span>
              <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                <span className="px-3 py-2 text-slate-600 bg-slate-50 font-medium text-sm">₱</span>
                <input
                  className="flex-1 h-10 border-0 bg-transparent px-2 focus:outline-none text-sm"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => {
                    let v = e.target.value.replace(/[^\d.]/g, '');
                    const parts = v.split('.');
                    if (parts.length > 2) {
                      v = parts[0] + '.' + parts.slice(1).join('');
                    }
                    setPrice(v);
                  }}
                  disabled={busy}
                  inputMode="decimal"
                />
                
              </div>
            </label>

            <label className="field-label">
              <span className="field-label-text">Duration</span>
              <select
                className="field-input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={busy}
              >
                <option value="">None</option>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hour</option>
                <option value="75">1h 15m</option>
                <option value="90">1h 30m</option>
                <option value="105">1h 45m</option>
                <option value="120">2 hours</option>
                <option value="135">2h 15m</option>
                <option value="150">2h 30m</option>
                <option value="165">2h 45m</option>
                <option value="180">3 hours</option>
              </select>
            </label>
          </div>

          <label className="field-label">
            <span className="field-label-text">Category</span>
            <select
              className="field-input"
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value as "general" | "ortho")}
              disabled={busy}
            >
              <option value="general">General</option>
              <option value="ortho">Ortho</option>
            </select>
          </label>

          <div className="modal-actions">
            <div className="modal-actions-right">
              <button
                type="button"
                className="cancel-btn"
                onClick={closeAdd}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={addItem}
                disabled={busy || !name.trim()}
              >
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>

      <EditModal
        open={editOpen}
        title={editRow ? `Edit ${editRow.item_type === "ADD_ON" ? "Extra" : "Service"}` : "Edit"}
        onClose={closeEdit}
      >
        {!editRow ? null : (
          <div className="spacing-vertical-lg">
            <label className="field-label">
              <span className="field-label-text">Type</span>
              <select
                className="field-input"
                value={editItemType}
                onChange={(e) => setEditItemType(e.target.value as "SERVICE" | "ADD_ON")}
                disabled={busy}
              >
                <option value="SERVICE">Service</option>
                <option value="ADD_ON">Extra</option>
              </select>
            </label>

            <label className="field-label">
              <span className="field-label-text">Name</span>
              <input
                className="field-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={busy}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="field-label">
                <span className="field-label-text">Fee</span>
                <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                  <span className="px-3 py-2 text-slate-600 bg-slate-50 font-medium text-sm">₱</span>
                  <input
                    className="flex-1 h-10 border-0 bg-transparent px-2 focus:outline-none text-sm"
                    placeholder="0.00"
                    value={editPrice}
                    onChange={(e) => {
                      let v = e.target.value.replace(/[^\d.]/g, '');
                      const parts = v.split('.');
                      if (parts.length > 2) {
                        v = parts[0] + '.' + parts.slice(1).join('');
                      }
                      setEditPrice(v);
                    }}
                    disabled={busy}
                    inputMode="decimal"
                  />
                  <span className="px-2 text-slate-400 text-sm">.00</span>
                </div>
              </label>

              <label className="field-label">
                <span className="field-label-text">Duration</span>
                <select
                  className="field-input"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  disabled={busy}
                >
                  <option value="">None</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hour</option>
                  <option value="75">1h 15m</option>
                  <option value="90">1h 30m</option>
                  <option value="105">1h 45m</option>
                  <option value="120">2 hours</option>
                  <option value="135">2h 15m</option>
                  <option value="150">2h 30m</option>
                  <option value="165">2h 45m</option>
                  <option value="180">3 hours</option>
                </select>
              </label>
            </div>

            <label className="field-label">
              <span className="field-label-text">Category</span>
              <select
                className="field-input"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as "general" | "ortho")}
                disabled={busy}
              >
                <option value="general">General</option>
                <option value="ortho">Ortho</option>
              </select>
            </label>

            <div className="delete-confirmation">
              <div className="delete-confirmation-title">Delete service?</div>
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
                onClick={deleteItem}
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
                  className="save-btn"
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
    </>
  );
}

export default function ServicesSettingsPageGated() {
  return <FeatureGate feature="edit_catalog"><ServicesSettingsPage /></FeatureGate>;
}
