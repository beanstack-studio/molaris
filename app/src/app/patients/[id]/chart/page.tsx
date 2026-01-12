"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ToothChart, { ToothStatus, getStatusTheme } from "@/components/ToothChart";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type { ChartEntry, ToothStatusRow, Patient } from "@/lib/types";
import { formatDateTimePH, combineFullName, splitFullName } from "@/lib/helpers";

export default function ChartPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [chart, setChart] = useState<ChartEntry[]>([]);
  const [toothStatuses, setToothStatuses] = useState<
    Record<number | string, { status: ToothStatus; note: string | null; updated_at?: string }>
  >({});
  const [selectedTooth, setSelectedTooth] = useState<number | string | null>(null);
  const [toothNote, setToothNote] = useState("");
  const [surfaceSel, setSurfaceSel] = useState<string[]>([]);
  const [findingDetail, setFindingDetail] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string>("HEALTHY");
  const [editingEntry, setEditingEntry] = useState<ChartEntry | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr(null);

    // Load patient info
    const p = await supabase.from("patients").select("*").eq("id", id).single();
    if (!p.error && p.data) {
      const patRaw = p.data as any;
      const fallback = splitFullName(patRaw.full_name ?? "");
      const dbFirst = String(patRaw.first_name ?? "").trim();
      const dbLast = String(patRaw.last_name ?? "").trim();
      const firstNameFinal = dbFirst || fallback.first;
      const lastNameFinal = dbLast || fallback.last;

      setPatient({
        id: patRaw.id,
        full_name: patRaw.full_name,
        first_name: firstNameFinal,
        last_name: lastNameFinal,
        phone: patRaw.phone,
        birth_date: patRaw.birth_date,
        address: patRaw.address,
        occupation: patRaw.occupation,
        email: patRaw.email,
        gender: patRaw.gender,
        notes: patRaw.notes,
      });
    }

    const c = await supabase
      .from("dental_chart_entries")
      .select("id, tooth_number, surfaces, finding_code, finding_detail, notes, recorded_at")
      .eq("patient_id", id)
      .order("recorded_at", { ascending: false });

    if (c.error) {
      setErr(c.error.message);
      setLoading(false);
      return;
    }
    setChart(c.data as ChartEntry[]);

    const s = await supabase
      .from("tooth_statuses")
      .select("tooth_number, status, note, updated_at")
      .eq("patient_id", id);

    if (!s.error && s.data) {
      const map: Record<number | string, { status: ToothStatus; note: string | null; updated_at?: string }> = {};
      for (const row of s.data as ToothStatusRow[]) {
        map[row.tooth_number] = {
          status: row.status as ToothStatus,
          note: row.note,
          updated_at: row.updated_at ?? undefined,
        };
      }
      setToothStatuses(map);
    } else {
      setToothStatuses({});
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveToothStatus(status: string) {
    if (!selectedTooth) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const up = await supabase.from("tooth_statuses").upsert(
      {
        patient_id: id,
        tooth_number: selectedTooth,
        status,
        note: toothNote.trim() || null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id,tooth_number" }
    );

    if (up.error) {
      setBusy(false);
      return setErr(up.error.message);
    }

    const surfacesToSave =
      status === "CARIES" || status === "FILLED"
        ? surfaceSel.length
          ? surfaceSel.slice().sort().join("")
          : null
        : null;

    const hist = await supabase.from("dental_chart_entries").insert({
      patient_id: id,
      tooth_number: selectedTooth,
      finding_code: status,
      finding_detail: findingDetail.trim() || null,
      surfaces: surfacesToSave,
      notes: toothNote.trim() || null,
    });

    setBusy(false);
    if (hist.error) return setErr(hist.error.message);

    if (status !== "CARIES" && status !== "FILLED") setSurfaceSel([]);
    await loadData();
  }

  async function editChartEntry(entry: ChartEntry) {
    setEditingEntry(entry);
    setEditNotes(entry.notes ?? "");
    setDeleteConfirmation("");
  }

  async function saveChartEntryEdit() {
    if (!editingEntry) return;
    setBusy(true);
    setErr(null);

    const res = await supabase
      .from("dental_chart_entries")
      .update({ notes: editNotes.trim() || null })
      .eq("id", editingEntry.id);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setEditingEntry(null);
    await loadData();
  }

  async function deleteChartEntry() {
    if (!editingEntry || deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      setErr("Type DELETE to confirm deletion.");
      return;
    }

    setBusy(true);
    setErr(null);

    // First, check how many entries exist for this tooth BEFORE deletion
    const countBefore = await supabase
      .from("dental_chart_entries")
      .select("id", { count: "exact" })
      .eq("patient_id", id)
      .eq("tooth_number", editingEntry.tooth_number);

    const totalEntries = countBefore.count ?? 0;

    // Delete the chart entry
    const res = await supabase
      .from("dental_chart_entries")
      .delete()
      .eq("id", editingEntry.id);

    if (res.error) {
      setBusy(false);
      return setErr(res.error.message);
    }

    // If this was the ONLY entry for this tooth, delete the status record
    if (totalEntries === 1) {
      const statusRes = await supabase
        .from("tooth_statuses")
        .delete()
        .eq("patient_id", id)
        .eq("tooth_number", editingEntry.tooth_number);

      if (statusRes.error) {
        setBusy(false);
        return setErr(statusRes.error.message);
      }
    } else if (totalEntries > 1) {
      // There are remaining entries - get the latest one and update status
      const remaining = await supabase
        .from("dental_chart_entries")
        .select("finding_code")
        .eq("patient_id", id)
        .eq("tooth_number", editingEntry.tooth_number)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      if (remaining.data && !remaining.error) {
        const latestStatus = remaining.data.finding_code as ToothStatus;
        const statusRes = await supabase
          .from("tooth_statuses")
          .update({ status: latestStatus, updated_at: new Date().toISOString() })
          .eq("patient_id", id)
          .eq("tooth_number", editingEntry.tooth_number);

        if (statusRes.error) {
          setBusy(false);
          return setErr(statusRes.error.message);
        }
      }
    }

    setBusy(false);
    setEditingEntry(null);
    setDeleteConfirmation("");
    // Reset selected tooth if it was the deleted one
    if (selectedTooth === editingEntry.tooth_number) {
      setSelectedTooth(null);
      setToothNote("");
      setPendingStatus("HEALTHY");
    }
    await loadData();
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
    <main className="min-h-screen bg-slate-50">
      <div className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">
            {patient ? combineFullName(patient.first_name, patient.last_name) || patient.full_name || "" : "Patient Chart"}
          </div>
          <button className="btn btn-secondary" onClick={() => window.history.back()}>
            Back
          </button>
        </div>

        {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        <div className="app-section-body">
          <PatientTabs activeTab="Chart" />

          <div>
            <ToothChart
              entries={chart ?? []}
              statuses={toothStatuses}
              selectedTooth={selectedTooth}
              onSelectTooth={(n) => {
                setSelectedTooth(n);
                setToothNote(toothStatuses[n]?.note ?? "");
                setPendingStatus(toothStatuses[n]?.status ?? "HEALTHY");
                setSurfaceSel([]);
                setFindingDetail("");
              }}
            />

            <div className="mt-4 rounded-xl border bg-slate-50 p-3">
              <div className="flex items-center justify-center">
                <div className="text-sm font-semibold">Tooth tools</div>
              </div>

              <div className="mt-2 text-center text-sm text-slate-700">
                Tooth# <span className="font-semibold text-slate-900">{selectedTooth ?? "—"}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                {/* LEFT COLUMN - Add/Update Status */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Set Status</div>
                  
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        "HEALTHY",
                        "CARIES",
                        "FILLED",
                        "MISSING",
                        "IMPLANT",
                        "CROWN",
                        "BRIDGE",
                        "ROOT_CANAL",
                        "EXTRACTED",
                      ] as const
                    ).map((status) => {
                      const theme = getStatusTheme(status);
                      const isSelected = pendingStatus === status;
                      const primaryClass = (() => {
                        if (status === "HEALTHY") return "bg-slate-100 border-slate-200 text-slate-800";
                        if (status === "CARIES") return "bg-rose-100 border-rose-200 text-rose-800";
                        if (status === "FILLED") return "bg-emerald-100 border-emerald-200 text-emerald-800";
                        if (status === "MISSING") return "bg-slate-200 border-slate-300 text-slate-900";
                        if (status === "EXTRACTED") return "bg-orange-100 border-orange-200 text-orange-800";
                        if (status === "ROOT_CANAL") return "bg-indigo-100 border-indigo-200 text-indigo-800";
                        if (status === "CROWN") return "bg-amber-100 border-amber-200 text-amber-800";
                        if (status === "BRIDGE") return "bg-purple-100 border-purple-200 text-purple-800";
                        if (status === "IMPLANT") return "bg-cyan-100 border-cyan-200 text-cyan-800";
                        return "bg-slate-100 border-slate-200 text-slate-800";
                      })();
                      const hoverClass = (() => {
                        if (status === "HEALTHY") return "hover:bg-slate-150 hover:border-slate-300";
                        if (status === "CARIES") return "hover:bg-rose-150 hover:border-rose-300";
                        if (status === "FILLED") return "hover:bg-emerald-150 hover:border-emerald-300";
                        if (status === "MISSING") return "hover:bg-slate-250 hover:border-slate-350";
                        if (status === "EXTRACTED") return "hover:bg-orange-150 hover:border-orange-300";
                        if (status === "ROOT_CANAL") return "hover:bg-indigo-150 hover:border-indigo-300";
                        if (status === "CROWN") return "hover:bg-amber-150 hover:border-amber-300";
                        if (status === "BRIDGE") return "hover:bg-purple-150 hover:border-purple-300";
                        if (status === "IMPLANT") return "hover:bg-cyan-150 hover:border-cyan-300";
                        return "hover:bg-slate-150 hover:border-slate-300";
                      })();
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setPendingStatus(status)}
                          className={[
                            "rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                            isSelected ? theme.chip : [primaryClass, hoverClass].join(" "),
                          ].join(" ")}
                        >
                          {status.replace("_", " ")}
                        </button>
                      );
                    })}
                  </div>

                  {(pendingStatus === "CARIES" || pendingStatus === "FILLED") && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-slate-700">Surfaces</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["O", "M", "D", "B", "L", "F"].map((surf) => (
                          <button
                            key={surf}
                            type="button"
                            onClick={() => {
                              setSurfaceSel((prev) =>
                                prev.includes(surf) ? prev.filter((x) => x !== surf) : [...prev, surf]
                              );
                            }}
                            className={[
                              "h-7 w-7 rounded border text-xs font-semibold transition-colors",
                              surfaceSel.includes(surf)
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400",
                            ].join(" ")}
                          >
                            {surf}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700 text-xs font-semibold">Finding detail</span>
                      <input
                        className="h-8 rounded-lg border px-2 text-sm"
                        value={findingDetail}
                        onChange={(e) => setFindingDetail(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="mt-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700 text-xs font-semibold">Notes</span>
                      <textarea
                        className="min-h-[72px] rounded-lg border px-2 py-1 text-sm"
                        value={toothNote}
                        onChange={(e) => setToothNote(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex justify-center">
                    <button
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={busy || selectedTooth === null}
                      onClick={() => saveToothStatus(pendingStatus)}
                    >
                      {busy ? "Saving…" : "Save status"}
                    </button>
                  </div>
                </div>

                {/* RIGHT COLUMN - Tooth History */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Tooth History</div>
                  
                  <div className="overflow-y-auto max-h-96 rounded-lg border bg-white">
                    {selectedTooth ? (
                      chart.filter((e) => e.tooth_number === selectedTooth).length > 0 ? (
                        <table className="data-table w-full">
                          <thead className="data-table-head">
                            <tr>
                              <th className="data-table-head-cell text-left">Finding</th>
                              <th className="data-table-head-cell text-left">Date</th>
                              <th className="data-table-head-cell-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {chart
                              .filter((e) => e.tooth_number === selectedTooth)
                              .map((entry, idx) => (
                                <tr key={entry.id} className={`data-table-row ${idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                                  <td className="data-table-cell">{entry.finding_code}</td>
                                  <td className="data-table-cell text-xs">
                                    {entry.recorded_at ? new Date(entry.recorded_at).toLocaleDateString() : "—"}
                                  </td>
                                  <td className="data-table-cell-right">
                                    <button
                                      onClick={() => editChartEntry(entry)}
                                      className="data-table-btn"
                                    >
                                      Edit
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-3 text-center text-sm text-slate-500">No history for this tooth</div>
                      )
                    ) : (
                      <div className="p-3 text-center text-sm text-slate-500">Select a tooth</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border bg-white p-4">
              <div className="text-sm font-semibold">Chart history</div>

              <div className="mt-3 overflow-x-auto">
                <table className="data-table">
                  <colgroup>
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "35%" }} />
                    <col style={{ width: "20%" }} />
                  </colgroup>
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell">Tooth</th>
                      <th className="data-table-head-cell">Finding</th>
                      <th className="data-table-head-cell">Surfaces</th>
                      <th className="data-table-head-cell">Detail</th>
                      <th className="data-table-head-cell-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.map((entry, index) => (
                      <tr key={entry.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                        <td className="data-table-cell">{entry.tooth_number}</td>
                        <td className="data-table-cell">{entry.finding_code}</td>
                        <td className="data-table-cell">{entry.surfaces ?? "—"}</td>
                        <td className="data-table-cell-truncate">{entry.finding_detail ?? "—"}</td>
                        <td className="data-table-cell-right">
                          <button
                            onClick={() => editChartEntry(entry)}
                            className="data-table-btn"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                    {chart.length === 0 ? (
                      <tr>
                        <td className="data-table-empty" colSpan={5}>
                          No chart entries yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editingEntry ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onDoubleClick={() => setEditingEntry(null)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <div className="text-lg font-semibold mb-4">
              Edit Entry — Tooth #{editingEntry.tooth_number}
            </div>

            {err && <div className="mb-3 rounded-lg border bg-red-50 p-3 text-sm text-red-600">{err}</div>}

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-700 mb-1">Finding</div>
                <div className="px-3 py-2 rounded-lg bg-slate-50 text-sm text-slate-600">
                  {editingEntry.finding_code}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-slate-700 mb-1">Surfaces</div>
                <div className="px-3 py-2 rounded-lg bg-slate-50 text-sm text-slate-600">
                  {editingEntry.surfaces || "—"}
                </div>
              </div>

              <div>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700 font-medium">Finding detail</span>
                  <input
                    className="h-10 rounded-lg border px-3 bg-slate-50"
                    value={editingEntry.finding_detail ?? ""}
                    disabled
                  />
                </label>
              </div>

              <div>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700 font-medium">Notes</span>
                  <textarea
                    className="min-h-[88px] rounded-lg border px-3 py-2"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </label>
              </div>

              <div className="mt-4 border-t pt-3">
                <div className="text-xs font-semibold text-slate-700 mb-2">Delete Entry</div>
                <div className="text-xs text-slate-600 mb-2">Type <span className="font-mono font-semibold">DELETE</span> to confirm:</div>
                <input
                  type="text"
                  className="w-full h-8 rounded-lg border px-3 text-sm mb-2"
                  placeholder="DELETE"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2 mt-4">
                <button
                  onClick={() => deleteChartEntry()}
                  disabled={busy || deleteConfirmation.trim().toUpperCase() !== "DELETE"}
                  className="rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 px-3 py-2 transition-colors"
                >
                  {busy ? "Deleting…" : "Delete"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingEntry(null);
                      setErr(null);
                      setDeleteConfirmation("");
                    }}
                    className="rounded-lg bg-slate-200 text-sm font-medium text-slate-800 hover:bg-slate-300 px-4 py-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveChartEntryEdit()}
                    disabled={busy}
                    className="rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 px-4 py-2 transition-colors"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
