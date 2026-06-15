"use client";

import { usePathname } from "next/navigation";
import TopNav from "./TopNav";

export default function TopNavWrapper() {
  const pathname = usePathname();
  
  if (pathname === "/login") {
    return null;
  }
  
  return <TopNav />;
}
