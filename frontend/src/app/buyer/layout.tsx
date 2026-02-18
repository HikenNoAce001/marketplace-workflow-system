"use client";

/**
 * Buyer Layout — wraps all /buyer/* pages.
 *
 * TWO RESPONSIBILITIES:
 * 1. Wrap content with AppShell (navbar + sidebar)
 * 2. Guard against non-BUYER users accessing buyer pages
 *
 * WHY A LAYOUT?
 * Next.js layouts persist between page navigations within the same
 * route segment. Navigating between /buyer/projects and /buyer/projects/new
 * keeps the sidebar and navbar — only the content area re-renders.
 *
 * ROLE GUARD:
 * The proxy (proxy.ts) only checks if the user has a refresh cookie.
 * It doesn't check WHAT role they have. So a logged-in Solver could
 * visit /buyer/projects. This layout prevents that by checking the
 * user's role from Zustand and redirecting if wrong.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Role } from "@/types";

export default function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // If user is loaded and NOT a buyer, redirect to dashboard
  useEffect(() => {
    if (!isLoading && user && user.role !== Role.BUYER) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  // While loading auth state, show nothing (AuthProvider handles the spinner)
  if (isLoading) return null;

  // If user is not buyer, don't render buyer content (redirect is in progress)
  if (!user || user.role !== Role.BUYER) return null;

  // User is buyer — render the AppShell with buyer sidebar links
  return <AppShell>{children}</AppShell>;
}
