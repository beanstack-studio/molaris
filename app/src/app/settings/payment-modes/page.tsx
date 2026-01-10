"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_PAYMENT_MODES = [
  { name: "Cash", sort_order: 1 },
  { name: "GCash", sort_order: 2 },
  { name: "Maya", sort_order: 3 },
  { name: "Bank Transfer", sort_order: 4 },
  { name: "Check", sort_order: 5 },
  { name: "Credit Card", sort_order: 6 },
];

export default function PaymentModesSettingsPage() {
  const [paymentModes, setPaymentModes] = useState<Array<{ id: string; name: string; is_active: boolean; sort_order: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [addingMode, setAddingMode] = useState(false);
  const [newModeName, setNewModeName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPaymentModes();
  }, []);

  async function loadPaymentModes() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("payment_modes")
      .select("id, name, is_active, sort_order")
      .order("sort_order", { ascending: true });

    setLoading(false);
    if (error === null && data) {
      setPaymentModes(data);
    } else if (error) {
      setErr("Failed to load payment modes: " + error.message);
    }
  }

  async function addPaymentMode() {
    if (!newModeName.trim()) return setErr("Enter a payment mode name.");
    
    setErr(null);
    setBusy(true);

    const maxSort = paymentModes.length > 0 ? Math.max(...paymentModes.map(m => m.sort_order)) : 0;

    const { data, error } = await supabase
      .from("payment_modes")
      .insert({ name: newModeName.trim(), is_active: true, sort_order: maxSort + 1 })
      .select();

    setBusy(false);
    if (error) {
      return setErr(error.message);
    }

    setNewModeName("");
    await loadPaymentModes();
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

  async function deleteMode(id: string) {
    if (!confirm("Delete this payment mode?")) return;

    setErr(null);
    setBusy(true);

    const { error } = await supabase
      .from("payment_modes")
      .delete()
      .eq("id", id);

    setBusy(false);
    if (error) {
      return setErr(error.message);
    }

    await loadPaymentModes();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <img src="/loading.gif" alt="Loading" className="h-12 w-12" />
          <div className="text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold">Payment Modes</h1>
        <p className="text-sm text-slate-600">Cash, GCash, Maya, bank transfer, and other payment methods.</p>
      </div>

      {err && <div className="mt-4 rounded-lg border bg-yellow-50 p-3 text-sm text-yellow-700">{err}</div>}

      {/* Add new mode */}
      
      <div className="mt-6 rounded-lg border bg-white p-4">
        <div className="text-sm font-semibold mb-3">Add payment mode</div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="e.g., GCash, Installment"
            className="flex-1 h-10 rounded-lg border bg-white px-3 text-sm"
            value={newModeName}
            onChange={(e) => setNewModeName(e.target.value)}
            disabled={busy}
          />
          <button
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            onClick={addPaymentMode}
            disabled={busy || !newModeName.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* List of payment modes */}
      <div className="mt-6 rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="py-3 px-4 font-semibold">Name</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paymentModes.map((mode, i) => (
              <tr key={mode.id} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                <td className="py-3 px-4">{mode.name}</td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${mode.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                    {mode.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    className="h-8 rounded-lg border bg-white px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => toggleActive(mode.id, mode.is_active)}
                    disabled={busy}
                  >
                    {mode.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="h-8 rounded-lg border bg-red-50 px-3 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                    onClick={() => deleteMode(mode.id)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paymentModes.length === 0 && (
          <div className="py-8 text-center text-slate-500 text-sm">
            No payment modes. Add one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
