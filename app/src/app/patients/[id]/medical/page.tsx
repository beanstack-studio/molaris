"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditModal } from "@/components/EditModal";
import { supabase } from "@/lib/supabaseClient";
import PatientTabs from "@/components/PatientTabs";
import type { Patient, MedHist } from "@/lib/types";
import { combineFullName } from "@/lib/helpers";

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [medHist, setMedHist] = useState<MedHist | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editAllergies, setEditAllergies] = useState("");
  const [editMedications, setEditMedications] = useState("");
  const [editBp, setEditBp] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const p = await supabase.from("patients").select("*").eq("id", id).single();
    if (p.error) {
      setError(p.error.message);
      setLoading(false);
      return;
    }
    setPatient(p.data as Patient);

    const m = await supabase
      .from("patient_medical_histories")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!m.error && m.data?.length) {
      const row = m.data[0] as MedHist;
      setMedHist(row);
    } else {
      setMedHist(null);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openEdit() {
    if (!medHist) return;
    setEditAllergies(medHist.allergies ?? "");
    setEditMedications(medHist.medications ?? "");
    setEditBp(medHist.blood_pressure ?? "");
    setEditNotes(medHist.notes ?? "");
    setDeleteConfirmationText("");
    setEditOpen(true);
  }

  async function saveMedical() {
    setBusy(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const payload = {
      patient_id: id,
      allergies: editAllergies.trim() || null,
      medications: editMedications.trim() || null,
      blood_pressure: editBp.trim() || null,
      notes: editNotes.trim() || null,
      conditions: {},
      updated_by: userId,
    };

    const res = medHist?.id
      ? await supabase.from("patient_medical_histories").update(payload).eq("id", medHist.id)
      : await supabase.from("patient_medical_histories").insert(payload);

    setBusy(false);
    if (res.error) return setError(res.error.message);

    setEditOpen(false);
    await loadData();
  }

  async function deleteMedical() {
    if (!medHist?.id) return;
    if (deleteConfirmationText !== "DELETE") return;

    setBusy(true);
    setError(null);
    const { error } = await supabase.from("patient_medical_histories").delete().eq("id", medHist.id);
    setBusy(false);
    if (error) return setError(error.message);
    setEditOpen(false);
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

  if (!patient) {
    return <div className="not-found-screen">Patient not found.</div>;
  }

  const displayFullName = combineFullName(patient.first_name, patient.last_name) || patient.full_name || "";

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}
          <div className="card">
          <div className="card-header">
            <div className="card-title">Medical Information</div>
              {medHist ? (
                <button className="save-btn" onClick={openEdit}>
                  Edit
                </button>
              ) : (
                <button className="save-btn" onClick={() => {
                  setEditAllergies("");
                  setEditMedications("");
                  setEditBp("");
                  setEditNotes("");
                  setDeleteConfirmationText("");
                  setEditOpen(true);
                }}>
                  Add Medical History
                </button>
              )}
            </div>
            {!medHist ? (
              <div className="text-sm text-slate-600 py-4">No medical history recorded.</div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="field-label">
                  <span className="field-label-text">Allergies</span>
                  <input className="field-input-readonly" value={medHist.allergies ?? ""} readOnly />
                </label>
                <label className="field-label">
                  <span className="field-label-text">Medications</span>
                  <input className="field-input-readonly" value={medHist.medications ?? ""} readOnly />
                </label>
                <label className="field-label">
                  <span className="field-label-text">Blood Pressure</span>
                  <input className="field-input-readonly" value={medHist.blood_pressure ?? ""} readOnly />
                </label>
                {medHist.notes && (
                  <label className="field-label field-label-2col">
                    <span className="field-label-text">Notes</span>
                    <textarea className="field-textarea" value={medHist.notes} readOnly />
                  </label>
                )}
              </div>
            )}
          </div>
      {/* Edit Medical History Modal */}
      <EditModal
        open={editOpen}
        title="Edit medical history"
        onClose={() => {
          setEditOpen(false);
          setDeleteConfirmationText("");
          setError(null);
        }}
      >
        <div className="spacing-vertical-lg">
          <div className="field-label">
            <label className="field-label-text">Allergies</label>
            <input
              type="text"
              className="field-input"
              value={editAllergies}
              onChange={(e) => setEditAllergies(e.target.value)}
              placeholder="Allergies"
            />
          </div>

          <div className="field-label">
            <label className="field-label-text">Medications</label>
            <input
              type="text"
              className="field-input"
              value={editMedications}
              onChange={(e) => setEditMedications(e.target.value)}
              placeholder="Medications"
            />
          </div>

          <div className="field-label">
            <label className="field-label-text">Blood Pressure</label>
            <input
              type="text"
              className="field-input"
              value={editBp}
              onChange={(e) => setEditBp(e.target.value)}
              placeholder="e.g., 120/80"
            />
          </div>

          <div className="field-label">
            <label className="field-label-text">Notes</label>
            <textarea
              className="field-textarea"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Medical notes…"
            />
          </div>

          {/* Delete Section */}
          <div className="delete-confirmation">
            <div className="delete-confirmation-title">Delete record?</div>
            <div className="delete-confirmation-hint">
              Type <span className="delete-confirmation-code">DELETE</span> to confirm deletion
            </div>
            <input
              type="text"
              className="delete-confirmation-input"
              placeholder="DELETE"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
            />
          </div>

          {/* Modal Actions */}
          <div className="modal-actions">
            <button
              className="delete-btn"
              disabled={busy || deleteConfirmationText !== "DELETE"}
              onClick={deleteMedical}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
            <div className="modal-actions-right">
              <button
                className="cancel-btn"
                onClick={() => {
                  setEditOpen(false);
                  setDeleteConfirmationText("");
                  setError(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                disabled={busy}
                onClick={saveMedical}
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>
    </>
  );
}
