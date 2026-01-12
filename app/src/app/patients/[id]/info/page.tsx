"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PatientTabs from "@/components/PatientTabs";
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
    <label className="grid gap-1 text-sm">
      <span className="text-slate-700">{label}</span>
      {textarea ? (
        <textarea
          className="min-h-[88px] rounded-lg border px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="h-10 rounded-lg border px-3"
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

    // Load last visit
    const t = await supabase
      .from("treatments")
      .select("treatment_date, dentist_name, procedure")
      .eq("patient_id", id)
      .order("treatment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (!t.error && t.data?.length) {
      const latest = t.data[0];
      setLastVisitDate(latest.treatment_date ?? "");
      setLastVisitDentist(latest.dentist_name || "");
      setLastVisitConcern("Placeholder - Appointments feature coming soon");
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
    const res = await supabase
      .from("patients")
      .update({
        first_name: first,
        last_name: last,
        phone: phone || null,
        birth_date: birth || null,
        gender,
        address: address || null,
      })
      .eq("id", patient.id);

    setBusy(false);
    if (res.error) return setErr(res.error.message);

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
    <main className="min-h-screen bg-slate-50">
      <div className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">{displayFullName}</div>
          <button className="btn btn-secondary" onClick={() => router.push("/patients")}>
            Back
          </button>
        </div>

        {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        <div className="app-section-body">
          <PatientTabs activeTab="Info" />

            {/* Content */}
            <div className="p-4">
              <div className="grid gap-4">
                <div className="rounded-xl border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">Patient Information</div>
                    <button
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                      onClick={() => setEditOpen(true)}
                    >
                      Edit
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">First name</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={patient.first_name ?? ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Last name</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={patient.last_name ?? ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Phone number</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={patient.phone ?? ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Date of birth</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={patient.birth_date ?? ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Age</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={calcAge(patient.birth_date)?.toString() ?? ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Gender</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={formatGenderLabel(patient.gender)} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm sm:col-span-2">
                      <span className="text-slate-700">Address</span>
                      <input className="rounded-lg border bg-slate-50 px-3 py-2" value={patient.address ?? ""} readOnly />
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">Last visit</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Date</span>
                      <input className="rounded-lg border bg-white px-3 py-2" value={lastVisitDate ? formatDatePH(lastVisitDate) : ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Dentist</span>
                      <input className="rounded-lg border bg-white px-3 py-2" value={lastVisitDentist || ""} readOnly />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Concern</span>
                      <input className="rounded-lg border bg-white px-3 py-2" value={lastVisitConcern || ""} readOnly />
                    </label>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    TODO: Replace "Concern" with appointment/visit chief complaint once scheduling/messenger integration is done.
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    </main>

      {/* Edit Modal */}
      <EditModal open={editOpen} title="Edit patient" onClose={() => setEditOpen(false)}>
        <div className="grid gap-4">
          {/* R1 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Last name" value={editLastName} onChange={setEditLastName} placeholder="Last name" />
            <Field label="First name" value={editFirstName} onChange={setEditFirstName} placeholder="First name" />
          </div>

          {/* R2 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Birth date" value={editBirthDate} onChange={setEditBirthDate} />
            <div className="grid gap-1 text-sm">
              <span className="text-slate-700">Gender</span>
              <div className="h-10 rounded-lg border bg-white px-3 flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={editGender === "male"}
                    onChange={(e) => setEditGender(e.target.value as "male")}
                  />
                  Male
                </label>
                <label className="inline-flex items-center gap-2">
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

          <Field label="Phone number" value={editPhone} onChange={setEditPhone} placeholder="e.g., 09123456789" />
          <Field label="Address" value={editAddress} onChange={setEditAddress} textarea />

          <div className="delete-confirmation">
            <div className="delete-confirmation-title text-red-700">Delete Patient?</div>
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

          <div className="flex items-center justify-between gap-2 pt-4">
            <button
              className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              disabled={busy || deletePatientText.trim().toUpperCase() !== "DELETE"}
              onClick={deletePatient}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
            <div className="flex gap-2">
              <button
                className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
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
