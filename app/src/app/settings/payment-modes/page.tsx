"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PaymentMode } from "@/lib/types";

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
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function PaymentModesSettingsPage() {
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editData, setEditData] = useState<Partial<PaymentMode> | null>(null);

  useEffect(() => {
    loadPaymentModes();
  }, []);

  async function loadPaymentModes() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("payment_modes")
      .select("*")
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
      .eq("id", editingId);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <img src="/loading.gif" alt="Loading" className="h-12 w-12" />
          <div className="text-sm">Loading payment modes…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="page-content">
        <div className="page-sections">
            {/* Payment modes table */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Payment Modes</div>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                <colgroup>
                  <col className="col-18" />
                  <col className="col-13" />
                  <col className="col-13" />
                  <col className="col-13" />
                  <col className="col-13" />
                  <col className="col-13" />
                  <col className="col-17" />
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
                    <th className="data-table-head-cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentModes.length === 0 ? (
                    <tr className="data-table-row">
                      <td className="data-table-empty" colSpan={7}>
                        No payment modes configured.
                      </td>
                    </tr>
                  ) : (
                    paymentModes.map((mode, i) => (
                      <tr
                        key={mode.id}
                        className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                      >
                        {editingId === mode.id && editData ? (
                          <>
                            <td className="data-table-cell font-semibold">{mode.name}</td>
                            <td className="data-table-cell">
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
                            <td className="data-table-cell">
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
                            <td className="data-table-cell">
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
                            <td className="data-table-cell">
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
                            <td className="data-table-cell">
                              <div className="centered-cell">
                                <TogglePill
                                  checked={mode.is_active}
                                  onChange={(newValue) => toggleActive(mode.id, newValue)}
                                />
                              </div>
                            </td>
                            <td className="data-table-cell-right">
                              <div className="flex gap-2 justify-end">
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
                            <td className="data-table-cell">
                              <div className="centered-cell">
                                <TogglePill
                                  checked={mode.is_active}
                                  onChange={(newValue) => toggleActive(mode.id, newValue)}
                                />
                              </div>
                            </td>
                            <td className="data-table-cell-right">
                              <button
                                className="data-table-btn"
                                onClick={() => startEdit(mode)}
                                disabled={busy}
                              >
                                Edit
                              </button>
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
        </div>
      </div>
    </>
  );
}
