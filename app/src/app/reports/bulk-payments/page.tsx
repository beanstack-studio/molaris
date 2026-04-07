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
    <div className="page-content">
      <div className="page-sections">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Bulk Payments</div>
            <Link href="/reports/payments" className="save-btn">← Back</Link>
          </div>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Record multiple payments, import from CSV, and generate receipts
          </p>

        {/* Tabs */}
        <div className="tabs mb-6">
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
              className={`tab-item ${
                activeTab === tab.key ? "tab-item-active" : tab.disabled ? "tab-item-disabled" : ""
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card">
          {/* MANUAL ENTRY TAB */}
          {activeTab === "manual" && (
            <div className="space-y-4">
              <div className="table-wrapper">
                <table className="data-table-compact">
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell">Invoice #</th>
                      <th className="data-table-head-cell-right">Amount</th>
                      <th className="data-table-head-cell">Date</th>
                      <th className="data-table-head-cell">Mode</th>
                      <th className="data-table-head-cell">Reference</th>
                      <th className="data-table-head-cell">Received By</th>
                      <th className="data-table-head-cell">Notes</th>
                      <th className="data-table-head-cell-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualPayments.map((payment, index) => (
                      <tr key={index} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                        <td className="data-table-cell">
                          <input
                            type="text"
                            placeholder="INV-001"
                            value={payment.invoice_number}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "invoice_number", e.target.value)
                            }
                            className="compact-input"
                          />
                        </td>
                        <td className="data-table-cell-right">
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
                            className="compact-input text-right"
                          />
                        </td>
                        <td className="data-table-cell">
                          <input
                            type="date"
                            value={payment.payment_date}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "payment_date", e.target.value)
                            }
                            className="compact-input"
                          />
                        </td>
                        <td className="data-table-cell">
                          <select
                            value={payment.mode}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "mode", e.target.value)
                            }
                            className="compact-input"
                            onFocus={loadPaymentModes}
                          >
                            {paymentModes.map((mode) => (
                              <option key={mode.code} value={mode.code}>
                                {mode.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="data-table-cell">
                          <input
                            type="text"
                            placeholder="Optional"
                            value={payment.reference_number || ""}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "reference_number", e.target.value)
                            }
                            className="compact-input"
                          />
                        </td>
                        <td className="data-table-cell">
                          <input
                            type="text"
                            placeholder="Optional"
                            value={payment.received_by || ""}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "received_by", e.target.value)
                            }
                            className="compact-input"
                          />
                        </td>
                        <td className="data-table-cell">
                          <input
                            type="text"
                            placeholder="Optional"
                            value={payment.notes || ""}
                            onChange={(e) =>
                              handleManualPaymentChange(index, "notes", e.target.value)
                            }
                            className="compact-input"
                          />
                        </td>
                        <td className="data-table-cell-right">
                          <button
                            onClick={() => handleRemovePaymentRow(index)}
                            className="data-table-btn text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="action-row">
                <button
                  onClick={handleAddPaymentRow}
                  className="save-btn"
                >
                  + Add Row
                </button>
                <button
                  onClick={handleValidateManual}
                  disabled={isValidating}
                  className="save-btn"
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
                    <p className="text-muted">
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
                    className="save-btn"
                  >
                    Choose File
                  </button>
                </div>
              </div>

              {csvFile && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">File: {csvFile.name}</p>
                  <p className="text-muted">
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
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead className="data-table-head">
                        <tr>
                          <th className="data-table-head-cell">Invoice</th>
                          <th className="data-table-head-cell-right">Amount</th>
                          <th className="data-table-head-cell">Date</th>
                          <th className="data-table-head-cell">Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRecords.slice(0, 5).map((record, i) => (
                          <tr key={i} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                            <td className="data-table-cell">{record.invoice_number}</td>
                            <td className="data-table-cell-right">{formatMoney(record.amount)}</td>
                            <td className="data-table-cell">{record.payment_date}</td>
                            <td className="data-table-cell">{record.mode}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedRecords.length > 5 && (
                    <p className="text-muted">
                      ...and {parsedRecords.length - 5} more records
                    </p>
                  )}

                  <button
                    onClick={handleValidateCSV}
                    disabled={isValidating}
                    className="save-btn"
                  >
                    {isValidating ? "Validating..." : "Continue to Review"}
                  </button>
                </div>
              )}

              <button
                onClick={handleDownloadTemplate}
                className="cancel-btn"
              >
                ⬇️ Download Template
              </button>
            </div>
          )}

          {/* REVIEW TAB */}
          {activeTab === "review" && (
            <div className="space-y-4">
              <div className="card-title">Review Records</div>

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

              <div className="table-wrapper">
                <table className="data-table">
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell">Invoice</th>
                      <th className="data-table-head-cell-right">Amount</th>
                      <th className="data-table-head-cell">Date</th>
                      <th className="data-table-head-cell">Mode</th>
                      <th className="data-table-head-cell">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordsToImport.map((record, i) => (
                      <tr key={i} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                        <td className="data-table-cell">{record.invoice_number}</td>
                        <td className="data-table-cell-right">{formatMoney(record.amount)}</td>
                        <td className="data-table-cell">{record.payment_date}</td>
                        <td className="data-table-cell">{record.mode}</td>
                        <td className="data-table-cell">{record.reference_number || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="action-row">
                <button
                  onClick={handleImport}
                  disabled={isImporting || validationErrors.length > 0}
                  className="save-btn"
                >
                  {isImporting ? "Importing..." : "Import Payments"}
                </button>
                <button
                  onClick={() => setActiveTab("manual")}
                  className="cancel-btn"
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {/* RESULTS TAB */}
          {activeTab === "results" && (
            <div className="space-y-4">
              <div className="card-title">Import Results</div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="card">
                  <p className="text-muted">Successful</p>
                  <p className="text-2xl font-bold text-green-700 mt-2">
                    {importResults.filter((r) => r.success).length}
                  </p>
                </div>
                <div className="card">
                  <p className="text-muted">Failed</p>
                  <p className="text-2xl font-bold text-red-700 mt-2">
                    {importResults.filter((r) => !r.success).length}
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell">Invoice</th>
                      <th className="data-table-head-cell">Status</th>
                      <th className="data-table-head-cell">Message</th>
                      <th className="data-table-head-cell-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResults.map((result, i) => (
                      <tr key={i} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                        <td className="data-table-cell">{result.invoice_number}</td>
                        <td className="data-table-cell">
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
                        <td className="data-table-cell text-sm">
                          {result.message}
                          {result.error && ` - ${result.error}`}
                        </td>
                        <td className="data-table-cell-right">
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
                  disabled={isGeneratingReceipts || selectedForReceipts.length === 0}
                  className="save-btn"
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
    </div>
  );
}
