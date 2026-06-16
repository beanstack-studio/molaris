"use client";

import { FeatureGate } from "@/components/shared/FeatureGate";

import { useEffect, useState } from "react";
import { loadClinicMeta } from "@/lib/clinicMetaLoader";
import { generatePrescriptionHTML } from "@/lib/prescriptionGenerator";
import { generateCertificateHTML } from "@/lib/certificateGenerator";
import { generateReferralHTML } from "@/lib/referralGenerator";
import { generateInvoicePreviewHTML, generateReceiptPreviewHTML } from "@/lib/invoiceReceiptGenerators";

const TABS = ["Prescription", "Certificate", "Referral", "Invoice", "Receipt"] as const;
type Tab = typeof TABS[number];

function DocumentTemplatesSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Prescription");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generatePreview(activeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function generatePreview(tab: Tab) {
    setLoading(true);
    try {
      const clinicMeta = await loadClinicMeta();

      const sampleDate = new Date().toISOString().split("T")[0];

      if (tab === "Prescription") {
        const html = generatePrescriptionHTML({
          patientName: "Sample Patient",
          patientAge: 32,
          patientAddress: "Sample Address, City",
          patientGender: "Female",
          visitDate: sampleDate,
          dentistName: "Dr. Sample Dentist",
          medications: [
            { medication: "Amoxicillin 500mg", dosage: "500mg", duration: "7 days", instructions: "Take 1 capsule 3x a day after meals" },
            { medication: "Mefenamic Acid", dosage: "500mg", duration: "3 days", instructions: "Take as needed for pain" },
          ],
          remarks: "Rest and avoid hard foods for 24 hours.",
          docNo: "RX26-0001",
          clinicMeta,
        });
        setPreviewHtml(html);
      } else if (tab === "Certificate") {
        const html = generateCertificateHTML({
          patientName: "Sample Patient",
          patientAge: 32,
          patientAddress: "Sample Address, City",
          patientGender: "Female",
          visitDate: sampleDate,
          dentistName: "Dr. Sample Dentist",
          purpose: "employment",
          findings: "Patient has good oral health. No active caries noted.",
          treatmentDone: "Oral prophylaxis (teeth cleaning) performed.",
          remarks: "Patient is fit for work.",
          docNo: "CERT26-0001",
          clinicMeta,
        });
        setPreviewHtml(html);
      } else if (tab === "Referral") {
        const html = generateReferralHTML({
          patientName: "Sample Patient",
          patientAge: 32,
          patientAddress: "Sample Address, City",
          patientGender: "Female",
          visitDate: sampleDate,
          dentistName: "Dr. Sample Dentist",
          clinic: "Sample Specialist Clinic",
          doctor: "Dr. Specialist",
          reason: "Patient requires orthodontic evaluation and possible treatment.",
          remarks: "Please evaluate for braces or Invisalign suitability.",
          docNo: "REF26-0001",
          clinicMeta,
        });
        setPreviewHtml(html);
      } else if (tab === "Invoice") {
        const html = await generateInvoicePreviewHTML();
        setPreviewHtml(html);
      } else if (tab === "Receipt") {
        const html = await generateReceiptPreviewHTML();
        setPreviewHtml(html);
      } else {
        setPreviewHtml("");
      }
    } catch (err) {
      console.error("Preview generation failed:", err);
      setPreviewHtml("");
    }
    setLoading(false);
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Document Templates</div>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Preview how your documents will look with your current clinic profile settings.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-current text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              style={activeTab === tab ? { borderColor: "hsl(var(--accent-hue) var(--accent-sat) 45%)", color: "hsl(var(--accent-hue) var(--accent-sat) 35%)" } : {}}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Preview area */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 h-[700px]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              Generating preview…
            </div>
          ) : previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full border-0"
              title={`${activeTab} Preview`}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              No preview available.
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-3">
          Preview uses sample data. Update clinic information in Clinic Profile settings to see real details.
        </p>
      </div>
    </>
  );
}

export default function DocumentTemplatesSettingsPageGated() {
  return <FeatureGate feature="edit_catalog"><DocumentTemplatesSettingsPage /></FeatureGate>;
}
