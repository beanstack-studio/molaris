"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditModal } from "@/components/EditModal";
import { supabase } from "@/lib/supabaseClient";
import PatientTabs from "@/components/PatientTabs";
import type { Patient, MedHist } from "@/lib/types";
import { combineFullName, formatDatePH } from "@/lib/helpers";

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    setErr(null);

    const p = await supabase.from("patients").select("*").eq("id", id).single();
    if (p.error) {
      setErr(p.error.message);
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
    setErr(null);

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
    if (res.error) return setErr(res.error.message);

    setEditOpen(false);
    await loadData();
  }

  async function deleteMedical() {
    if (!medHist?.id) return;
    if (deleteConfirmationText !== "DELETE") return;

    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("patient_medical_histories").delete().eq("id", medHist.id);
    setBusy(false);
    if (error) return setErr(error.message);
    setEditOpen(false);
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

  if (!patient) {
    return <div className="min-h-screen p-6 text-red-600">Patient not found.</div>;
  }

  const displayFullName = combineFullName(patient.first_name, patient.last_name) || patient.full_name || "";

  return (
    <>
      {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

      {/* Content */}
      <div className="p-4">
        <div className="grid gap-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Medical Information</div>
              {medHist && (
                <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={openEdit}>
                  Edit
                </button>
              )}
            </div>
            {!medHist ? (
              <div className="mt-4 text-sm text-slate-500">No medical history recorded.</div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Allergies</span>
                  <input className="rounded-lg border bg-slate-50 px-3 py-2" value={medHist.allergies ?? ""} readOnly />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Medications</span>
                  <input className="rounded-lg border bg-slate-50 px-3 py-2" value={medHist.medications ?? ""} readOnly />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Blood Pressure</span>
                  <input className="rounded-lg border bg-slate-50 px-3 py-2" value={medHist.blood_pressure ?? ""} readOnly />
                </label>
                {medHist.notes && (
                  <label className="grid gap-1 text-sm sm:col-span-2">
                    <span className="text-slate-700">Notes</span>
                    <textarea className="rounded-lg border bg-slate-50 px-3 py-2" value={medHist.notes} readOnly />
                  </label>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Medical History Modal */}
      <EditModal
        open={editOpen}
        title="Edit medical history"
        onClose={() => {
          setEditOpen(false);
          setDeleteConfirmationText("");
          setErr(null);
        }}
      >
        <div className="space-y-4">
          <div className="grid gap-1 text-sm">
            <label className="text-slate-700 font-medium">Allergies</label>
            <input
              type="text"
              className="h-10 rounded-lg border px-3"
              value={editAllergies}
              onChange={(e) => setEditAllergies(e.target.value)}
              placeholder="Allergies"
            />
          </div>

          <div className="grid gap-1 text-sm">
            <label className="text-slate-700 font-medium">Medications</label>
            <input
              type="text"
              className="h-10 rounded-lg border px-3"
              value={editMedications}
              onChange={(e) => setEditMedications(e.target.value)}
              placeholder="Medications"
            />
          </div>

          <div className="grid gap-1 text-sm">
            <label className="text-slate-700 font-medium">Blood Pressure</label>
            <input
              type="text"
              className="h-10 rounded-lg border px-3"
              value={editBp}
              onChange={(e) => setEditBp(e.target.value)}
              placeholder="e.g., 120/80"
            />
          </div>

          <div className="grid gap-1 text-sm">
            <label className="text-slate-700 font-medium">Notes</label>
            <textarea
              className="min-h-[88px] rounded-lg border px-3 py-2"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Medical notes…"
            />
          </div>

          {/* Delete Section */}
          <div className="delete-confirmation">
            <div className="delete-confirmation-title text-red-700">Delete record?</div>
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
                  setErr(null);
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
