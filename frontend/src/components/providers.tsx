"use client";

/**
 * Global providers that wrap the entire application.
 *
 * WHY "use client"?
 * Next.js 16 defaults to Server Components (rendered on the server).
 * But providers use React context (useState, createContext), which
 * only works on the client. So we mark this as a Client Component.
 *
 * The root layout (layout.tsx) is a Server Component that wraps
 * its children with this Client Component. This pattern is
 * recommended by Next.js — it keeps the layout on the server
 * while the interactive parts run on the client.
 *
 * WHAT'S PROVIDED:
 * 1. QueryClientProvider — TanStack Query's cache and state manager
 *    Handles all API calls: caching, refetching, loading/error states
 * 2. AuthProvider — checks for existing session on app load
 *    (restores login from refresh cookie if available)
 * 3. Toaster — sonner toast notifications (success/error messages)
 *
 * NESTING ORDER MATTERS:
 * QueryClient → AuthProvider → children → Toaster
 * AuthProvider needs QueryClient above it (for API calls),
 * and children need AuthProvider above them (for user state).
 */

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  /**
   * Create QueryClient inside useState to ensure each user gets their own
   * cache instance. Without this, all users would share cached data
   * (a security/correctness issue in SSR).
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Refetch when browser tab regains focus — catches changes
            // made by other users (e.g., buyer accepts bid, solver tabs back)
            refetchOnWindowFocus: true,
            // Retry failed requests once before showing error
            retry: 1,
            // Data is stale after 30 seconds — balances freshness vs API load.
            // Stale data is shown instantly while refetching in the background.
            staleTime: 30 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* AuthProvider checks for existing session on app load */}
      <AuthProvider>
        {children}
      </AuthProvider>
      {/* Toaster renders toast notifications at bottom-right */}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
