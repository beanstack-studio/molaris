"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  importBulkPayments,
  parsePaymentCSV,
  validatePaymentRecords,
  getPaymentCSVTemplate,
  recordPayment,
  batchVerifyPayments,
  batchGenerateReceipts,
  type BulkPaymentRecord,
  type BulkPaymentResult,
} from "@/lib/bulkPaymentHelpers";
import { getActivePaymentModes } from "@/lib/paymentModeHelpers";
import { formatMoney, todayLocalISO } from "@/lib/helpers";

type TabType = "manual" | "csv" | "review" | "results";

export default function BulkPaymentsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("manual");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual entry state
  const [manualPayments, setManualPayments] = useState<BulkPaymentRecord[]>([
    {
      invoice_number: "",
      amount: 0,
      payment_date: todayLocalISO(),
      mode: "CASH",
      reference_number: "",
      received_by: "",
      notes: "",
    },
  ]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);

  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [parsedRecords, setParsedRecords] = useState<BulkPaymentRecord[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  // Review/validation state
  const [recordsToImport, setRecordsToImport] = useState<BulkPaymentRecord[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Results state
  const [importResults, setImportResults] = useState<BulkPaymentResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedForReceipts, setSelectedForReceipts] = useState<string[]>([]);
  const [isGeneratingReceipts, setIsGeneratingReceipts] = useState(false);

  // Load payment modes
  const loadPaymentModes = async () => {
    try {
      const modes = await getActivePaymentModes();
      setPaymentModes(modes || []);
    } catch (error) {
      console.error("Failed to load payment modes:", error);
    }
  };

  // Manual entry handlers
  const handleAddPaymentRow = () => {
    setManualPayments([
      ...manualPayments,
      {
        invoice_number: "",
        amount: 0,
        payment_date: todayLocalISO(),
        mode: "CASH",
        reference_number: "",
        received_by: "",
        notes: "",
      },
    ]);
  };

  const handleRemovePaymentRow = (index: number) => {
    setManualPayments(manualPayments.filter((_, i) => i !== index));
  };

  const handleManualPaymentChange = (index: number, field: string, value: any) => {
    const updated = [...manualPayments];
    updated[index] = { ...updated[index], [field]: value };
    setManualPayments(updated);
  };

  const handleValidateManual = async () => {
    const filtered = manualPayments.filter((p) => p.invoice_number);
    setRecordsToImport(filtered);
    setActiveTab("review");

    setIsValidating(true);
    try {
      const result = await validatePaymentRecords(filtered);
      setValidationErrors(result.errors);
    } catch (error) {
      setValidationErrors([
        error instanceof Error ? error.message : "Validation error",
      ]);
    } finally {
      setIsValidating(false);
    }
  };

  // CSV import handlers
  const handleCSVFile = (file: File) => {
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);

      // Parse immediately
      const { records, errors } = parsePaymentCSV(content);
      setParsedRecords(records);
      setCsvErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleValidateCSV = async () => {
    setRecordsToImport(parsedRecords);
    setActiveTab("review");

    setIsValidating(true);
    try {
      const result = await validatePaymentRecords(parsedRecords);
      setValidationErrors(result.errors);
    } catch (error) {
      setValidationErrors([
        error instanceof Error ? error.message : "Validation error",
      ]);
    } finally {
      setIsValidating(false);
    }
  };

  // Review and import
  const handleImport = async () => {
    if (validationErrors.length > 0) {
      alert("Please fix validation errors before importing");
      return;
    }

    setIsImporting(true);
    try {
      const results = await importBulkPayments(recordsToImport);
      setImportResults(results);
      setActiveTab("results");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  // Receipt generation
  const handleGenerateReceipts = async () => {
    const successResults = importResults.filter((r) => r.success && r.payment_id);
    const selectedPayments = successResults
      .filter((r) => selectedForReceipts.includes(r.payment_id!))
      .map((r) => r.payment_id!)
      .filter(Boolean);

    if (selectedPayments.length === 0) {
      alert("Please select payments to generate receipts for");
      return;
    }

    setIsGeneratingReceipts(true);
    try {
      // Note: This requires staff_id and user_id from auth context
      // For now, we'll show the implementation but need proper auth integration
      alert(
        "Receipt generation requires staff authentication. Please integrate with your auth system."
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Receipt generation failed");
    } finally {
      setIsGeneratingReceipts(false);
    }
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    const content = getPaymentCSVTemplate();
    const blob = new Blob([content], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payment-template.csv";
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Bulk Payments</h1>
              <p className="mt-2 text-slate-600">
                Record multiple payments, import from CSV, and generate receipts
              </p>
            </div>
            <Link
              href="/reports/payments"
              className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
            >
              ← Back to Reports
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-300">
          {[
            { key: "manual", label: "✏️ Manual Entry" },
            { key: "csv", label: "📄 CSV Import" },
            { key: "review", label: "✓ Review", disabled: recordsToImport.length === 0 },
            { key: "results", label: "✅ Results", disabled: importResults.length === 0 },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && setActiveTab(tab.key as TabType)}
              disabled={tab.disabled}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : tab.disabled
                    ? "cursor-not-allowed text-slate-400"
                    : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-lg bg-white p-6 shadow-lg">
          {/* MANUAL ENTRY TAB */}
          {activeTab === "manual" && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">
                        Invoice #
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-700">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Mode</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Reference</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">
                        Received By
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Notes</th>
                      <th className="px-4 py-2 text-center font-semibold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {manualPayments.map((payment, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            placeholder="INV-001"
                            value={payment.invoice_number}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "invoice_number", e.target.value)
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            placeholder="0"
                            step="0.01"
                            value={payment.amount}
                            onChange={(e) =>
                              handleManualPaymentChange(
                                index,
                                "amount",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={payment.payment_date}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "payment_date", e.target.value)
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={payment.mode}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "mode", e.target.value)
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1"
                            onFocus={loadPaymentModes}
                          >
                            {paymentModes.map((mode) => (
                              <option key={mode.code} value={mode.code}>
                                {mode.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            placeholder="Optional"
                            value={payment.reference_number || ""}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "reference_number", e.target.value)
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            placeholder="Optional"
                            value={payment.received_by || ""}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "received_by", e.target.value)
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            placeholder="Optional"
                            value={payment.notes || ""}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "notes", e.target.value)
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemovePaymentRow(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddPaymentRow}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
                >
                  + Add Row
                </button>
                <button
                  onClick={handleValidateManual}
                  disabled={isValidating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isValidating ? "Validating..." : "Continue to Review"}
                </button>
              </div>
            </div>
          )}

          {/* CSV IMPORT TAB */}
          {activeTab === "csv" && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
                <div className="space-y-4">
                  <div className="text-4xl">📄</div>
                  <div>
                    <p className="font-semibold text-slate-900">Drop CSV file here or click to upload</p>
                    <p className="text-sm text-slate-600">
                      Format: invoice_number, amount, payment_date, mode, reference_number, received_by, notes
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleCSVFile(e.target.files[0])}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    Choose File
                  </button>
                </div>
              </div>

              {csvFile && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">File: {csvFile.name}</p>
                  <p className="text-sm text-slate-600">
                    {parsedRecords.length} records found{csvErrors.length > 0 && `, ${csvErrors.length} errors`}
                  </p>
                </div>
              )}

              {csvErrors.length > 0 && (
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="font-semibold text-red-700">Parse Errors</p>
                  <ul className="mt-2 space-y-1 text-sm text-red-600">
                    {csvErrors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parsedRecords.length > 0 && csvErrors.length === 0 && (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">
                            Invoice
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">
                            Amount
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {parsedRecords.slice(0, 5).map((record, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2">{record.invoice_number}</td>
                            <td className="px-4 py-2 text-right">
                              {formatMoney(record.amount)}
                            </td>
                            <td className="px-4 py-2">{record.payment_date}</td>
                            <td className="px-4 py-2">{record.mode}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedRecords.length > 5 && (
                    <p className="text-sm text-slate-600">
                      ...and {parsedRecords.length - 5} more records
                    </p>
                  )}

                  <button
                    onClick={handleValidateCSV}
                    disabled={isValidating}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isValidating ? "Validating..." : "Continue to Review"}
                  </button>
                </div>
              )}

              <button
                onClick={handleDownloadTemplate}
                className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
              >
                ⬇️ Download Template
              </button>
            </div>
          )}

          {/* REVIEW TAB */}
          {activeTab === "review" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Review Records</h2>

              {validationErrors.length > 0 && (
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="font-semibold text-red-700">Validation Errors ({validationErrors.length})</p>
                  <ul className="mt-2 space-y-1 text-sm text-red-600">
                    {validationErrors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationErrors.length === 0 && (
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="font-semibold text-green-700">✓ All records are valid</p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">
                        Invoice
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-700">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Mode</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recordsToImport.map((record, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2">{record.invoice_number}</td>
                        <td className="px-4 py-2 text-right">{formatMoney(record.amount)}</td>
                        <td className="px-4 py-2">{record.payment_date}</td>
                        <td className="px-4 py-2">{record.mode}</td>
                        <td className="px-4 py-2">{record.reference_number || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={isImporting || validationErrors.length > 0}
                  className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isImporting ? "Importing..." : "Import Payments"}
                </button>
                <button
                  onClick={() => setActiveTab("manual")}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {/* RESULTS TAB */}
          {activeTab === "results" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Import Results</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-sm text-slate-600">Successful</p>
                  <p className="text-2xl font-bold text-green-700">
                    {importResults.filter((r) => r.success).length}
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-sm text-slate-600">Failed</p>
                  <p className="text-2xl font-bold text-red-700">
                    {importResults.filter((r) => !r.success).length}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">
                        Invoice
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Message</th>
                      <th className="px-4 py-2 text-center font-semibold text-slate-700">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {importResults.map((result, i) => (
                      <tr key={i} className={result.success ? "bg-green-50" : "bg-red-50"}>
                        <td className="px-4 py-2">{result.invoice_number}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                              result.success
                                ? "bg-green-200 text-green-800"
                                : "bg-red-200 text-red-800"
                            }`}
                          >
                            {result.success ? "✓ Success" : "✕ Failed"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {result.message}
                          {result.error && ` - ${result.error}`}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {result.success && (
                            <input
                              type="checkbox"
                              checked={selectedForReceipts.includes(result.payment_id!)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedForReceipts([
                                    ...selectedForReceipts,
                                    result.payment_id!,
                                  ]);
                                } else {
                                  setSelectedForReceipts(
                                    selectedForReceipts.filter((id) => id !== result.payment_id!)
                                  );
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importResults.some((r) => r.success) && (
                <button
                  onClick={handleGenerateReceipts}
                  disabled={
                    isGeneratingReceipts || selectedForReceipts.length === 0
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isGeneratingReceipts
                    ? "Generating..."
                    : `Generate Receipts (${selectedForReceipts.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
