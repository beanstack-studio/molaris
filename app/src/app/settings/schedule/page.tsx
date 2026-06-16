"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";
import { formatDateStandard } from "@/lib/helpers";
import { DatePickerField } from "@/components/DatePickerField";
import { Toggle } from "@/components/Toggle";
import { Spinner } from "@/components/Spinner";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TIME_OPTIONS = Array.from({ length: 14 }, (_, i) => {
  const h = 6 + i;
  const label = h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`;
  return { value: `${String(h).padStart(2, "0")}:00`, label };
});

type DentistRow = { id: string; full_name: string; nickname: string | null; color: string | null };
type DaySchedule = { isWorking: boolean; startTime: string; endTime: string };
type BlockoutRow = { id: string; start_date: string; end_date: string; reason: string | null };
type DentistScheduleState = {
  weekSchedule: DaySchedule[];
  blockouts: BlockoutRow[];
  expanded: boolean;
  busy: boolean;
  saved: boolean;
};

const defaultWeek = (): DaySchedule[] =>
  DAYS.map((_, i) => ({ isWorking: i >= 1 && i <= 5, startTime: "08:00", endTime: "17:00" }));

export default function ScheduleSettingsPage() {
  const { clinicId, isLoading: clinicLoading } = useClinic();
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [schedules, setSchedules] = useState<Record<string, DentistScheduleState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newBlockoutStart, setNewBlockoutStart] = useState<Record<string, string>>({});
  const [newBlockoutEnd, setNewBlockoutEnd] = useState<Record<string, string>>({});
  const [newBlockoutReason, setNewBlockoutReason] = useState<Record<string, string>>({});
  const blockoutStartRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const blockoutEndRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadDentists = useCallback(async () => {
    if (clinicLoading || !clinicId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("dentists")
      .select("id, full_name, nickname, color")
      .eq("clinic_id", clinicId)
      .order("full_name");
    if (err) { setError(err.message); setLoading(false); return; }
    const list = (data || []) as DentistRow[];
    setDentists(list);
    setLoading(false);
  }, [clinicId, clinicLoading]);

  useEffect(() => { loadDentists(); }, [loadDentists]);

  async function expandDentist(dentistId: string) {
    const currentlyExpanded = schedules[dentistId]?.expanded ?? false;

    setSchedules((prev) => ({
      ...prev,
      [dentistId]: {
        ...(prev[dentistId] ?? { weekSchedule: defaultWeek(), blockouts: [], busy: false, saved: false }),
        expanded: !currentlyExpanded,
      },
    }));

    if (currentlyExpanded) return; // collapsing — don't reload

    const [schedRes, blockRes] = await Promise.all([
      supabase.from("dentist_schedules").select("*").eq("dentist_id", dentistId),
      supabase.from("dentist_blockouts").select("*").eq("dentist_id", dentistId).order("start_date"),
    ]);

    const week: DaySchedule[] = DAYS.map((_, idx) => {
      const row = (schedRes.data ?? []).find((s: Record<string, unknown>) => s.day_of_week === idx);
      return row
        ? { isWorking: row.is_working as boolean, startTime: (row.start_time as string).substring(0, 5), endTime: (row.end_time as string).substring(0, 5) }
        : { isWorking: idx >= 1 && idx <= 5, startTime: "08:00", endTime: "17:00" };
    });

    setSchedules((prev) => ({
      ...prev,
      [dentistId]: {
        ...prev[dentistId],
        weekSchedule: week,
        blockouts: (blockRes.data ?? []) as BlockoutRow[],
        expanded: true,
      },
    }));
  }

  async function saveSchedule(dentistId: string) {
    const state = schedules[dentistId];
    if (!state) return;
    setSchedules((prev) => ({ ...prev, [dentistId]: { ...prev[dentistId], busy: true } }));
    const rows = state.weekSchedule.map((day, idx) => ({
      dentist_id: dentistId,
      day_of_week: idx,
      start_time: day.startTime,
      end_time: day.endTime,
      is_working: day.isWorking,
    }));
    const { error: err } = await supabase
      .from("dentist_schedules")
      .upsert(rows, { onConflict: "dentist_id,day_of_week" });
    setSchedules((prev) => ({
      ...prev,
      [dentistId]: { ...prev[dentistId], busy: false, saved: !err },
    }));
    if (err) setError(err.message);
    setTimeout(() => setSchedules((prev) => ({ ...prev, [dentistId]: { ...prev[dentistId], saved: false } })), 2000);
  }

  function updateDay(dentistId: string, dayIdx: number, patch: Partial<DaySchedule>) {
    setSchedules((prev) => {
      const week = [...(prev[dentistId]?.weekSchedule ?? defaultWeek())];
      week[dayIdx] = { ...week[dayIdx], ...patch };
      return { ...prev, [dentistId]: { ...prev[dentistId], weekSchedule: week } };
    });
  }

  async function addBlockout(dentistId: string) {
    const start = newBlockoutStart[dentistId];
    const end = newBlockoutEnd[dentistId];
    if (!start || !end) return;
    setSchedules((prev) => ({ ...prev, [dentistId]: { ...prev[dentistId], busy: true } }));
    const { data, error: err } = await supabase
      .from("dentist_blockouts")
      .insert({ dentist_id: dentistId, start_date: start, end_date: end, reason: newBlockoutReason[dentistId]?.trim() || null })
      .select()
      .single();
    if (err) {
      setSchedules((prev) => ({ ...prev, [dentistId]: { ...prev[dentistId], busy: false } }));
      setError(err.message);
      return;
    }
    setSchedules((prev) => ({
      ...prev,
      [dentistId]: {
        ...prev[dentistId],
        busy: false,
        blockouts: [...(prev[dentistId]?.blockouts ?? []), data as BlockoutRow].sort((a, b) => a.start_date.localeCompare(b.start_date)),
      },
    }));
    setNewBlockoutStart((p) => ({ ...p, [dentistId]: "" }));
    setNewBlockoutEnd((p) => ({ ...p, [dentistId]: "" }));
    setNewBlockoutReason((p) => ({ ...p, [dentistId]: "" }));
  }

  async function deleteBlockout(dentistId: string, blockoutId: string) {
    await supabase.from("dentist_blockouts").delete().eq("id", blockoutId);
    setSchedules((prev) => ({
      ...prev,
      [dentistId]: {
        ...prev[dentistId],
        blockouts: prev[dentistId].blockouts.filter((b) => b.id !== blockoutId),
      },
    }));
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner /></div>;

  return (
    <div className="spacing-vertical-lg">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Dentist Schedules</h2>
        </div>

        {dentists.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No dentists added yet. Add dentists in the Team settings.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {dentists.map((d) => {
              const state = schedules[d.id];
              const isExpanded = state?.expanded ?? false;
              return (
                <div key={d.id}>
                  {/* Dentist header row */}
                  <button
                    type="button"
                    onClick={() => expandDentist(d.id)}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color || "#6366f1" }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{d.full_name}</span>
                      {d.nickname && <span className="text-xs text-slate-400">({d.nickname})</span>}
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded schedule content */}
                  {isExpanded && (
                    <div className="px-4 pb-6 bg-slate-50 dark:bg-slate-800/30">
                      {/* Weekly schedule */}
                      <div className="pt-4">
                        <p className="field-label-text mb-3">Weekly schedule</p>
                        <div className="divide-y divide-slate-100 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                          {DAYS.map((day, idx) => {
                            const daySched = state?.weekSchedule?.[idx] ?? { isWorking: idx >= 1 && idx <= 5, startTime: "08:00", endTime: "17:00" };
                            return (
                              <div key={day} className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-sm font-medium ${daySched.isWorking ? "text-slate-800 dark:text-slate-100" : "text-slate-400 line-through"}`}>{day}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{daySched.isWorking ? "Working" : "Day off"}</span>
                                    <Toggle
                                      checked={daySched.isWorking}
                                      onChange={(v) => updateDay(d.id, idx, { isWorking: v })}
                                    />
                                  </div>
                                </div>
                                {daySched.isWorking && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">Start</label>
                                      <select
                                        className="input-standard w-full text-xs"
                                        value={daySched.startTime}
                                        onChange={(e) => updateDay(d.id, idx, { startTime: e.target.value })}
                                      >
                                        {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">End</label>
                                      <select
                                        className="input-standard w-full text-xs"
                                        value={daySched.endTime}
                                        onChange={(e) => updateDay(d.id, idx, { endTime: e.target.value })}
                                      >
                                        {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-end mt-3">
                          <button
                            className="save-btn"
                            onClick={() => saveSchedule(d.id)}
                            disabled={state?.busy}
                          >
                            {state?.busy ? "Saving…" : state?.saved ? "Saved!" : "Save schedule"}
                          </button>
                        </div>
                      </div>

                      {/* Blockouts */}
                      <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
                        <p className="field-label-text mb-3">Leave / blockouts</p>
                        {(!state?.blockouts || state.blockouts.length === 0) ? (
                          <p className="hint-text mb-3">No blockouts set.</p>
                        ) : (
                          <div className="space-y-2 mb-4">
                            {state.blockouts.map((b) => (
                              <div key={b.id} className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {b.start_date === b.end_date
                                      ? formatDateStandard(b.start_date)
                                      : `${formatDateStandard(b.start_date)} → ${formatDateStandard(b.end_date)}`}
                                  </p>
                                  {b.reason && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{b.reason}</p>}
                                </div>
                                <button
                                  onClick={() => deleteBlockout(d.id, b.id)}
                                  className="data-table-btn-danger shrink-0"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <DatePickerField
                            label="From"
                            value={newBlockoutStart[d.id] ?? ""}
                            onChange={(v) => setNewBlockoutStart((p) => ({ ...p, [d.id]: v }))}
                            inputRef={{ current: blockoutStartRefs.current[d.id] ?? null }}
                            variant="case-modal"
                          />
                          <DatePickerField
                            label="To"
                            value={newBlockoutEnd[d.id] ?? ""}
                            onChange={(v) => setNewBlockoutEnd((p) => ({ ...p, [d.id]: v }))}
                            inputRef={{ current: blockoutEndRefs.current[d.id] ?? null }}
                            variant="case-modal"
                            min={newBlockoutStart[d.id]}
                          />
                        </div>
                        <input
                          type="text"
                          className="input-standard w-full mt-2 text-sm"
                          placeholder="Reason (e.g. Vacation, Conference)"
                          value={newBlockoutReason[d.id] ?? ""}
                          onChange={(e) => setNewBlockoutReason((p) => ({ ...p, [d.id]: e.target.value }))}
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            className="save-btn"
                            onClick={() => addBlockout(d.id)}
                            disabled={state?.busy || !newBlockoutStart[d.id] || !newBlockoutEnd[d.id]}
                          >
                            Add blockout
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
