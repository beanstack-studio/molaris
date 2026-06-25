"use client";

import { FeatureGate } from "@/components/shared/FeatureGate";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";
import { EditModal } from "@/components/EditModal";
import { formatMoney } from "@/lib/helpers";
import { PageLoader } from "@/components/Spinner";
import { Toggle } from "@/components/Toggle";
import { cn } from "@/lib/cn";
import type { PaymentMode } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServicePriceRow = {
  id: string;
  service_name: string;
  default_price: number;
  item_type: "SERVICE" | "ADD_ON";
  is_active: boolean;
  duration_minutes?: number;
  category?: "general" | "ortho";
};

type ServiceSort = "NAME_ASC" | "NAME_DESC" | "DUR_ASC" | "DUR_DESC" | "FEE_ASC" | "FEE_DESC";

const TogglePill = Toggle;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortRows(list: ServicePriceRow[], sort: ServiceSort) {
  const out = [...list];
  out.sort((a, b) => {
    switch (sort) {
      case "NAME_DESC": return b.service_name.localeCompare(a.service_name);
      case "DUR_ASC":   return (a.duration_minutes ?? 0) - (b.duration_minutes ?? 0);
      case "DUR_DESC":  return (b.duration_minutes ?? 0) - (a.duration_minutes ?? 0);
      case "FEE_ASC":   return a.default_price - b.default_price;
      case "FEE_DESC":  return b.default_price - a.default_price;
      default:          return a.service_name.localeCompare(b.service_name);
    }
  });
  return out;
}

