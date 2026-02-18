"use client";

/**
 * AuthProvider — Checks for existing session when the app loads.
 *
 * WHY THIS EXISTS:
 * When a user closes the browser and comes back, the access token
 * (stored in JS memory/Zustand) is gone. But the refresh token
 * (stored as an httpOnly cookie by the browser) survives.
 *
 * This component runs on app load and tries to use that cookie to
 * get a fresh access token — so the user stays logged in across
 * browser restarts without needing to login again.
 *
 * WHAT IT DOES:
 * 1. On mount → call checkSession() from useAuth hook
 * 2. While checking → show a full-screen loading spinner
 * 3. If session restored → render the app normally (children)
 * 4. If no session → still render children (the middleware or individual
 *    pages handle redirecting to login)
 *
 * WHERE IT SITS IN THE COMPONENT TREE:
 * layout.tsx → Providers → AuthProvider → rest of the app
 *
 * This is a Client Component ("use client") because:
 * - It uses React hooks (useEffect, useState)
 * - It needs to run in the browser to access cookies
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

// Routes that DON'T require authentication
// Users should be able to visit these without being logged in
const PUBLIC_ROUTES = ["/", "/auth/login", "/auth/callback"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { checkSession, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  // Check if current route is public (no auth needed)
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith("/auth/")
  );

  useEffect(() => {
    /**
     * On app load, try to restore the session:
     * 1. POST /api/auth/refresh (sends httpOnly cookie)
     * 2. If 200 → store access token → fetch user → session restored
     * 3. If 401 → no valid session → user will need to login
     */
    const init = async () => {
      // Skip session check on public routes if not already authenticated
      // This prevents unnecessary API calls on the login page
      if (isPublicRoute && !isAuthenticated) {
        setIsChecking(false);
        return;
      }

      await checkSession();
      setIsChecking(false);
    };

    init();
    // Only run on mount — we don't want to re-check on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While checking session, show a loading spinner
  // This prevents a flash of the login page for already-authenticated users
  if (isChecking && !isPublicRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          {/* Animated spinner using Tailwind's animate-spin */}
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Session check complete — render the app
  return <>{children}</>;
}
