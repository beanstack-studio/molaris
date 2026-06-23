"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentModesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/settings/services"); }, [router]);
  return null;
}
