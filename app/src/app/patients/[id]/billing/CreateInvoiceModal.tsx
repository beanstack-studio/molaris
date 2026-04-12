"use client";

import { formatMoney, formatDateStandard } from "@/lib/helpers";
import type { Treatment, ServicePriceRow, OrthoEntry, OrthoEntryItem, OrthoCase } from "@/lib/types";
import { EditModal } from "@/components/EditModal";

function num(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

interface Props {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  selectedVisitDate: string;
  setSelectedVisitDate: (v: string) => void;
  invoiceDate: string;
  setInvoiceDate: (v: string) => void;
  visitDates: string[];
  orthoDateSet: Set<string>;
  visitTreatments: Treatment[];
  orthoVisits: OrthoEntry[];
  orthoVisitItems: OrthoEntryItem[];
  orthoCase: OrthoCase | null;
  servicePrices: ServicePriceRow[];
  showDiscount: boolean;
  setShowDiscount: (v: boolean) => void;
  discountDescription: string;
  setDiscountDescription: (v: string) => void;
  discountAmount: string;
  setDiscountAmount: (v: string) => void;
  subtotal: number;
  invoiceTotal: number;
  onCreateInvoice: () => void;
}

export function CreateInvoiceModal({
  open, onClose, busy,
  selectedVisitDate, setSelectedVisitDate,
  invoiceDate, setInvoiceDate,
  visitDates, orthoDateSet,
  visitTreatments, orthoVisits, orthoVisitItems, orthoCase, servicePrices,
  showDiscount, setShowDiscount,
  discountDescription, setDiscountDescription,
  discountAmount, setDiscountAmount,
  subtotal, invoiceTotal,
  onCreateInvoice,
}: Props) {
  return (
    <EditModal open={open} title="Create invoice" onClose={onClose} wide>
      <div className="grid gap-4">
          <div className="flex gap-3 items-end">
            <label className="flex-1 grid gap-1 text-sm">
              <span className="text-slate-700">Visit date</span>
              <select
                className="input-standard"
                value={selectedVisitDate}
                onChange={(e) => {
                  setSelectedVisitDate(e.target.value);
                  setInvoiceDate(e.target.value || invoiceDate);
                }}
              >
                <option value="">Select a visit date</option>
                {visitDates.map((d) => (
                  <option key={d} value={d}>
                    {formatDateStandard(d)}{orthoDateSet.has(d) ? " (ORTHO)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="cancel-btn"
              disabled={!selectedVisitDate}
              onClick={() => setShowDiscount(!showDiscount)}
            >
              {showDiscount ? "Remove discount" : "Add discount"}
            </button>
          </div>

          {selectedVisitDate && (
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              {visitTreatments.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-2">
                    Treatments on {formatDateStandard(selectedVisitDate)} ({visitTreatments.length})
                  </div>
                  <div className="space-y-2 mb-4 pb-4 border-b border-slate-100">
                    {visitTreatments.map((t: any) => {
                      const servicePrice = servicePrices.find((sp) => sp.id === t.service_price_id);
                      const priceValue = (servicePrice as any)?.default_price ?? (servicePrice as any)?.price ?? 0;
                      return (
                        <div key={t.id} className="invoice-line-item">
                          <div className="flex-1">
                            <div className="text-sm">{servicePrice?.service_name || t.procedure || "Treatment"}</div>
                            {t.tooth_number && <div className="text-caption">Tooth {t.tooth_number}</div>}
                          </div>
                          <div className="item-value">{formatMoney(priceValue)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {orthoVisits.length > 0 && (
                <div className="mb-4">
                  {(() => {
                    let totalItemCount = 0;
                    orthoVisits.forEach((entry: OrthoEntry) => {
                      const items = orthoVisitItems.filter((item) => item.ortho_entry_id === entry.id);
                      const chargedItems = items.filter((item) => item.is_charged);
                      if (entry.invoice_package && orthoCase?.package_service_id) totalItemCount++;
                      totalItemCount += chargedItems.length;
                    });
                    return (
                      <>
                        <div className="text-sm font-semibold mb-2">
                          Treatments on {formatDateStandard(selectedVisitDate)} ({totalItemCount}) - ORTHO
                        </div>
                        <div className="space-y-2 mb-4 pb-4 border-b border-slate-100">
                          {orthoVisits.map((entry: OrthoEntry) => {
                            const items = orthoVisitItems.filter((item) => item.ortho_entry_id === entry.id);
                            const chargedItems = items.filter((item) => item.is_charged);
                            return (
                              <div key={entry.id} className="space-y-2">
                                {entry.invoice_package && orthoCase?.package_service_id && (
                                  <div className="invoice-line-item">
                                    <div className="flex-1">
                                      <div className="text-sm">
                                        {servicePrices.find((s) => s.id === orthoCase.package_service_id)?.service_name || "Ortho Package"}
                                      </div>
                                    </div>
                                    <div className="item-value">
                                      {formatMoney(num(orthoCase.package_fee || 0))}
                                    </div>
                                  </div>
                                )}
                                {chargedItems.map((item: OrthoEntryItem) => {
                                  const svc = servicePrices.find((s) => s.id === item.service_id);
                                  const price = (svc as any)?.default_price || 0;
                                  return (
                                    <div key={item.id} className="invoice-line-item">
                                      <div className="flex-1">
                                        <div className="text-sm">{svc?.service_name || "Service"}</div>
                                        {item.service_detail && <div className="text-caption">{item.service_detail}</div>}
                                      </div>
                                      <div className="item-value">{formatMoney(price)}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold">{formatMoney(subtotal)}</span>
                </div>
                {showDiscount && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="inline-row">
                      <input
                        type="text"
                        placeholder="Discount code/description"
                        className="input-standard flex-1"
                        value={discountDescription}
                        onChange={(e) => setDiscountDescription(e.target.value)}
                      />
                      <span className="text-sm font-semibold text-red-600">−</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="input-standard w-24"
                        value={discountAmount}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, "");
                          setDiscountAmount(raw);
                        }}
                        onBlur={(e) => {
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num)) setDiscountAmount(num.toFixed(2));
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="text-lg">{formatMoney(invoiceTotal)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="save-btn"
              disabled={busy || !selectedVisitDate}
              onClick={onCreateInvoice}
            >
              Create
            </button>
          </div>
      </div>
    </EditModal>
  );
}
