"use client";

import React, { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PatientTabs from "@/components/PatientTabs";
import { combineFullName } from "@/lib/helpers";
import type { Tab } from "@/lib/types";

export default function Layout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const patientId = params?.id as string;
  const [patientName, setPatientName] = useState<string>("");
  const [patientAge, setPatientAge] = useState<number | null>(null);
  const [patientGender, setPatientGender] = useState<string>("");
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
      ortho: "Ortho",
    };
    return tabMap[segment] || "Info";
  };

  const activeTab = getActiveTab();

  useEffect(() => {
    async function loadPatientName() {
      if (!patientId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();

      if (data) {
        const name =
          combineFullName(data.first_name, data.last_name) ||
          data.full_name ||
          "";
        setPatientName(name);
        
        // Calculate age from birth_date
        if (data.birth_date) {
          try {
            const birthDate = new Date(data.birth_date);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            setPatientAge(age);
          } catch (e) {
            console.error("Error calculating age:", e);
          }
        }
        
        // Set gender if it exists
        if (data.gender) {
          setPatientGender(data.gender);
        }
      } else if (error) {
        console.error("Error loading patient:", error);
      }

      setLoading(false);
    }

    loadPatientName();
  }, [patientId]);

  const displayName = patientName || "Patient";

  return (
    <div className="page-bg">
      <main className="app-section">
        <div className="app-section-header">
          <div>
            <div className="flex-center-gap-3">
              <div className="app-section-title">{displayName}</div>
              {(patientAge !== null || patientGender) && (
                <div className="text-muted">
                  {patientAge !== null && `${patientAge}`}
                  {patientAge !== null && patientGender && " "}
                  {patientGender && patientGender.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          {!loading && patientId && (
            <a
              href={`/patients/${patientId}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="cancel-btn flex items-center gap-1.5 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
              </svg>
              Print
            </a>
          )}
        </div>

        <PatientTabs activeTab={activeTab} />

        <div className="app-section-body">
          {children}
        </div>
      </main>
    </div>
  );
}
