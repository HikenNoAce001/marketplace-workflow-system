"use client";

import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { Shield, ShoppingCart, Wrench, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/api-client";

interface TestUser {
  email: string;
  name: string;
  role: string;
}

// Admins are seeded and don't get role-changed
const STATIC_ADMINS: TestUser[] = [
  { email: "admin@test.com", name: "Sarah Chen", role: Role.ADMIN },
  { email: "admin2@test.com", name: "Marcus Johnson", role: Role.ADMIN },
];

const ROLE_CONFIG: Record<string, {
  icon: typeof Shield;
  badgeClass: string;
}> = {
  ADMIN: {
    icon: Shield,
    badgeClass: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  BUYER: {
    icon: ShoppingCart,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  },
  SOLVER: {
    icon: Wrench,
    badgeClass: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  },
};

const ROLE_GROUPS = [
  { role: Role.ADMIN, label: "Sign in as Admin", description: "Manage user roles, view all projects" },
  { role: Role.BUYER, label: "Sign in as Buyer", description: "Create projects, review submissions" },
  { role: Role.SOLVER, label: "Sign in as Solver", description: "Browse projects, bid, submit work" },
];

export default function LoginPage() {
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const { devLogin } = useAuth();

  // Fetch non-admin users dynamically so role changes are reflected
  const [dynamicUsers, setDynamicUsers] = useState<TestUser[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(true);

  useEffect(() => {
    async function fetchDevUsers() {
      try {
        const res = await api.get("/auth/dev-users");
        if (res.ok) {
          const users: TestUser[] = await res.json();
          const nonAdmins = users.filter((u) => u.role !== Role.ADMIN);
          setDynamicUsers(nonAdmins);
        }
      } catch {
        console.warn("Could not fetch dev users — backend may not be running");
      } finally {
        setFetchingUsers(false);
      }
    }
    fetchDevUsers();
  }, []);

  const allUsers = [...STATIC_ADMINS, ...dynamicUsers];

  const handleDevLogin = async (email: string) => {
    setLoadingEmail(email);
    try {
      await devLogin(email);
      toast.success("Logged in successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Login failed. Is the backend running?"
      );
    } finally {
      setLoadingEmail(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              Marketplace Workflow
            </CardTitle>
            <CardDescription>
              Select a test user to sign in
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {ROLE_GROUPS.map((group) => {
              const users = allUsers.filter((u) => u.role === group.role);
              const isLoadingSection = fetchingUsers && group.role !== Role.ADMIN;

              return (
                <div key={group.role} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">
                      {group.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {group.description}
                    </p>
                  </div>

                  {isLoadingSection ? (
                    <div className="flex items-center justify-center py-3 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm">Loading users...</span>
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2 text-center">
                      No users with this role
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {users.map((testUser, idx) => {
                        const config = ROLE_CONFIG[testUser.role] || ROLE_CONFIG.SOLVER;
                        const Icon = config.icon;
                        const isLoading = loadingEmail === testUser.email;

                        return (
                          <motion.div
                            key={testUser.email}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.05 * idx }}
                          >
                            <Button
                              variant="outline"
                              className="w-full justify-start gap-3 h-auto py-2.5"
                              onClick={() => handleDevLogin(testUser.email)}
                              disabled={isLoading || loadingEmail !== null}
                            >
                              {isLoading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              ) : (
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              )}

                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{testUser.name}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${config.badgeClass}`}
                                >
                                  {testUser.role}
                                </Badge>
                              </div>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {testUser.email}
                              </span>
                            </Button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <p className="text-xs text-center text-muted-foreground pt-2">
              Each role has different permissions. Try logging in as different users to explore the full workflow.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
