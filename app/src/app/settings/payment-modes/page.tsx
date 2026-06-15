"use client";

import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PaymentMode } from "@/lib/types";
import { useClinic } from "@/contexts/ClinicContext";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Toggle } from "@/components/Toggle";
import { TableOptions, type ColumnConfig } from "@/components/shared/TableOptions";
const TogglePill = Toggle;

const PM_COLUMNS: ColumnConfig[] = [
  { key: "name",    label: "Name",        required: true },
  { key: "proof",   label: "Proof" },
  { key: "ref",     label: "Reference" },
  { key: "staff",   label: "Staff" },
  { key: "auto",    label: "Auto-Verify" },
  { key: "active",  label: "Activate" },
];

export default function PaymentModesSettingsPage() {
  const { clinicId, isLoading: clinicLoading } = useClinic();
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editData, setEditData] = useState<Partial<PaymentMode> | null>(null);
  const [pmSortConfig, setPmSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "sort_order", direction: "asc" });

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    loadPaymentModes();
  }, [clinicLoading, clinicId]);

  async function loadPaymentModes() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("payment_modes")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("sort_order", { ascending: true });

    setLoading(false);
    if (error === null && data) {
      setPaymentModes(data);
    } else if (error) {
      setError("Failed to load payment modes: " + error.message);
    }
  }

  async function toggleActive(id: string, newValue: boolean) {
    setBusy(true);
    setError(null);
    
    // Optimistically update UI immediately
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
        console.error("Toggle error:", error);
        setError(`Failed to update: ${error.message}`);
        // Revert on error
        await loadPaymentModes();
        return;
      }

      if (!data || data.length === 0) {
        console.error("No data returned from update");
        setError("Failed to update payment mode");
        await loadPaymentModes();
        return;
      }

    } catch (ex) {
      console.error("Toggle exception:", ex);
      setError("An error occurred while updating");
      await loadPaymentModes();
    } finally {
      setBusy(false);
    }
  }

  async function startEdit(mode: PaymentMode) {
    setEditingId(mode.id);
    setEditData({ ...mode });
  }

  async function saveEdit() {
    if (!editingId || !editData) return;

    setError(null);
    setBusy(true);

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

    setBusy(false);
    if (error) {
      return setError(error.message);
    }

    setEditingId(null);
    setEditData(null);
    await loadPaymentModes();
  }

  async function cancelEdit() {
    setEditingId(null);
    setEditData(null);
    setError(null);
  }

  const sortedPaymentModes = useMemo(() => {
    const list = [...paymentModes];
    const { key, direction } = pmSortConfig;
    const dir = direction === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (key === "name") return dir * (a.name ?? "").localeCompare(b.name ?? "");
      if (key === "sort_order") return dir * ((a.sort_order ?? 0) - (b.sort_order ?? 0));
      return 0;
    });
    return list;
  }, [paymentModes, pmSortConfig]);

  if (loading) {
    return (
      <PageLoader text="Loading payment modes…" />
    );
  }

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}
            {/* Payment modes table */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Payment Modes</div>
                <TableOptions
                  tableName="payment_modes"
                  columns={PM_COLUMNS}
                  sorts={[
                    { key: "name",       label: "Name" },
                    { key: "sort_order", label: "Sort order" },
                  ]}
                  currentSort={pmSortConfig}
                  onSortChange={(k, d) => setPmSortConfig({ key: k, direction: d })}
                  data={paymentModes}
                  onDownloadCSV={() => {}}
                />
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                <colgroup>
                  <col className="col-22" />
                  <col className="col-13" />
                  <col className="col-13" />
                  <col className="col-13" />
                  <col className="col-13" />
                  <col className="col-26" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Name</th>
                    <th className="data-table-head-cell">
                      <div className="centered-cell">Proof</div>
                    </th>
                    <th className="data-table-head-cell">
                      <div className="centered-cell">Reference</div>
                    </th>
                    <th className="data-table-head-cell">
                      <div className="centered-cell">Staff</div>
                    </th>
                    <th className="data-table-head-cell">
                      <div className="centered-cell">Auto-Verify</div>
                    </th>
                    <th className="data-table-head-cell">
                      <div className="centered-cell">Activate</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPaymentModes.length === 0 ? (
                    <tr className="data-table-row">
                      <td className="data-table-empty" colSpan={6}>
                        No payment modes configured.
                      </td>
                    </tr>
                  ) : (
                    sortedPaymentModes.map((mode, i) => (
                      <tr
                        key={mode.id}
                        className={`data-table-row ${editingId === mode.id ? "" : "cursor-pointer hover:bg-slate-50"} ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
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
                                <input
                                  type="checkbox"
                                  checked={editData.requires_proof || false}
                                  onChange={(e) =>
                                    setEditData({ ...editData, requires_proof: e.target.checked })
                                  }
                                  disabled={busy}
                                  className="h-4 w-4 rounded"
                                />
                              </div>
                            </td>
                            <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                              <div className="centered-cell">
                                <input
                                  type="checkbox"
                                  checked={editData.requires_reference || false}
                                  onChange={(e) =>
                                    setEditData({ ...editData, requires_reference: e.target.checked })
                                  }
                                  disabled={busy}
                                  className="h-4 w-4 rounded"
                                />
                              </div>
                            </td>
                            <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                              <div className="centered-cell">
                                <input
                                  type="checkbox"
                                  checked={editData.requires_received_by || false}
                                  onChange={(e) =>
                                    setEditData({ ...editData, requires_received_by: e.target.checked })
                                  }
                                  disabled={busy}
                                  className="h-4 w-4 rounded"
                                />
                              </div>
                            </td>
                            <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                              <div className="centered-cell">
                                <input
                                  type="checkbox"
                                  checked={editData.auto_verifies || false}
                                  onChange={(e) =>
                                    setEditData({ ...editData, auto_verifies: e.target.checked })
                                  }
                                  disabled={busy}
                                  className="h-4 w-4 rounded"
                                />
                              </div>
                            </td>
                            <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                              <div className="centered-cell">
                                <TogglePill
                                  checked={mode.is_active}
                                  onChange={(newValue) => toggleActive(mode.id, newValue)}
                                />
                              </div>
                              <div className="flex gap-2 justify-center mt-2">
                                <button
                                  className="save-btn"
                                  onClick={saveEdit}
                                  disabled={busy}
                                >
                                  Save
                                </button>
                                <button
                                  className="cancel-btn"
                                  onClick={cancelEdit}
                                  disabled={busy}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="data-table-cell font-semibold">{mode.name}</td>
                            <td className="data-table-cell">
                              <div className="centered-cell">
                                <span
                                  className={`inline-block w-4 h-4 rounded ${
                                    mode.requires_proof ? "bg-blue-500" : "bg-slate-200"
                                  }`}
                                ></span>
                              </div>
                            </td>
                            <td className="data-table-cell">
                              <div className="centered-cell">
                                <span
                                  className={`inline-block w-4 h-4 rounded ${
                                    mode.requires_reference ? "bg-blue-500" : "bg-slate-200"
                                  }`}
                                ></span>
                              </div>
                            </td>
                            <td className="data-table-cell">
                              <div className="centered-cell">
                                <span
                                  className={`inline-block w-4 h-4 rounded ${
                                    mode.requires_received_by ? "bg-blue-500" : "bg-slate-200"
                                  }`}
                                ></span>
                              </div>
                            </td>
                            <td className="data-table-cell">
                              <div className="centered-cell">
                                <span
                                  className={`inline-block w-4 h-4 rounded ${
                                    mode.auto_verifies ? "bg-green-500" : "bg-slate-200"
                                  }`}
                                ></span>
                              </div>
                            </td>
                            <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                              <div className="centered-cell">
                                <TogglePill
                                  checked={mode.is_active}
                                  onChange={(newValue) => toggleActive(mode.id, newValue)}
                                />
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
            </div>

            {/* Requirements legend */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Requirements Legend</div>
              </div>
              <div className="legend-grid">
                <div className="legend-item">
                  <span className="legend-indicator bg-blue-500"></span>
                  <span>
                    <strong>Proof</strong> - Requires proof upload
                  </span>
                </div>
                <div className="legend-item">
                  <span className="legend-indicator bg-blue-500"></span>
                  <span>
                    <strong>Reference</strong> - Requires reference number
                  </span>
                </div>
                <div className="legend-item">
                  <span className="legend-indicator bg-blue-500"></span>
                  <span>
                    <strong>Staff</strong> - Requires staff member
                  </span>
                </div>
                <div className="legend-item">
                  <span className="legend-indicator bg-green-500"></span>
                  <span>
                    <strong>Auto-Verify</strong> - Verifies automatically
                  </span>
                </div>
              </div>
            </div>
    </>
  );
}
