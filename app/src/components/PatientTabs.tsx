"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { tabs, type Tab } from "@/lib/types";

export default function PatientTabs({ activeTab }: { activeTab: Tab }) {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className="tabs">
      {tabs.map((t) => {
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