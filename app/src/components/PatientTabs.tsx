"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { tabs, type Tab } from "@/lib/types";

export default function PatientTabs({ activeTab }: { activeTab: Tab }) {
  const params = useParams();
  const id = params?.id as string;
  const [orthoPatient, setOrthoPatient] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    let pollInterval: NodeJS.Timeout;

    async function loadOrthoFlag() {
      const { data, error } = await supabase
        .from("patients")
        .select("ortho_patient")
        .eq("id", id)
        .single();
      
      if (isMounted && data && !error) {
        console.log("PatientTabs: Loaded ortho_patient =", Boolean(data.ortho_patient));
        setOrthoPatient(Boolean(data.ortho_patient));
      }
      if (isMounted) {
        setLoaded(true);
      }
    }

    // Initial load
    loadOrthoFlag();

    // Set up real-time listener for ortho_patient changes
    const channel = supabase
      .channel(`patient_${id}`, { config: { broadcast: { self: true } } })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "patients",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log("PatientTabs: Real-time update received", payload);
          if (isMounted && payload.new.ortho_patient !== undefined) {
            console.log("PatientTabs: Setting ortho_patient to", Boolean(payload.new.ortho_patient));
            setOrthoPatient(Boolean(payload.new.ortho_patient));
          }
        }
      )
      .subscribe((status) => {
        console.log("PatientTabs: Channel subscription status:", status);
      });

    // Fallback: Poll every 1 second for updates (catches missed real-time events)
    pollInterval = setInterval(() => {
      if (isMounted) {
        loadOrthoFlag();
      }
    }, 1000);

    return () => {
      isMounted = false;
      channel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [id]);

  // Filter tabs based on ortho_patient flag
  const visibleTabs = tabs.filter((tab) => {
    if (tab === "Ortho" && !orthoPatient) {
      return false;
    }
    return true;
  });

  if (!loaded) {
    return <div className="tabs" />;
  }

  return (
    <div className="tabs">
      {visibleTabs.map((t) => {
        const active = activeTab === t;
        const href = `/patients/${id}/${t.toLowerCase()}`;
        return (
          <Link
            key={t}
            href={href}
            className={`tab-item ${active ? "tab-item-active" : ""}`}
          >
            {t}
          </Link>
        );
      })}
    </div>
  );
}