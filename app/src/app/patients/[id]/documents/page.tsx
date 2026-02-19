"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { EditModal } from "@/components/EditModal";
import { supabase } from "@/lib/supabaseClient";
import type { DocTemplate, GeneratedDoc, DentistRow, Patient } from "@/lib/types";
import { todayLocalISO, formatDateTimePH, formatDateStandard, renderTemplate, splitFullName } from "@/lib/helpers";

function printHtml(html: string) {
  const w = window.open("", "", "width=800,height=600");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.print();
  }
}

function openHtml(html: string) {
  const w = window.open("", "", "width=900,height=700");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export default function DocumentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);
  const [docSort, setDocSort] = useState<"DATE_DESC" | "DATE_ASC" | "TYPE_ASC">("DATE_DESC");
  const [dentists, setDentists] = useState<DentistRow[]>([]);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
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
      .select("*")
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

    const { error } = await supabase.from("generated_documents").insert({
      patient_id: id,
      doc_type: template.doc_type,
      doc_number: null,
      payload,
      created_by: userId,
    });

    setBusy(false);
    if (error) return setErr(error.message);

    setShowGenerateModal(false);
    resetGenerateForm();
    await loadData();
  }

  function resetGenerateForm() {
    setSelectedTemplateId("");
    setPreviewHtml("");
    setDocVisitDate(todayLocalISO());
    setDocDentistId("");
    setDocReceiptNo("");
    setDocItems("");
    setDocAmountPaid("");
    setDocPaymentMethod("Cash");
    setDocBalance("");
    setDocFindings("");
    setDocTreatmentDone("");
    setDocRemarks("");
    setDocIssuedBy("");
    setErr(null);
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

  return (
    <>
      {err ? <div className="error-banner">{err}</div> : null}

      <div className="page-content">
        <div className="page-sections">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Generated Documents</div>
              <div className="flex items-center gap-2">
                <select
                  className="form-select-standard"
                  value={docSort}
                  onChange={(e) => setDocSort(e.target.value as any)}
                >
                  <option value="DATE_DESC">Newest</option>
                  <option value="DATE_ASC">Oldest</option>
                  <option value="TYPE_ASC">Type A–Z</option>
                </select>
                <button
                  className="btn-secondary-dark"
                  onClick={() => setShowGenerateModal(true)}
                  disabled={true}
                >
                  Generate document
                </button>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <colgroup>
                  <col className="col-25" />
                  <col className="col-25" />
                  <col className="col-35" />
                  <col className="col-15" />
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
                      <td className="data-table-cell">{formatDateStandard(d.created_at.split('T')[0])}</td>
                      <td className="data-table-cell">{d.doc_type}</td>
                      <td className="data-table-cell">{d.doc_number ?? "—"}</td>
                      <td className="data-table-cell-right">
                        <div className="flex-items-center-justify-end-gap-2">
                          <button
                            className="data-table-btn"
                            onClick={() => {
                              const html = d.payload?.rendered_html || d.payload?.renderedHtml || "";
                              if (html) openHtml(html);
                            }}
                          >
                            Open
                          </button>
                          <button
                            className="data-table-btn"
                            onClick={() => {
                              const html = d.payload?.rendered_html || d.payload?.renderedHtml || "";
                              if (html) printHtml(html);
                            }}
                          >
                            Print
                          </button>
                        </div>
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

      {/* Generate Document Modal */}
      <EditModal
        open={showGenerateModal}
        title="Generate document"
        onClose={() => {
          setShowGenerateModal(false);
          resetGenerateForm();
        }}
      >
        <div className="spacing-vertical-lg">
          {/* Template, Visit date, Dentist - Three columns */}
          <div className="flex gap-4">
            <div className="grid-gap-1" style={{ width: "33.33%" }}>
              <label className="text-sm-medium-slate-700">Template</label>
              <select
                className="input-h10-border-white w-full"
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
            </div>

            <div className="grid-gap-1" style={{ width: "33.33%" }}>
              <label className="text-sm-medium-slate-700">Visit date</label>
              <input
                type="date"
                className="input-h10-border-white w-full"
                value={docVisitDate}
                onChange={(e) => setDocVisitDate(e.target.value)}
              />
            </div>

            <div className="grid-gap-1" style={{ width: "33.33%" }}>
              <label className="text-sm-medium-slate-700">Dentist</label>
              <select
                className="input-h10-border-white w-full"
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
            </div>
          </div>

          {/* Receipt #, Payment method - Two columns */}
          <div className="flex gap-4">
            <div className="grid-gap-1" style={{ width: "50%" }}>
              <label className="text-sm-medium-slate-700">Receipt #</label>
              <input
                type="text"
                className="input-h10-border-white w-full"
                value={docReceiptNo}
                onChange={(e) => setDocReceiptNo(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid-gap-1" style={{ width: "50%" }}>
              <label className="text-sm-medium-slate-700">Payment method</label>
              <input
                type="text"
                className="input-h10-border-white w-full"
                value={docPaymentMethod}
                onChange={(e) => setDocPaymentMethod(e.target.value)}
                placeholder="e.g., Cash"
              />
            </div>
          </div>

          {/* Items, Amount paid, Balance - Three columns */}
          <div className="flex gap-4">
            <div className="grid-gap-1" style={{ width: "33.33%" }}>
              <label className="text-sm-medium-slate-700">Items</label>
              <input
                type="text"
                className="input-h10-border-white w-full"
                value={docItems}
                onChange={(e) => setDocItems(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid-gap-1" style={{ width: "33.33%" }}>
              <label className="text-sm-medium-slate-700">Amount paid</label>
              <input
                type="text"
                className="input-h10-border-white w-full"
                value={docAmountPaid}
                onChange={(e) => setDocAmountPaid(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid-gap-1" style={{ width: "33.33%" }}>
              <label className="text-sm-medium-slate-700">Balance</label>
              <input
                type="text"
                className="input-h10-border-white w-full"
                value={docBalance}
                onChange={(e) => setDocBalance(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Findings, Treatment done - Two columns */}
          <div className="flex gap-4">
            <div className="grid-gap-1" style={{ width: "50%" }}>
              <label className="text-sm-medium-slate-700">Findings</label>
              <textarea
                className="input-h10-border-white w-full resize-none"
                style={{ minHeight: "88px" }}
                value={docFindings}
                onChange={(e) => setDocFindings(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid-gap-1" style={{ width: "50%" }}>
              <label className="text-sm-medium-slate-700">Treatment done</label>
              <textarea
                className="input-h10-border-white w-full resize-none"
                style={{ minHeight: "88px" }}
                value={docTreatmentDone}
                onChange={(e) => setDocTreatmentDone(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Remarks, Issued by - Two columns */}
          <div className="flex gap-4">
            <div className="grid-gap-1" style={{ width: "50%" }}>
              <label className="text-sm-medium-slate-700">Remarks</label>
              <textarea
                className="input-h10-border-white w-full resize-none"
                style={{ minHeight: "88px" }}
                value={docRemarks}
                onChange={(e) => setDocRemarks(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid-gap-1" style={{ width: "50%" }}>
              <label className="text-sm-medium-slate-700">Issued by</label>
              <input
                type="text"
                className="input-h10-border-white w-full"
                value={docIssuedBy}
                onChange={(e) => setDocIssuedBy(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="modal-actions">
            <div className="modal-actions-right">
              <button
                className="cancel-btn"
                disabled={busy}
                onClick={() => {
                  setShowGenerateModal(false);
                  resetGenerateForm();
                }}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                disabled={busy || !selectedTemplateId || !docDentistId}
                onClick={generateDocument}
              >
                {busy ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>
    </>
  );
}