function SortIndicator({ active, asc }: { active: boolean; asc: boolean }) {
  const path = !active
    ? "M8 9l4-4 4 4M16 15l-4 4-4-4"
    : asc
    ? "M5 15l7-7 7 7"
    : "M19 9l-7 7-7-7";
  return (
    <svg
      className={cn("inline-block w-3 h-3 ml-1 shrink-0", active ? "text-blue-600" : "text-slate-300 dark:text-slate-600")}
      fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

// ─── Combined page ─────────────────────────────────────────────────────────────

function CatalogSettingsPage() {
  const { clinicId, isAdmin, isLoading: clinicLoading } = useClinic();
  const router = useRouter();

  // ── Services state ────────────────────────────────────────────────────────
  const [rows, setRows] = useState<ServicePriceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<ServiceSort>("NAME_ASC");

  const [addOpen, setAddOpen] = useState(false);
  const [itemType, setItemType] = useState<"SERVICE" | "ADD_ON">("SERVICE");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState<string>("");
  const [addCategory, setAddCategory] = useState<"general" | "ortho">("general");

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ServicePriceRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState<string>("");
  const [editCategory, setEditCategory] = useState<"general" | "ortho">("general");
  const [editItemType, setEditItemType] = useState<"SERVICE" | "ADD_ON">("SERVICE");
  const [deleteText, setDeleteText] = useState("");

  // ── Payment modes state ────────────────────────────────────────────────────
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [pmLoading, setPmLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pmError, setPmError] = useState<string | null>(null);
  const [pmBusy, setPmBusy] = useState(false);
  const [editData, setEditData] = useState<Partial<PaymentMode> | null>(null);

  const [addPmOpen, setAddPmOpen] = useState(false);
  const [pmName, setPmName] = useState("");
  const [pmCode, setPmCode] = useState("");
  const [pmRequiresProof, setPmRequiresProof] = useState(false);
  const [pmRequiresReference, setPmRequiresReference] = useState(false);
  const [pmRequiresReceivedBy, setPmRequiresReceivedBy] = useState(false);
  const [pmAutoVerifies, setPmAutoVerifies] = useState(false);

  // ── Admin redirect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clinicLoading && !isAdmin) {
      router.replace("/settings/account");
    }
  }, [clinicLoading, isAdmin, router]);

  // ── Services data loading ─────────────────────────────────────────────────

  async function loadServices() {
    setServicesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setServicesLoading(false); return; }
      const r = await supabase
        .from("service_prices")
        .select("id, service_name, default_price, item_type, is_active, duration_minutes, category")
        .eq("clinic_id", clinicId)
        .order("service_name", { ascending: true });
      setRows((r.data ?? []) as ServicePriceRow[]);
    } finally {
      setServicesLoading(false);
    }
  }

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    loadServices();
  }, [clinicLoading, clinicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Payment modes data loading ─────────────────────────────────────────────

  async function loadPaymentModes() {
    setPmLoading(true);
    setPmError(null);
    const { data, error } = await supabase
      .from("payment_modes")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("sort_order", { ascending: true });
    setPmLoading(false);
    if (error === null && data) {
      setPaymentModes(data);
    } else if (error) {
      setPmError("Failed to load payment modes: " + error.message);
    }
  }

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    loadPaymentModes();
  }, [clinicLoading, clinicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Services handlers ─────────────────────────────────────────────────────

  function toggleSort(col: "NAME" | "DUR" | "FEE") {
    setSort((prev) => {
      const asc = `${col}_ASC` as ServiceSort;
      const desc = `${col}_DESC` as ServiceSort;
      return prev === asc ? desc : asc;
    });
  }

  const combinedRows = useMemo(() => sortRows([...rows], sort), [rows, sort]);

  if (!isAdmin && !clinicLoading) return null;

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
      category: addCategory,
    });
    if (error) {
      setBusy(false);
      alert("Failed to add item: " + error.message);
      return;
    }
    await loadServices();
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
    if (!editRow || !editName.trim()) return;
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
      setBusy(false);
      alert("Failed to save: " + error.message);
      return;
    }
    await loadServices();
    setBusy(false);
    closeEdit();
  }

  async function deleteItem() {
    if (!editRow || deleteText !== "DELETE") return;
    setBusy(true);
    const { error } = await supabase
      .from("service_prices")
      .delete()
      .eq("id", editRow.id)
      .eq("clinic_id", clinicId);
    if (error) {
      setBusy(false);
      alert("Failed to delete: " + (error.message || JSON.stringify(error)));
      return;
    }
    await loadServices();
    setBusy(false);
    closeEdit();
  }

  // ── Payment modes handlers ─────────────────────────────────────────────────

  async function pmToggleActive(id: string, newValue: boolean) {
    setPmBusy(true);
    setPmError(null);
    setPaymentModes((prev) =>
      prev.map((mode) => (mode.id === id ? { ...mode, is_active: newValue } : mode))
    );
    try {
      const { data, error } = await supabase
        .from("payment_modes")
        .update({ is_active: newValue })
        .eq("id", id)
        .eq("clinic_id", clinicId)
        .select();
      if (error) {
        setPmError(`Failed to update: ${error.message}`);
        await loadPaymentModes();
        return;
      }
      if (!data || data.length === 0) {
        setPmError("Failed to update payment mode");
        await loadPaymentModes();
        return;
      }
    } catch (ex) {
      setPmError("An error occurred while updating");
      await loadPaymentModes();
    } finally {
      setPmBusy(false);
    }
  }

  function startEdit(mode: PaymentMode) {
    setEditingId(mode.id);
    setEditData({ ...mode });
  }

  async function pmSaveEdit() {
    if (!editingId || !editData) return;
    setPmError(null);
    setPmBusy(true);
    const { error } = await supabase
      .from("payment_modes")
      .update({
        requires_proof: editData.requires_proof,
        requires_reference: editData.requires_reference,
        requires_received_by: editData.requires_received_by,
        auto_verifies: editData.auto_verifies,
      })
      .eq("id", editingId)
      .eq("clinic_id", clinicId);
    setPmBusy(false);
    if (error) { setPmError(error.message); return; }
    setEditingId(null);
    setEditData(null);
    await loadPaymentModes();
  }

  function pmCancelEdit() {
    setEditingId(null);
    setEditData(null);
    setPmError(null);
  }

  function openAddPm() {
    setPmName("");
    setPmCode("");
    setPmRequiresProof(false);
    setPmRequiresReference(false);
    setPmRequiresReceivedBy(false);
    setPmAutoVerifies(false);
    setAddPmOpen(true);
  }

  function closeAddPm() {
    setAddPmOpen(false);
  }

  async function addPaymentMode() {
    if (!pmName.trim()) return;
    const maxOrder = paymentModes.reduce((max, m) => Math.max(max, m.sort_order ?? 0), 0);
    setPmBusy(true);
    const { error: addErr } = await supabase.from("payment_modes").insert({
      clinic_id: clinicId,
      name: pmName.trim(),
      code: pmCode.trim() || pmName.trim().toUpperCase().replace(/\s+/g, "_"),
      requires_proof: pmRequiresProof,
      requires_reference: pmRequiresReference,
      requires_received_by: pmRequiresReceivedBy,
      auto_verifies: pmAutoVerifies,
      is_active: true,
      sort_order: maxOrder + 1,
    });
    setPmBusy(false);
    if (addErr) { setPmError(addErr.message); return; }
    closeAddPm();
    await loadPaymentModes();
  }

  const sortedPaymentModes = useMemo(
    () => [...paymentModes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [paymentModes]
  );

  // ── Loading states ─────────────────────────────────────────────────────────

  if (servicesLoading || pmLoading) return <PageLoader />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">

        {/* ── Services card ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Services &amp; Extras</div>
            <button type="button" className="save-btn" onClick={openAdd} disabled={busy}>
              Add
            </button>
          </div>

          {/* Services sub-table */}
          <div className="mt-2">
            <div className="px-1 mb-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Services</h4>
            </div>
            <div className="table-wrapper overflow-x-auto">
              <table className="data-table min-w-[380px]">
                <colgroup>
                  <col className="col-35" />
                  <col className="col-20" />
                  <col className="col-25" />
                  <col className="col-20" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell cursor-pointer select-none" onClick={() => toggleSort("NAME")}>
                      Name <SortIndicator active={sort.startsWith("NAME")} asc={sort === "NAME_ASC"} />
                    </th>
                    <th className="data-table-head-cell-right cursor-pointer select-none" onClick={() => toggleSort("DUR")}>
                      Duration <SortIndicator active={sort.startsWith("DUR")} asc={sort === "DUR_ASC"} />
                    </th>
                    <th className="data-table-head-cell-right cursor-pointer select-none" onClick={() => toggleSort("FEE")}>
                      Fee <SortIndicator active={sort.startsWith("FEE")} asc={sort === "FEE_ASC"} />
                    </th>
                    <th className="data-table-head-cell-right">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedRows.filter((r) => r.item_type === "SERVICE").map((r, index) => (
                    <tr
                      key={r.id}
                      className={cn(
                        "data-table-row cursor-pointer",
                        index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"
                      )}
                      onClick={() => openEdit(r)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(r); } }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Edit ${r.service_name}`}
                    >
                      <td className="data-table-cell">{r.service_name}</td>
                      <td className="data-table-cell-right">{r.duration_minutes ? `${r.duration_minutes} min` : "—"}</td>
                      <td className="data-table-cell-right whitespace-nowrap">{formatMoney(r.default_price)}</td>
                      <td className="data-table-cell-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <TogglePill checked={r.is_active} disabled={busy} onChange={() => toggleActive(r.id, r.is_active)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {combinedRows.filter((r) => r.item_type === "SERVICE").length === 0 && (
                    <tr><td className="data-table-empty" colSpan={4}>No services yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Extras sub-table */}
          <div className="mt-4">
            <div className="px-1 mb-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Extras</h4>
            </div>
            <div className="table-wrapper overflow-x-auto">
              <table className="data-table min-w-[380px]">
                <colgroup>
                  <col className="col-35" />
                  <col className="col-20" />
                  <col className="col-25" />
                  <col className="col-20" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell cursor-pointer select-none" onClick={() => toggleSort("NAME")}>
                      Name <SortIndicator active={sort.startsWith("NAME")} asc={sort === "NAME_ASC"} />
                    </th>
                    <th className="data-table-head-cell-right cursor-pointer select-none" onClick={() => toggleSort("DUR")}>
                      Duration <SortIndicator active={sort.startsWith("DUR")} asc={sort === "DUR_ASC"} />
                    </th>
                    <th className="data-table-head-cell-right cursor-pointer select-none" onClick={() => toggleSort("FEE")}>
                      Fee <SortIndicator active={sort.startsWith("FEE")} asc={sort === "FEE_ASC"} />
                    </th>
                    <th className="data-table-head-cell-right">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedRows.filter((r) => r.item_type === "ADD_ON").map((r, index) => (
                    <tr
                      key={r.id}
                      className={cn(
                        "data-table-row cursor-pointer",
                        index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"
                      )}
                      onClick={() => openEdit(r)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(r); } }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Edit ${r.service_name}`}
                    >
                      <td className="data-table-cell">{r.service_name}</td>
                      <td className="data-table-cell-right">{r.duration_minutes ? `${r.duration_minutes} min` : "—"}</td>
                      <td className="data-table-cell-right whitespace-nowrap">{formatMoney(r.default_price)}</td>
                      <td className="data-table-cell-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <TogglePill checked={r.is_active} disabled={busy} onChange={() => toggleActive(r.id, r.is_active)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {combinedRows.filter((r) => r.item_type === "ADD_ON").length === 0 && (
                    <tr><td className="data-table-empty" colSpan={4}>No extras yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Payment Modes card ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Payment Modes</div>
            <button type="button" className="save-btn" onClick={openAddPm} disabled={pmBusy}>
              Add
            </button>
          </div>

          {pmError && <div className="error-banner">{pmError}</div>}

          <div className="table-wrapper overflow-x-auto">
            <table className="data-table min-w-[480px]">
              <colgroup>
                <col className="col-20" />
                <col className="col-17" />
                <col className="col-17" />
                <col className="col-23" />
                <col className="col-23" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Name</th>
                  <th className="data-table-head-cell"><div className="centered-cell">Proof</div></th>
                  <th className="data-table-head-cell"><div className="centered-cell">Reference</div></th>
                  <th className="data-table-head-cell"><div className="centered-cell">Verification</div></th>
                  <th className="data-table-head-cell"><div className="centered-cell">Active</div></th>
                </tr>
              </thead>
              <tbody>
                {sortedPaymentModes.length === 0 ? (
                  <tr className="data-table-row">
                    <td className="data-table-empty" colSpan={5}>No payment modes configured.</td>
                  </tr>
                ) : (
                  sortedPaymentModes.map((mode, i) => (
                    <tr
                      key={mode.id}
                      className={cn(
                        "data-table-row",
                        editingId === mode.id ? "" : "cursor-pointer hover:bg-slate-50",
                        i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"
                      )}
                      onClick={() => { if (editingId !== mode.id) startEdit(mode); }}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && editingId !== mode.id) { e.preventDefault(); startEdit(mode); } }}
                      tabIndex={editingId === mode.id ? -1 : 0}
                      role={editingId === mode.id ? undefined : "button"}
                      aria-label={editingId === mode.id ? undefined : `Edit ${mode.name}`}
                    >
                      {editingId === mode.id && editData ? (
                        <>
                          <td className="data-table-cell font-semibold" onClick={(e) => e.stopPropagation()}>{mode.name}</td>
                          <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                            <div className="centered-cell">
                              <input type="checkbox" checked={editData.requires_proof || false}
                                onChange={(e) => setEditData({ ...editData, requires_proof: e.target.checked })}
                                disabled={pmBusy} className="h-4 w-4 rounded" />
                            </div>
                          </td>
                          <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                            <div className="centered-cell">
                              <input type="checkbox" checked={editData.requires_reference || false}
                                onChange={(e) => setEditData({ ...editData, requires_reference: e.target.checked })}
                                disabled={pmBusy} className="h-4 w-4 rounded" />
                            </div>
                          </td>
                          <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                            <div className="centered-cell">
                              <select
                                className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none bg-white"
                                value={editData.auto_verifies ? "auto" : "manual"}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditData({ ...editData, auto_verifies: v === "auto", requires_received_by: false });
                                }}
                                disabled={pmBusy}
                              >
                                <option value="auto">Auto</option>
                                <option value="manual">Manual</option>
                              </select>
                            </div>
                          </td>
                          <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                            <div className="centered-cell">
                              <TogglePill checked={mode.is_active} onChange={(v) => pmToggleActive(mode.id, v)} />
                            </div>
                            <div className="flex gap-2 justify-center mt-2">
                              <button className="save-btn" onClick={pmSaveEdit} disabled={pmBusy}>Save</button>
                              <button className="cancel-btn" onClick={pmCancelEdit} disabled={pmBusy}>Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="data-table-cell font-semibold">{mode.name}</td>
                          <td className="data-table-cell">
                            <div className="centered-cell">
                              <span className={cn("inline-block w-4 h-4 rounded", mode.requires_proof ? "bg-blue-500" : "bg-slate-200")} />
                            </div>
                          </td>
                          <td className="data-table-cell">
                            <div className="centered-cell">
                              <span className={cn("inline-block w-4 h-4 rounded", mode.requires_reference ? "bg-blue-500" : "bg-slate-200")} />
                            </div>
                          </td>
                          <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                            <div className="centered-cell">
                              {mode.auto_verifies ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Auto</span>
                              ) : mode.requires_received_by ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Staff</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">Manual</span>
                              )}
                            </div>
                          </td>
                          <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                            <div className="centered-cell">
                              <TogglePill checked={mode.is_active} onChange={(v) => pmToggleActive(mode.id, v)} />
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Requirements legend */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded bg-blue-500" />
                <span><strong>Proof</strong> — requires proof upload</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded bg-blue-500" />
                <span><strong>Reference</strong> — requires ref number</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Auto</span>
                <span>auto-verified on record</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">Manual</span>
                <span>requires manual verification</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Services modals ── */}
      <EditModal open={addOpen} title={itemType === "ADD_ON" ? "Add Extra" : "Add Service"} onClose={closeAdd}>
        <div className="spacing-vertical-lg">
          {/* Category radio — required */}
          <div>
            <span className="field-label-text block mb-2">Category <span className="text-red-400">*</span></span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="add-item-type"
                  value="SERVICE"
                  checked={itemType === "SERVICE"}
                  onChange={() => setItemType("SERVICE")}
                  disabled={busy}
                  className="h-4 w-4"
                />
                <span className="text-sm text-slate-700">Service</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="add-item-type"
                  value="ADD_ON"
                  checked={itemType === "ADD_ON"}
                  onChange={() => setItemType("ADD_ON")}
                  disabled={busy}
                  className="h-4 w-4"
                />
                <span className="text-sm text-slate-700">Extra</span>
              </label>
            </div>
          </div>

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
                    let v = e.target.value.replace(/[^\d.]/g, "");
                    const parts = v.split(".");
                    if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
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
              <button type="button" className="cancel-btn" onClick={closeAdd} disabled={busy}>Cancel</button>
              <button type="button" className="save-btn" onClick={addItem} disabled={busy || !name.trim()}>
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
        {editRow && (
          <div className="spacing-vertical-lg">
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
                      let v = e.target.value.replace(/[^\d.]/g, "");
                      const parts = v.split(".");
                      if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
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
                <button type="button" className="cancel-btn" onClick={closeEdit} disabled={busy}>Cancel</button>
                <button type="button" className="save-btn" onClick={saveEdit} disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </EditModal>

      {/* ── Payment mode add modal ── */}
      <EditModal open={addPmOpen} title="Add Payment Mode" onClose={closeAddPm}>
        <div className="spacing-vertical-lg">
          <label className="field-label">
            <span className="field-label-text">Name</span>
            <input
              className="field-input"
              value={pmName}
              onChange={(e) => setPmName(e.target.value)}
              placeholder="e.g. GCash"
              disabled={pmBusy}
            />
          </label>
          <label className="field-label">
            <span className="field-label-text">Code <span className="text-slate-400 font-normal">(auto-generated if blank)</span></span>
            <input
              className="field-input"
              value={pmCode}
              onChange={(e) => setPmCode(e.target.value)}
              placeholder={pmName ? pmName.toUpperCase().replace(/\s+/g, "_") : "e.g. GCASH"}
              disabled={pmBusy}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pmRequiresProof} onChange={(e) => setPmRequiresProof(e.target.checked)} className="h-4 w-4 rounded" disabled={pmBusy} />
              <span className="text-sm text-slate-700 dark:text-slate-300">Requires proof</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pmRequiresReference} onChange={(e) => setPmRequiresReference(e.target.checked)} className="h-4 w-4 rounded" disabled={pmBusy} />
              <span className="text-sm text-slate-700 dark:text-slate-300">Requires reference</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pmAutoVerifies} onChange={(e) => setPmAutoVerifies(e.target.checked)} className="h-4 w-4 rounded" disabled={pmBusy} />
              <span className="text-sm text-slate-700 dark:text-slate-300">Auto-verifies</span>
            </label>
          </div>
          <div className="modal-actions">
            <div className="modal-actions-right">
              <button type="button" className="cancel-btn" onClick={closeAddPm} disabled={pmBusy}>Cancel</button>
              <button type="button" className="save-btn" onClick={addPaymentMode} disabled={pmBusy || !pmName.trim()}>
                {pmBusy ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>
    </>
  );
}

export default function CatalogSettingsPageGated() {
  return <FeatureGate feature="edit_catalog"><CatalogSettingsPage /></FeatureGate>;
}
