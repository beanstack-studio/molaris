"use client";

import React, { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PatientTabs from "@/components/PatientTabs";
import { formatPatientName } from "@/lib/helpers";
import { useClinic } from "@/contexts/ClinicContext";
import { SlidingTabBar } from "@/components/shared/SlidingTabBar";
import type { Tab } from "@/lib/types";

export default function Layout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const patientId = params?.id as string;
  const { clinicId } = useClinic();
  const [patientName, setPatientName] = useState<string>("");
  const [patientAge, setPatientAge] = useState<number | null>(null);
  const [patientGender, setPatientGender] = useState<string>("");

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

  // Collapse main sidebar when on the Chart tab to give chart full horizontal space
  useEffect(() => {
    if (activeTab === "Chart") {
      window.dispatchEvent(new CustomEvent("molaChartActive"));
    } else {
      window.dispatchEvent(new CustomEvent("molaChartInactive"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("molaChartInactive"));
    };
  }, [activeTab]);

  useEffect(() => {
    async function loadPatientName() {
      if (!patientId || !clinicId) return;

      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .eq("clinic_id", clinicId)
        .single();

      if (data) {
        const name =
          formatPatientName(data.first_name, data.middle_name, data.last_name) ||
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
    }

    loadPatientName();
  }, [patientId, clinicId]);

  const displayName = patientName || "Patient";

  const ageGenderSuffix = [
    patientAge !== null ? String(patientAge) : null,
    patientGender ? patientGender.charAt(0).toUpperCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="page-bg">
      <main className="app-section">
        {/* Compact patient header — one line */}
        <div className="flex items-center gap-2 mb-3 min-w-0">
          <h1 className="app-section-title leading-none">{displayName}</h1>
          {ageGenderSuffix && (
            <span className="text-muted text-sm leading-none">{ageGenderSuffix}</span>
          )}
        </div>

        {/* Sticky scrollable tab bar */}
        <div className="patient-tabs-sticky -mx-3 sm:-mx-4 px-3 sm:px-4">
          <SlidingTabBar>
            <PatientTabs activeTab={activeTab} />
          </SlidingTabBar>
        </div>

        <div className="app-section-body">
          {children}
        </div>
      </main>
    </div>
  );
}
