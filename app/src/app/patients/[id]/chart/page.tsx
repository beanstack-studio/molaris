"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ToothChart, { ToothStatus, getStatusTheme } from "@/components/ToothChart";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type { ChartEntry, ToothStatusRow, Patient } from "@/lib/types";
import { formatDatePH, formatDateTimePH, combineFullName, splitFullName } from "@/lib/helpers";

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
  const [pendingStatus, setPendingStatus] = useState<ToothStatus | null>("HEALTHY");
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

    const payload = {
      patient_id: id,
      tooth_number: selectedTooth,
      status: status as any,
      note: toothNote.trim() || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    // First, try to delete any existing record
    await supabase.from("tooth_statuses").delete().eq("patient_id", id).eq("tooth_number", selectedTooth);

    // Then insert the new record
    const up = await supabase.from("tooth_statuses").insert(payload);

    if (up.error) {
      console.error("Insert error:", up.error);
      setBusy(false);
      setErr(`Error saving status: ${up.error?.message || JSON.stringify(up.error)}`);
      return;
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
    if (hist.error) {
      setErr(`Error saving history: ${hist.error?.message || JSON.stringify(hist.error)}`);
      return;
    }

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
      <div className="loading-screen">
        <div className="loading-container">
          <img src="/loading.gif" alt="Loading" className="loading-icon" />
          <div className="loading-text">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {err ? <div className="error-banner">{err}</div> : null}
      <div className="page-content">
        <div className="page-sections">
          <div className="card">
            <ToothChart
              entries={chart ?? []}
              statuses={toothStatuses}
              selectedTooth={selectedTooth}
              previewStatus={selectedTooth ? pendingStatus : null}
              onSelectTooth={(n) => {
                setSelectedTooth(n);
                setToothNote(toothStatuses[n]?.note ?? "");
                setPendingStatus(toothStatuses[n]?.status ?? "HEALTHY");
                setSurfaceSel([]);
                setFindingDetail("");
              }}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Tooth tools</div>
            </div>

            <div className="text-left-mt-2-sm-slate-700">
              Tooth# <span className="font-semibold text-slate-900">{selectedTooth ?? "—"}</span>
            </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                {/* LEFT COLUMN - Add/Update Status */}
                <div>
                  <div className="text-xs-semibold-slate-600-uppercase">Set Status</div>
                  
                  <div className="flex-wrap-gap-2-mt-2">
                    {(
                      [
                        "HEALTHY",
                        "CARIES",
                        "FILLED",
                        "MISSING",
                        "IMPLANT",
                        "CROWN",
                        "DENTURE",
                        "RCT",
                        "EXTRACTED",
                      ] as const
                    ).map((status) => {
                      const theme = getStatusTheme(status);
                      const isSelected = pendingStatus === status;
                      const primaryClass = (() => {
                        if (status === "HEALTHY") return "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 hover:border-slate-400 hover:shadow-sm";
                        if (status === "CARIES") return "bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200 hover:border-rose-400 hover:shadow-sm";
                        if (status === "FILLED") return "bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200 hover:border-emerald-400 hover:shadow-sm";
                        if (status === "MISSING") return "bg-slate-200 border-slate-400 text-slate-800 hover:bg-slate-300 hover:border-slate-500 hover:shadow-sm";
                        if (status === "EXTRACTED") return "bg-orange-100 border-orange-300 text-orange-800 hover:bg-orange-200 hover:border-orange-400 hover:shadow-sm";
                        if (status === "RCT") return "bg-indigo-100 border-indigo-300 text-indigo-800 hover:bg-indigo-200 hover:border-indigo-400 hover:shadow-sm";
                        if (status === "CROWN") return "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 hover:border-amber-400 hover:shadow-sm";
                        if (status === "DENTURE") return "bg-purple-100 border-purple-300 text-purple-800 hover:bg-purple-200 hover:border-purple-400 hover:shadow-sm";
                        if (status === "IMPLANT") return "bg-cyan-100 border-cyan-300 text-cyan-800 hover:bg-cyan-200 hover:border-cyan-400 hover:shadow-sm";
                        return "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 hover:border-slate-400 hover:shadow-sm";
                      })();
                      const selectedClass = (() => {
                        if (status === "HEALTHY") return "bg-slate-800 border-slate-900 text-white shadow-lg ring-2 ring-slate-300";
                        if (status === "CARIES") return "bg-rose-600 border-rose-700 text-white shadow-lg ring-2 ring-rose-200";
                        if (status === "FILLED") return "bg-emerald-600 border-emerald-700 text-white shadow-lg ring-2 ring-emerald-200";
                        if (status === "MISSING") return "bg-slate-700 border-slate-800 text-white shadow-lg ring-2 ring-slate-200";
                        if (status === "EXTRACTED") return "bg-orange-600 border-orange-700 text-white shadow-lg ring-2 ring-orange-200";
                        if (status === "RCT") return "bg-indigo-600 border-indigo-700 text-white shadow-lg ring-2 ring-indigo-200";
                        if (status === "CROWN") return "bg-amber-600 border-amber-700 text-white shadow-lg ring-2 ring-amber-200";
                        if (status === "DENTURE") return "bg-purple-600 border-purple-700 text-white shadow-lg ring-2 ring-purple-200";
                        if (status === "IMPLANT") return "bg-cyan-600 border-cyan-700 text-white shadow-lg ring-2 ring-cyan-200";
                        return "bg-slate-800 border-slate-900 text-white shadow-lg ring-2 ring-slate-300";
                      })();
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setPendingStatus(status)}
                          className={[
                            "rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-200",
                            isSelected ? selectedClass : primaryClass,
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
                      <div className="flex-wrap-gap-2-mt-2">
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
                    <label className="form-field-wrapper">
                      <span className="text-slate-700-xs-semibold">Finding detail</span>
                      <input
                        className="input-sm-text-sm"
                        value={findingDetail}
                        onChange={(e) => setFindingDetail(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="mt-3">
                    <label className="form-field-wrapper">
                      <span className="text-slate-700-xs-semibold">Notes</span>
                      <textarea
                        className="textarea-sm"
                        value={toothNote}
                        onChange={(e) => setToothNote(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="flex-center-text-sm">
                    <button
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={busy || selectedTooth === null}
                      onClick={() => pendingStatus && saveToothStatus(pendingStatus)}
                    >
                      {busy ? "Saving…" : "Save status"}
                    </button>
                  </div>
                </div>

                {/* RIGHT COLUMN - Tooth History */}
                <div>
                  <div className="text-xs-semibold-slate-600-uppercase">Tooth History</div>
                  
                  <div className="overflow-scroll-bordered">
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
                                    {entry.recorded_at ? formatDatePH(entry.recorded_at.split('T')[0]) : "—"}
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
                        <div className="container-center-sm-slate-500">No history for this tooth</div>
                      )
                    ) : (
                      <div className="container-center-sm-slate-500">Select a tooth</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Chart history</div>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <colgroup>
                    <col className="col-12" />
                    <col className="col-18" />
                    <col className="col-15" />
                    <col className="col-35" />
                    <col className="col-20" />
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

      {editingEntry ? (
        <div className="modal-container" onDoubleClick={() => setEditingEntry(null)}>
          <div className="container-bg-white-rounded-shadow">
            <div className="text-lg font-semibold mb-4">
              Edit Entry — Tooth #{editingEntry.tooth_number}
            </div>

            {err && <div className="error-message-red">{err}</div>}

            <div className="space-y-3-base">
              <div>
                <div className="text-sm-medium-slate-700-mb-1">Finding</div>
                <div className="container-input-slate-50">
                  {editingEntry.finding_code}
                </div>
              </div>

              <div>
                <div className="text-sm-medium-slate-700-mb-1">Surfaces</div>
                <div className="container-input-slate-50">
                  {editingEntry.surfaces || "—"}
                </div>
              </div>

              <div>
                <label className="form-field-wrapper">
                  <span className="text-slate-700-medium">Finding detail</span>
                  <input
                    className="input-readonly-slate-bg"
                    value={editingEntry.finding_detail ?? ""}
                    disabled
                  />
                </label>
              </div>

              <div>
                <label className="form-field-wrapper">
                  <span className="text-slate-700-medium">Notes</span>
                  <textarea
                    className="textarea-standard"
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

              <div className="flex-between-gap-2 mt-4">
                <button
                  onClick={() => deleteChartEntry()}
                  disabled={busy || deleteConfirmation.trim().toUpperCase() !== "DELETE"}
                  className="btn-action-red"
                >
                  {busy ? "Deleting…" : "Delete"}
                </button>
                <div className="flex-gap-2">
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
                    className="save-btn"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
