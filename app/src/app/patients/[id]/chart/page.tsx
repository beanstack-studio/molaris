"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ToothChart, { ToothStatus } from "@/components/ToothChart";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type { ChartEntry, ToothStatusRow, Patient } from "@/lib/types";
import { formatDateStandard, formatDateTimePH, combineFullName, splitFullName } from "@/lib/helpers";
import { useClinic } from "@/contexts/ClinicContext";
import { PageLoader } from "@/components/Spinner";
import { SortArrow } from "@/components/shared/TableOptions";
import { cn } from "@/lib/cn";


export default function ChartPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { clinicId } = useClinic();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [sortKey, setSortKey] = useState("date_desc");

  const loadData = useCallback(async () => {
    if (!id || !clinicId) return;
    setLoading(true);
    setError(null);

    // Load patient info
    const p = await supabase.from("patients").select("*").eq("id", id).eq("clinic_id", clinicId).single();
    if (!p.error && p.data) {
      const patRaw = p.data as any;
      const fallback = splitFullName(patRaw.full_name ?? "");
      const dbFirst = String(patRaw.first_name ?? "").trim();
      const dbLast = String(patRaw.last_name ?? "").trim();
      const firstNameFinal = dbFirst || fallback.first;
      const lastNameFinal = dbLast || fallback.last;

      setPatient({
        id: patRaw.id,
        clinic_id: patRaw.clinic_id,
        full_name: patRaw.full_name,
        first_name: firstNameFinal,
        middle_name: patRaw.middle_name ?? null,
        last_name: lastNameFinal,
        phone: patRaw.phone,
        birth_date: patRaw.birth_date,
        address: patRaw.address,
        occupation: patRaw.occupation,
        email: patRaw.email,
        gender: patRaw.gender,
        notes: patRaw.notes,
        created_at: patRaw.created_at,
        updated_at: patRaw.updated_at,
      });
    }

    const c = await supabase
      .from("dental_chart_entries")
      .select("id, tooth_number, surfaces, finding_code, finding_detail, notes, recorded_at")
      .eq("patient_id", id)
      .order("recorded_at", { ascending: false });

    if (c.error) {
      setError(c.error.message);
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
  }, [id, clinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveToothStatus(status: string) {
    if (!selectedTooth) return;

    setBusy(true);
    setError(null);

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
      setError(`Error saving status: ${up.error?.message || JSON.stringify(up.error)}`);
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
      setError(`Error saving history: ${hist.error?.message || JSON.stringify(hist.error)}`);
      return;
    }

    if (status !== "CARIES" && status !== "FILLED") setSurfaceSel([]);
    await loadData();
    setSelectedTooth(null);
  }

  async function editChartEntry(entry: ChartEntry) {
    setEditingEntry(entry);
    setEditNotes(entry.notes ?? "");
    setDeleteConfirmation("");
  }

  async function saveChartEntryEdit() {
    if (!editingEntry) return;
    setBusy(true);
    setError(null);

    const res = await supabase
      .from("dental_chart_entries")
      .update({ notes: editNotes.trim() || null })
      .eq("id", editingEntry.id);

    setBusy(false);
    if (res.error) return setError(res.error.message);

    setEditingEntry(null);
    await loadData();
  }

  async function deleteChartEntry() {
    if (!editingEntry || deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      setError("Type DELETE to confirm deletion.");
      return;
    }

    setBusy(true);
    setError(null);

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
      return setError(res.error.message);
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
        return setError(statusRes.error.message);
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
          return setError(statusRes.error.message);
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

  function getChartDir(col: string): "asc" | "desc" | null {
    if (sortKey === `${col}_asc`) return "asc";
    if (sortKey === `${col}_desc`) return "desc";
    return null;
  }

  function toggleChartSort(col: string) {
    setSortKey(sortKey === `${col}_asc` ? `${col}_desc` : `${col}_asc`);
  }

  function sortChart(a: ChartEntry, b: ChartEntry): number {
    if (sortKey === "tooth_asc") return Number(a.tooth_number) - Number(b.tooth_number);
    if (sortKey === "tooth_desc") return Number(b.tooth_number) - Number(a.tooth_number);
    if (sortKey === "finding_asc") return (a.finding_code ?? "").localeCompare(b.finding_code ?? "");
    if (sortKey === "finding_desc") return (b.finding_code ?? "").localeCompare(a.finding_code ?? "");
    if (sortKey === "surface_asc") return (a.surfaces ?? "").localeCompare(b.surfaces ?? "");
    if (sortKey === "surface_desc") return (b.surfaces ?? "").localeCompare(a.surfaces ?? "");
    if (sortKey === "detail_asc") return (a.finding_detail ?? "").localeCompare(b.finding_detail ?? "");
    if (sortKey === "detail_desc") return (b.finding_detail ?? "").localeCompare(a.finding_detail ?? "");
    if (sortKey === "date_asc") return (a.recorded_at ?? "").localeCompare(b.recorded_at ?? "");
    return (b.recorded_at ?? "").localeCompare(a.recorded_at ?? "");
  }

  if (loading) {
    return (
      <PageLoader />
    );
  }

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}

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
              <div className="card-title">Chart history</div>
            </div>

            {/* Desktop table */}
            <div className="table-wrapper hidden md:block">
              <table className="data-table min-w-[600px]">
                <colgroup>
                  <col className="col-15" />
                  <col className="col-12" />
                  <col className="col-18" />
                  <col className="col-15" />
                  <col className="col-25" />
                  <col className="col-15" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell cursor-pointer select-none" onClick={() => toggleChartSort("date")}>
                      Date <SortArrow dir={getChartDir("date")} />
                    </th>
                    <th className="data-table-head-cell cursor-pointer select-none" onClick={() => toggleChartSort("tooth")}>
                      Tooth <SortArrow dir={getChartDir("tooth")} />
                    </th>
                    <th className="data-table-head-cell cursor-pointer select-none" onClick={() => toggleChartSort("finding")}>
                      Finding <SortArrow dir={getChartDir("finding")} />
                    </th>
                    <th className="data-table-head-cell cursor-pointer select-none" onClick={() => toggleChartSort("surface")}>
                      Surfaces <SortArrow dir={getChartDir("surface")} />
                    </th>
                    <th className="data-table-head-cell cursor-pointer select-none" onClick={() => toggleChartSort("detail")}>
                      Detail <SortArrow dir={getChartDir("detail")} />
                    </th>
                    <th className="data-table-head-cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chart]
                    .sort(sortChart)
                    .map((entry, index) => (
                    <tr
                      key={entry.id}
                      className={cn("data-table-row cursor-pointer", index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd")}
                      onClick={() => editChartEntry(entry)}
                    >
                      <td className="data-table-cell">{entry.recorded_at ? formatDateStandard(entry.recorded_at.split('T')[0]) : "—"}</td>
                      <td className="data-table-cell">{entry.tooth_number}</td>
                      <td className="data-table-cell">{entry.finding_code}</td>
                      <td className="data-table-cell">{entry.surfaces ?? "—"}</td>
                      <td className="data-table-cell-truncate">{entry.finding_detail ?? "—"}</td>
                      <td className="data-table-cell-right">
                        <button onClick={(e) => { e.stopPropagation(); editChartEntry(entry); }} className="data-table-btn hidden lg:inline-flex">Edit</button>
                      </td>
                    </tr>
                  ))}
                  {chart.length === 0 ? (
                    <tr><td className="data-table-empty" colSpan={6}>No chart entries yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mt-3 grid gap-2 md:hidden">
              {chart.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No chart entries yet.</div>
              ) : (
                [...chart]
                  .sort(sortChart)
                  .map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm cursor-pointer" onClick={() => editChartEntry(entry)}>
                      <div className="flex items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">Tooth {entry.tooth_number}</span>
                            <span className="rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5">{entry.finding_code}</span>
                            {entry.surfaces && <span className="text-xs text-slate-500">{entry.surfaces}</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{entry.recorded_at ? formatDateStandard(entry.recorded_at.split('T')[0]) : "—"}</div>
                          {entry.finding_detail && <div className="text-xs text-slate-600 mt-1">{entry.finding_detail}</div>}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

      {/* Tooth Modal */}
      {selectedTooth !== null && (
        <div
          className="modal-container"
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedTooth(null); } }}
        >
          <div className="modal-panel-lg">
            <div className="modal-header flex items-center justify-between pr-4">
              <div className="modal-title">Tooth #{selectedTooth}</div>
              <button
                type="button"
                onClick={() => setSelectedTooth(null)}
                className="text-white/70 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-3">
                <div>
                  <div className="text-xs-semibold-slate-600-uppercase">Set Status</div>
                  <div className="flex-wrap-gap-2-mt-2">
                    {(["HEALTHY","CARIES","FILLED","MISSING","IMPLANT","CROWN","DENTURE","RCT","EXTRACTED"] as const).map((status) => {
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
                          className={cn("rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-200", isSelected ? selectedClass : primaryClass)}
                        >
                          {status.replace("_", " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(pendingStatus === "CARIES" || pendingStatus === "FILLED") && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Surfaces</div>
                    <div className="flex-wrap-gap-2-mt-2">
                      {["O", "M", "D", "B", "L", "F"].map((surf) => (
                        <button
                          key={surf}
                          type="button"
                          onClick={() => setSurfaceSel((prev) => prev.includes(surf) ? prev.filter((x) => x !== surf) : [...prev, surf])}
                          className={cn("h-7 w-7 rounded border text-xs font-semibold transition-colors", surfaceSel.includes(surf) ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400")}
                        >
                          {surf}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="form-field-wrapper">
                  <span className="text-xs font-semibold text-slate-700">Finding detail</span>
                  <input className="input-sm-text-sm" value={findingDetail} onChange={(e) => setFindingDetail(e.target.value)} />
                </label>

                <label className="form-field-wrapper">
                  <span className="text-xs font-semibold text-slate-700">Notes</span>
                  <textarea className="textarea-sm" value={toothNote} onChange={(e) => setToothNote(e.target.value)} />
                </label>

                <div className="flex justify-end">
                  <button
                    className="save-btn"
                    disabled={busy}
                    onClick={() => pendingStatus && saveToothStatus(pendingStatus)}
                  >
                    {busy ? "Saving…" : "Save status"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingEntry ? (
        <div className="modal-container" onDoubleClick={() => setEditingEntry(null)}>
          <div className="modal-panel">
            <div className="modal-header flex items-center justify-between pr-4">
              <div className="modal-title">Edit Entry — Tooth #{editingEntry.tooth_number}</div>
              <button type="button" onClick={() => { setEditingEntry(null); setError(null); setDeleteConfirmation(""); }} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="p-5">

            {error && <div className="error-message-red">{error}</div>}

            <div className="space-y-3">
              <div>
                <div className="text-field-label-mb-1">Finding</div>
                <div className="container-input-slate-50">
                  {editingEntry.finding_code}
                </div>
              </div>

              <div>
                <div className="text-field-label-mb-1">Surfaces</div>
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

              <div className="delete-confirmation">
                <div className="delete-confirmation-title">Delete Entry?</div>
                <div className="delete-confirmation-hint">
                  Type <span className="delete-confirmation-code">DELETE</span> to confirm
                </div>
                <input
                  type="text"
                  className="delete-confirmation-input mb-2"
                  placeholder="DELETE"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                />
              </div>

              <div className="flex-between-gap-2 mt-4">
                <button
                  onClick={() => deleteChartEntry()}
                  disabled={busy || deleteConfirmation.trim().toUpperCase() !== "DELETE"}
                  className="delete-btn"
                >
                  {busy ? "Deleting…" : "Delete"}
                </button>
                <div className="action-row">
                  <button
                    onClick={() => {
                      setEditingEntry(null);
                      setError(null);
                      setDeleteConfirmation("");
                    }}
                    className="cancel-btn"
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
        </div>
      ) : null}
    </>
  );
}
