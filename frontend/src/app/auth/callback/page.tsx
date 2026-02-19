"use client";

// OAuth callback page — commented out for now since we're using dev-login only.
// Uncomment when Google/GitHub OAuth is configured.

// import { Suspense, useEffect, useState } from "react";
// import { useSearchParams } from "next/navigation";
// import { useAuth } from "@/hooks/use-auth";
// import { useAuthStore } from "@/stores/auth-store";
//
// export default function AuthCallbackPage() {
//   return (
//     <Suspense
//       fallback={
//         <div className="flex min-h-screen items-center justify-center bg-background">
//           <div className="flex flex-col items-center gap-4">
//             <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
//             <p className="text-sm text-muted-foreground">Completing sign in...</p>
//           </div>
//         </div>
//       }
//     >
//       <CallbackHandler />
//     </Suspense>
//   );
// }
//
// function CallbackHandler() {
//   const searchParams = useSearchParams();
//   const { redirectByRole } = useAuth();
//   const setToken = useAuthStore((state) => state.setToken);
//   const setUser = useAuthStore((state) => state.setUser);
//   const [error, setError] = useState<string | null>(null);
//
//   useEffect(() => {
//     const handleCallback = async () => {
//       const token = searchParams.get("token");
//
//       if (!token) {
//         setError("No authentication token received. Please try logging in again.");
//         return;
//       }
//
//       setToken(token);
//
//       try {
//         const API_BASE =
//           process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
//         const res = await fetch(`${API_BASE}/auth/me`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//
//         if (!res.ok) {
//           setError("Failed to fetch user profile. Token may be invalid.");
//           return;
//         }
//
//         const userData = await res.json();
//         setUser(userData);
//         redirectByRole(userData.role);
//       } catch {
//         setError("Failed to connect to the server.");
//       }
//     };
//
//     handleCallback();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);
//
//   if (error) {
//     return (
//       <div className="flex min-h-screen items-center justify-center bg-background px-4">
//         <div className="text-center space-y-4">
//           <h2 className="text-xl font-semibold text-destructive">
//             Authentication Failed
//           </h2>
//           <p className="text-muted-foreground">{error}</p>
//           <a
//             href="/auth/login"
//             className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
//           >
//             Back to Login
//           </a>
//         </div>
//       </div>
//     );
//   }
//
//   return (
//     <div className="flex min-h-screen items-center justify-center bg-background">
//       <div className="flex flex-col items-center gap-4">
//         <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
//         <p className="text-sm text-muted-foreground">Completing sign in...</p>
//       </div>
//     </div>
//   );
// }

// Placeholder so the route still exists (Next.js needs a default export)
export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">OAuth not configured. Use dev login.</p>
    </div>
  );
}
