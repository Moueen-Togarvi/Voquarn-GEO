// Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`. Clerk v7
// detects both filenames, so `clerkMiddleware()` works unchanged here.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes that require an authenticated user. Everything under the dashboard
// route group renders at the top level (the group name isn't in the URL), so
// we match the real paths: /dashboard, /brands, /actions, /settings.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/brands(.*)",
  "/actions(.*)",
  "/settings(.*)",
  "/onboarding(.*)",
  // Protect API routes except public webhooks (Clerk, Paddle) and cron
  // (guarded by CRON_SECRET instead of a Clerk session).
  "/api/((?!webhooks|cron).*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // Redirect browser navigations to sign-in; return 401 for API calls.
      if (req.nextUrl.pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
