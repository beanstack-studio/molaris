"use client";

import React, { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PatientTabs from "@/components/PatientTabs";
import { combineFullName } from "@/lib/helpers";
import type { Tab } from "@/lib/types";

export default function Layout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const patientId = params?.id as string;
  const [patientName, setPatientName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Determine active tab from pathname
  const getActiveTab = (): Tab => {
    const segment = pathname?.split("/").pop() || "info";
    const tabMap: Record<string, Tab> = {
      info: "Info",
      chart: "Chart",
      medical: "Medical",
      treatments: "Treatments",
      documents: "Documents",
      attachments: "Attachments",
      billing: "Billing",
    };
    return tabMap[segment] || "Info";
  };

  const activeTab = getActiveTab();

  useEffect(() => {
    async function loadPatientName() {
      if (!patientId) return;

      setLoading(true);
      const { data } = await supabase
        .from("patients")
        .select("first_name, last_name, full_name")
        .eq("id", patientId)
        .single();

      if (data) {
        const name =
          combineFullName(data.first_name, data.last_name) ||
          data.full_name ||
          "";
        setPatientName(name);
      }

      setLoading(false);
    }

    loadPatientName();
  }, [patientId]);

  const displayName = patientName || "Patient";

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">{displayName}</div>
          <button
            className="btn btn-secondary"
            onClick={() => window.history.back()}
          >
            Back
          </button>
        </div>

        <PatientTabs activeTab={activeTab} />

        <div className="app-section-body">
          {children}
        </div>
      </main>
    </div>
  );
}
