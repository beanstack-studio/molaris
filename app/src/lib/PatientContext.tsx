"use client";

import { createContext, ReactNode, useContext, useState } from "react";
import type {
  Patient,
  MedHist,
  DentistRow,
  ChartEntry,
  ToothStatusRow,
  Treatment,
  ServicePriceRow,
  InvoiceRow,
  InvoiceItemRow,
  PaymentRow,
  Attachment,
  DocTemplate,
  GeneratedDoc,
} from "./types";

interface PatientContextType {
  patient: Patient | null;
  setPatient: (p: Patient | null) => void;
  med: MedHist | null;
  setMed: (m: MedHist | null) => void;
  dentists: DentistRow[];
  setDentists: (d: DentistRow[]) => void;
  serviceMenu: ServicePriceRow[];
  setServiceMenu: (s: ServicePriceRow[]) => void;
  chart: ChartEntry[];
  setChart: (c: ChartEntry[]) => void;
  toothStatuses: Record<number, { status: string; note: string | null; updated_at?: string }>;
  setToothStatuses: (ts: Record<number, { status: string; note: string | null; updated_at?: string }>) => void;
  treatments: Treatment[];
  setTreatments: (t: Treatment[]) => void;
  attachments: Attachment[];
  setAttachments: (a: Attachment[]) => void;
  templates: DocTemplate[];
  setTemplates: (t: DocTemplate[]) => void;
  generatedDocs: GeneratedDoc[];
  setGeneratedDocs: (g: GeneratedDoc[]) => void;
  invoices: InvoiceRow[];
  setInvoices: (i: InvoiceRow[]) => void;
  payments: PaymentRow[];
  setPayments: (p: PaymentRow[]) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  err: string | null;
  setErr: (e: string | null) => void;
}

const PatientContext = createContext<PatientContextType | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [med, setMed] = useState<MedHist | null>(null);
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [serviceMenu, setServiceMenu] = useState<ServicePriceRow[]>([]);
  const [chart, setChart] = useState<ChartEntry[]>([]);
  const [toothStatuses, setToothStatuses] = useState<Record<number, { status: string; note: string | null; updated_at?: string }>>({});
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <PatientContext.Provider
      value={{
        patient,
        setPatient,
        med,
        setMed,
        dentists,
        setDentists,
        serviceMenu,
        setServiceMenu,
        chart,
        setChart,
        toothStatuses,
        setToothStatuses,
        treatments,
        setTreatments,
        attachments,
        setAttachments,
        templates,
        setTemplates,
        generatedDocs,
        setGeneratedDocs,
        invoices,
        setInvoices,
        payments,
        setPayments,
        loading,
        setLoading,
        busy,
        setBusy,
        err,
        setErr,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used within PatientProvider");
  return ctx;
}