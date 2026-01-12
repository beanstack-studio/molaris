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
      onClick={() => {
        console.log('TogglePill clicked, checked:', checked, 'sending:', !checked);
        onChange(!checked);
      }}
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
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editData, setEditData] = useState<Partial<PaymentMode> | null>(null);

  useEffect(() => {
    loadPaymentModes();
  }, []);

  async function loadPaymentModes() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("payment_modes")
      .select("*")
      .order("sort_order", { ascending: true });

    setLoading(false);
    if (error === null && data) {
      setPaymentModes(data);
    } else if (error) {
      setErr("Failed to load payment modes: " + error.message);
    }
  }

  async function toggleActive(id: string, newValue: boolean) {
    console.log('toggleActive called with id:', id, 'newValue:', newValue);
    setErr(null);
    
    // Optimistically update UI immediately
    setPaymentModes((prev) =>
      prev.map((mode) => (mode.id === id ? { ...mode, is_active: newValue } : mode))
    );

    const { error } = await supabase
      .from("payment_modes")
      .update({ is_active: newValue })
      .eq("id", id);

    console.log('Supabase update error:', error);
    if (error) {
      console.error('Update failed:', error.message);
      setErr(error.message);
      // Revert on error
      await loadPaymentModes();
      return;
    }

    console.log('Update successful');
  }

  async function startEdit(mode: PaymentMode) {
    setEditingId(mode.id);
    setEditData({ ...mode });
  }

  async function saveEdit() {
    if (!editingId || !editData) return;

    setErr(null);
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
      return setErr(error.message);
    }

    setEditingId(null);
    setEditData(null);
    await loadPaymentModes();
  }

  async function cancelEdit() {
    setEditingId(null);
    setEditData(null);
    setErr(null);
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
    <div className="min-h-screen bg-slate-50">
      <div className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">Payment Modes</div>
        </div>

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="app-section-body">
          <div className="grid gap-4">
            {/* Payment modes table */}
            <div className="rounded-2xl border bg-white p-4">
              <table className="data-table">
                <colgroup>
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "17%" }} />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Name</th>
                    <th className="data-table-head-cell text-center">Proof</th>
                    <th className="data-table-head-cell text-center">Reference</th>
                    <th className="data-table-head-cell text-center">Staff</th>
                    <th className="data-table-head-cell text-center">Auto-Verify</th>
                    <th className="data-table-head-cell text-center">Activate</th>
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
                            <td className="data-table-cell text-center">
                              <input
                                type="checkbox"
                                checked={editData.requires_proof || false}
                                onChange={(e) =>
                                  setEditData({ ...editData, requires_proof: e.target.checked })
                                }
                                disabled={busy}
                                className="h-4 w-4 rounded"
                              />
                            </td>
                            <td className="data-table-cell text-center">
                              <input
                                type="checkbox"
                                checked={editData.requires_reference || false}
                                onChange={(e) =>
                                  setEditData({ ...editData, requires_reference: e.target.checked })
                                }
                                disabled={busy}
                                className="h-4 w-4 rounded"
                              />
                            </td>
                            <td className="data-table-cell text-center">
                              <input
                                type="checkbox"
                                checked={editData.requires_received_by || false}
                                onChange={(e) =>
                                  setEditData({ ...editData, requires_received_by: e.target.checked })
                                }
                                disabled={busy}
                                className="h-4 w-4 rounded"
                              />
                            </td>
                            <td className="data-table-cell text-center">
                              <input
                                type="checkbox"
                                checked={editData.auto_verifies || false}
                                onChange={(e) =>
                                  setEditData({ ...editData, auto_verifies: e.target.checked })
                                }
                                disabled={busy}
                                className="h-4 w-4 rounded"
                              />
                            </td>
                            <td className="data-table-cell text-center">
                              <TogglePill
                                checked={mode.is_active}
                                onChange={(newValue) => toggleActive(mode.id, newValue)}
                              />
                            </td>
                            <td className="data-table-cell-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                  onClick={saveEdit}
                                  disabled={busy}
                                >
                                  Save
                                </button>
                                <button
                                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-50"
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
                            <td className="data-table-cell text-center">
                              <span
                                className={`inline-block w-4 h-4 rounded ${
                                  mode.requires_proof ? "bg-blue-500" : "bg-slate-200"
                                }`}
                              ></span>
                            </td>
                            <td className="data-table-cell text-center">
                              <span
                                className={`inline-block w-4 h-4 rounded ${
                                  mode.requires_reference ? "bg-blue-500" : "bg-slate-200"
                                }`}
                              ></span>
                            </td>
                            <td className="data-table-cell text-center">
                              <span
                                className={`inline-block w-4 h-4 rounded ${
                                  mode.requires_received_by ? "bg-blue-500" : "bg-slate-200"
                                }`}
                              ></span>
                            </td>
                            <td className="data-table-cell text-center">
                              <span
                                className={`inline-block w-4 h-4 rounded ${
                                  mode.auto_verifies ? "bg-green-500" : "bg-slate-200"
                                }`}
                              ></span>
                            </td>
                            <td className="data-table-cell text-center">
                              <TogglePill
                                checked={mode.is_active}
                                onChange={(newValue) => toggleActive(mode.id, newValue)}
                              />
                            </td>
                            <td className="data-table-cell-right">
                              <button
                                className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-50"
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

            {/* Requirements legend */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-sm font-semibold mb-3">Requirements Legend</div>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded bg-blue-500"></span>
                  <span>
                    <strong>Proof</strong> - Requires proof upload
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded bg-blue-500"></span>
                  <span>
                    <strong>Reference</strong> - Requires reference number
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded bg-blue-500"></span>
                  <span>
                    <strong>Staff</strong> - Requires staff member
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded bg-green-500"></span>
                  <span>
                    <strong>Auto-Verify</strong> - Verifies automatically
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
