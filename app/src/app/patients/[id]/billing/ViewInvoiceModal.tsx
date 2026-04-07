"use client";

import { formatMoney, formatDateStandard } from "@/lib/helpers";
import type { Invoice, PaymentRowExtended } from "@/lib/types";

function num(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

interface Props {
  viewingInvoice: Invoice | null;
  payments: PaymentRowExtended[];
  onClose: () => void;
}

export function ViewInvoiceModal({ viewingInvoice, payments, onClose }: Props) {
  if (!viewingInvoice) return null;

  const invoicePayments = payments.filter((p: any) => p.invoice_id === viewingInvoice.id);
  const totalPaid = invoicePayments.reduce((sum: number, p: any) => sum + num(p.amount), 0);

  return (
    <div
      className="modal-container"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onDoubleClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-screen overflow-y-auto rounded-2xl border bg-white w-full max-w-2xl">
        <div className="modal-sticky-header">
          <div className="modal-title">Invoice {viewingInvoice.invoice_number}</div>
        </div>

        <div className="p-4">
          <div className="grid gap-4">
            {/* Header Info */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <div className="detail-label">Invoice date</div>
                <div className="text-sm font-semibold">{formatDateStandard(viewingInvoice.invoice_date)}</div>
              </div>
              <div>
                <div className="detail-label">Status</div>
                <div className="text-sm font-semibold capitalize">{viewingInvoice.status}</div>
              </div>
              <div>
                <div className="detail-label">Total amount</div>
                <div className="text-sm font-semibold text-blue-900">{formatMoney(viewingInvoice.total ?? 0)}</div>
              </div>
            </div>

            {/* Invoice items table */}
            <div className="section-divider">
              <div className="text-sm font-semibold mb-3">Items</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600 bg-slate-50">
                    <th className="cell-sm">Description</th>
                    <th className="cell-sm-right">Quantity</th>
                    <th className="cell-sm-right">Unit price</th>
                    <th className="cell-sm-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {((viewingInvoice as any).invoice_items || []).map((item: any, i: number) => {
                    const qty = item.qty ?? item.quantity ?? 1;
                    const unitPrice = item.unit_price ?? 0;
                    const lineTotal = qty * unitPrice;
                    return (
                      <tr key={item.id || i} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <td className="cell-sm">{item.description || item.service_name || "Service"}</td>
                        <td className="cell-sm-right">{qty}</td>
                        <td className="cell-sm-right">{formatMoney(unitPrice)}</td>
                        <td className="py-2 px-3 text-right font-semibold">{formatMoney(lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Payments applied */}
            {invoicePayments.length > 0 && (
              <div className="section-divider">
                <div className="text-sm font-semibold mb-3">Payments</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-600 bg-slate-50">
                      <th className="cell-sm">Date</th>
                      <th className="cell-sm">Amount</th>
                      <th className="cell-sm">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicePayments.map((payment: any, i: number) => (
                      <tr key={payment.id} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <td className="cell-sm">{formatDateStandard(payment.payment_date)}</td>
                        <td className="py-2 px-3 font-semibold">{formatMoney(payment.amount)}</td>
                        <td className="cell-sm">{payment.mode || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            <div className="section-divider">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-600">Total:</span>
                <span className="font-semibold">{formatMoney(viewingInvoice.total ?? 0)}</span>
              </div>
              {invoicePayments.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600">Paid:</span>
                    <span className="font-semibold text-green-900">{formatMoney(totalPaid)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold border-t pt-2">
                    <span className="text-slate-700">Remaining:</span>
                    <span className="text-red-900">{formatMoney(num(viewingInvoice.total) - totalPaid)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
