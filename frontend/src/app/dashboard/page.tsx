"use client";

import { useAuth } from "@/hooks/use-auth";
import { Role } from "@/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { user, redirectByRole } = useAuth();

  if (!user) return null;

  const roleBadgeClass = {
    ADMIN: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    BUYER: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    SOLVER: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  }[user.role];

  return (
    <AppShell>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome, {user.name}!</CardTitle>
              <CardDescription>
                You are logged in as{" "}
                <Badge variant="outline" className={roleBadgeClass}>
                  {user.role}
                </Badge>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium">{user.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-xs">
                    {user.id.slice(0, 8)}...
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => redirectByRole(user.role)}
              >
                Go to{" "}
                {user.role === Role.ADMIN
                  ? "Admin Panel"
                  : user.role === Role.BUYER
                    ? "My Projects"
                    : "Browse Projects"}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Your role-specific pages are coming soon. Use the sidebar to
                navigate.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
