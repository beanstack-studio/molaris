"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";
import type { Patient } from "@/lib/types";
import {
  splitFullName,
  combineFullName,
  formatGenderLabel,
  normalizeGenderInput,
  formatDatePH,
  calcAge,
} from "@/lib/helpers";

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="field-label">
      <span className="field-label-text">{label}</span>
      {textarea ? (
        <textarea
          className="field-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);

  // Last visit (based on latest treatment)
  const [lastVisitDate, setLastVisitDate] = useState<string>("");
  const [lastVisitDentist, setLastVisitDentist] = useState<string>("");
  const [lastVisitConcern, setLastVisitConcern] = useState<string>("");

  // Info edit
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editGender, setEditGender] = useState<"" | "male" | "female">("");
  const [editAddress, setEditAddress] = useState("");
  const [editOrtho, setEditOrtho] = useState(false);
  const [deletePatientText, setDeletePatientText] = useState("");

  const loadPatient = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const p = await supabase.from("patients").select("*").eq("id", id).single();

    if (p.error) {
      setErr(p.error.message);
      setLoading(false);
      return;
    }

    const patRaw = p.data as any;
    const fallback = splitFullName(patRaw.full_name ?? "");
    const dbFirst = String(patRaw.first_name ?? "").trim();
    const dbLast = String(patRaw.last_name ?? "").trim();
    const firstNameFinal = dbFirst || fallback.first;
    const lastNameFinal = dbLast || fallback.last;
    const fullNameFinal =
      combineFullName(firstNameFinal, lastNameFinal) || String(patRaw.full_name ?? "").trim();

    const pat: Patient = {
      id: patRaw.id,
      full_name: fullNameFinal,
      first_name: firstNameFinal || null,
      last_name: lastNameFinal || null,
      phone: patRaw.phone ?? null,
      birth_date: patRaw.birth_date ?? null,
      address: patRaw.address ?? null,
      occupation: patRaw.occupation ?? null,
      email: patRaw.email ?? null,
      notes: patRaw.notes ?? null,
      gender: normalizeGenderInput(String(patRaw.gender ?? "")),
    };

    setPatient(pat);

    setEditFirstName(pat.first_name ?? "");
    setEditLastName(pat.last_name ?? "");
    setEditPhone(pat.phone ?? "");
    setEditBirthDate(pat.birth_date ?? "");
    setEditGender((pat.gender ?? "") as any);
    setEditAddress(pat.address ?? "");
    setEditOrtho(Boolean(patRaw.ortho_patient ?? false));

    // Load last visit
    const t = await supabase
      .from("treatments")
      .select("treatment_date, dentist_name, procedure, visit_concern")
      .eq("patient_id", id)
      .order("treatment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (!t.error && t.data?.length) {
      const latest = t.data[0] as any;
      setLastVisitDate(latest.treatment_date ?? "");
      setLastVisitDentist(latest.dentist_name || "");
      setLastVisitConcern(latest.visit_concern || "");
    } else {
      setLastVisitDate("");
      setLastVisitDentist("");
      setLastVisitConcern("");
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  async function savePatient() {
    if (!patient) return;
    setErr(null);

    const first = editFirstName.trim();
    const last = editLastName.trim();
    const phone = editPhone.trim();
    const birth = editBirthDate.trim();
    const gender = editGender || null;
    const address = editAddress.trim();

    if (!first || !last) return setErr("First and last name are required.");

    setBusy(true);
    console.log("Saving patient with ortho_patient =", editOrtho);
    
    const res = await supabase
      .from("patients")
      .update({
        first_name: first,
        last_name: last,
        phone: phone || null,
        birth_date: birth || null,
        gender,
        address: address || null,
        ortho_patient: editOrtho,
      })
      .eq("id", patient.id);

    console.log("Save result:", res);
    setBusy(false);
    if (res.error) return setErr(res.error.message);

    // Small delay to ensure real-time subscription processes the update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setEditOpen(false);
    await loadPatient();
  }

  async function deletePatient() {
    if (!patient) return;
    if (deletePatientText.trim().toUpperCase() !== "DELETE") {
      setErr("Type DELETE to confirm.");
      return;
    }

    setBusy(true);
    const res = await supabase.from("patients").delete().eq("id", patient.id);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    router.push("/patients");
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
    return <div className="min-h-screen p-6 text-red-600">Patient not found.</div>;
  }

  const displayFullName = combineFullName(patient.first_name, patient.last_name) || patient.full_name || "";

  return (
    <>
      {err ? <div className="error-banner">{err}</div> : null}

      <div className="patient-content">
        <div className="patient-sections">
          {/* Patient Information Box */}
          <div className="info-box">
            <div className="info-box-header">
              <div className="info-box-title">Patient Information</div>
              <button className="btn-primary-dark" onClick={() => setEditOpen(true)}>
                Edit
              </button>
            </div>
            <div className="space-y-4-base">
              {/* Row 1: Last name, First name - 50/50 */}
              <div className="grid-gap-4-cols-2">
                <label className="field-label">
                  <span className="field-label-text">Last name</span>
                  <input className="field-input-readonly" value={patient.last_name ?? ""} readOnly />
                </label>
                <label className="field-label">
                  <span className="field-label-text">First name</span>
                  <input className="field-input-readonly" value={patient.first_name ?? ""} readOnly />
                </label>
              </div>

              {/* Row 2: Birthday, Age, Gender - 33/33/33 */}
              <div className="grid-gap-4-cols-3">
                <label className="field-label">
                  <span className="field-label-text">Date of birth</span>
                  <input className="field-input-readonly" value={formatDatePH(patient.birth_date)} readOnly />
                </label>
                <label className="field-label">
                  <span className="field-label-text">Age</span>
                  <input className="field-input-readonly" value={calcAge(patient.birth_date)?.toString() ?? ""} readOnly />
                </label>
                <label className="field-label">
                  <span className="field-label-text">Gender</span>
                  <input className="field-input-readonly" value={formatGenderLabel(patient.gender)} readOnly />
                </label>
              </div>

              {/* Row 3: Phone 25%, Address 75% */}
              <div className="grid-gap-4-cols-4">
                <label className="field-label">
                  <span className="field-label-text">Phone number</span>
                  <input className="field-input-readonly" value={patient.phone ?? ""} readOnly />
                </label>
                <label className="field-label col-span-3">
                  <span className="field-label-text">Address</span>
                  <input className="field-input-readonly" value={patient.address ?? ""} readOnly />
                </label>
              </div>
            </div>
          </div>

          {/* Last Visit Box */}
          <div className="info-box-muted">
            <div className="info-box-title">Last visit</div>
            <div className="info-box-grid-3">
              <label className="field-label">
                <span className="field-label-text">Date</span>
                <input className="field-input-white" value={lastVisitDate ? formatDatePH(lastVisitDate) : ""} readOnly />
              </label>
              <label className="field-label">
                <span className="field-label-text">Dentist</span>
                <input className="field-input-white" value={lastVisitDentist || ""} readOnly />
              </label>
              <label className="field-label">
                <span className="field-label-text">Concern</span>
                <input className="field-input-white" value={lastVisitConcern || ""} readOnly />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditModal open={editOpen} title="Edit patient" onClose={() => setEditOpen(false)}>
        <div className="grid-gap-4">
          {/* R1: Last name, First name */}
          <div className="grid-gap-4-cols-2">
            <Field label="Last name" value={editLastName} onChange={setEditLastName} placeholder="Last name" />
            <Field label="First name" value={editFirstName} onChange={setEditFirstName} placeholder="First name" />
          </div>

          {/* R2: Birth date, Gender */}
          <div className="grid-gap-4-cols-2">
            <div className="field-label">
              <span className="field-label-text">Birth date</span>
              <input
                type="text"
                className="field-input"
                value={editBirthDate ? formatDatePH(editBirthDate) : ""}
                readOnly
                placeholder="Click to select date"
                onFocus={(e) => {
                  const picker = document.createElement("input");
                  picker.type = "date";
                  picker.value = editBirthDate;
                  picker.onchange = () => setEditBirthDate(picker.value);
                  picker.click();
                }}
              />
            </div>
            <div className="field-label">
              <span className="field-label-text">Gender</span>
              <div className="gender-selector">
                <label className="gender-option">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={editGender === "male"}
                    onChange={(e) => setEditGender(e.target.value as "male")}
                  />
                  Male
                </label>
                <label className="inline-flex-items-center-gap-2">
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={editGender === "female"}
                    onChange={(e) => setEditGender(e.target.value as "female")}
                  />
                  Female
                </label>
              </div>
            </div>
          </div>

          {/* R3: Phone number full width */}
          <Field label="Phone number" value={editPhone} onChange={setEditPhone} placeholder="e.g., 09123456789" />

          {/* R4: Address full width */}
          <div className="field-label">
            <label className="field-label-text">Address</label>
            <input
              type="text"
              className="field-input"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="Address"
            />
          </div>

          {/* Ortho patient toggle switch */}
          <div className="flex items-center gap-3">
            <span className="field-label-text text-sm">Ortho patient?</span>
            <button
              type="button"
              onClick={() => setEditOrtho(!editOrtho)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${
                editOrtho ? 'bg-green-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-md transition-transform ${
                  editOrtho ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              >
                <span className={`text-xs font-bold ${
                  editOrtho ? 'text-green-500' : 'text-slate-300'
                }`}>
                  {editOrtho ? '✓' : '✕'}
                </span>
              </span>
            </button>
          </div>

          <div className="delete-confirmation">
            <div className="delete-confirmation-title-red">Delete Patient?</div>
            <div className="delete-confirmation-hint">
              Type <span className="delete-confirmation-code">DELETE</span> to confirm permanent deletion
            </div>
            <input
              type="text"
              className="delete-confirmation-input"
              placeholder="DELETE"
              value={deletePatientText}
              onChange={(e) => setDeletePatientText(e.target.value)}
            />
          </div>

          <div className="modal-footer-spread">
            <button
              className="btn-danger-lg"
              disabled={busy || deletePatientText.trim().toUpperCase() !== "DELETE"}
              onClick={deletePatient}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
            <div className="modal-footer-buttons">
              <button
                className="btn-secondary-outlined"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                className="h-10 save-btn"
                disabled={busy}
                onClick={savePatient}
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
