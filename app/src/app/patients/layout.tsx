import React from "react";

export default function PatientsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-bg">
      {children}
    </div>
  );
}
