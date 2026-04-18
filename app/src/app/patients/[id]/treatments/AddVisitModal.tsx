"use client";

import { useEffect, useRef, useState } from "react";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";
import { supabase } from "@/lib/supabaseClient";
import type { DentistRow, ServicePriceRow, DraftLine } from "@/lib/types";
import { todayLocalISO } from "@/lib/helpers";

interface ConfirmedAppt {
  id: string;
  appointment_date: string;
  appointment_time: string;
  dentist_id: string | null;
  concern_type: string | null;
  dentistName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patientId: string;
  dentists: DentistRow[];
  serviceMenu: ServicePriceRow[];
  defaultConcern: string;
}

const formatTime12Hr = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export function AddVisitModal({ open, onClose, onSaved, patientId, dentists, serviceMenu, defaultConcern }: Props) {
  const [visitDate, setVisitDate] = useState(() => todayLocalISO());
  const [visitDentistId, setVisitDentistId] = useState("");
  const [visitConcern, setVisitConcern] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visitDateRef = useRef<HTMLInputElement | null>(null);

  const [linkedApptId, setLinkedApptId] = useState<string>("");
  const [confirmedAppts, setConfirmedAppts] = useState<ConfirmedAppt[]>([]);

  useEffect(() => {
    if (open) {
      setVisitDate(todayLocalISO());
      setVisitDentistId("");
      setVisitConcern(defaultConcern);
      setDraftLines([]);
      setBusy(false);
      setError(null);
      setLinkedApptId("");
      loadConfirmedAppts();
    }
  }, [open, defaultConcern]);

  async function loadConfirmedAppts() {
    if (!patientId) return;
    const { data } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_time, dentist_id, concern_type, dentists(full_name)")
      .eq("patient_id", patientId)
      .in("status", ["confirmed", "pending"])
      .is("deleted_at", null)
      .order("appointment_date", { ascending: false })
      .limit(10);
    setConfirmedAppts(
      (data ?? []).map((a: any) => ({
        id: a.id,
        appointment_date: a.appointment_date,
        appointment_time: a.appointment_time,
        dentist_id: a.dentist_id,
        concern_type: a.concern_type,
        dentistName: a.dentists?.full_name ?? "",
      }))
    );
  }

  function handleApptSelect(apptId: string) {
    setLinkedApptId(apptId);
    if (!apptId) return;
    const appt = confirmedAppts.find((a) => a.id === apptId);
    if (!appt) return;
    setVisitDate(appt.appointment_date);
    if (appt.dentist_id) setVisitDentistId(appt.dentist_id);
    if (appt.concern_type) setVisitConcern(appt.concern_type);
  }

  function handleClose() {
    setVisitDate(todayLocalISO());
    setVisitDentistId("");
    setVisitConcern("");
    setDraftLines([]);
    setError(null);
    onClose();
  }

  function removeDraftLine(id: string) {
    setDraftLines((prev) => prev.filter((ln) => ln.id !== id));
  }

  async function handleSave() {
    setError(null);
    if (!visitDate) return setError("Select a visit date.");
    if (!visitConcern.trim()) return setError("Enter the visit concern.");
    if (!visitDentistId) return setError("Select the attending dentist.");
    if (draftLines.length === 0) return setError("Add at least one procedure.");

    setBusy(true);
    const dentistName = dentists.find((d) => d.id === visitDentistId)?.full_name || "";
    const payload = draftLines.map((ln) => ({
      patient_id: patientId,
      treatment_date: visitDate,
      procedure: ln.procedure,
      tooth_number: ln.tooth_number,
      notes: ln.note || null,
      visit_concern: visitConcern.trim() || null,
      dentist_id: visitDentistId || null,
      dentist_name: dentistName || null,
      service_price_id: ln.service_price_id,
      appointment_id: linkedApptId || null,
    }));

    const ins = await supabase.from("treatments").insert(payload);
    setBusy(false);
    if (ins.error) return setError(ins.error.message);

    if (linkedApptId) {
      await supabase.from("appointments").update({ status: "completed" }).eq("id", linkedApptId);
    }

    onSaved();
    handleClose();
  }

  const sortedMenu = serviceMenu.slice().sort((a, b) => {
    if (a.item_type !== b.item_type) return a.item_type === "SERVICE" ? -1 : 1;
    return a.service_name.localeCompare(b.service_name);
  });

  return (
    <EditModal open={open} title="Add visit" onClose={handleClose}>
      <div className="spacing-vertical-lg">
        {error && <div className="error-banner">{error}</div>}

        {/* Linked appointment */}
        <div className="grid-gap-1">
          <label className="text-field-label">Appointment</label>
          <select
            className="input-full"
            value={linkedApptId}
            onChange={(e) => handleApptSelect(e.target.value)}
          >
            <option value="">Walk-in (no appointment)</option>
            {confirmedAppts.map((a) => {
              const d = new Date(a.appointment_date + "T00:00:00");
              const label = `${d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "2-digit" })} · ${formatTime12Hr(a.appointment_time)}${a.dentistName ? " · " + a.dentistName : ""}${a.concern_type ? " — " + a.concern_type : ""}`;
              return <option key={a.id} value={a.id}>{label}</option>;
            })}
          </select>
          {confirmedAppts.length === 0 && (
            <p className="text-xs text-slate-400">No pending appointments found for this patient.</p>
          )}
        </div>

        {/* Visit Date and Dentist - Side by Side */}
        <div className="section-columns">
          <div className="w-[40%]">
            <DatePickerField
              label="Visit date"
              value={visitDate}
              onChange={setVisitDate}
              inputRef={visitDateRef}
              variant="visit-modal"
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="grid-gap-1 w-[60%]">
            <label className="text-field-label">Dentist</label>
            <select
              className="input-full"
              value={visitDentistId}
              onChange={(e) => setVisitDentistId(e.target.value)}
            >
              <option value="">Select dentist…</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Visit Concern */}
        <div className="grid-gap-1">
          <label className="text-field-label">Concern</label>
          <input
            type="text"
            className="input-standard"
            value={visitConcern}
            onChange={(e) => setVisitConcern(e.target.value)}
            placeholder="Chief complaint or concern"
          />
        </div>

        {/* Treatment Items */}
        <div className="space-y-2">
          <div className="text-field-label">Treatments ({draftLines.length})</div>
          {draftLines.map((t) => (
            <div key={t.id} className="info-box">
              <div className="three-col-row">
                <div className="grid gap-1">
                  <label className="field-sublabel">Tooth #</label>
                  <input
                    type="number"
                    className="input-standard-sm"
                    placeholder="Optional"
                    value={t.tooth_number?.toString() || ""}
                    onChange={(e) =>
                      setDraftLines((prev) =>
                        prev.map((dl) =>
                          dl.id === t.id
                            ? { ...dl, tooth_number: e.target.value.trim() ? Number(e.target.value) : null }
                            : dl
                        )
                      )
                    }
                    min="1"
                    max="32"
                  />
                </div>
                <div className="field-full-row">
                  <label className="field-sublabel">Treatment</label>
                  <select
                    className="input-standard"
                    value={t.service_price_id || ""}
                    onChange={(e) => {
                      const svc = serviceMenu.find((s) => s.id === e.target.value);
                      setDraftLines((prev) =>
                        prev.map((dl) =>
                          dl.id === t.id
                            ? { ...dl, service_price_id: e.target.value, procedure: svc?.service_name ?? "" }
                            : dl
                        )
                      );
                    }}
                  >
                    <option value="">Select treatment</option>
                    {sortedMenu.map((s) => (
                      <option key={s.id} value={s.id}>{s.service_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-row">
                <input
                  type="text"
                  className="input-flex-sm"
                  placeholder="Notes…"
                  value={t.note ?? ""}
                  onChange={(e) =>
                    setDraftLines((prev) =>
                      prev.map((dl) => (dl.id === t.id ? { ...dl, note: e.target.value } : dl))
                    )
                  }
                />
                <button
                  className="item-delete-btn"
                  onClick={() => removeDraftLine(t.id)}
                  title="Remove treatment"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {draftLines.length === 0 && (
            <div className="hint-text">No treatments on this visit yet.</div>
          )}

          <button
            className="add-row-btn"
            onClick={() =>
              setDraftLines((prev) => [
                ...prev,
                { id: crypto.randomUUID(), tooth_number: null, service_price_id: null, procedure: "", note: "" },
              ])
            }
          >
            + Add Treatment
          </button>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <div className="modal-actions-right">
            <button className="cancel-btn" onClick={handleClose} disabled={busy}>
              Cancel
            </button>
            <button
              className="save-btn"
              disabled={busy || draftLines.length === 0 || !visitConcern.trim() || !visitDentistId}
              onClick={handleSave}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </EditModal>
  );
}
