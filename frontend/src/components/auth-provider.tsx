"use client";

// Restores session on app load using the httpOnly refresh cookie

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

const PUBLIC_ROUTES = ["/", "/auth/login", "/auth/callback"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { checkSession, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith("/auth/")
  );

  useEffect(() => {
    const init = async () => {
      // Skip session check on public routes to avoid unnecessary API calls
      if (isPublicRoute && !isAuthenticated) {
        setIsChecking(false);
        return;
      }

      await checkSession();
      setIsChecking(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show spinner while checking — prevents flash of login page
  if (isChecking && !isPublicRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
