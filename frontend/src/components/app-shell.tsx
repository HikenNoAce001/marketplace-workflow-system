"use client";

/**
 * AppShell — Shared layout for all authenticated pages.
 *
 * Provides a consistent structure:
 * ┌─────────────────────────────────────────┐
 * │  NAVBAR (app name, user info, logout)   │
 * ├──────────┬──────────────────────────────┤
 * │          │                              │
 * │ SIDEBAR  │         CONTENT              │
 * │ (nav     │         (page renders here)  │
 * │  links)  │                              │
 * │          │                              │
 * └──────────┴──────────────────────────────┘
 *
 * WHY A SHARED SHELL?
 * Every authenticated page (admin, buyer, solver) needs the same navbar
 * and a sidebar with role-specific links. Instead of duplicating this in
 * every page, we create one shell and swap the content area.
 *
 * ROLE THEMING:
 * The sidebar has a colored left border accent per role:
 * - ADMIN = red, BUYER = blue, SOLVER = green
 * This gives instant visual feedback about which role is active.
 * Defined via CSS variables in globals.css ([data-role="..."]).
 *
 * ANIMATIONS:
 * - Active nav link has a sliding background pill (layoutId animation)
 * - Nav links shift right on hover (micro-interaction)
 * - Sign Out button scales on click
 * - Content area fades in on route change
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  Users,
  FolderKanban,
  ShoppingCart,
  Wrench,
  Search,
  FileText,
  UserCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { UserRole } from "@/types";

/**
 * Navigation items per role.
 * Each item has: label (shown text), href (route), icon (lucide icon).
 * The sidebar renders only the items for the current user's role.
 */
const NAV_ITEMS: Record<UserRole, { label: string; href: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  ],
  BUYER: [
    { label: "My Projects", href: "/buyer/projects", icon: ShoppingCart },
  ],
  SOLVER: [
    { label: "Browse Projects", href: "/solver/projects", icon: Search },
    { label: "My Requests", href: "/solver/requests", icon: FileText },
    { label: "Profile", href: "/solver/profile", icon: UserCircle },
  ],
};

/**
 * Role badge colors — consistent across the entire app.
 * Same colors used on login page, dashboard, and here.
 */
const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  ADMIN: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  BUYER: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  SOLVER: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
};

/**
 * Role icons — shown next to the role name in the navbar.
 */
const ROLE_ICON: Record<UserRole, React.ElementType> = {
  ADMIN: Users,
  BUYER: ShoppingCart,
  SOLVER: Wrench,
};

/**
 * Role accent colors for the sidebar left border.
 * These map to Tailwind color classes per role.
 */
const ROLE_SIDEBAR_ACCENT: Record<UserRole, string> = {
  ADMIN: "border-l-red-500",
  BUYER: "border-l-blue-500",
  SOLVER: "border-l-green-500",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // If no user (shouldn't happen — proxy + AuthProvider protect this),
  // render nothing. AuthProvider will redirect to login.
  if (!user) return null;

  const role = user.role as UserRole;
  const navItems = NAV_ITEMS[role] || [];
  const RoleIcon = ROLE_ICON[role];

  return (
    // data-role enables role-specific CSS variables (see globals.css)
    <div className="flex h-screen bg-background" data-role={role}>
      {/* ============================================ */}
      {/* SIDEBAR — role-specific navigation           */}
      {/* Colored left border provides role distinction */}
      {/* ============================================ */}
      <aside className={`flex w-64 flex-col border-r border-l-4 bg-card ${ROLE_SIDEBAR_ACCENT[role]}`}>
        {/* App branding at the top of sidebar */}
        <div className="flex h-16 items-center gap-2 px-6 border-b">
          <FolderKanban className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Marketplace</span>
        </div>

        {/* Navigation links — one per role-allowed page */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Highlight the active link based on current URL
            const isActive = pathname.startsWith(item.href);

            return (
              <Link key={item.href} href={item.href}>
                {/* motion.div enables hover/tap micro-interactions */}
                <motion.div
                  className={`
                    relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                    transition-colors duration-150
                    ${isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                  // Subtle rightward shift on hover — indicates interactivity
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Animated active background pill — slides between links */}
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0 rounded-lg bg-primary/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {/* Icon and label sit above the background pill */}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* User info at bottom of sidebar */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            {/* User avatar circle with first letter of name */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ============================================ */}
      {/* MAIN AREA — navbar + content                  */}
      {/* ============================================ */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* TOP NAVBAR */}
        <header className="flex h-16 items-center justify-between border-b px-6 bg-card">
          {/* Left side: role indicator with entrance animation */}
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <RoleIcon className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline" className={ROLE_BADGE_CLASS[role]}>
              {role}
            </Badge>
          </motion.div>

          {/* Right side: theme toggle + logout */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </motion.div>
          </div>
        </header>

        {/* CONTENT AREA — animated page transitions on route change */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
