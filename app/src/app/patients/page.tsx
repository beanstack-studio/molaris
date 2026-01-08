"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PatientRow = {
  id: string;

  // New columns
  first_name: string | null;
  last_name: string | null;

  // Kept for compatibility and search
  full_name: string | null;

  phone: string | null;
  birth_date: string | null;
  created_at: string;

  // From view
  last_visit_date: string | null; // YYYY-MM-DD
  balance: number | null; // computed
};

type PatientSort =
  | "LASTNAME_ASC"
  | "LASTNAME_DESC"
  | "BALANCE_ASC"
  | "BALANCE_DESC"
  | "LASTVISIT_ASC"
  | "LASTVISIT_DESC";

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

/**
 * Formats PH mobile numbers as: 09XX XXX XXXX
 * - Accepts input with or without spaces
 * - Limits to 11 digits
 * - If user pastes 63XXXXXXXXXX, converts to 0XXXXXXXXXX
 * Returns both digits-only and formatted display.
 */
function normalizePhonePH(input: string) {
  let d = onlyDigits(input);

  // Convert +63XXXXXXXXXX or 63XXXXXXXXXX to 0XXXXXXXXXX
  if (d.startsWith("63") && d.length >= 12) {
    d = "0" + d.slice(2);
  }

  // If someone types 9XXXXXXXXX (10 digits), make it 09XXXXXXXXX
  if (d.length === 10 && d.startsWith("9")) {
    d = "0" + d;
  }

  // Limit to 11 digits
  d = d.slice(0, 11);

  // Format: 09XX XXX XXXX
  const p1 = d.slice(0, 4);
  const p2 = d.slice(4, 7);
  const p3 = d.slice(7, 11);

  let formatted = p1;
  if (d.length > 4) formatted += " " + p2;
  if (d.length > 7) formatted += " " + p3;

  return { digits: d, formatted };
}

function safeText(s: any) {
  return String(s ?? "").trim();
}

function combineFullName(first: string, last: string) {
  const f = safeText(first);
  const l = safeText(last);
  return [f, l].filter(Boolean).join(" ").trim();
}

function formatMoney(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.00";
  return v.toFixed(2);
}

function toDateKey(iso: string | null | undefined) {
  // For sorting. Null -> very old.
  if (!iso) return "0000-00-00";
  return iso;
}

