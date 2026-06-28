"use client";

import { useState, useEffect } from "react";
import { formatMoney, formatDateStandard } from "@/lib/helpers";
import type { Invoice, PaymentRowExtended, PaymentMode } from "@/lib/types";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";

function formatAmountDisplay(raw: string): string {
  const num = parseFloat(raw.replace(/,/g, ""));
  if (!raw || isNaN(num)) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function num(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

interface Props {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  invoices: Invoice[];
  payments: PaymentRowExtended[];
  selectedInvoiceIds: string[];
  setSelectedInvoiceIds: (v: string[]) => void;
  paymentAmount: string;
  setPaymentAmount: (v: string) => void;
  paymentDate: string;
  setPaymentDate: (v: string) => void;
  selectedPaymentMode: PaymentMode | null;
  setSelectedPaymentMode: (v: PaymentMode | null) => void;
  paymentModes: PaymentMode[];
  paymentReceivedBy: string;
  setPaymentReceivedBy: (v: string) => void;
  paymentReference: string;
  setPaymentReference: (v: string) => void;
  paymentProofFile: File | null;
  setPaymentProofFile: (v: File | null) => void;
  onAddPayment: () => void;
}

export function AddPaymentModal({
  open, onClose, busy,
  invoices, payments,
  selectedInvoiceIds, setSelectedInvoiceIds,
  paymentAmount, setPaymentAmount,
  paymentDate, setPaymentDate,
  selectedPaymentMode, setSelectedPaymentMode,
  paymentModes,
  paymentReceivedBy, setPaymentReceivedBy,
  paymentReference, setPaymentReference,
  paymentProofFile, setPaymentProofFile,
  onAddPayment,
}: Props) {
  const [displayAmount, setDisplayAmount] = useState("");

  // Sync display when parent clears the amount
  useEffect(() => {
    if (!paymentAmount) setDisplayAmount("");
  }, [paymentAmount]);

  return (
    <EditModal open={open} title="Add payment" onClose={onClose}>
      <div className="grid gap-4">
          <div className="grid gap-2 text-sm">
            <label className="text-slate-700 font-medium">Invoices</label>
            <div className="space-y-2 border border-slate-200 rounded-lg bg-slate-50 p-3">
              {invoices
                .map((inv: any) => {
                  const invoicePayments = payments.filter((p) => p.invoice_id === inv.id && !p.voided_at);
                  const totalPaid = invoicePayments.reduce((sum, p) => sum + num(p.amount), 0);
                  const balance = num(inv.total) - totalPaid;
                  return { inv, balance };
                })
                .filter(({ balance }) => balance > 0)
                .map(({ inv, balance }) => {
                  const isSelected = selectedInvoiceIds.includes(inv.id);
                  return (
                    <label key={inv.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInvoiceIds([...selectedInvoiceIds, inv.id]);
                          } else {
                            setSelectedInvoiceIds(selectedInvoiceIds.filter((id) => id !== inv.id));
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">
                        <span className="font-bold">{inv.invoice_number}</span>
                        {" "}— {formatDateStandard(inv.invoice_date)} — Bal: {formatMoney(balance)}
                      </span>
                    </label>
                  );
                })}
            </div>

            {selectedInvoiceIds.length > 0 && (
              <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                <div className="font-semibold text-blue-700">
                  Total balance:{" "}
                  {formatMoney(
                    selectedInvoiceIds.reduce((sum, invoiceId) => {
                      const inv = invoices.find((i: any) => i.id === invoiceId);
                      if (!inv) return sum;
                      const invoicePayments = payments.filter((p) => p.invoice_id === invoiceId && !p.voided_at);
                      const totalPaid = invoicePayments.reduce((s, p) => s + num(p.amount), 0);
                      const balance = num(inv.total) - totalPaid;
                      return sum + balance;
                    }, 0)
                  )}
                </div>
              </div>
            )}
          </div>

          <label className="form-field">
            <span className="text-slate-700">Amount</span>
            <input
              type="text"
              inputMode="decimal"
              className="input-standard"
              value={displayAmount}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, "");
                setDisplayAmount(raw);
                setPaymentAmount(raw);
              }}
              onBlur={() => {
                const formatted = formatAmountDisplay(displayAmount);
                setDisplayAmount(formatted);
                const numeric = displayAmount.replace(/,/g, "");
                setPaymentAmount(numeric);
              }}
              onFocus={() => {
                // Show raw number on focus for easy editing
                setDisplayAmount(paymentAmount || "");
              }}
              placeholder="₱ 0.00"
            />
          </label>

          {selectedInvoiceIds.length > 0 && paymentAmount && (() => {
            const totalAvailableBalance = selectedInvoiceIds.reduce((sum, invoiceId) => {
              const inv = invoices.find((i: any) => i.id === invoiceId);
              if (!inv) return sum;
              const invoicePayments = payments.filter((p) => p.invoice_id === invoiceId && !p.voided_at);
              const totalPaid = invoicePayments.reduce((s, p) => s + num(p.amount), 0);
              const balance = num(inv.total) - totalPaid;
              return sum + balance;
            }, 0);
            const paymentAmountNum = parseFloat(paymentAmount);
            if (paymentAmountNum > totalAvailableBalance) {
              return (
                <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                  Payment amount ({formatMoney(paymentAmountNum)}) exceeds total balance ({formatMoney(totalAvailableBalance)})
                </div>
              );
            }
            return null;
          })()}

          <DatePickerField
            label="Payment date"
            value={paymentDate}
            onChange={setPaymentDate}
            max={new Date().toISOString().split("T")[0]}
          />

          <label className="form-field">
            <span className="text-slate-700">Payment mode</span>
            <select
              className="input-standard"
              value={selectedPaymentMode?.code || ""}
              onChange={(e) => {
                const mode = paymentModes.find((m) => m.code === e.target.value) || null;
                setSelectedPaymentMode(mode);
              }}
            >
              <option value="">Select mode</option>
              {paymentModes.map((mode: PaymentMode) => (
                <option key={mode.id} value={mode.code}>
                  {mode.name}
                  {!mode.auto_verifies && " (needs verification)"}
                </option>
              ))}
            </select>
          </label>

          {selectedPaymentMode?.code === "CASH" && (
            <label className="form-field">
              <span className="text-slate-700">Received by</span>
              <input
                type="text"
                className="input-standard"
                value={paymentReceivedBy}
                onChange={(e) => setPaymentReceivedBy(e.target.value)}
                placeholder="Name of person receiving cash"
              />
            </label>
          )}

          {selectedPaymentMode?.requires_reference && (
            <label className="form-field">
              <span className="text-slate-700">Reference number *</span>
              <input
                type="text"
                className="input-standard"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={`Required for ${selectedPaymentMode.name}`}
              />
            </label>
          )}

          {selectedPaymentMode?.requires_proof && (
            <div className="grid gap-1">
              <span className="text-sm text-slate-700 font-medium">Proof file *</span>
              <label className="relative group">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                />
                <div
                  className={`flex items-center justify-center gap-3 p-4 rounded-lg border-2 border-dashed transition cursor-pointer ${
                    paymentProofFile
                      ? "border-green-300 bg-green-50 hover:bg-green-100"
                      : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400"
                  }`}
                >
                  <svg
                    className={`w-5 h-5 flex-shrink-0 ${paymentProofFile ? "text-green-600" : "text-slate-400"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {paymentProofFile ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    )}
                  </svg>
                  <div className="text-left">
                    {paymentProofFile ? (
                      <div>
                        <div className="text-sm font-medium text-green-700">{paymentProofFile.name}</div>
                        <div className="text-caption">{(paymentProofFile.size / 1024).toFixed(0)} KB</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-slate-700">Drop file or click to select</div>
                        <div className="text-caption">JPG, PNG, PDF (max 10MB)</div>
                      </div>
                    )}
                  </div>
                </div>
              </label>
            </div>
          )}

          <div className="modal-footer-buttons pt-2">
            <button
              className="cancel-btn"
              onClick={() => {
                onClose();
                setSelectedInvoiceIds([]);
                setPaymentAmount("");
                setPaymentReference("");
                setPaymentProofFile(null);
                setSelectedPaymentMode(null);
              }}
            >
              Cancel
            </button>
            <button className="save-btn" disabled={busy} onClick={onAddPayment}>
              Add
            </button>
          </div>
      </div>
    </EditModal>
  );
}
