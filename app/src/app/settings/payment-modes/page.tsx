"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PaymentMode } from "@/lib/types";

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

  async function toggleActive(id: string, isActive: boolean) {
    setErr(null);
    setBusy(true);

    const { error } = await supabase
      .from("payment_modes")
      .update({ is_active: !isActive })
      .eq("id", id);

    setBusy(false);
    if (error) {
      return setErr(error.message);
    }

    await loadPaymentModes();
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
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold">Payment Modes</h1>
        <p className="text-sm text-slate-600">Configure payment method requirements and verification.</p>
      </div>

      {err && <div className="mt-4 rounded-lg border bg-yellow-50 p-3 text-sm text-yellow-700">{err}</div>}

      {/* Payment modes table */}
      <div className="mt-6 rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="py-3 px-4 font-semibold">Name</th>
              <th className="py-3 px-4 font-semibold text-center">Proof</th>
              <th className="py-3 px-4 font-semibold text-center">Reference</th>
              <th className="py-3 px-4 font-semibold text-center">Staff</th>
              <th className="py-3 px-4 font-semibold text-center">Auto-Verify</th>
              <th className="py-3 px-4 font-semibold text-center">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paymentModes.map((mode, i) => (
              <tr key={mode.id} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                {editingId === mode.id && editData ? (
                  <>
                    <td className="py-3 px-4 font-semibold">{mode.name}</td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={editData.requires_proof || false}
                        onChange={(e) => setEditData({ ...editData, requires_proof: e.target.checked })}
                        disabled={busy}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={editData.requires_reference || false}
                        onChange={(e) => setEditData({ ...editData, requires_reference: e.target.checked })}
                        disabled={busy}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={editData.requires_received_by || false}
                        onChange={(e) => setEditData({ ...editData, requires_received_by: e.target.checked })}
                        disabled={busy}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={editData.auto_verifies || false}
                        onChange={(e) => setEditData({ ...editData, auto_verifies: e.target.checked })}
                        disabled={busy}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${mode.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                        {mode.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        onClick={saveEdit}
                        disabled={busy}
                      >
                        Save
                      </button>
                      <button
                        className="h-8 rounded-lg border bg-white px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                        onClick={cancelEdit}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3 px-4 font-semibold">{mode.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block w-5 h-5 rounded ${mode.requires_proof ? "bg-blue-500" : "bg-gray-200"}`}></span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block w-5 h-5 rounded ${mode.requires_reference ? "bg-blue-500" : "bg-gray-200"}`}></span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block w-5 h-5 rounded ${mode.requires_received_by ? "bg-blue-500" : "bg-gray-200"}`}></span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block w-5 h-5 rounded ${mode.auto_verifies ? "bg-green-500" : "bg-gray-200"}`}></span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${mode.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                        {mode.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        className="h-8 rounded-lg border bg-white px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                        onClick={() => startEdit(mode)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        className="h-8 rounded-lg border bg-white px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                        onClick={() => toggleActive(mode.id, mode.is_active)}
                        disabled={busy}
                      >
                        {mode.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {paymentModes.length === 0 && (
          <div className="py-8 text-center text-slate-500 text-sm">
            No payment modes configured.
          </div>
        )}
      </div>

      {/* Requirements legend */}
      <div className="mt-6 rounded-lg border bg-slate-50 p-4">
        <div className="text-sm font-semibold mb-3">Requirements Legend</div>
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded bg-blue-500"></span>
            <span><strong>Proof</strong> - Requires proof upload</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded bg-blue-500"></span>
            <span><strong>Reference</strong> - Requires reference number</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded bg-blue-500"></span>
            <span><strong>Staff</strong> - Requires staff member</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded bg-green-500"></span>
            <span><strong>Auto-Verify</strong> - Verifies automatically</span>
          </div>
        </div>
      </div>
    </div>
  );
}
