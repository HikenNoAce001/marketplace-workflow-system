"use client";

/**
 * OAuth Callback Page — Handles the redirect from Google/GitHub.
 *
 * WHEN DOES THIS PAGE LOAD?
 * After the user logs in on Google/GitHub, the OAuth provider redirects
 * the browser to: /api/auth/callback/google?code=abc123
 *
 * BUT WAIT — that's a BACKEND route, not a frontend route.
 * The backend handles the code exchange, creates the user, sets the
 * refresh cookie, and returns the access token.
 *
 * Then the backend redirects to THIS frontend page with the token
 * as a query parameter: /auth/callback?token=eyJ...
 *
 * THIS PAGE:
 * 1. Reads the token from the URL
 * 2. Stores it in Zustand (memory)
 * 3. Fetches user profile (GET /api/auth/me)
 * 4. Redirects to the appropriate dashboard
 *
 * If no token in URL, shows an error.
 *
 * NOTE: For now, we're using dev-login which doesn't go through this page.
 * This page will be used when real OAuth is configured.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

/**
 * WRAPPER — Next.js requires useSearchParams() to be inside a <Suspense> boundary.
 *
 * WHY? During the production build, Next.js tries to statically pre-render pages.
 * useSearchParams() depends on the runtime URL (?token=...), so it can't be
 * pre-rendered at build time. Wrapping in Suspense tells Next.js:
 * "show a loading fallback during pre-render, then render the real content
 * on the client once the URL is available."
 *
 * Without this, the build fails with:
 * "useSearchParams() should be wrapped in a suspense boundary"
 */
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Completing sign in...</p>
          </div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

/**
 * Inner component that actually uses useSearchParams().
 * Separated out so it can be wrapped in Suspense above.
 */
function CallbackHandler() {
  const searchParams = useSearchParams();
  const { redirectByRole } = useAuth();
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Read access token from URL query parameter
      const token = searchParams.get("token");

      if (!token) {
        setError("No authentication token received. Please try logging in again.");
        return;
      }

      // Store the access token in Zustand (memory only)
      setToken(token);

      // Fetch user profile with the new token
      try {
        const API_BASE =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setError("Failed to fetch user profile. Token may be invalid.");
          return;
        }

        const userData = await res.json();
        setUser(userData);

        // Redirect to the appropriate dashboard based on role
        redirectByRole(userData.role);
      } catch {
        setError("Failed to connect to the server.");
      }
    };

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show error if something went wrong
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-destructive">
            Authentication Failed
          </h2>
          <p className="text-muted-foreground">{error}</p>
          <a
            href="/auth/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  // Loading state while processing the callback
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
