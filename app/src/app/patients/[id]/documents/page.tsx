"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PatientTabs from "@/components/PatientTabs";
import { supabase } from "@/lib/supabaseClient";
import type { DocTemplate, GeneratedDoc, DentistRow, Patient } from "@/lib/types";
import { todayLocalISO, formatDateTimePH, renderTemplate, combineFullName, splitFullName } from "@/lib/helpers";

export default function DocumentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);
  const [docSort, setDocSort] = useState<"DATE_DESC" | "DATE_ASC" | "TYPE_ASC">("DATE_DESC");
  const [dentists, setDentists] = useState<DentistRow[]>([]);

  const [docVisitDate, setDocVisitDate] = useState(() => todayLocalISO());
  const [docDentistId, setDocDentistId] = useState<string>("");
  const [docReceiptNo, setDocReceiptNo] = useState("");
  const [docItems, setDocItems] = useState("");
  const [docAmountPaid, setDocAmountPaid] = useState("");
  const [docPaymentMethod, setDocPaymentMethod] = useState("Cash");
  const [docBalance, setDocBalance] = useState("");
  const [docFindings, setDocFindings] = useState("");
  const [docTreatmentDone, setDocTreatmentDone] = useState("");
  const [docRemarks, setDocRemarks] = useState("");
  const [docIssuedBy, setDocIssuedBy] = useState("");

  const dentistNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of dentists) m[d.id] = d.full_name;
    return m;
  }, [dentists]);

  const displayedGeneratedDocs = useMemo(() => {
    const copy = [...generatedDocs];
    if (docSort === "TYPE_ASC") {
      copy.sort(
        (a, b) =>
          (a.doc_type ?? "").localeCompare(b.doc_type ?? "") || (a.created_at < b.created_at ? 1 : -1)
      );
      return copy;
    }
    if (docSort === "DATE_ASC") {
      copy.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
      return copy;
    }
    copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return copy;
  }, [generatedDocs, docSort]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr(null);

    // Load patient info
    const p = await supabase.from("patients").select("*").eq("id", id).single();
    if (!p.error && p.data) {
      const patRaw = p.data as any;
      const fallback = splitFullName(patRaw.full_name ?? "");
      const dbFirst = String(patRaw.first_name ?? "").trim();
      const dbLast = String(patRaw.last_name ?? "").trim();
      const firstNameFinal = dbFirst || fallback.first;
      const lastNameFinal = dbLast || fallback.last;

      setPatient({
        id: patRaw.id,
        full_name: patRaw.full_name,
        first_name: firstNameFinal,
        last_name: lastNameFinal,
        phone: patRaw.phone,
        birth_date: patRaw.birth_date,
        address: patRaw.address,
        occupation: patRaw.occupation,
        email: patRaw.email,
        gender: patRaw.gender,
        notes: patRaw.notes,
      });
    }

    const tm = await supabase
      .from("document_templates")
      .select("id, name, doc_type, content_html")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    setTemplates(!tm.error && tm.data ? (tm.data as DocTemplate[]) : []);

    const gd = await supabase
      .from("generated_documents")
      .select("id, doc_type, doc_number, payload, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });
    setGeneratedDocs(!gd.error && gd.data ? (gd.data as GeneratedDoc[]) : []);

    const d = await supabase
      .from("dentists")
      .select("id, full_name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });
    setDentists(!d.error && d.data ? (d.data as DentistRow[]) : []);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function generateDocument() {
    if (!id) return;
    setErr(null);

    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return setErr("Select a document template.");

    if (!docDentistId) return setErr("Select a dentist.");

    setBusy(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const payload = {
      template_id: template.id,
      template_name: template.name,
      doc_type: template.doc_type,
      visit_date: docVisitDate,
      dentist_id: docDentistId,
      dentist_name: dentistNameById[docDentistId] ?? null,
      fields: {
        receipt_no: docReceiptNo || null,
        items: docItems || null,
        amount_paid: docAmountPaid || null,
        payment_method: docPaymentMethod || null,
        balance: docBalance || null,
        findings: docFindings || null,
        treatment_done: docTreatmentDone || null,
        remarks: docRemarks || null,
        issued_by: docIssuedBy || null,
      },
      rendered_html: previewHtml,
    };

    const ins = await supabase.from("generated_documents").insert({
      patient_id: id,
      doc_type: template.doc_type,
      doc_number: docReceiptNo.trim() || null,
      payload,
    });

    setBusy(false);
    if (ins.error) return setErr(ins.error.message);

    await loadData();
  }

  function printHtml(html: string) {
    if (!html) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"/><title>Print</title></head><body>${html}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function openHtml(html: string) {
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">
            {patient ? combineFullName(patient.first_name, patient.last_name) || patient.full_name || "" : "Patient Documents"}
          </div>
          <button className="btn btn-secondary" onClick={() => window.history.back()}>
            Back
          </button>
        </div>

        {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        <div className="app-section-body">
          <PatientTabs activeTab="Documents" />

          <div>
            <div className="grid gap-4">
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold">Generate document</div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Template</span>
                    <select
                      className="h-10 rounded-lg border bg-white px-3"
                      value={selectedTemplateId}
                      onChange={(e) => {
                        const tmpl = templates.find((t) => t.id === e.target.value);
                        setSelectedTemplateId(e.target.value);
                        if (tmpl) setPreviewHtml(renderTemplate(tmpl.content_html, {}));
                      }}
                    >
                      <option value="">Select template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Visit date</span>
                    <input
                      type="date"
                      className="h-10 rounded-lg border px-3"
                      value={docVisitDate}
                      onChange={(e) => setDocVisitDate(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Dentist</span>
                    <select
                      className="h-10 rounded-lg border bg-white px-3"
                      value={docDentistId}
                      onChange={(e) => setDocDentistId(e.target.value)}
                    >
                      <option value="">Select dentist</option>
                      {dentists.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Receipt #</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={docReceiptNo}
                      onChange={(e) => setDocReceiptNo(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Payment method</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={docPaymentMethod}
                      onChange={(e) => setDocPaymentMethod(e.target.value)}
                      placeholder="e.g., Cash"
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Items</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={docItems}
                      onChange={(e) => setDocItems(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Amount paid</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={docAmountPaid}
                      onChange={(e) => setDocAmountPaid(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Balance</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={docBalance}
                      onChange={(e) => setDocBalance(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Findings</span>
                    <textarea
                      className="min-h-[88px] rounded-lg border px-3 py-2"
                      value={docFindings}
                      onChange={(e) => setDocFindings(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Treatment done</span>
                    <textarea
                      className="min-h-[88px] rounded-lg border px-3 py-2"
                      value={docTreatmentDone}
                      onChange={(e) => setDocTreatmentDone(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Remarks</span>
                    <textarea
                      className="min-h-[88px] rounded-lg border px-3 py-2"
                      value={docRemarks}
                      onChange={(e) => setDocRemarks(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Issued by</span>
                    <input
                      className="h-10 rounded-lg border px-3"
                      value={docIssuedBy}
                      onChange={(e) => setDocIssuedBy(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={busy}
                    onClick={generateDocument}
                  >
                    Generate
                  </button>

                  <button
                    className="h-10 rounded-lg border bg-white px-4 text-sm font-semibold disabled:opacity-60"
                    disabled={!previewHtml}
                    onClick={() => {
                      if (previewHtml) printHtml(previewHtml);
                    }}
                  >
                    Print
                  </button>
                </div>

                {/* Preview */}
                <div className="mt-3 rounded-xl border bg-white p-3">
                  {previewHtml ? (
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : null}
                </div>
              </div>

              {/* Generated documents */}
              <div className="rounded-2xl border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Generated documents</div>

                  <select
                    className="h-9 w-40 rounded-lg border bg-white px-2 text-sm"
                    value={docSort}
                    onChange={(e) => setDocSort(e.target.value as any)}
                  >
                    <option value="DATE_DESC">Newest</option>
                    <option value="DATE_ASC">Oldest</option>
                    <option value="TYPE_ASC">Type A–Z</option>
                  </select>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="data-table">
                    <colgroup>
                      <col style={{ width: 160 }} />
                      <col style={{ width: 200 }} />
                      <col />
                      <col style={{ width: 120 }} />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Date</th>
                        <th className="data-table-head-cell">Type</th>
                        <th className="data-table-head-cell">Number</th>
                        <th className="data-table-head-cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedGeneratedDocs.map((d, index) => (
                        <tr key={d.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                          <td className="data-table-cell">{formatDateTimePH(d.created_at)}</td>
                          <td className="data-table-cell">{d.doc_type}</td>
                          <td className="data-table-cell">{d.doc_number ?? "—"}</td>
                          <td className="data-table-cell-right">
                            <button
                              className="data-table-btn"
                              onClick={() => {
                                const html = d.payload?.rendered_html || d.payload?.renderedHtml || "";
                                if (html) openHtml(html);
                              }}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                      {displayedGeneratedDocs.length === 0 ? (
                        <tr>
                          <td className="data-table-empty" colSpan={4}>
                            No documents yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}