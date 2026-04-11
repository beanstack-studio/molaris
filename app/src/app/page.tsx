"use client";

import { PageLoader } from "@/components/Spinner";

export default function Home() {
  // TopNav handles auth state and redirects to /dashboard or /login
  return <PageLoader text="Loading…" />;
}
