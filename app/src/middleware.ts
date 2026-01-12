import { type NextRequest, NextResponse } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if route is public
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // For protected routes, we can't directly check auth in middleware
  // because Supabase session is stored in localStorage (client-side only).
  // Instead, we'll redirect / to /login as a starting point.
  // The client-side components (TopNav, page.tsx) will handle the actual auth redirect.
  
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
