"use client";

import { useEffect, useRef, useState } from "react";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";
import { supabase } from "@/lib/supabaseClient";
import type { DentistRow, ServicePriceRow, DraftLine } from "@/lib/types";
import { todayLocalISO } from "@/lib/helpers";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patientId: string;
  dentists: DentistRow[];
  serviceMenu: ServicePriceRow[];
  defaultConcern: string;
}

export function AddVisitModal({ open, onClose, onSaved, patientId, dentists, serviceMenu, defaultConcern }: Props) {
  const [visitDate, setVisitDate] = useState(() => todayLocalISO());
  const [visitDentistId, setVisitDentistId] = useState("");
  const [visitConcern, setVisitConcern] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visitDateRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setVisitDate(todayLocalISO());
      setVisitDentistId("");
      setVisitConcern(defaultConcern);
      setDraftLines([]);
      setBusy(false);
      setError(null);
    }
  }, [open, defaultConcern]);

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
    }));

    const ins = await supabase.from("treatments").insert(payload);
    setBusy(false);
    if (ins.error) return setError(ins.error.message);

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

        {/* Visit Date and Dentist - Side by Side */}
        <div className="section-columns">
          <div className="w-[40%]">
            <DatePickerField
              label="Visit date"
              value={visitDate}
              onChange={setVisitDate}
              inputRef={visitDateRef}
              variant="visit-modal"
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
