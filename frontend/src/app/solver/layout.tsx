"use client";

/**
 * Solver Layout — wraps all /solver/* pages.
 *
 * TWO RESPONSIBILITIES:
 * 1. Wrap content with AppShell (navbar + sidebar)
 * 2. Guard against non-SOLVER users accessing solver pages
 *
 * Same pattern as admin/layout.tsx and buyer/layout.tsx.
 * The AppShell reads the user's role from Zustand and shows
 * solver-specific sidebar links: Browse Projects, My Requests, Profile.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Role } from "@/types";

export default function SolverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // If user is loaded and NOT a solver, redirect to dashboard
  useEffect(() => {
    if (!isLoading && user && user.role !== Role.SOLVER) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) return null;
  if (!user || user.role !== Role.SOLVER) return null;

  return <AppShell>{children}</AppShell>;
}
