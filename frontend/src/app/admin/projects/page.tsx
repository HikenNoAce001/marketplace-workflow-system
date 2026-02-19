"use client";

/**
 * Admin Projects Page — Read-only overview of ALL projects.
 *
 * PDF SPEC: Admin can "View all users and projects" but has
 * "No project execution responsibilities" — so this is VIEW ONLY.
 * No create, edit, delete, or status change buttons.
 *
 * FEATURES:
 * - Paginated table of all projects
 * - Columns: Title, Status (colored badge), Budget, Deadline, Created
 * - Status badges: OPEN=blue, ASSIGNED=yellow, COMPLETED=green
 * - 3 states: loading skeleton, error + retry, empty state
 *
 * DATA FLOW:
 * useProjects(page) → GET /api/projects → backend returns ALL projects for ADMIN
 */

import { useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import { AnimatedTableBody, AnimatedTableRow } from "@/components/animated-list";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import type { ProjectStatus } from "@/types";

/**
 * Project status badge colors — visually distinct for quick scanning.
 * OPEN = accepting bids, ASSIGNED = work in progress, COMPLETED = done.
 */
const STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  OPEN: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  ASSIGNED: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  COMPLETED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
};

export default function AdminProjectsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useProjects(page);

  // Format ISO date string to readable format
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format budget as currency
  const formatBudget = (budget: number | null) => {
    if (budget === null || budget === undefined) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(budget);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderKanban className="h-6 w-6" />
          All Projects
        </h1>
        <p className="text-muted-foreground mt-1">
          Overview of all projects in the system. Admin view is read-only.
        </p>
      </div>

      {/* ============================================ */}
      {/* STATE: Loading — skeleton rows               */}
      {/* ============================================ */}
      {isLoading && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ============================================ */}
      {/* STATE: Error — message with retry            */}
      {/* ============================================ */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold">Failed to load projects</h3>
          <p className="text-muted-foreground mb-4">
            Something went wrong. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </div>
      )}

      {/* ============================================ */}
      {/* STATE: Empty — no projects yet               */}
      {/* ============================================ */}
      {data && data.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No projects yet</h3>
          <p className="text-muted-foreground">
            Projects will appear here once Buyers create them.
          </p>
        </div>
      )}

      {/* ============================================ */}
      {/* STATE: Data — project table                  */}
      {/* ============================================ */}
      {data && data.data.length > 0 && (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              {/* AnimatedTableBody staggers each row's entrance */}
              <AnimatedTableBody className="[&_tr:last-child]:border-0">
                {data.data.map((project) => (
                  <AnimatedTableRow key={project.id}>
                    {/* Title — main identifier */}
                    <TableCell className="font-medium">
                      {project.title}
                    </TableCell>

                    {/* Status badge with color */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE_CLASS[project.status]}
                      >
                        {project.status}
                      </Badge>
                    </TableCell>

                    {/* Budget — formatted as currency or dash if none */}
                    <TableCell className="text-muted-foreground">
                      {formatBudget(project.budget)}
                    </TableCell>

                    {/* Deadline — formatted date or dash if none */}
                    <TableCell className="text-muted-foreground">
                      {formatDate(project.deadline)}
                    </TableCell>

                    {/* Created date */}
                    <TableCell className="text-muted-foreground">
                      {formatDate(project.created_at)}
                    </TableCell>
                  </AnimatedTableRow>
                ))}
              </AnimatedTableBody>
            </Table>
          </div>

          {/* Pagination controls */}
          {data.meta.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing page {data.meta.page} of {data.meta.total_pages} ({data.meta.total} projects)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.meta.total_pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
