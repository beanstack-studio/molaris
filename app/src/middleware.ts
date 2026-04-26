import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/reset-password", "/privacy", "/_next", "/favicon", "/logo", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Auth is enforced client-side (localStorage session, no cookies).
  // The root "/" renders a public landing page that self-redirects to /dashboard
  // if the user is already logged in. No server-side redirect needed.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
