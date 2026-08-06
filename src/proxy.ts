import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAuthEnabled } from "@/lib/auth/flag";

// Renamed from middleware.ts in Next.js 16 — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
//
// This is an OPTIMISTIC check only: it reads the session cookie's presence,
// never its validity, and never touches the database — exactly what the
// Next.js auth guide recommends for proxy, since it runs on every navigation
// including prefetches. The real, authoritative check is
// requireWorkspaceContext() in src/lib/auth/context.ts, which every page and
// route handler calls regardless of what happens here. If this file's
// matcher ever misses a route, that function is still the backstop — do not
// let this be the only thing standing between a page and someone else's data.
const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/accept-invite"];

export function proxy(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (!getSessionCookie(request)) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except API routes (they return JSON 401s themselves via
    // requireWorkspaceContext(), not an HTML redirect), static assets, and
    // the favicon.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
