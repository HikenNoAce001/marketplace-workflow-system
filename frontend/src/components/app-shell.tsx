"use client";

// Shared layout for all authenticated pages — sidebar + navbar + content area

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

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  ADMIN: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  BUYER: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  SOLVER: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
};

const ROLE_ICON: Record<UserRole, React.ElementType> = {
  ADMIN: Users,
  BUYER: ShoppingCart,
  SOLVER: Wrench,
};

// Colored left border accent per role
const ROLE_SIDEBAR_ACCENT: Record<UserRole, string> = {
  ADMIN: "border-l-red-500",
  BUYER: "border-l-blue-500",
  SOLVER: "border-l-green-500",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const role = user.role as UserRole;
  const navItems = NAV_ITEMS[role] || [];
  const RoleIcon = ROLE_ICON[role];

  return (
    <div className="flex h-screen bg-background" data-role={role}>
      {/* Sidebar */}
      <aside className={`flex w-64 flex-col border-r border-l-4 bg-card ${ROLE_SIDEBAR_ACCENT[role]}`}>
        <div className="flex h-16 items-center gap-2 px-6 border-b">
          <FolderKanban className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Marketplace</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={`
                    relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                    transition-colors duration-150
                    ${isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Active background pill — slides between links */}
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0 rounded-lg bg-primary/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <div className="flex items-center gap-3">
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

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b px-6 bg-card">
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

        {/* Page content with route transition */}
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
