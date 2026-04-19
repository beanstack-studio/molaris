"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PrintRedirect() {
  const params = useParams();
  const router = useRouter();
  const patientId = params?.id as string;

  useEffect(() => {
    router.replace(`/patients/${patientId}/documents`);
  }, [patientId, router]);

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center">
      <p className="text-slate-400 text-sm">Redirecting to Documents…</p>
    </div>
  );
}
