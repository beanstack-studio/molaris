"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { calcAge, formatGenderShort, formatDateStandard, formatMoney, formatPhoneLocal, formatPatientName } from "@/lib/helpers";
import type { GenderDB } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { DatePickerField } from "@/components/DatePickerField";
import { useClinic } from "@/contexts/ClinicContext";
import { TableOptions, useTableColumns, SortArrow, type ColumnConfig } from "@/components/shared/TableOptions";
import { useColumnResize } from "@/hooks/useColumnResize";

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
  balance: number | null;         // computed
};

const PATIENT_COLUMNS: ColumnConfig[] = [
  { key: "last_name",    label: "Last name",    required: true },
  { key: "first_name",   label: "First name",   required: true },
  { key: "middle_name",  label: "Middle name" },
  { key: "age",          label: "Age" },
  { key: "gender",       label: "Gender" },
  { key: "phone",        label: "Phone" },
  { key: "last_visit",   label: "Last visit" },
  { key: "balance",      label: "Balance" },
];

const PATIENT_FILTERS = [
  {
    key: "balance",
    label: "Balance",
    options: [
      { label: "All", value: "" },
      { label: "Has balance", value: "has_balance" },
      { label: "No balance", value: "no_balance" },
      { label: "Over ₱1,000", value: "over_1000" },
      { label: "Over ₱5,000", value: "over_5000" },
    ],
  },
  {
    key: "ortho",
    label: "Ortho",
    options: [
      { label: "All", value: "" },
      { label: "Active case", value: "active" },
      { label: "No case", value: "none" },
    ],
  },
  {
    key: "last_visit",
    label: "Last Visit",
    options: [
      { label: "All", value: "" },
      { label: "Last 30 days", value: "30d" },
      { label: "Last 6 months", value: "6m" },
      { label: "Last 12 months", value: "12m" },
      { label: "Never visited", value: "never" },
    ],
  },
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

function daysBetween(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(isoDate + "T00:00:00");
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PatientsPage() {
  const router = useRouter();
  const { clinicId, isLoading: clinicLoading } = useClinic();

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "last_name", direction: "asc" });
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [orthoPatientIds, setOrthoPatientIds] = useState<Set<string>>(new Set());
  const { visibleColumns, onVisibilityChange, isVisible } = useTableColumns("patients", PATIENT_COLUMNS);
  const { getWidth, startResize } = useColumnResize("patients");

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

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

  async function enrichPatients(basePatients: PatientRow[]) {
    try {
      const [{ data: allTreatments }, { data: allInvoices }, { data: allPayments }] = await Promise.all([
        supabase.from("treatments").select("patient_id, treatment_date").eq("clinic_id", clinicId),
        supabase.from("invoices").select("patient_id, total").eq("clinic_id", clinicId),
        supabase.from("payments").select("patient_id, amount").eq("clinic_id", clinicId),
      ]);

      const lastVisitMap: Record<string, string> = {};
      (allTreatments || []).forEach((t) => {
        const row = t as { patient_id: string; treatment_date: string };
        if (row.treatment_date && (!lastVisitMap[row.patient_id] || row.treatment_date > lastVisitMap[row.patient_id]))
          lastVisitMap[row.patient_id] = row.treatment_date;
      });
      const invoiceTotal: Record<string, number> = {};
      (allInvoices || []).forEach((inv) => {
        const row = inv as { patient_id: string; total: number };
        invoiceTotal[row.patient_id] = (invoiceTotal[row.patient_id] ?? 0) + (row.total || 0);
      });
      const paymentTotal: Record<string, number> = {};
      (allPayments || []).forEach((pay) => {
        const row = pay as { patient_id: string; amount: number };
        paymentTotal[row.patient_id] = (paymentTotal[row.patient_id] ?? 0) + (row.amount || 0);
      });

      setPatients(basePatients.map((p): PatientRow => ({
        ...p,
        last_visit_date: lastVisitMap[p.id] ?? null,
        balance: (invoiceTotal[p.id] ?? 0) - (paymentTotal[p.id] ?? 0),
      })));
    } catch {
      // non-critical — list already shown without balance/last visit
    }
  }

  async function loadOrthoPatientIds() {
    try {
      const { data } = await supabase
        .from("ortho_cases")
        .select("patient_id")
        .eq("clinic_id", clinicId)
        .eq("status", "active");
      if (data) {
        setOrthoPatientIds(new Set((data as { patient_id: string }[]).map((r) => r.patient_id)));
      }
    } catch {
      // non-critical
    }
  }

  async function loadPatients() {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const allPatients: PatientRow[] = [];
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
        else {
          allPatients.push(...(data as PatientRow[]).map((p) => ({ ...p, last_visit_date: null, balance: null })));
          offset += data.length;
          hasMore = data.length === 1000;
        }
      }

      setPatients(allPatients);
      setLoading(false);

      // Background enrichment
      enrichPatients(allPatients);
      loadOrthoPatientIds();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load patients";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      if (!abort.signal.aborted) {
        setError("Connection timed out. The server may be slow to start — please try again.");
        setLoading(false);
      }
    }, 30000);
    loadPatients().finally(() => clearTimeout(timer));
    return () => { abort.abort(); clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicLoading, clinicId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    let list = (() => {
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

    // Apply filters
    const balFilter = activeFilters["balance"] ?? "";
    if (balFilter === "has_balance")  list = list.filter((p) => (p.balance ?? 0) > 0);
    if (balFilter === "no_balance")   list = list.filter((p) => (p.balance ?? 0) <= 0);
    if (balFilter === "over_1000")    list = list.filter((p) => (p.balance ?? 0) > 1000);
    if (balFilter === "over_5000")    list = list.filter((p) => (p.balance ?? 0) > 5000);

    const orthoFilter = activeFilters["ortho"] ?? "";
    if (orthoFilter === "active") list = list.filter((p) => orthoPatientIds.has(p.id));
    if (orthoFilter === "none")   list = list.filter((p) => !orthoPatientIds.has(p.id));

    const lvFilter = activeFilters["last_visit"] ?? "";
    if (lvFilter === "30d")    list = list.filter((p) => p.last_visit_date != null && daysBetween(p.last_visit_date) <= 30);
    if (lvFilter === "6m")     list = list.filter((p) => p.last_visit_date != null && daysBetween(p.last_visit_date) <= 183);
    if (lvFilter === "12m")    list = list.filter((p) => p.last_visit_date != null && daysBetween(p.last_visit_date) <= 366);
    if (lvFilter === "never")  list = list.filter((p) => p.last_visit_date == null);

    // Apply sort
    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;
    const cmpText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

    list.sort((a, b) => {
      if (key === "last_name") {
        const aVal = (a.last_name ?? "").trim();
        const bVal = (b.last_name ?? "").trim();
        return dir * cmpText(aVal, bVal) || cmpText((a.first_name ?? "").trim(), (b.first_name ?? "").trim());
      }
      if (key === "first_name") {
        const aVal = (a.first_name ?? "").trim();
        const bVal = (b.first_name ?? "").trim();
        return dir * cmpText(aVal, bVal) || cmpText((a.last_name ?? "").trim(), (b.last_name ?? "").trim());
      }
      if (key === "last_visit_date") {
        const aVal = toDateKey(a.last_visit_date);
        const bVal = toDateKey(b.last_visit_date);
        return dir * cmpText(aVal, bVal);
      }
      if (key === "balance") {
        const aVal = a.balance ?? 0;
        const bVal = b.balance ?? 0;
        return dir * (aVal - bVal);
      }
      if (key === "middle_name") {
        return dir * cmpText((a.middle_name ?? "").trim(), (b.middle_name ?? "").trim());
      }
      if (key === "birth_date") {
        const aVal = a.birth_date ?? "9999-99-99";
        const bVal = b.birth_date ?? "9999-99-99";
        return dir * cmpText(aVal, bVal);
      }
      if (key === "gender") {
        return dir * cmpText((a.gender ?? "").trim(), (b.gender ?? "").trim());
      }
      if (key === "phone") {
        return dir * cmpText((a.phone ?? "").trim(), (b.phone ?? "").trim());
      }
      return 0;
    });

    return list;
  }, [patients, q, sortConfig, activeFilters, orthoPatientIds]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [q, sortConfig, activeFilters]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  async function addPatient() {
    setBusy(true);
    setError(null);

    try {
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

      const { error: insertError } = await supabase.from("patients").insert({
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

      if (insertError) {
        setError(insertError.message);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  // Column header sort indicator
  const SORTABLE_COLS: Record<string, string> = {
    last_name:   "last_name",
    first_name:  "first_name",
    middle_name: "middle_name",
    age:         "birth_date",
    gender:      "gender",
    phone:       "phone",
    balance:     "balance",
    last_visit:  "last_visit_date",
  };

  function handleColSort(col: string) {
    const mappedKey = SORTABLE_COLS[col];
    if (!mappedKey) return;
    if (sortConfig.key === mappedKey) {
      setSortConfig({ key: mappedKey, direction: sortConfig.direction === "asc" ? "desc" : "asc" });
    } else {
      setSortConfig({ key: mappedKey, direction: "asc" });
    }
  }

  function getSortIcon(col: string): React.ReactElement | null {
    const mappedKey = SORTABLE_COLS[col];
    if (!mappedKey) return null;
    const dir = sortConfig.key === mappedKey ? sortConfig.direction : null;
    return <SortArrow dir={dir} />;
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

  function exportPatientsPdf() {
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
        case "balance":     return p.balance != null ? formatMoney(p.balance) : "—";
        default:            return "";
      }
    };
    const headerRow = `<tr>${visCols.map((c) => `<th>${c.label}</th>`).join("")}</tr>`;
    const bodyRows = filtered
      .map((p) => `<tr>${visCols.map((c) => `<td>${getVal(p, c.key)}</td>`).join("")}</tr>`)
      .join("");
    const tableHtml = `<h1 style="font-size:16px;margin:0 0 12px">Patients (${filtered.length})</h1><table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;

    // Inject into current page — avoids popup blocker that blocks window.open()
    const STYLE_ID = "molaris-pdf-style";
    const CONTENT_ID = "molaris-pdf-content";

    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @media print {
        body > *:not(#${CONTENT_ID}) { display: none !important; }
        #${CONTENT_ID} {
          display: block !important;
          font-family: sans-serif; font-size: 12px; padding: 20px; color: #0f172a;
        }
        #${CONTENT_ID} table { width: 100%; border-collapse: collapse; }
        #${CONTENT_ID} th, #${CONTENT_ID} td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
        #${CONTENT_ID} th { background: #eff6ff; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #1d4ed8; }
        #${CONTENT_ID} tr:nth-child(even) td { background: #f8faff; }
      }
    `;

    const prev = document.getElementById(CONTENT_ID);
    if (prev) document.body.removeChild(prev);

    const contentEl = document.createElement("div");
    contentEl.id = CONTENT_ID;
    contentEl.style.display = "none";
    contentEl.innerHTML = tableHtml;
    document.body.appendChild(contentEl);

    window.print();

    setTimeout(() => {
      const el = document.getElementById(CONTENT_ID);
      if (el) document.body.removeChild(el);
    }, 2000);
  }

  return (
    <main className="app-section">
      <div className="app-section-header">
        <div className="app-section-title">Patients</div>
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

            <TableOptions
              tableName="patients"
              columns={PATIENT_COLUMNS}
              filters={PATIENT_FILTERS}
              currentSort={sortConfig}
              onSortChange={(key, direction) => setSortConfig({ key, direction })}
              currentFilters={activeFilters}
              onFilterChange={(key, value) => setActiveFilters((prev) => ({ ...prev, [key]: value }))}
              data={patients}
              onDownloadCSV={exportPatientsCsv}
              onDownloadPDF={exportPatientsPdf}
              visibleColumns={visibleColumns}
              onColsChange={onVisibilityChange}
            />
            {Object.values(activeFilters).some((v) => v !== "") && (
              <button
                type="button"
                onClick={() => setActiveFilters({})}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 whitespace-nowrap"
                title="Clear all filters"
              >
                Filters active ×
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              Add patient
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
                {isVisible("last_name")   && (
                  <th
                    className="data-table-head-cell relative cursor-pointer select-none hover:bg-slate-100"
                    style={{ width: getWidth("last_name") }}
                    onClick={() => handleColSort("last_name")}
                  >
                    Last name{getSortIcon("last_name")}
                    <div
                      onMouseDown={(e) => startResize("last_name", e)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 bg-slate-300 dark:bg-slate-600"
                    />
                  </th>
                )}
                {isVisible("first_name")  && (
                  <th
                    className="data-table-head-cell relative cursor-pointer select-none hover:bg-slate-100"
                    style={{ width: getWidth("first_name") }}
                    onClick={() => handleColSort("first_name")}
                  >
                    First name{getSortIcon("first_name")}
                    <div
                      onMouseDown={(e) => startResize("first_name", e)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 bg-slate-300 dark:bg-slate-600"
                    />
                  </th>
                )}
                {isVisible("middle_name") && (
                  <th
                    className="data-table-head-cell relative cursor-pointer select-none hover:bg-slate-100"
                    style={{ width: getWidth("middle_name") }}
                    onClick={() => handleColSort("middle_name")}
                  >
                    Middle name{getSortIcon("middle_name")}
                    <div
                      onMouseDown={(e) => startResize("middle_name", e)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 bg-slate-300 dark:bg-slate-600"
                    />
                  </th>
                )}
                {isVisible("age")         && (
                  <th
                    className="data-table-head-cell relative cursor-pointer select-none hover:bg-slate-100"
                    style={{ width: getWidth("age") }}
                    onClick={() => handleColSort("age")}
                  >
                    Age{getSortIcon("age")}
                    <div
                      onMouseDown={(e) => startResize("age", e)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 bg-slate-300 dark:bg-slate-600"
                    />
                  </th>
                )}
                {isVisible("gender")      && (
                  <th
                    className="data-table-head-cell relative cursor-pointer select-none hover:bg-slate-100"
                    style={{ width: getWidth("gender") }}
                    onClick={() => handleColSort("gender")}
                  >
                    Gender{getSortIcon("gender")}
                    <div
                      onMouseDown={(e) => startResize("gender", e)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 bg-slate-300 dark:bg-slate-600"
                    />
                  </th>
                )}
                {isVisible("phone")       && (
                  <th
                    className="data-table-head-cell relative cursor-pointer select-none hover:bg-slate-100"
                    style={{ width: getWidth("phone") }}
                    onClick={() => handleColSort("phone")}
                  >
                    Phone number{getSortIcon("phone")}
                    <div
                      onMouseDown={(e) => startResize("phone", e)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 bg-slate-300 dark:bg-slate-600"
                    />
                  </th>
                )}
                {isVisible("last_visit")  && (
                  <th
                    className="data-table-head-cell relative cursor-pointer select-none hover:bg-slate-100"
                    style={{ width: getWidth("last_visit") }}
                    onClick={() => handleColSort("last_visit")}
                  >
                    Last visit{getSortIcon("last_visit")}
                    <div
                      onMouseDown={(e) => startResize("last_visit", e)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 bg-slate-300 dark:bg-slate-600"
                    />
                  </th>
                )}
                {isVisible("balance")     && (
                  <th
                    className="data-table-head-cell-right relative cursor-pointer select-none hover:bg-slate-100"
                    style={{ width: getWidth("balance") }}
                    onClick={() => handleColSort("balance")}
                  >
                    Balance{getSortIcon("balance")}
                    <div
                      onMouseDown={(e) => startResize("balance", e)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 bg-slate-300 dark:bg-slate-600"
                    />
                  </th>
                )}
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
                      {isVisible("gender")      && <td className="data-table-cell">{formatGenderShort(p.gender)}</td>}
                      {isVisible("phone")       && <td className="data-table-cell">{p.phone ? formatPhoneLocal(p.phone) : "-"}</td>}
                      {isVisible("last_visit")  && <td className="data-table-cell">{formatDateStandard(p.last_visit_date)}</td>}
                      {isVisible("balance")     && <td className="data-table-cell-right num">{formatMoney(p.balance ?? 0)}</td>}
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
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </button>

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
    </main>
  );
}
