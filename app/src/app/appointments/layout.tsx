import React from "react";

export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-bg">
      {children}
    </div>
  );
}
