"use client";

import { useState } from "react";

export default function Home() {
  const [_checked] = useState(false);

  // Middleware will redirect / to /login
  // TopNav will handle auth state changes and redirect to /dashboard if authenticated
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted">Loading...</div>
    </div>
  );
}
