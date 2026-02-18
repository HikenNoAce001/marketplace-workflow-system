/**
 * Next.js 16 Proxy — Route protection that runs BEFORE any page loads.
 *
 * NEXT.JS 16 BREAKING CHANGE:
 * In Next.js 16, "middleware.ts" was renamed to "proxy.ts".
 * The exported function is now "export default function proxy()"
 * instead of "export function middleware()".
 * It runs on the Node.js runtime (not Edge like the old middleware).
 *
 * WHY PROXY?
 * Without this, an unauthenticated user visiting /admin/users would:
 * 1. See the page start loading (flash of content)
 * 2. AuthProvider checks session → fails
 * 3. Redirect to /auth/login
 *
 * That "flash" is a bad UX. Proxy prevents it by checking auth
 * BEFORE the page even starts rendering.
 *
 * HOW IT WORKS:
 * - Proxy runs on the server before the page loads
 * - It CAN'T access Zustand (that's client-side JS memory)
 * - It CAN access cookies (they're sent with every HTTP request)
 * - So we check: does the refresh_token cookie exist?
 *   - YES → user probably has a session → let the page load
 *           (AuthProvider will do the full verification client-side)
 *   - NO → user definitely doesn't have a session → redirect to login
 *
 * IMPORTANT: This file MUST be at src/proxy.ts (Next.js 16 convention).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that anyone can visit without being logged in
const PUBLIC_PATHS = [
  "/",              // Landing page
  "/auth/login",    // Login page
  "/auth/callback", // OAuth callback
];

/**
 * Default export named "proxy" — required by Next.js 16.
 * In Next.js 15 this was "export function middleware()".
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without any auth check
  // Some routes are exact matches ("/"), others are prefixes ("/auth/")
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith("/auth/")
  );
  if (isPublic) {
    return NextResponse.next();
  }

  // For protected routes, check if the refresh_token cookie exists
  // This cookie is set by the backend on login (httpOnly, so JS can't read it,
  // but proxy CAN because it runs server-side and sees all cookies)
  // Check for "has_session" cookie set by the frontend after login.
  // We can't check "refresh_token" here because that cookie lives on the
  // backend domain (cross-origin), not the frontend domain.
  const hasSession = request.cookies.get("has_session");

  if (!hasSession) {
    // No cookie = definitely not logged in → redirect to login
    // We add the original URL as a "from" param so we can redirect back
    // after login (e.g., /auth/login?from=/admin/users)
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists → user probably has a session → let the page load
  // AuthProvider will do the full token validation client-side
  return NextResponse.next();
}

/**
 * MATCHER CONFIG — tells Next.js which routes this proxy applies to.
 *
 * We EXCLUDE:
 * - _next/static → Next.js static files (CSS, JS bundles)
 * - _next/image → Next.js image optimization
 * - favicon.ico → browser icon
 * - api/ → API routes (not used, but excluded for safety)
 *
 * Everything else goes through the proxy.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