export default function PatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [patientSort, setPatientSort] = useState<PatientSort>("LASTNAME_ASC");

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);

  // Add patient form
  const [showAdd, setShowAdd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPatients() {
    setLoading(true);

    // IMPORTANT:
    // This expects you created the view: patient_list_view (SQL below)
    const { data, error } = await supabase
      .from("patient_list_view")
      .select(
        "id, first_name, last_name, full_name, phone, birth_date, created_at, last_visit_date, balance"
      )
      .order("created_at", { ascending: false });

    if (!error && data) setPatients(data as PatientRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadPatients();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    const list = (() => {
      if (!s) return [...patients];

      const sDigits = onlyDigits(s);

      return patients.filter((p) => {
        const first = (p.first_name ?? "").toLowerCase();
        const last = (p.last_name ?? "").toLowerCase();
        const full = (p.full_name ?? "").toLowerCase();

        const ph = (p.phone ?? "").toLowerCase();
        const phDigits = onlyDigits(p.phone ?? "");

        const matchName = first.includes(s) || last.includes(s) || full.includes(s);
        const matchPhone = sDigits ? phDigits.includes(sDigits) : ph.includes(s);

        return matchName || matchPhone;
      });
    })();

    const cmpText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

    list.sort((a, b) => {
      const aLast = (a.last_name ?? "").trim();
      const bLast = (b.last_name ?? "").trim();
      const aFirst = (a.first_name ?? "").trim();
      const bFirst = (b.first_name ?? "").trim();

      const aBal = Number(a.balance ?? 0);
      const bBal = Number(b.balance ?? 0);

      const aLV = toDateKey(a.last_visit_date);
      const bLV = toDateKey(b.last_visit_date);

      if (patientSort === "LASTNAME_ASC") {
        return cmpText(aLast, bLast) || cmpText(aFirst, bFirst) || cmpText(a.id, b.id);
      }

      if (patientSort === "LASTNAME_DESC") {
        return cmpText(bLast, aLast) || cmpText(bFirst, aFirst) || cmpText(a.id, b.id);
      }

      if (patientSort === "BALANCE_ASC") {
        return aBal - bBal || cmpText(aLast, bLast) || cmpText(aFirst, bFirst);
      }

      if (patientSort === "BALANCE_DESC") {
        return bBal - aBal || cmpText(aLast, bLast) || cmpText(aFirst, bFirst);
      }

      if (patientSort === "LASTVISIT_ASC") {
        // Older -> newer
        return cmpText(aLV, bLV) || cmpText(aLast, bLast) || cmpText(aFirst, bFirst);
      }

      // LASTVISIT_DESC (newer -> older)
      return cmpText(bLV, aLV) || cmpText(aLast, bLast) || cmpText(aFirst, bFirst);
    });

    return list;
  }, [patients, q, patientSort]);

  const totalPages = useMemo(() => {
  return Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
}, [filtered.length]);

useEffect(() => {
  // If filters/search reduce results, keep page in bounds
  setPage((p) => Math.min(Math.max(1, p), totalPages));
}, [totalPages]);

useEffect(() => {
  // Reset to page 1 when search or sort changes
  setPage(1);
}, [q, patientSort]);

const pageRows = useMemo(() => {
  const start = (page - 1) * PAGE_SIZE;
  return filtered.slice(start, start + PAGE_SIZE);
}, [filtered, page]);

  async function addPatient() {
    setSaving(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const fn = safeText(firstName);
    const ln = safeText(lastName);
    const full = combineFullName(fn, ln);

    if (fn.length < 1 || ln.length < 1) {
      setSaving(false);
      setError("Please enter both First name and Last name.");
      return;
    }

    const normalized = normalizePhonePH(phone);

    const { error } = await supabase.from("patients").insert({
      first_name: fn,
      last_name: ln,
      full_name: full, // keep for compatibility
      gender: gender || null,
      phone: normalized.formatted.trim() || null,
      birth_date: birthDate || null,
      address: safeText(address) || null,
      created_by: userId,
      first_seen_on: new Date().toISOString().slice(0, 10),
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setShowAdd(false);
    setFirstName("");
    setLastName("");
    setGender("");
    setPhone("");
    setAddress("");
    setBirthDate("");
    await loadPatients();
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">

        {/* MAIN BOX (matches patient-id-page) */}
        <div className="mt-4 rounded-2xl border overflow-hidden mds-surface">
          <div className="p-4">

            {/* Header */}
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Patients</h1>
                <p className="text-sm text-slate-600">
                  Search, add, and manage patient records
                </p>
              </div>

              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setShowAdd(true)}
              >
                Add patient
              </button>
            </header>

            {/* Search + Sort */}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                className="h-10 w-full rounded-lg border px-3 text-sm sm:max-w-md bg-white"
                placeholder="Search by name or phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-600">
                  {loading
                    ? "Loading..."
                    : `${filtered.length} of ${patients.length} patients`}
                </div>

                <select
                  className="h-10 w-56 rounded-lg border bg-white px-2 text-sm"
                  value={patientSort}
                  onChange={(e) => setPatientSort(e.target.value as PatientSort)}
                >
                  <option value="LASTNAME_ASC">Last name A–Z</option>
                  <option value="LASTNAME_DESC">Last name Z–A</option>
                  <option value="BALANCE_ASC">Balance low–high</option>
                  <option value="BALANCE_DESC">Balance high–low</option>
                  <option value="LASTVISIT_ASC">Last visit old–new</option>
                  <option value="LASTVISIT_DESC">Last visit new–old</option>
                </select>
              </div>
            </div>

            {/* TABLE (desktop) */}
            <div className="mt-4 hidden overflow-hidden rounded-xl border bg-white md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Last name</th>
                    <th className="px-4 py-3 text-left font-medium">First name</th>
                    <th className="px-4 py-3 text-left font-medium">Birth date</th>
                    <th className="px-4 py-3 text-left font-medium">Phone number</th>
                    <th className="px-4 py-3 text-left font-medium">Last visit</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {pageRows.map((p, index) => (
                    <tr
                      key={p.id}
                      className={`
                        cursor-pointer border-t
                        hover:bg-slate-100
                        ${index % 2 === 0 ? "bg-white/60" : "bg-slate-50/60"}
                      `}
                      onClick={() => router.push(`/patients/${p.id}`)}
                      tabIndex={0}
                      role="link"
                    >
                      <td className="px-4 py-3 font-medium underline decoration-slate-300">
                        {p.last_name ?? "-"}
                      </td>
                      <td className="px-4 py-3">{p.first_name ?? "-"}</td>
                      <td className="px-4 py-3">{p.birth_date ?? "-"}</td>
                      <td className="px-4 py-3">{p.phone ?? "-"}</td>
                      <td className="px-4 py-3">{p.last_visit_date ?? "-"}</td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(p.balance ?? 0)}
                      </td>
                    </tr>
                  ))}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-slate-600">
                        No patients found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* CARDS (mobile) */}
            <div className="mt-4 grid gap-3 md:hidden">
              {pageRows.map((p, index) => (
                <Link
                  key={p.id}
                  href={`/patients/${p.id}`}
                  className={`
                    block rounded-xl border p-4
                    hover:bg-slate-100 active:bg-slate-200
                    ${index % 2 === 0 ? "bg-white/70" : "bg-slate-50/70"}
                  `}
                >
                  <div className="font-semibold underline decoration-slate-300">
                    {p.last_name
                      ? `${p.last_name}, ${p.first_name ?? ""}`
                      : p.full_name ?? "—"}
                  </div>

                  <div className="mt-2 text-sm text-slate-700">
                    <div>
                      <span className="text-slate-500">Birth date:</span>{" "}
                      {p.birth_date ?? "-"}
                    </div>
                    <div className="mt-1">
                      <span className="text-slate-500">Phone:</span>{" "}
                      {p.phone ?? "-"}
                    </div>
                    <div className="mt-1">
                      <span className="text-slate-500">Last visit:</span>{" "}
                      {p.last_visit_date ?? "-"}
                    </div>
                    <div className="mt-1">
                      <span className="text-slate-500">Balance:</span>{" "}
                      {formatMoney(p.balance ?? 0)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                Showing{" "}
                {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </div>


              <div className="flex items-center gap-2">
                <button
                  className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>

                <button
                  className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Add Patient Modal stays OUTSIDE the box */}
        {showAdd ? (
              <div
                className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
                onDoubleClick={() => setShowAdd(false)}
              >
                <div
                  className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg"
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <h2 className="text-lg font-semibold">Add patient</h2>
                    <p className="text-sm text-slate-600">Basic info now, details later</p>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {/* R1: Last name, First name */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium">Last name</label>
                        <input
                          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Dela Cruz"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium">First name</label>
                        <input
                          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Juan"
                        />
                      </div>
                    </div>

                    {/* R2: Birth date, Gender */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium">Birth date</label>
                        <input
                          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                          type="date"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                        />
                      </div>

                      <div>
                        <div className="text-sm font-medium">Gender</div>
                        <div className="mt-2 flex items-center gap-6 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="gender"
                              value="male"
                              checked={gender === "male"}
                              onChange={() => setGender("male")}
                            />
                            Male
                          </label>

                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="gender"
                              value="female"
                              checked={gender === "female"}
                              onChange={() => setGender("female")}
                            />
                            Female
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* R3: Phone number, Address */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium">Phone</label>
                        <input
                          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                          value={phone}
                          onChange={(e) => {
                            const next = normalizePhonePH(e.target.value);
                            setPhone(next.formatted);
                          }}
                          placeholder="09XX XXX XXXX"
                          inputMode="numeric"
                        />
                        <div className="mt-1 text-xs text-slate-500">Format: 09XX XXX XXXX</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium">Address</label>
                        <input
                          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Barangay / City"
                        />
                      </div>
                    </div>

                    {error ? <p className="text-sm text-red-600">{error}</p> : null}

                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <button
                        className="h-10 rounded-lg border bg-white px-4 text-sm font-medium"
                        onClick={() => setShowAdd(false)}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
                        onClick={addPatient}
                        disabled={saving || firstName.trim().length < 1 || lastName.trim().length < 1}
                      >
                        {saving ? "Saving..." : "Save patient"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
      </div>
    </main>
  );
}