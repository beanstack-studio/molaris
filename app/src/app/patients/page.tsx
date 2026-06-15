"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { calcAge, formatGenderShort, formatDateStandard, formatMoney, formatPhoneLocal, formatPatientName } from "@/lib/helpers";
import type { GenderDB } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { DatePickerField } from "@/components/DatePickerField";
import { useClinic } from "@/contexts/ClinicContext";
import { TableOptions, useTableColumns, type ColumnDef } from "@/components/shared/TableOptions";

type PatientRow = {
  id: string;

  first_name: string | null;
  middle_name: string | null;
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

const PATIENT_COLUMNS: ColumnDef[] = [
  { key: "last_name",    label: "Last name",    required: true },
  { key: "first_name",   label: "First name",   required: true },
  { key: "middle_name",  label: "Middle name" },
  { key: "age",          label: "Age" },
  { key: "gender",       label: "Gender" },
  { key: "phone",        label: "Phone" },
  { key: "last_visit",   label: "Last visit" },
  { key: "balance",      label: "Balance" },
];

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function safeText(s: unknown) {
  return String(s ?? "").trim();
}



function toDateKey(iso: string | null | undefined) {
  if (!iso) return "0000-00-00";
  return iso;
}

export default function PatientsPage() {
  const router = useRouter();
  const { clinicId } = useClinic();

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [patientSort, setPatientSort] = useState<PatientSort>("LASTNAME_ASC");
  const [showOptions, setShowOptions] = useState(false);
  const { visibleColumns, onVisibilityChange, isVisible } = useTableColumns("patients", PATIENT_COLUMNS);

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  // Add patient form
  const [showAdd, setShowAdd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 2: load balance + last visit in background after list is shown
  async function enrichPatients(basePatients: any[]) {
    try {
      const [{ data: allTreatments }, { data: allInvoices }, { data: allPayments }] = await Promise.all([
        supabase.from("treatments").select("patient_id, treatment_date").eq("clinic_id", clinicId),
        supabase.from("invoices").select("patient_id, total").eq("clinic_id", clinicId),
        supabase.from("payments").select("patient_id, amount").eq("clinic_id", clinicId),
      ]);

      const lastVisitMap: Record<string, string> = {};
      (allTreatments || []).forEach((t: any) => {
        if (t.treatment_date && (!lastVisitMap[t.patient_id] || t.treatment_date > lastVisitMap[t.patient_id]))
          lastVisitMap[t.patient_id] = t.treatment_date;
      });
      const invoiceTotal: Record<string, number> = {};
      (allInvoices || []).forEach((inv: any) => { invoiceTotal[inv.patient_id] = (invoiceTotal[inv.patient_id] ?? 0) + (inv.total || 0); });
      const paymentTotal: Record<string, number> = {};
      (allPayments || []).forEach((pay: any) => { paymentTotal[pay.patient_id] = (paymentTotal[pay.patient_id] ?? 0) + (pay.amount || 0); });

      setPatients(basePatients.map((p: any): PatientRow => ({
        ...p,
        last_visit_date: lastVisitMap[p.id] ?? null,
        balance: (invoiceTotal[p.id] ?? 0) - (paymentTotal[p.id] ?? 0),
      })));
    } catch { /* non-critical — list already shown without balance/last visit */ }
  }

  async function loadPatients() {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // Phase 1: patients only — show list fast
      const allPatients: any[] = [];
      const BATCH_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error: patientsError } = await supabase
          .from("patients")
          .select("id, first_name, middle_name, last_name, full_name, phone, birth_date, gender, created_at")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);
        if (patientsError) throw patientsError;
        if (!data || data.length === 0) { hasMore = false; }
        else { allPatients.push(...data); offset += data.length; hasMore = data.length === 1000; }
      }

      // Show list immediately with null balance/last visit
      setPatients(allPatients.map((p: any): PatientRow => ({ ...p, last_visit_date: null, balance: null })));
      setLoading(false);

      // Phase 2: enrich in background (no spinner, best-effort)
      enrichPatients(allPatients);
    } catch (err: any) {
      setError(err.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const abort = new AbortController();
    // Timer only covers Phase 1 (patients query); Phase 2 runs silently
    const timer = setTimeout(() => {
      if (!abort.signal.aborted) {
        setError("Connection timed out. The server may be slow to start — please try again.");
        setLoading(false);
      }
    }, 30000);
    loadPatients().finally(() => clearTimeout(timer));
    return () => { abort.abort(); clearTimeout(timer); };
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
    setBusy(true);
    setError(null);

    try {
      // Force a session refresh so the token is always fresh before writing.
      // This prevents RLS rejections in Safari where the token can expire silently.
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData.session) {
        setError("Session expired — please sign out and sign back in.");
        setBusy(false);
        return;
      }
      const userId = sessionData.session.user.id;

      const fn = safeText(firstName);
      const mn = safeText(middleName);
      const ln = safeText(lastName);
      const full = formatPatientName(fn, mn || null, ln);

      if (fn.length < 1 || ln.length < 1) {
        setError("Please enter both First name and Last name.");
        setBusy(false);
        return;
      }

      const { error } = await supabase.from("patients").insert({
        clinic_id: clinicId,
        first_name: fn,
        middle_name: mn || null,
        last_name: ln,
        full_name: full,
        gender: gender || null,
        phone: formatPhoneLocal(phone) || null,
        birth_date: birthDate || null,
        address: safeText(address) || null,
        email: safeText(email) || null,
        created_by: userId,
        first_seen_on: new Date().toISOString().slice(0, 10),
      });

      if (error) {
        setError(error.message);
        return;
      }

      setShowAdd(false);
      setFirstName("");
      setMiddleName("");
      setLastName("");
      setGender("");
      setPhone("");
      setEmail("");
      setAddress("");
      setBirthDate("");
      await loadPatients();
    } catch (err: any) {
      setError(err?.message ?? "An unexpected error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const SORTABLE_COLS: Record<string, { asc: PatientSort; desc: PatientSort }> = {
    last_name:  { asc: "LASTNAME_ASC",  desc: "LASTNAME_DESC" },
    balance:    { asc: "BALANCE_ASC",   desc: "BALANCE_DESC" },
    last_visit: { asc: "LASTVISIT_ASC", desc: "LASTVISIT_DESC" },
  };

  function handleColSort(col: string) {
    const entry = SORTABLE_COLS[col];
    if (!entry) return;
    setPatientSort(patientSort === entry.asc ? entry.desc : entry.asc);
  }

  function getSortIcon(col: string): string {
    const entry = SORTABLE_COLS[col];
    if (!entry) return "";
    if (patientSort === entry.asc)  return " ↑";
    if (patientSort === entry.desc) return " ↓";
    return " ↕";
  }

  function exportPatientsCsv() {
    const visCols = PATIENT_COLUMNS.filter((c) => isVisible(c.key));
    const getVal = (p: PatientRow, key: string): string => {
      switch (key) {
        case "last_name":   return p.last_name ?? "";
        case "first_name":  return p.first_name ?? "";
        case "middle_name": return p.middle_name ?? "";
        case "age":         return String(calcAge(p.birth_date) ?? "");
        case "gender":      return formatGenderShort(p.gender);
        case "phone":       return p.phone ? formatPhoneLocal(p.phone) : "";
        case "last_visit":  return p.last_visit_date ? formatDateStandard(p.last_visit_date) : "";
        case "balance":     return p.balance != null ? String(p.balance) : "";
        default:            return "";
      }
    };
    const escape = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    const header = visCols.map((c) => c.label).join(",");
    const rows = filtered.map((p) => visCols.map((c) => escape(getVal(p, c.key))).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-section">
      <div className="app-section-header">
        <div>
          <div className="app-section-title">Patients</div>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          Add patient
        </button>
      </div>

      <div className="card">
          <div className="page-toolbar">
            <input
              className="form-input w-full sm:max-w-md"
              placeholder="Search by name or phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="flex-center-gap-3">
              <div className="text-muted">
                {loading ? "Loading..." : `${filtered.length} of ${patients.length} patients`}
              </div>

              <select
                className="form-select-standard w-48"
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
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowOptions(true)}
              >
                Options
              </button>
            </div>
          </div>

          {/* Error banner with retry */}
          {!loading && error && (
            <div className="mx-1 mb-3 flex items-center justify-between gap-3 rounded-lg bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="flex-shrink-0 text-xs font-medium text-red-700 underline hover:no-underline"
                onClick={() => { setError(null); loadPatients(); }}
              >
                Retry
              </button>
            </div>
          )}

          {/* TABLE (desktop) */}
          <div className="table-wrapper hidden md:block">
            <table className="data-table">
              <thead className="data-table-head">
                <tr>
                  {isVisible("last_name")   && <th className="data-table-head-cell cursor-pointer select-none hover:bg-slate-100" onClick={() => handleColSort("last_name")}>Last name{getSortIcon("last_name")}</th>}
                  {isVisible("first_name")  && <th className="data-table-head-cell">First name</th>}
                  {isVisible("middle_name") && <th className="data-table-head-cell">Middle name</th>}
                  {isVisible("age")         && <th className="data-table-head-cell">Age</th>}
                  {isVisible("gender")     && <th className="data-table-head-cell">Gender</th>}
                  {isVisible("phone")      && <th className="data-table-head-cell">Phone number</th>}
                  {isVisible("last_visit") && <th className="data-table-head-cell cursor-pointer select-none hover:bg-slate-100" onClick={() => handleColSort("last_visit")}>Last visit{getSortIcon("last_visit")}</th>}
                  {isVisible("balance")    && <th className="data-table-head-cell-right cursor-pointer select-none hover:bg-slate-100" onClick={() => handleColSort("balance")}>Balance{getSortIcon("balance")}</th>}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="py-12 text-center">
                      <div className="flex justify-center">
                        <Spinner />
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {pageRows.map((p, index) => (
                      <tr
                        key={p.id}
                        className={`data-table-row cursor-pointer ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
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
                        {isVisible("last_name")   && <td className="data-table-cell font-medium">{p.last_name ?? "-"}</td>}
                        {isVisible("first_name")  && <td className="data-table-cell">{p.first_name ?? "-"}</td>}
                        {isVisible("middle_name") && <td className="data-table-cell">{p.middle_name ?? "—"}</td>}
                        {isVisible("age")         && <td className="data-table-cell">{calcAge(p.birth_date)}</td>}
                        {isVisible("gender")     && <td className="data-table-cell">{formatGenderShort(p.gender)}</td>}
                        {isVisible("phone")      && <td className="data-table-cell">{p.phone ? formatPhoneLocal(p.phone) : "-"}</td>}
                        {isVisible("last_visit") && <td className="data-table-cell">{formatDateStandard(p.last_visit_date)}</td>}
                        {isVisible("balance")    && <td className="data-table-cell-right num">{formatMoney(p.balance ?? 0)}</td>}
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={visibleColumns.length} className="data-table-empty">
                          No patients found.
                        </td>
                      </tr>
                    )}
                  </>
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
                {formatPatientName(p.first_name, p.middle_name, p.last_name)}
              </div>

              <div className="card-meta">
                <div>
                  <span className="card-label">Age:</span> {calcAge(p.birth_date)}
                </div>

                <div className="mt-1">
                  <span className="card-label">Gender:</span> {formatGenderShort(p.gender)}
                </div>

                <div className="mt-1">
                  <span className="card-label">Phone:</span> {p.phone ? formatPhoneLocal(p.phone) : "-"}
                </div>

                <div className="mt-1">
                  <span className="card-label">Last visit:</span> {formatDateStandard(p.last_visit_date)}
                </div>

                <div className="mt-1">
                  <span className="card-label">Balance:</span>{" "}
                  <span className="num">{formatMoney(p.balance ?? 0)}</span>
                </div>
              </div>
            </Link>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="empty-state">
              No patients found.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-muted">
              Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>

            <div className="flex items-center gap-1">
              {/* Prev */}
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </button>

              {/* Page number buttons — windowed around current page */}
              {(() => {
                const pages: (number | "…")[] = [];
                const delta = 2;
                const left = page - delta;
                const right = page + delta;

                for (let i = 1; i <= totalPages; i++) {
                  if (i === 1 || i === totalPages || (i >= left && i <= right)) {
                    pages.push(i);
                  } else if (pages[pages.length - 1] !== "…") {
                    pages.push("…");
                  }
                }

                return pages.map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={p === page ? "page-btn-active" : "btn btn-secondary"}
                    >
                      {p}
                    </button>
                  )
                );
              })()}

              {/* Next */}
              <button
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Patient Modal */}
      {showAdd ? (
        <div className="modal-container p-4" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)} onDoubleClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-panel-lg">
            <div className="modal-header">
              <h2 className="modal-title">Add patient</h2>
            </div>

            <div className="p-4 grid gap-3">
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

              <div className="form-group">
                <label className="form-label">Middle name <span className="text-xs text-slate-400">(optional)</span></label>
                <input className="form-input" value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Santos" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Birth date</label>
                  <DatePickerField label="" value={birthDate} onChange={setBirthDate} wrapperClassName="" max={new Date().toISOString().split("T")[0]} />
                </div>

                <div className="form-group">
                  <div className="form-label">Gender</div>
                  <div className="mt-2 flex items-center gap-6 text-sm">
                    <label className="flex-center-gap-2">
                      <input type="radio" name="gender" value="male" checked={gender === "male"} onChange={() => setGender("male")} />
                      Male
                    </label>

                    <label className="flex-center-gap-2">
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
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneLocal(e.target.value))}
                    placeholder="09XX XXX XXXX"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Barangay / City" />
              </div>

              {error ? <p className="form-error">{error}</p> : null}

              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button className="btn btn-secondary" onClick={() => setShowAdd(false)} disabled={busy}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={addPatient}
                  disabled={busy || firstName.trim().length < 1 || lastName.trim().length < 1}
                >
                  {busy ? "Saving..." : "Save patient"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <TableOptions
        open={showOptions}
        onClose={() => setShowOptions(false)}
        columns={PATIENT_COLUMNS}
        visibleColumns={visibleColumns}
        onVisibilityChange={onVisibilityChange}
        onExportCsv={exportPatientsCsv}
      />
    </main>
  );
}
