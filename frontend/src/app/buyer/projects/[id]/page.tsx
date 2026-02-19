"use client";

// Buyer project detail — overview, requests (accept/reject bids), tasks (review submissions)

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LifecycleStepper } from "@/components/lifecycle-stepper";
import { AnimatedList, AnimatedListItem } from "@/components/animated-list";
import { AnimatedBadge } from "@/components/animated-badge";
import {
  useProject,
  useProjectRequests,
  useProjectTasks,
  useTaskSubmissions,
  useAcceptRequest,
  useRejectRequest,
  useAcceptSubmission,
  useRejectSubmission,
  downloadSubmission,
} from "@/hooks/use-buyer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import { ProjectState, RequestState, SubmissionState } from "@/types";
import type { ProjectStatus, RequestStatus, TaskStatus, SubmissionStatus, Task } from "@/types";

const PROJECT_STATUS_CLASS: Record<ProjectStatus, string> = {
  OPEN: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  ASSIGNED: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  COMPLETED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
};

const REQUEST_STATUS_CLASS: Record<RequestStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  ACCEPTED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  REJECTED: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  SUBMITTED: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  COMPLETED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  REVISION_REQUESTED: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
};

const SUBMISSION_STATUS_CLASS: Record<SubmissionStatus, string> = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  ACCEPTED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  REJECTED: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatBudget = (budget: number | null) => {
  if (budget === null || budget === undefined) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(budget);
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function BuyerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 16: params is async
  const { id: projectId } = use(params);
  const router = useRouter();

  const { data: project, isLoading, isError, refetch } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold">Failed to load project</h3>
        <p className="text-muted-foreground mb-4">
          The project may not exist or you may not have access.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
          <Button onClick={() => router.push("/buyer/projects")} variant="outline">
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push("/buyer/projects")}
          className="gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <AnimatedBadge
            status={project.status}
            className={PROJECT_STATUS_CLASS[project.status]}
          />
        </div>

        <LifecycleStepper type="project" currentStatus={project.status} className="mt-4" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab project={project} />
        </TabsContent>

        <TabsContent value="requests">
          <RequestsTab projectId={projectId} projectStatus={project.status} />
        </TabsContent>

        <TabsContent value="tasks">
          <TasksTab projectId={projectId} projectStatus={project.status} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ project }: { project: { title: string; description: string; status: ProjectStatus; budget: number | null; deadline: string | null; assigned_solver_id: string | null; created_at: string } }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {project.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Budget</p>
            <p className="font-semibold">{formatBudget(project.budget)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Deadline</p>
            <p className="font-semibold">{formatDate(project.deadline)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <User className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Assigned Solver</p>
            <p className="font-semibold">
              {project.assigned_solver_id ? "Assigned" : "None yet"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="font-semibold">{formatDate(project.created_at)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RequestsTab({
  projectId,
  projectStatus,
}: {
  projectId: string;
  projectStatus: ProjectStatus;
}) {
  const { data, isLoading, isError, refetch } = useProjectRequests(projectId);
  const acceptRequest = useAcceptRequest(projectId);
  const rejectRequest = useRejectRequest(projectId);

  const handleAccept = async (requestId: string) => {
    try {
      await acceptRequest.mutateAsync(requestId);
      toast.success("Request accepted! Solver has been assigned to the project.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept request"
      );
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectRequest.mutateAsync(requestId);
      toast.success("Request rejected.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject request"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold">Failed to load requests</h3>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No requests yet</h3>
        <p className="text-muted-foreground">
          Solvers will appear here when they bid on your project.
        </p>
      </div>
    );
  }

  return (
    <AnimatedList className="space-y-4">
      {data.data.map((request) => (
        <AnimatedListItem key={request.id}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Solver: {request.solver_id.slice(0, 8)}...
                    </span>
                    <AnimatedBadge
                      status={request.status}
                      className={REQUEST_STATUS_CLASS[request.status]}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {request.cover_letter}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted {formatDate(request.created_at)}
                  </p>
                </div>

                {request.status === RequestState.PENDING && projectStatus === ProjectState.OPEN && (
                  <div className="flex gap-2 flex-shrink-0">
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                        onClick={() => handleReject(request.id)}
                        disabled={rejectRequest.isPending || acceptRequest.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </motion.div>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => handleAccept(request.id)}
                        disabled={acceptRequest.isPending || rejectRequest.isPending}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Accept
                      </Button>
                    </motion.div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedListItem>
      ))}
    </AnimatedList>
  );
}

function TasksTab({
  projectId,
  projectStatus,
}: {
  projectId: string;
  projectStatus: ProjectStatus;
}) {
  const { data, isLoading, isError, refetch } = useProjectTasks(projectId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold">Failed to load tasks</h3>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No tasks yet</h3>
        <p className="text-muted-foreground">
          {projectStatus === ProjectState.OPEN
            ? "Accept a solver's request first. They'll create tasks once assigned."
            : "The assigned solver will create tasks here."}
        </p>
      </div>
    );
  }

  return (
    <AnimatedList className="space-y-4">
      {data.data.map((task) => (
        <AnimatedListItem key={task.id}>
          <TaskCard task={task} projectId={projectId} />
        </AnimatedListItem>
      ))}
    </AnimatedList>
  );
}

function TaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{task.title}</span>
                <AnimatedBadge
                  status={task.status}
                  className={TASK_STATUS_CLASS[task.status]}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {task.description}
              </p>
            </div>
          </div>

          {task.deadline && (
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-4">
              Due: {formatDate(task.deadline)}
            </span>
          )}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="mt-4 pl-7 border-l-2 border-muted ml-2">
                <SubmissionsPanel
                  taskId={task.id}
                  taskStatus={task.status}
                  projectId={projectId}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function SubmissionsPanel({
  taskId,
  taskStatus,
  projectId,
}: {
  taskId: string;
  taskStatus: TaskStatus;
  projectId: string;
}) {
  const { data, isLoading, isError, refetch } = useTaskSubmissions(taskId);
  const acceptSubmission = useAcceptSubmission(projectId, taskId);
  const rejectSubmission = useRejectSubmission(projectId, taskId);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");

  const handleAccept = async (submissionId: string) => {
    try {
      await acceptSubmission.mutateAsync(submissionId);
      toast.success("Submission accepted! Task marked as completed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept submission"
      );
    }
  };

  const openRejectDialog = (submissionId: string) => {
    setRejectingId(submissionId);
    setReviewerNotes("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectingId || !reviewerNotes.trim()) {
      toast.error("Please provide feedback notes for the solver.");
      return;
    }
    try {
      await rejectSubmission.mutateAsync({
        submissionId: rejectingId,
        reviewerNotes: reviewerNotes.trim(),
      });
      toast.success("Submission rejected. Solver will see your feedback.");
      setRejectDialogOpen(false);
      setRejectingId(null);
      setReviewerNotes("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject submission"
      );
    }
  };

  const handleDownload = async (submissionId: string) => {
    try {
      await downloadSubmission(submissionId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to download file"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-destructive mb-2">Failed to load submissions</p>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-muted-foreground">
          No submissions yet. The solver will upload ZIP files here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 py-2">
        {data.data.map((submission, index) => (
          <div
            key={submission.id}
            className="rounded-lg border p-4 bg-background"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{submission.file_name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({formatFileSize(submission.file_size)})
                  </span>
                  <AnimatedBadge
                    status={submission.status}
                    className={SUBMISSION_STATUS_CLASS[submission.status]}
                  />
                  {index === 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Latest
                    </Badge>
                  )}
                </div>

                {submission.notes && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">Notes:</span> {submission.notes}
                  </p>
                )}

                {submission.reviewer_notes && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                    <span className="font-medium">Feedback:</span> {submission.reviewer_notes}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-1">
                  Submitted {formatDate(submission.submitted_at)}
                  {submission.reviewed_at && ` · Reviewed ${formatDate(submission.reviewed_at)}`}
                </p>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => handleDownload(submission.id)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>

                {submission.status === SubmissionState.PENDING_REVIEW && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                      onClick={() => openRejectDialog(submission.id)}
                      disabled={rejectSubmission.isPending || acceptSubmission.isPending}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => handleAccept(submission.id)}
                      disabled={acceptSubmission.isPending || rejectSubmission.isPending}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Provide feedback so the solver knows what to fix. The task will move
              to &quot;Revision Requested&quot; and the solver can resubmit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="What needs to be changed? Be specific so the solver can address it..."
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!reviewerNotes.trim() || rejectSubmission.isPending}
            >
              {rejectSubmission.isPending ? "Rejecting..." : "Reject with Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
