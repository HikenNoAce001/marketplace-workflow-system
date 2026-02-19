"use client";

/**
 * Solver My Requests Page — Track bid statuses across all projects.
 *
 * Shows every bid (request) this solver has submitted:
 * - PENDING  → waiting for buyer to review (yellow)
 * - ACCEPTED → buyer chose you! (green)
 * - REJECTED → buyer chose someone else (red)
 *
 * DATA FLOW:
 * useMyRequests(page) → GET /api/requests/me → paginated list of solver's bids
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMyRequests } from "@/hooks/use-solver";
import { AnimatedList, AnimatedListItem } from "@/components/animated-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { RequestStatus } from "@/types";

const REQUEST_STATUS_CLASS: Record<RequestStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  ACCEPTED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  REJECTED: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

const REQUEST_STATUS_ICON: Record<RequestStatus, React.ElementType> = {
  PENDING: Clock,
  ACCEPTED: CheckCircle,
  REJECTED: XCircle,
};

export default function SolverRequestsPage() {
  const [page, setPage] = useState(1);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMyRequests(page);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          My Requests
        </h1>
        <p className="text-muted-foreground mt-1">
          Track the status of your bids on projects.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold">Failed to load requests</h3>
          <p className="text-muted-foreground mb-4">
            Something went wrong. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
        </div>
      )}

      {/* Empty */}
      {data && data.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No bids yet</h3>
          <p className="text-muted-foreground mb-4">
            Browse projects and submit your first bid.
          </p>
          <Button onClick={() => router.push("/solver/projects")} variant="outline">
            Browse Projects
          </Button>
        </div>
      )}

      {/* Request cards */}
      {data && data.data.length > 0 && (
        <>
          <AnimatedList className="space-y-4">
            {data.data.map((request) => {
              const StatusIcon = REQUEST_STATUS_ICON[request.status];

              return (
                <AnimatedListItem key={request.id}>
                  <Card
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/solver/projects/${request.project_id}`)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              Project: {request.project_id.slice(0, 8)}...
                            </span>
                            <Badge
                              variant="outline"
                              className={REQUEST_STATUS_CLASS[request.status]}
                            >
                              {request.status}
                            </Badge>
                          </div>
                          {/* Cover letter preview */}
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {request.cover_letter}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Submitted {formatDate(request.created_at)}
                          </p>
                        </div>

                        {/* Click hint */}
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedListItem>
              );
            })}
          </AnimatedList>

          {/* Pagination */}
          {data.meta.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing page {data.meta.page} of {data.meta.total_pages} ({data.meta.total} requests)
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
