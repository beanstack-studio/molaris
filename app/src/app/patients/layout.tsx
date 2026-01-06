import React from "react";
import TopNav from "@/components/TopNav";

export default function PatientsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />

      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">{children}</div>
    </div>
  );
}