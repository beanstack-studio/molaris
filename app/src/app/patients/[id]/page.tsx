"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  occupation: string | null;
  email: string | null;
  notes: string | null;
};

type MedHist = {
  id: string;
  allergies: string | null;
  medications: string | null;
  blood_pressure: string | null;
  notes: string | null;
  conditions: any;
};

type ChartEntry = {
  id: string;
  tooth_number: number;
  surfaces: string | null;
  finding_code: string;
  notes: string | null;
  recorded_at: string;
};

type Treatment = {
  id: string;
  treatment_date: string;
  procedure: string;
  tooth_number: number | null;
  fee: number;
  notes: string | null;
};

type DocTemplate = {
  id: string;
  name: string;
  doc_type: string;
  content_html: string;
};

type GeneratedDoc = {
  id: string;
  doc_type: string;
  doc_number: string | null;
  payload: any;
  created_at: string;
};

type Attachment = {
  id: string;
  type: string;
  file_path: string;
  file_name: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

const attachmentTypes = ["XRAY", "PHOTO", "FORM", "LAB", "OTHER"] as const;
type AttachmentType = (typeof attachmentTypes)[number];

const tabs = ["Info", "Medical", "Chart", "Treatments", "Files", "Documents"] as const;
type Tab = (typeof tabs)[number];

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("Info");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [med, setMed] = useState<MedHist | null>(null);
  const [chart, setChart] = useState<ChartEntry[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadType, setUploadType] = useState<AttachmentType>("XRAY");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  // Documents
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");

  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);

  // Document input fields
  const [docVisitDate, setDocVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [docFindings, setDocFindings] = useState("");
  const [docTreatmentDone, setDocTreatmentDone] = useState("");
  const [docRemarks, setDocRemarks] = useState("");

  const [docDentistName, setDocDentistName] = useState("");
  const [docPrcLicense, setDocPrcLicense] = useState("");

  const [docReceiptNo, setDocReceiptNo] = useState("");
  const [docItems, setDocItems] = useState("");
  const [docAmountPaid, setDocAmountPaid] = useState("");
  const [docPaymentMethod, setDocPaymentMethod] = useState("Cash");
  const [docBalance, setDocBalance] = useState("");
  const [docIssuedBy, setDocIssuedBy] = useState("");

  const [loading, setLoading] = useState(true);

  // Forms
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Medical form
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [bp, setBp] = useState("");
  const [medNotes, setMedNotes] = useState("");

  // Chart form
  const [tooth, setTooth] = useState("");
  const [surfaces, setSurfaces] = useState("");
  const [finding, setFinding] = useState("");
  const [chartNotes, setChartNotes] = useState("");

  // Treatment form
  const [procDate, setProcDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [procedure, setProcedure] = useState("");
  const [tTooth, setTTooth] = useState("");
  const [fee, setFee] = useState("");
  const [tNotes, setTNotes] = useState("");

  async function loadAll() {
    setLoading(true);
    setErr(null);

    const p = await supabase
      .from("patients")
      .select("id, full_name, phone, birth_date, address, occupation, email, notes")
      .eq("id", id)
      .single();

    if (p.error) {
      setErr(p.error.message);
      setLoading(false);
      return;
    }
    setPatient(p.data as Patient);

    const m = await supabase
      .from("patient_medical_histories")
      .select("id, allergies, medications, blood_pressure, notes, conditions")
      .eq("patient_id", id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!m.error && m.data?.length) {
      const row = m.data[0] as MedHist;
      setMed(row);
      setAllergies(row.allergies ?? "");
      setMedications(row.medications ?? "");
      setBp(row.blood_pressure ?? "");
      setMedNotes(row.notes ?? "");
    }

    const c = await supabase
      .from("dental_chart_entries")
      .select("id, tooth_number, surfaces, finding_code, notes, recorded_at")
      .eq("patient_id", id)
      .order("recorded_at", { ascending: false });

    if (!c.error && c.data) setChart(c.data as ChartEntry[]);

    const t = await supabase
      .from("treatments")
      .select("id, treatment_date, procedure, tooth_number, fee, notes")
      .eq("patient_id", id)
      .order("treatment_date", { ascending: false })
      .limit(200);

    if (!t.error && t.data) setTreatments(t.data as Treatment[]);
    
    const a = await supabase
      .from("attachments")
      .select("id, type, file_path, file_name, content_type, file_size_bytes, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });

    if (!a.error && a.data) setAttachments(a.data as Attachment[]);

    const tpl = await supabase
      .from("document_templates")
      .select("id, name, doc_type, content_html")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (!tpl.error && tpl.data) {
      setTemplates(tpl.data as DocTemplate[]);
      if (!selectedTemplateId && tpl.data.length) setSelectedTemplateId(tpl.data[0].id);
    }

    const gd = await supabase
      .from("generated_documents")
      .select("id, doc_type, doc_number, payload, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!gd.error && gd.data) setGeneratedDocs(gd.data as GeneratedDoc[]);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveMedical() {
    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const payload = {
      patient_id: id,
      allergies: allergies.trim() || null,
      medications: medications.trim() || null,
      blood_pressure: bp.trim() || null,
      notes: medNotes.trim() || null,
      conditions: {}, // we’ll add checkboxes later
      updated_by: userId,
    };

    const res = med?.id
      ? await supabase.from("patient_medical_histories").update(payload).eq("id", med.id)
      : await supabase.from("patient_medical_histories").insert(payload);

    setBusy(false);
    if (res.error) return setErr(res.error.message);
    await loadAll();
  }

  async function addChartEntry() {
    const toothNum = Number(tooth);
    if (!toothNum || toothNum < 1) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const res = await supabase.from("dental_chart_entries").insert({
      patient_id: id,
      tooth_number: toothNum,
      surfaces: surfaces.trim() || null,
      finding_code: finding.trim(),
      notes: chartNotes.trim() || null,
      recorded_by: userId,
    });

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setTooth("");
    setSurfaces("");
    setFinding("");
    setChartNotes("");
    await loadAll();
  }

  async function addTreatment() {
    setBusy(true);
    setErr(null);

    const toothNum = tTooth.trim() ? Number(tTooth) : null;
    const feeNum = fee.trim() ? Number(fee) : 0;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const res = await supabase.from("treatments").insert({
      patient_id: id,
      treatment_date: procDate,
      procedure: procedure.trim(),
      tooth_number: toothNum,
      fee: isNaN(feeNum) ? 0 : feeNum,
      notes: tNotes.trim() || null,
      created_by: userId,
      dentist_id: userId,
    });

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    setProcedure("");
    setTTooth("");
    setFee("");
    setTNotes("");
    await loadAll();
  }

  function safeFileName(name: string) {
    return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  }

  async function uploadAttachment() {
    if (!fileToUpload) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const ext = fileToUpload.name.includes(".") ? fileToUpload.name.split(".").pop() : "";
    const base = safeFileName(fileToUpload.name);
    const random = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);

    // Path inside the bucket:
    // patientId/YYYY-MM-DD/uuid_filename.ext
    const path = `${id}/${today}/${random}_${base}`;

    const up = await supabase.storage
      .from("patient-files")
      .upload(path, fileToUpload, {
        contentType: fileToUpload.type || "application/octet-stream",
        upsert: false,
      });

    if (up.error) {
      setBusy(false);
      setErr(up.error.message);
      return;
    }

    const ins = await supabase.from("attachments").insert({
      patient_id: id,
      type: uploadType,
      file_path: path,
      file_name: fileToUpload.name,
      content_type: fileToUpload.type || null,
      file_size_bytes: fileToUpload.size ?? null,
      uploaded_by: userId,
    });

    setBusy(false);

    if (ins.error) {
      setErr(ins.error.message);
      return;
    }

    setFileToUpload(null);
    await loadAll();
  }

  async function openAttachment(a: Attachment) {
    setErr(null);

    const signed = await supabase.storage
      .from("patient-files")
      .createSignedUrl(a.file_path, 60 * 10); // 10 minutes

    if (signed.error || !signed.data?.signedUrl) {
      setErr(signed.error?.message ?? "Failed to generate signed URL.");
      return;
    }

    window.open(signed.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function escapeHtml(s: string) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderTemplate(html: string, vars: Record<string, string>) {
    let out = html;
    for (const [key, val] of Object.entries(vars)) {
      out = out.replaceAll(`{{${key}}}`, val);
    }
    return out;
  }

  function patientBirthDateLine(p: Patient) {
    if (!p.birth_date) return "";
    return `, born on <b>${escapeHtml(p.birth_date)}</b>,`;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) ?? null;
  }, [templates, selectedTemplateId]);

  function buildVars() {
    if (!patient) return {};

    return {
      "patient.full_name": escapeHtml(patient.full_name),
      "patient.birth_date_line": patientBirthDateLine(patient),

      "doc.visit_date": escapeHtml(docVisitDate || todayISO()),
      "doc.issue_date": escapeHtml(todayISO()),

      "doc.findings": escapeHtml(docFindings || "-").replaceAll("\n", "<br />"),
      "doc.treatment_done": escapeHtml(docTreatmentDone || "-").replaceAll("\n", "<br />"),
      "doc.remarks": escapeHtml(docRemarks || "-").replaceAll("\n", "<br />"),

      "doc.dentist_name": escapeHtml(docDentistName || "________________"),
      "doc.prc_license": escapeHtml(docPrcLicense || "__________"),

      "doc.receipt_no": escapeHtml(docReceiptNo || "__________"),
      "doc.items": escapeHtml(docItems || "-").replaceAll("\n", "<br />"),
      "doc.amount_paid": escapeHtml(docAmountPaid || "0.00"),
      "doc.payment_method": escapeHtml(docPaymentMethod || "Cash"),
      "doc.balance": escapeHtml(docBalance || "0.00"),
      "doc.issued_by": escapeHtml(docIssuedBy || "________________"),
    };
  }

  function generatePreview() {
    if (!selectedTemplate) return;
    const vars = buildVars();
    const html = renderTemplate(selectedTemplate.content_html, vars);
    setPreviewHtml(html);
  }

  function printPreview() {
    if (!previewHtml) return;

    // Open a same-origin blank window we can write into
    const w = window.open("about:blank", "_blank");
    if (!w) {
      setErr("Popup blocked. Please allow popups for this site, then try again.");
      return;
    }

    // Best-effort security: prevent the new tab from being able to access the opener
    try {
      w.opener = null;
    } catch {}

    w.document.open();
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Print</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; }
            @page { margin: 12mm; }
          </style>
        </head>
        <body>
          ${previewHtml}
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    w.document.close();
  }

  async function saveGeneratedDoc() {
    if (!selectedTemplate || !patient) return;

    setBusy(true);
    setErr(null);

    const payload = {
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        birth_date: patient.birth_date,
        phone: patient.phone,
        address: patient.address,
      },
      doc: {
        visit_date: docVisitDate || todayISO(),
        issue_date: todayISO(),
        findings: docFindings,
        treatment_done: docTreatmentDone,
        remarks: docRemarks,
        dentist_name: docDentistName,
        prc_license: docPrcLicense,
        receipt_no: docReceiptNo,
        items: docItems,
        amount_paid: docAmountPaid,
        payment_method: docPaymentMethod,
        balance: docBalance,
        issued_by: docIssuedBy,
      },
    };

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const res = await supabase.from("generated_documents").insert({
      template_id: selectedTemplate.id,
      patient_id: patient.id,
      doc_type: selectedTemplate.doc_type,
      payload,
      created_by: userId,
    });

    setBusy(false);
    if (res.error) return setErr(res.error.message);

    await loadAll();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading…</div>;
  }

  if (!patient) {
    return (
      <div className="min-h-screen p-6">
        <button className="rounded-lg border bg-white px-4 py-2" onClick={() => router.push("/patients")}>
          Back
        </button>
        <p className="mt-4 text-red-600">Patient not found.</p>
        {err ? <p className="mt-2 text-slate-600">{err}</p> : null}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button className="rounded-lg border bg-white px-3 py-1 text-sm" onClick={() => router.push("/patients")}>
              ← Back
            </button>
            <h1 className="mt-2 text-2xl font-semibold">{patient.full_name}</h1>
            <p className="text-sm text-slate-600">
              {patient.phone ?? "No phone"} {patient.birth_date ? `• Born ${patient.birth_date}` : ""}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              className={
                "rounded-lg px-3 py-2 text-sm font-medium border " +
                (tab === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-900")
              }
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {err ? <div className="mt-3 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        {/* Tab content */}
        <div className="mt-4 rounded-xl border bg-white p-4">
          {tab === "Info" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Phone" value={patient.phone ?? "-"} />
              <InfoRow label="Birth date" value={patient.birth_date ?? "-"} />
              <InfoRow label="Address" value={patient.address ?? "-"} />
              <InfoRow label="Email" value={patient.email ?? "-"} />
              <InfoRow label="Occupation" value={patient.occupation ?? "-"} />
              <InfoRow label="Notes" value={patient.notes ?? "-"} />
              <p className="text-sm text-slate-600 sm:col-span-2">
                Next: we’ll add “Edit Patient” here.
              </p>
            </div>
          ) : null}

          {tab === "Medical" ? (
            <div className="grid gap-3">
              <Field label="Allergies" value={allergies} onChange={setAllergies} />
              <Field label="Medications" value={medications} onChange={setMedications} />
              <Field label="Blood pressure" value={bp} onChange={setBp} placeholder="e.g., 120/80" />
              <Field label="Notes" value={medNotes} onChange={setMedNotes} textarea />
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={busy}
                  onClick={saveMedical}
                >
                  {busy ? "Saving…" : "Save medical history"}
                </button>
              </div>
            </div>
          ) : null}

          {tab === "Chart" ? (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Tooth no." value={tooth} onChange={setTooth} placeholder="e.g., 11" />
                <Field label="Surfaces" value={surfaces} onChange={setSurfaces} placeholder="e.g., MOD" />
                <Field label="Finding" value={finding} onChange={setFinding} placeholder="e.g., Caries" />
                <div className="flex items-end">
                  <button
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={busy || finding.trim().length < 2 || !tooth.trim()}
                    onClick={addChartEntry}
                  >
                    {busy ? "Adding…" : "Add entry"}
                  </button>
                </div>
              </div>
              <Field label="Notes" value={chartNotes} onChange={setChartNotes} textarea />

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Tooth</th>
                      <th className="text-left px-3 py-2">Finding</th>
                      <th className="text-left px-3 py-2">Surfaces</th>
                      <th className="text-left px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="px-3 py-2">{new Date(e.recorded_at).toLocaleString()}</td>
                        <td className="px-3 py-2">{e.tooth_number}</td>
                        <td className="px-3 py-2 font-medium">{e.finding_code}</td>
                        <td className="px-3 py-2">{e.surfaces ?? "-"}</td>
                        <td className="px-3 py-2">{e.notes ?? "-"}</td>
                      </tr>
                    ))}
                    {chart.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-slate-600">No chart entries yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "Treatments" ? (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="sm:col-span-1">
                  <Field label="Date" value={procDate} onChange={setProcDate} type="date" />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Procedure" value={procedure} onChange={setProcedure} placeholder="e.g., Extraction" />
                </div>
                <div className="sm:col-span-1">
                  <Field label="Tooth" value={tTooth} onChange={setTTooth} placeholder="optional" />
                </div>
                <div className="sm:col-span-1">
                  <Field label="Fee" value={fee} onChange={setFee} placeholder="0.00" />
                </div>
              </div>
              <Field label="Notes" value={tNotes} onChange={setTNotes} textarea />
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={busy || procedure.trim().length < 2}
                  onClick={addTreatment}
                >
                  {busy ? "Adding…" : "Add treatment"}
                </button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Procedure</th>
                      <th className="text-left px-3 py-2">Tooth</th>
                      <th className="text-left px-3 py-2">Fee</th>
                      <th className="text-left px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatments.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-3 py-2">{t.treatment_date}</td>
                        <td className="px-3 py-2 font-medium">{t.procedure}</td>
                        <td className="px-3 py-2">{t.tooth_number ?? "-"}</td>
                        <td className="px-3 py-2">{Number(t.fee).toFixed(2)}</td>
                        <td className="px-3 py-2">{t.notes ?? "-"}</td>
                      </tr>
                    ))}
                    {treatments.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-slate-600">No treatments yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "Files" ? (
            <div className="grid gap-4">
              <div className="rounded-lg border p-4 bg-slate-50">
                <div className="text-sm font-semibold">Upload file</div>
                <p className="text-xs text-slate-600 mt-1">
                  Use for X-rays, photos, consent forms, lab results. Files are stored privately.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium">Type</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 bg-white"
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value as AttachmentType)}
                    >
                      {attachmentTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium">Choose file</label>
                    <input
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)}
                    />
                    <div className="mt-1 text-xs text-slate-600">
                      {fileToUpload ? `Selected: ${fileToUpload.name}` : "No file selected."}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={busy || !fileToUpload}
                    onClick={uploadAttachment}
                  >
                    {busy ? "Uploading…" : "Upload"}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="bg-white px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Patient files</div>
                    <div className="text-xs text-slate-600">{attachments.length} file(s)</div>
                  </div>
                </div>

                <div className="bg-white">
                  {attachments.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-600">No files uploaded yet.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="text-left px-4 py-2">Type</th>
                          <th className="text-left px-4 py-2">File</th>
                          <th className="text-left px-4 py-2">Uploaded</th>
                          <th className="text-right px-4 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attachments.map((a) => (
                          <tr key={a.id} className="border-t">
                            <td className="px-4 py-2 font-medium">{a.type}</td>
                            <td className="px-4 py-2">{a.file_name ?? a.file_path}</td>
                            <td className="px-4 py-2">{new Date(a.created_at).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                className="rounded-lg border bg-white px-3 py-1 text-sm font-medium"
                                onClick={() => openAttachment(a)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "Documents" ? (
            <div className="grid gap-4">
              <div className="rounded-lg border p-4 bg-slate-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Generate document</div>
                    <p className="text-xs text-slate-600 mt-1">
                      Choose a template, fill details, preview, print, and save a record.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="rounded-lg border bg-white px-4 py-2 text-sm font-medium"
                      onClick={generatePreview}
                    >
                      Preview
                    </button>
                    <button
                      className="rounded-lg border bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                      onClick={printPreview}
                      disabled={!previewHtml}
                    >
                      Print
                    </button>
                    <button
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      onClick={saveGeneratedDoc}
                      disabled={busy || !selectedTemplate}
                    >
                      {busy ? "Saving…" : "Save record"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">Template</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 bg-white"
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        setPreviewHtml("");
                      }}
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Field label="Visit date" value={docVisitDate} onChange={setDocVisitDate} type="date" />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Dentist name" value={docDentistName} onChange={setDocDentistName} placeholder="Dr. ____" />
                  <Field label="PRC license no." value={docPrcLicense} onChange={setDocPrcLicense} placeholder="____" />
                </div>

                <div className="mt-3 grid gap-3">
                  <Field label="Findings / Diagnosis" value={docFindings} onChange={setDocFindings} textarea />
                  <Field label="Treatment done" value={docTreatmentDone} onChange={setDocTreatmentDone} textarea />
                  <Field label="Remarks / Recommendation" value={docRemarks} onChange={setDocRemarks} textarea />
                </div>

                <div className="mt-4 rounded-lg border bg-white p-3">
                  <div className="text-sm font-semibold">Receipt fields (use when template is Receipt)</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Receipt no." value={docReceiptNo} onChange={setDocReceiptNo} placeholder="R-2026-0001" />
                    <Field label="Issued by" value={docIssuedBy} onChange={setDocIssuedBy} placeholder="Staff name" />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Amount paid" value={docAmountPaid} onChange={setDocAmountPaid} placeholder="0.00" />
                    <Field label="Balance" value={docBalance} onChange={setDocBalance} placeholder="0.00" />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Payment method" value={docPaymentMethod} onChange={setDocPaymentMethod} placeholder="Cash / GCash" />
                    <Field label="Items / Services" value={docItems} onChange={setDocItems} textarea />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-white overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">Preview</div>
                <div className="p-4">
                  {previewHtml ? (
                    <div className="max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  ) : (
                    <div className="text-sm text-slate-600">Click Preview to generate.</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-white overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-sm font-semibold">Saved documents</div>
                {generatedDocs.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-600">No saved documents yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-white text-slate-700">
                      <tr className="border-b">
                        <th className="text-left px-4 py-2">Type</th>
                        <th className="text-left px-4 py-2">Created</th>
                        <th className="text-left px-4 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedDocs.map((d) => (
                        <tr key={d.id} className="border-t">
                          <td className="px-4 py-2 font-medium">{d.doc_type}</td>
                          <td className="px-4 py-2">{new Date(d.created_at).toLocaleString()}</td>
                          <td className="px-4 py-2 text-slate-600">
                            {d.payload?.doc?.receipt_no
                              ? `Receipt #${d.payload.doc.receipt_no}`
                              : d.payload?.doc?.visit_date
                                ? `Visit ${d.payload.doc.visit_date}`
                                : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      {textarea ? (
        <textarea
          className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[90px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type ?? "text"}
        />
      )}
    </div>
  );
}
