"use client";

import { useEffect, useState } from "react";
import { EditModal } from "@/components/EditModal";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import type { DentistRow, ServicePriceRow, Treatment, DraftLine } from "@/lib/types";
import { formatDateStandard } from "@/lib/helpers";

interface Props {
  open: boolean;
  date: string | null;
  onClose: () => void;
  onSaved: () => void;
  patientId: string;
  dentists: DentistRow[];
  serviceMenu: ServicePriceRow[];
  visitTreatments: Treatment[];
}

export function EditVisitModal({
  open,
  date,
  onClose,
  onSaved,
  patientId,
  dentists,
  serviceMenu,
  visitTreatments,
}: Props) {
  const { clinicId } = useClinic();
  const [dentistId, setDentistId] = useState("");
  const [concern, setConcern] = useState("");
  const [treatmentNotes, setTreatmentNotes] = useState<Record<string, string>>({});
  const [treatmentTooth, setTreatmentTooth] = useState<Record<string, string>>({});
  const [treatmentProcedure, setTreatmentProcedure] = useState<Record<string, string>>({});
  const [treatmentServiceId, setTreatmentServiceId] = useState<Record<string, string>>({});
  const [newTreatments, setNewTreatments] = useState<DraftLine[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && visitTreatments.length > 0) {
      setDentistId(visitTreatments[0].dentist_id || "");
      setConcern(visitTreatments[0].visit_concern || "");
    }
    if (!open) {
      setDentistId("");
      setConcern("");
      setTreatmentNotes({});
      setTreatmentTooth({});
      setTreatmentProcedure({});
      setTreatmentServiceId({});
      setNewTreatments([]);
      setDeleteConfirm("");
      setBusy(false);
      setError(null);
    }
  }, [open, visitTreatments]);

  function handleClose() {
    setDentistId("");
    setConcern("");
    setTreatmentNotes({});
    setTreatmentTooth({});
    setTreatmentProcedure({});
    setTreatmentServiceId({});
    setNewTreatments([]);
    setDeleteConfirm("");
    setError(null);
    onClose();
  }

  async function handleDeleteVisit() {
    if (!date) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("treatments")
      .delete()
      .in("id", visitTreatments.map((t) => t.id));
    setBusy(false);
    if (error) return setError(error.message);
    onSaved();
    handleClose();
  }

  async function handleSave() {
    setBusy(true);
    setError(null);

    for (const t of visitTreatments) {
      const toothVal =
        treatmentTooth[t.id] !== undefined
          ? treatmentTooth[t.id].trim() ? Number(treatmentTooth[t.id]) : null
          : t.tooth_number;
      const procedureVal = treatmentProcedure[t.id] ?? t.procedure;
      const serviceIdVal = treatmentServiceId[t.id] ?? t.service_price_id;
      const notesVal = treatmentNotes[t.id] ?? t.notes;

      const hasChanges =
        toothVal !== t.tooth_number ||
        procedureVal !== t.procedure ||
        serviceIdVal !== t.service_price_id ||
        notesVal !== t.notes ||
        concern !== (t.visit_concern ?? "");

      if (hasChanges) {
        const { error } = await supabase
          .from("treatments")
          .update({
            tooth_number: toothVal,
            procedure: procedureVal,
            service_price_id: serviceIdVal,
            notes: notesVal || null,
            visit_concern: concern.trim() || null,
          })
          .eq("id", t.id);
        if (error) {
          setBusy(false);
          return setError(error.message);
        }
      }
    }

    if (newTreatments.length > 0) {
      const dentistName = dentists.find((d) => d.id === dentistId)?.full_name || "";
      const newPayload = newTreatments
        .filter((nt) => treatmentServiceId[nt.id])
        .map((nt) => ({
          clinic_id: clinicId,
          patient_id: patientId,
          treatment_date: date,
          tooth_number: treatmentTooth[nt.id]?.trim() ? Number(treatmentTooth[nt.id]) : null,
          procedure: treatmentProcedure[nt.id] || "",
          service_price_id: treatmentServiceId[nt.id],
          notes: treatmentNotes[nt.id]?.trim() || null,
          visit_concern: concern.trim() || null,
          dentist_id: dentistId || null,
          dentist_name: dentistName || null,
        }));

      if (newPayload.length > 0) {
        const { error } = await supabase.from("treatments").insert(newPayload);
        if (error) {
          setBusy(false);
          return setError(error.message);
        }
      }
    }

    setBusy(false);
    onSaved();
    handleClose();
  }

  const sortedMenu = serviceMenu.slice().sort((a, b) => {
    if (a.item_type !== b.item_type) return a.item_type === "SERVICE" ? -1 : 1;
    return a.service_name.localeCompare(b.service_name);
  });

  return (
    <EditModal
      open={open}
      title={`Edit Visit - ${date ? formatDateStandard(date) : ""}`}
      onClose={handleClose}
    >
      {open && date && (
        <div className="spacing-vertical-lg">
          {error && <div className="error-banner">{error}</div>}

          {/* Dentist Dropdown */}
          <div className="grid-gap-1">
            <label className="text-field-label">Dentist</label>
            <select
              className="input-standard"
              value={dentistId}
              onChange={(e) => setDentistId(e.target.value)}
            >
              <option value="">Select dentist…</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>

          {/* Visit Concern */}
          <div className="grid-gap-1">
            <label className="text-field-label">Concern</label>
            <input
              type="text"
              className="input-standard"
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="Chief complaint or concern"
            />
          </div>

          {/* Treatment Items */}
          <div className="space-y-2">
            <div className="text-field-label">
              Treatments ({visitTreatments.length + newTreatments.length})
            </div>

            {visitTreatments.map((t) => (
              <div key={t.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="three-col-row">
                  <div className="grid gap-1">
                    <label className="field-sublabel">Tooth #</label>
                    <input
                      type="number"
                      className="input-standard-sm"
                      placeholder="Optional"
                      value={treatmentTooth[t.id] ?? (t.tooth_number?.toString() || "")}
                      onChange={(e) =>
                        setTreatmentTooth((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      min="1"
                      max="32"
                    />
                  </div>
                  <div className="field-full-row">
                    <label className="field-sublabel">Treatment</label>
                    <select
                      className="input-standard"
                      value={treatmentServiceId[t.id] ?? (t.service_price_id || "")}
                      onChange={(e) => {
                        const svc = serviceMenu.find((s) => s.id === e.target.value);
                        setTreatmentServiceId((prev) => ({ ...prev, [t.id]: e.target.value }));
                        setTreatmentProcedure((prev) => ({ ...prev, [t.id]: svc?.service_name ?? "" }));
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
                    value={treatmentNotes[t.id] ?? t.notes ?? ""}
                    onChange={(e) =>
                      setTreatmentNotes((prev) => ({ ...prev, [t.id]: e.target.value }))
                    }
                  />
                  <button
                    className="item-delete-btn"
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      const { error } = await supabase.from("treatments").delete().eq("id", t.id);
                      setBusy(false);
                      if (error) return setError(error.message);
                      onSaved();
                      // Remove from local view without closing modal
                    }}
                    title="Delete treatment"
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {visitTreatments.length === 0 && (
              <div className="hint-text">No treatments on this date.</div>
            )}

            {newTreatments.map((newT) => (
              <div key={newT.id} className="info-box">
                <div className="three-col-row">
                  <div className="grid gap-1">
                    <label className="field-sublabel">Tooth #</label>
                    <input
                      type="number"
                      className="input-standard-sm"
                      placeholder="Optional"
                      value={treatmentTooth[newT.id] ?? ""}
                      onChange={(e) =>
                        setTreatmentTooth((prev) => ({ ...prev, [newT.id]: e.target.value }))
                      }
                      min="1"
                      max="32"
                    />
                  </div>
                  <div className="field-full-row">
                    <label className="field-sublabel">Treatment</label>
                    <select
                      className="input-standard"
                      value={treatmentServiceId[newT.id] ?? ""}
                      onChange={(e) => {
                        const svc = serviceMenu.find((s) => s.id === e.target.value);
                        setTreatmentServiceId((prev) => ({ ...prev, [newT.id]: e.target.value }));
                        setTreatmentProcedure((prev) => ({ ...prev, [newT.id]: svc?.service_name ?? "" }));
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
                    value={treatmentNotes[newT.id] ?? ""}
                    onChange={(e) =>
                      setTreatmentNotes((prev) => ({ ...prev, [newT.id]: e.target.value }))
                    }
                  />
                  <button
                    className="item-delete-btn"
                    onClick={() => setNewTreatments((prev) => prev.filter((nt) => nt.id !== newT.id))}
                    title="Remove treatment"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            <button
              className="add-row-btn"
              onClick={() =>
                setNewTreatments((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), tooth_number: null, service_price_id: null, procedure: "", note: "" },
                ])
              }
            >
              + Add Treatment
            </button>
          </div>

          {/* Delete Entire Visit */}
          <div className="delete-confirmation delete-confirmation-section">
            <div className="delete-confirmation-title">Delete entire visit?</div>
            <div className="delete-confirmation-hint">
              Type <span className="delete-confirmation-code">DELETE</span> to confirm deletion of all treatments on this date
            </div>
            <input
              type="text"
              className="delete-confirmation-input"
              placeholder="DELETE"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>

          {/* Modal Actions */}
          <div className="modal-actions">
            <div className="modal-actions-left">
              <button
                className="delete-btn"
                disabled={busy || deleteConfirm !== "DELETE"}
                onClick={handleDeleteVisit}
              >
                {busy ? "Deleting…" : "Delete Visit"}
              </button>
            </div>
            <div className="modal-actions-right">
              <button className="cancel-btn" onClick={handleClose} disabled={busy}>
                Cancel
              </button>
              <button className="save-btn" disabled={busy} onClick={handleSave}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </EditModal>
  );
}
