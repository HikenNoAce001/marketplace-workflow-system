"use client";

/**
 * Admin Layout — wraps all /admin/* pages.
 *
 * TWO RESPONSIBILITIES:
 * 1. Wrap content with AppShell (navbar + sidebar)
 * 2. Guard against non-ADMIN users accessing admin pages
 *
 * WHY A LAYOUT (not just wrapping each page)?
 * Next.js layouts persist between page navigations within the same
 * route segment. So when you navigate from /admin/users to /admin/projects,
 * the sidebar and navbar DON'T re-render — only the content area changes.
 * This makes navigation feel instant and smooth.
 *
 * ROLE GUARD:
 * The proxy (proxy.ts) only checks if the user has a refresh cookie.
 * It doesn't check WHAT role they have. So a logged-in Buyer could
 * technically visit /admin/users. This layout prevents that by
 * checking the user's role from Zustand and redirecting if wrong.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Role } from "@/types";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // If user is loaded and NOT an admin, redirect to dashboard
  useEffect(() => {
    if (!isLoading && user && user.role !== Role.ADMIN) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  // While loading auth state, show nothing (AuthProvider handles the spinner)
  if (isLoading) return null;

  // If user is not admin, don't render admin content (redirect is in progress)
  if (!user || user.role !== Role.ADMIN) return null;

  // User is admin — render the AppShell with admin sidebar links
  return <AppShell>{children}</AppShell>;
}
