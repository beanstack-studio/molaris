import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/reset-password", "/_next", "/favicon", "/logo", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // All other routes require a Supabase session cookie.
  // Since we use sessionStorage (not cookies), the session lives client-side.
  // We can't verify it server-side — rely on client-side guards in TopNav.
  // However, we redirect bare "/" to "/login" immediately server-side for speed.
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
