"use client";

/**
 * Login Page — Entry point for authentication.
 *
 * Shows two sections:
 * 1. DEV LOGIN: Quick-select test users (admin, buyer, solver)
 *    - Calls POST /api/auth/dev-login with the selected email
 *    - Only available in development (remove before production)
 *
 * 2. OAUTH LOGIN: Google + GitHub buttons
 *    - Calls GET /api/auth/google (or /github) to get OAuth URL
 *    - Redirects user to Google/GitHub consent screen
 *    - After consent, user is redirected back to /auth/callback
 *    - Disabled until OAuth credentials are configured in .env
 *
 * WHY "use client"?
 * This page uses React hooks (useState, event handlers, useAuth)
 * which only work in Client Components. Login pages are always
 * client-rendered because they need interactivity.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Role } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Shield, ShoppingCart, Wrench, Github } from "lucide-react";

/**
 * Test users created by the seed script (make seed).
 * Each has a different role so we can test all 3 perspectives.
 *
 * The icon and color help visually distinguish roles — this is
 * what the PDF means by "clear visual distinction between roles."
 */
const TEST_USERS = [
  {
    email: "admin@test.com",
    label: "Admin",
    role: Role.ADMIN,
    description: "Manage user roles, view all projects",
    icon: Shield,
    // Each role gets a distinct color for quick visual identification
    badgeClass: "bg-red-100 text-red-700 border-red-200",
  },
  {
    email: "buyer@test.com",
    label: "Buyer",
    role: Role.BUYER,
    description: "Create projects, review submissions",
    icon: ShoppingCart,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    email: "solver@test.com",
    label: "Problem Solver",
    role: Role.SOLVER,
    description: "Browse projects, bid, submit work",
    icon: Wrench,
    badgeClass: "bg-green-100 text-green-700 border-green-200",
  },
];

export default function LoginPage() {
  // Track which button is loading (to show a spinner on that button only)
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const { devLogin } = useAuth();

  /**
   * Handle dev login — called when user clicks a test user button.
   *
   * Flow:
   * 1. Set loading state on the clicked button
   * 2. Call devLogin(email) from useAuth hook
   * 3. Hook handles: API call → store token → fetch user → redirect
   * 4. If error → show toast notification
   */
  const handleDevLogin = async (email: string) => {
    setLoadingEmail(email);
    try {
      await devLogin(email);
      // Success! The hook redirects automatically, so no need to do anything here.
      // We show a toast anyway so the user gets feedback while the redirect happens.
      toast.success("Logged in successfully!");
    } catch (error) {
      // Show error as a toast notification (red, bottom-right of screen)
      toast.error(
        error instanceof Error ? error.message : "Login failed. Is the backend running?"
      );
    } finally {
      setLoadingEmail(null);
    }
  };

  /**
   * Handle OAuth login — redirects to Google/GitHub consent screen.
   *
   * Flow:
   * 1. GET /api/auth/google → returns { url: "https://accounts.google.com/..." }
   * 2. Redirect browser to that URL
   * 3. User logs in on Google/GitHub
   * 4. Google/GitHub redirects back to /api/auth/callback/google
   * 5. Backend exchanges code → creates user → sets cookie → returns token
   * 6. Frontend /auth/callback page handles the response
   */
  const handleOAuthLogin = async (provider: "google" | "github") => {
    try {
      const API_BASE =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      const res = await fetch(`${API_BASE}/auth/${provider}`);

      if (!res.ok) {
        toast.error(`${provider} OAuth is not configured. Add credentials to .env`);
        return;
      }

      const data = await res.json();
      // Redirect the entire browser to the OAuth consent screen
      window.location.href = data.url;
    } catch {
      toast.error("Failed to start OAuth flow. Is the backend running?");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/*
        motion.div from Framer Motion — adds a smooth fade-in + slide-up
        animation when the login card appears. This is the "smooth animated
        transitions" the PDF asks for.

        initial: starting state (invisible, shifted down)
        animate: ending state (visible, normal position)
        transition: how long it takes (0.4s with ease-out curve)
      */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              Marketplace Workflow
            </CardTitle>
            <CardDescription>
              Sign in to manage projects and tasks
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* ============================================ */}
            {/* SECTION 1: Dev Login (test users)            */}
            {/* Quick buttons for each role — click to login */}
            {/* ============================================ */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground text-center">
                Development Login
              </p>

              {TEST_USERS.map((testUser) => {
                const Icon = testUser.icon;
                const isLoading = loadingEmail === testUser.email;

                return (
                  /*
                    Each test user button is wrapped in motion.div for a
                    staggered animation — they appear one after another
                    instead of all at once. More polished feel.
                  */
                  <motion.div
                    key={testUser.email}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 * TEST_USERS.indexOf(testUser) }}
                  >
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto py-3"
                      onClick={() => handleDevLogin(testUser.email)}
                      disabled={isLoading || loadingEmail !== null}
                    >
                      {/* Spinner or icon depending on loading state */}
                      {isLoading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      )}

                      <div className="flex flex-col items-start text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{testUser.label}</span>
                          {/* Role badge with distinct color per role */}
                          <Badge
                            variant="outline"
                            className={`text-xs ${testUser.badgeClass}`}
                          >
                            {testUser.role}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {testUser.description}
                        </span>
                      </div>
                    </Button>
                  </motion.div>
                );
              })}
            </div>

            {/* Visual separator between dev login and OAuth */}
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or continue with
              </span>
            </div>

            {/* ============================================ */}
            {/* SECTION 2: OAuth buttons                     */}
            {/* Google + GitHub — redirect to consent screen */}
            {/* ============================================ */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleOAuthLogin("google")}
                className="gap-2"
              >
                {/* Google "G" icon as inline SVG — simpler than importing a package */}
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>

              <Button
                variant="outline"
                onClick={() => handleOAuthLogin("github")}
                className="gap-2"
              >
                <Github className="h-4 w-4" />
                GitHub
              </Button>
            </div>

            {/* Helpful hint at the bottom */}
            <p className="text-xs text-center text-muted-foreground">
              Dev login uses seeded test users. Run{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                make seed
              </code>{" "}
              first.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
