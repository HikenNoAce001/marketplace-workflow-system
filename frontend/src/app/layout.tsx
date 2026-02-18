import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

/**
 * Root layout — wraps EVERY page in the application.
 *
 * This is a Server Component (no "use client" directive).
 * It handles:
 * 1. HTML structure (<html>, <body>)
 * 2. Font loading (Geist Sans + Mono from Google Fonts)
 * 3. Metadata (title, description for SEO)
 * 4. Wrapping children with client-side Providers
 *
 * The Providers component is a Client Component that adds
 * TanStack Query and toast notifications.
 */

// Load Google Fonts — these CSS variables are used in globals.css @theme
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// SEO metadata — appears in browser tab and search results
export const metadata: Metadata = {
  title: "Marketplace Workflow System",
  description:
    "Role-based project marketplace — create projects, bid on work, manage tasks, and deliver results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Providers adds TanStack Query + Toast notifications */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
