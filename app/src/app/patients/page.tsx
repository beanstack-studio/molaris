"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { calcAge, formatGenderShort, formatDatePH, formatMoney } from "@/lib/helpers";
import type { GenderDB } from "@/lib/types";

type PatientRow = {
  id: string;

  first_name: string | null;
  last_name: string | null;

  full_name: string | null;

  phone: string | null;
  birth_date: string | null;
  gender: GenderDB;
  created_at: string;

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

  if (d.startsWith("63") && d.length >= 12) {
    d = "0" + d.slice(2);
  }

  if (d.length === 10 && d.startsWith("9")) {
    d = "0" + d;
  }

  d = d.slice(0, 11);

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

function toDateKey(iso: string | null | undefined) {
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
  const [page, setPage] = useState(1);

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
    setError(null);

    try {
      // Load all patients
      const { data: allPatients, error: patientsError } = await supabase
        .from("patients")
        .select("id, first_name, last_name, full_name, phone, birth_date, gender, created_at")
        .order("created_at", { ascending: false });

      if (patientsError) throw patientsError;

      // Load all treatments for last visit date lookup
      const { data: allTreatments, error: treatmentsError } = await supabase
        .from("treatments")
        .select("patient_id, treatment_date");

      if (treatmentsError) throw treatmentsError;

      // Load all invoices for balance calculation
      const { data: allInvoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("patient_id, total");

      if (invoicesError) throw invoicesError;

      // Load all payments for balance calculation
      const { data: allPayments, error: paymentsError } = await supabase
        .from("payments")
        .select("patient_id, amount");

      if (paymentsError) throw paymentsError;

      // Build lookup maps
      const lastVisitMap: Record<string, string> = {};
      (allTreatments || []).forEach((t: any) => {
        if (t.treatment_date) {
          if (!lastVisitMap[t.patient_id] || t.treatment_date > lastVisitMap[t.patient_id]) {
            lastVisitMap[t.patient_id] = t.treatment_date;
          }
        }
      });

      const invoicesByPatient: Record<string, number[]> = {};
      (allInvoices || []).forEach((inv: any) => {
        if (!invoicesByPatient[inv.patient_id]) {
          invoicesByPatient[inv.patient_id] = [];
        }
        invoicesByPatient[inv.patient_id].push(inv.total || 0);
      });

      const paymentsByPatient: Record<string, number[]> = {};
      (allPayments || []).forEach((pay: any) => {
        if (!paymentsByPatient[pay.patient_id]) {
          paymentsByPatient[pay.patient_id] = [];
        }
        paymentsByPatient[pay.patient_id].push(pay.amount || 0);
      });

      // Merge all data efficiently
      const patientsWithData = (allPatients || []).map((patient: any) => {
        const totalInvoiced = invoicesByPatient[patient.id]?.reduce((a, b) => a + b, 0) || 0;
        const totalPaid = paymentsByPatient[patient.id]?.reduce((a, b) => a + b, 0) || 0;

        return {
          ...patient,
          last_visit_date: lastVisitMap[patient.id] || null,
          balance: totalInvoiced - totalPaid,
        };
      });

      setPatients(patientsWithData as PatientRow[]);
    } catch (err: any) {
      setError(err.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
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
        return cmpText(aLV, bLV) || cmpText(aLast, bLast) || cmpText(aFirst, bFirst);
      }

      return cmpText(bLV, aLV) || cmpText(aLast, bLast) || cmpText(aFirst, bFirst);
    });

    return list;
  }, [patients, q, patientSort]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  useEffect(() => {
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
      full_name: full,
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
    <main className="app-section">
      <div className="app-section-header">
        <div>
          <div className="app-section-title">Patients</div>
          <div className="app-section-subtitle">Search, add, and manage patient records</div>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          Add patient
        </button>
      </div>

      <div className="app-section-body">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="form-input w-full sm:max-w-md bg-white"
            placeholder="Search by name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">
              {loading ? "Loading..." : `${filtered.length} of ${patients.length} patients`}
            </div>

            <select
              className="form-select w-56 bg-white"
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
        {/* TABLE (desktop) */}
        <div className="mt-4 hidden md:block table-shell">
          <table className="table">
            <thead className="table-head">
              <tr>
                <th className="table-th">Last name</th>
                <th className="table-th">First name</th>
                <th className="table-th">Age</th>
                <th className="table-th">Gender</th>
                <th className="table-th">Phone number</th>
                <th className="table-th">Last visit</th>
                <th className="table-th-right table-col-money">Balance</th>
              </tr>
            </thead>

            <tbody>
              {pageRows.map((p, index) => (
                <tr
                  key={p.id}
                  className={`table-row ${index % 2 === 0 ? "table-row-even" : "table-row-odd"}`}
                  onClick={() => router.push(`/patients/${p.id}/info`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/patients/${p.id}/info`);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                >
                  <td className="table-td table-link">{p.last_name ?? "-"}</td>
                  <td className="table-td">{p.first_name ?? "-"}</td>
                  <td className="table-td">{calcAge(p.birth_date)}</td>
                  <td className="table-td">{formatGenderShort(p.gender)}</td>
                  <td className="table-td">{p.phone ?? "-"}</td>
                  <td className="table-td">{formatDatePH(p.last_visit_date)}</td>
                  <td className="table-td-right num">{formatMoney(p.balance ?? 0)}</td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty">
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
              href={`/patients/${p.id}/info`}
              className={`card-shell card-interactive ${index % 2 === 0 ? "card-even" : "card-odd"}`}
            >
              <div className="card-title">
                {p.last_name ? `${p.last_name}, ${p.first_name ?? ""}` : p.full_name ?? "—"}
              </div>

              <div className="card-meta">
                <div>
                  <span className="card-label">Age:</span> {calcAge(p.birth_date)}
                </div>

                <div className="mt-1">
                  <span className="card-label">Gender:</span> {formatGenderShort(p.gender)}
                </div>

                <div className="mt-1">
                  <span className="card-label">Phone:</span> {p.phone ?? "-"}
                </div>

                <div className="mt-1">
                  <span className="card-label">Last visit:</span> {formatDatePH(p.last_visit_date)}
                </div>

                <div className="mt-1">
                  <span className="card-label">Balance:</span>{" "}
                  <span className="num">{formatMoney(p.balance ?? 0)}</span>
                </div>
              </div>
            </Link>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="table-shell p-6 text-center text-slate-600">
              No patients found.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length}
          </div>

          <div className="flex items-center gap-2">
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>

            <button
              className="btn btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Patient Modal */}
      {showAdd ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)} onDoubleClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
            <div>
              <h2 className="text-lg font-semibold">Add patient</h2>
              <p className="text-sm text-slate-600">Basic info now, details later</p>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Last name</label>
                  <input
                    className="form-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dela Cruz"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">First name</label>
                  <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Birth date</label>
                  <input className="form-input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>

                <div className="form-group">
                  <div className="form-label">Gender</div>
                  <div className="mt-2 flex items-center gap-6 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="gender" value="male" checked={gender === "male"} onChange={() => setGender("male")} />
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="form-input"
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

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Barangay / City" />
                </div>
              </div>

              {error ? <p className="form-error">{error}</p> : null}

              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button className="btn btn-secondary" onClick={() => setShowAdd(false)} disabled={saving}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
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
    </main>
  );
}
