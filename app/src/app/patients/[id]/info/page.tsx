"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";
import type { Patient } from "@/lib/types";
import { PageLoader } from "@/components/Spinner";
import { Toggle } from "@/components/Toggle";

import {
  splitFullName,
  combineFullName,
  formatGenderLabel,
  normalizeGenderInput,
  formatDateStandard,
  calcAge,
  formatPhoneLocal,
} from "@/lib/helpers";
import { getVisitReasonLabel } from "@/lib/visitReasonHelpers";

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
  const [error, setError] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);

  // Last visit (based on latest treatment)
  const [lastVisitDate, setLastVisitDate] = useState<string>("");
  const [lastVisitDentist, setLastVisitDentist] = useState<string>("");
  const [lastVisitConcern, setLastVisitConcern] = useState<string>("");

  // Next appointment
  const [nextApptDate, setNextApptDate] = useState<string>("");
  const [nextApptDentist, setNextApptDentist] = useState<string>("");
  const [nextApptConcern, setNextApptConcern] = useState<string>("");

  // Info edit
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editGender, setEditGender] = useState<"" | "male" | "female">("");
  const [editAddress, setEditAddress] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editOrtho, setEditOrtho] = useState(false);
  const [deletePatientText, setDeletePatientText] = useState("");

  // Date picker refs
  const birthDateRef = useRef<HTMLInputElement | null>(null);

  const loadPatient = useCallback(async () => {
    setLoading(true);
    setError(null);

    const p = await supabase.from("patients").select("*").eq("id", id).single();

    if (p.error) {
      setError(p.error.message);
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
    setEditPhone(formatPhoneLocal(pat.phone ?? ""));
    setEditBirthDate(pat.birth_date ?? "");
    setEditGender((pat.gender ?? "") as any);
    setEditAddress(pat.address ?? "");
    setEditEmail(pat.email ?? "");
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

    // Load next upcoming appointment
    const today = new Date().toISOString().split("T")[0];
    const appt = await supabase
      .from("appointments")
      .select("appointment_date, concern_type, dentists(full_name, nickname)")
      .eq("patient_id", id)
      .gte("appointment_date", today)
      .not("status", "in", '("cancelled","completed")')
      .is("deleted_at", null)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(1);

    if (!appt.error && appt.data?.length) {
      const a = appt.data[0] as any;
      setNextApptDate(a.appointment_date ?? "");
      const dentist = a.dentists;
      setNextApptDentist(dentist?.nickname?.trim() || dentist?.full_name || "");
      setNextApptConcern(a.concern_type ? getVisitReasonLabel(a.concern_type) : "");
    } else {
      setNextApptDate("");
      setNextApptDentist("");
      setNextApptConcern("");
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  async function savePatient() {
    if (!patient) return;
    setError(null);

    const first = editFirstName.trim();
    const last = editLastName.trim();
    const phone = editPhone.trim();
    const birth = editBirthDate.trim();
    const gender = editGender || null;
    const address = editAddress.trim();
    const email = editEmail.trim();

    if (!first || !last) return setError("First and last name are required.");

    setBusy(true);
    const res = await supabase
      .from("patients")
      .update({
        first_name: first,
        last_name: last,
        phone: phone || null,
        birth_date: birth || null,
        gender,
        address: address || null,
        email: email || null,
        ortho_patient: editOrtho,
      })
      .eq("id", patient.id);

    setBusy(false);
    if (res.error) return setError(res.error.message);

    // Small delay to ensure real-time subscription processes the update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setEditOpen(false);
    await loadPatient();
  }

  async function deletePatient() {
    if (!patient) return;
    if (deletePatientText.trim().toUpperCase() !== "DELETE") {
      setError("Type DELETE to confirm.");
      return;
    }

    setBusy(true);
    const res = await supabase.from("patients").delete().eq("id", patient.id);

    setBusy(false);
    if (res.error) return setError(res.error.message);

    router.push("/patients");
  }

  if (loading) {
    return (
      <PageLoader />
    );
  }

  if (!patient) {
    return <div className="min-h-screen p-6 text-red-600">Patient not found.</div>;
  }

  const displayFullName = combineFullName(patient.first_name, patient.last_name) || patient.full_name || "";

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}

        {/* Patient Information Box */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Patient Information</div>
            <button className="save-btn" onClick={() => setEditOpen(true)}>
              Edit
            </button>
          </div>
          <div className="spacing-vertical-lg">
            {/* Row 1: Last name, First name - 50/50 */}
            <div className="two-col-grid">
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
                <input className="field-input-readonly" value={formatDateStandard(patient.birth_date)} readOnly />
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

            {/* Row 3: Email 25%, Phone 25%, Address 50% */}
            <div className="grid-gap-4-cols-4">
              <label className="field-label">
                <span className="field-label-text">Email</span>
                <input className="field-input-readonly" value={patient.email ?? ""} readOnly />
              </label>
              <label className="field-label">
                <span className="field-label-text">Phone number</span>
                <input className="field-input-readonly" value={formatPhoneLocal(patient.phone ?? "")} readOnly />
              </label>
              <label className="field-label col-span-2">
                <span className="field-label-text">Address</span>
                <input className="field-input-readonly" value={patient.address ?? ""} readOnly />
              </label>
            </div>
          </div>
        </div>

        {/* Last Visit + Next Appointment — side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Last visit</div>
            </div>
            <div className="grid-gap-4-cols-3">
              <label className="field-label">
                <span className="field-label-text">Date</span>
                <input className="field-input-readonly" value={lastVisitDate ? formatDateStandard(lastVisitDate) : ""} readOnly />
              </label>
              <label className="field-label">
                <span className="field-label-text">Dentist</span>
                <input className="field-input-readonly" value={lastVisitDentist || ""} readOnly />
              </label>
              <label className="field-label">
                <span className="field-label-text">Concern</span>
                <input className="field-input-readonly" value={lastVisitConcern || ""} readOnly />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Next appointment</div>
            </div>
            {nextApptDate ? (
              <div className="grid-gap-4-cols-3">
                <label className="field-label">
                  <span className="field-label-text">Date</span>
                  <input className="field-input-readonly" value={formatDateStandard(nextApptDate)} readOnly />
                </label>
                <label className="field-label">
                  <span className="field-label-text">Dentist</span>
                  <input className="field-input-readonly" value={nextApptDentist} readOnly />
                </label>
                <label className="field-label">
                  <span className="field-label-text">Concern</span>
                  <input className="field-input-readonly" value={nextApptConcern} readOnly />
                </label>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No upcoming appointments</p>
            )}
          </div>
        </div>
      

      {/* Edit Modal */}
      <EditModal open={editOpen} title="Edit patient" onClose={() => setEditOpen(false)}>
        <div className="grid-gap-4">
          {/* R1: Last name, First name */}
          <div className="two-col-grid">
            <Field label="Last name" value={editLastName} onChange={setEditLastName} placeholder="Last name" />
            <Field label="First name" value={editFirstName} onChange={setEditFirstName} placeholder="First name" />
          </div>

          {/* R2: Birth date, Gender */}
          <div className="two-col-grid">
            <DatePickerField
              label="Birth date"
              value={editBirthDate}
              onChange={setEditBirthDate}
              inputRef={birthDateRef}
              variant="case-modal"
              max={new Date().toISOString().split("T")[0]}
            />
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

          {/* R3: Email + Phone */}
          <div className="two-col-grid">
            <Field label="Email" value={editEmail} onChange={setEditEmail} placeholder="email@example.com" />
            <Field label="Phone number" value={editPhone} onChange={(v) => setEditPhone(formatPhoneLocal(v))} placeholder="09XX XXX XXXX" />
          </div>

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
            <Toggle checked={editOrtho} onChange={(v) => setEditOrtho(v)} />
          </div>

          <div className="delete-confirmation">
            <div className="delete-confirmation-title">Delete Patient?</div>
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
              className="delete-btn"
              disabled={busy || deletePatientText.trim().toUpperCase() !== "DELETE"}
              onClick={deletePatient}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
            <div className="modal-footer-buttons">
              <button
                className="cancel-btn"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                className="save-btn"
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
