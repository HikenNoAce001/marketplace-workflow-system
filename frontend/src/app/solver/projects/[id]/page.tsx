"use client";

// Solver project detail — view info, bid on OPEN projects, manage tasks on assigned ones

import { use, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LifecycleStepper } from "@/components/lifecycle-stepper";
import { AnimatedList, AnimatedListItem } from "@/components/animated-list";
import { AnimatedBadge } from "@/components/animated-badge";
import { useAuth } from "@/hooks/use-auth";
import {
  useProject,
  useProjectTasks,
  useTaskSubmissions,
  useCreateRequest,
  useCreateTask,
  useUpdateTask,
  useUploadSubmission,
} from "@/hooks/use-solver";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  Clock,
  Upload,
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  DollarSign,
  ClipboardList,
  Send,
  Pencil,
} from "lucide-react";
import { ProjectState, TaskState, SubmissionState } from "@/types";
import type { ProjectStatus, TaskStatus, SubmissionStatus, Task } from "@/types";

const PROJECT_STATUS_CLASS: Record<ProjectStatus, string> = {
  OPEN: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  ASSIGNED: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  COMPLETED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
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

export default function SolverProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
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
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
          <Button onClick={() => router.push("/solver/projects")} variant="outline">
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const isAssigned = project.assigned_solver_id === user?.id;
  const isOpen = project.status === ProjectState.OPEN;
  const isCompleted = project.status === ProjectState.COMPLETED;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push("/solver/projects")}
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
          {isAssigned && (
            <Badge variant="secondary">You&apos;re assigned</Badge>
          )}
        </div>

        <LifecycleStepper type="project" currentStatus={project.status} className="mt-4" />
      </div>

      <Tabs defaultValue={isAssigned ? "tasks" : "overview"}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {(isAssigned || isCompleted) && (
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
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
            </div>

            {isOpen && (
              <BidForm projectId={projectId} />
            )}
          </div>
        </TabsContent>

        {(isAssigned || isCompleted) && (
          <TabsContent value="tasks">
            <SolverTasksTab
              projectId={projectId}
              isAssigned={isAssigned}
              isCompleted={isCompleted}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function BidForm({ projectId }: { projectId: string }) {
  const [coverLetter, setCoverLetter] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const createRequest = useCreateRequest(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverLetter.trim()) {
      toast.error("Please write a cover letter explaining why you're a good fit.");
      return;
    }

    try {
      await createRequest.mutateAsync({ cover_letter: coverLetter.trim() });
      toast.success("Bid submitted! The buyer will review your request.");
      setSubmitted(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit bid"
      );
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium">Bid submitted!</p>
            <p className="text-sm text-muted-foreground">
              The buyer will review your request. Check &quot;My Requests&quot; for status updates.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Submit a Bid
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cover-letter">Cover Letter</Label>
            <Textarea
              id="cover-letter"
              placeholder="Explain why you're a good fit for this project. Highlight relevant skills and experience..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">
              A strong cover letter helps buyers choose you over other solvers.
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              type="submit"
              disabled={createRequest.isPending}
              className="gap-2"
            >
              {createRequest.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Bid
                </>
              )}
            </Button>
          </motion.div>
        </form>
      </CardContent>
    </Card>
  );
}

function SolverTasksTab({
  projectId,
  isAssigned,
  isCompleted,
}: {
  projectId: string;
  isAssigned: boolean;
  isCompleted: boolean;
}) {
  const { data, isLoading, isError, refetch } = useProjectTasks(projectId);
  const [showCreateForm, setShowCreateForm] = useState(false);

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
        <Button onClick={() => refetch()} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAssigned && !isCompleted && (
        <div className="flex justify-end">
          <Button
            onClick={() => setShowCreateForm(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      )}

      <CreateTaskDialog
        projectId={projectId}
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
      />

      {(!data || data.data.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No tasks yet</h3>
          <p className="text-muted-foreground">
            {isAssigned
              ? "Create your first task to start working on this project."
              : "Tasks will appear here."}
          </p>
        </div>
      )}

      {data && data.data.length > 0 && (
        <AnimatedList className="space-y-4">
          {data.data.map((task) => (
            <AnimatedListItem key={task.id}>
              <SolverTaskCard
                task={task}
                projectId={projectId}
                isAssigned={isAssigned}
                isCompleted={isCompleted}
              />
            </AnimatedListItem>
          ))}
        </AnimatedList>
      )}
    </div>
  );
}

function CreateTaskDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const createTask = useCreateTask(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }

    try {
      await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        deadline: deadline ? new Date(deadline).toISOString() : null,
      });
      toast.success("Task created!");
      setTitle("");
      setDescription("");
      setDeadline("");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create task"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Break down the project into manageable tasks. Each task can have its own deadline and submissions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              placeholder="e.g., Set up database schema"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Description *</Label>
            <Textarea
              id="task-desc"
              placeholder="What needs to be done for this task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-deadline">Deadline (optional)</Label>
            <Input
              id="task-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTask.isPending} className="gap-2">
              {createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SolverTaskCard({
  task,
  projectId,
  isAssigned,
  isCompleted,
}: {
  task: Task;
  projectId: string;
  isAssigned: boolean;
  isCompleted: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const canEdit = isAssigned && !isCompleted && task.status !== TaskState.COMPLETED;

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-3 flex-1 text-left"
            >
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
            </button>

            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              {task.deadline && (
                <span className="text-xs text-muted-foreground">
                  Due: {formatDate(task.deadline)}
                </span>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditDialog(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

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
                  <SolverSubmissionsPanel
                    taskId={task.id}
                    taskStatus={task.status}
                    projectId={projectId}
                    canUpload={isAssigned && !isCompleted}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <EditTaskDialog
        task={task}
        projectId={projectId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </>
  );
}

function EditTaskDialog({
  task,
  projectId,
  open,
  onOpenChange,
}: {
  task: Task;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [deadline, setDeadline] = useState(
    task.deadline ? new Date(task.deadline).toISOString().split("T")[0] : ""
  );
  const updateTask = useUpdateTask(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }

    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        payload: {
          title: title.trim(),
          description: description.trim(),
          deadline: deadline ? new Date(deadline).toISOString() : null,
        },
      });
      toast.success("Task updated!");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update the task title, description, or deadline.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Description *</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-deadline">Deadline (optional)</Label>
            <Input
              id="edit-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateTask.isPending} className="gap-2">
              {updateTask.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SolverSubmissionsPanel({
  taskId,
  taskStatus,
  projectId,
  canUpload,
}: {
  taskId: string;
  taskStatus: TaskStatus;
  projectId: string;
  canUpload: boolean;
}) {
  const { data, isLoading, isError, refetch } = useTaskSubmissions(taskId);
  const { uploadProgress, ...uploadSubmission } = useUploadSubmission(projectId, taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Can upload when task is IN_PROGRESS or REVISION_REQUESTED (not SUBMITTED or COMPLETED)
  const canSubmitZip =
    canUpload &&
    (taskStatus === TaskState.IN_PROGRESS || taskStatus === TaskState.REVISION_REQUESTED);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a ZIP file to upload.");
      return;
    }

    try {
      await uploadSubmission.mutateAsync({
        file,
        notes: uploadNotes.trim() || undefined,
      });
      toast.success("Submission uploaded! The buyer will review it.");
      setUploadNotes("");
      setShowUploadForm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload submission"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-destructive mb-2">Failed to load submissions</p>
        <Button onClick={() => refetch()} variant="outline" size="sm">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {canSubmitZip && !showUploadForm && (
        <Button
          size="sm"
          onClick={() => setShowUploadForm(true)}
          className="gap-2"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload ZIP
        </Button>
      )}

      {showUploadForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleUpload} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`file-${taskId}`}>ZIP File *</Label>
                <Input
                  id={`file-${taskId}`}
                  type="file"
                  accept=".zip,application/zip"
                  ref={fileInputRef}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Must be a valid .zip file, max 50MB.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`notes-${taskId}`}>Notes (optional)</Label>
                <Textarea
                  id={`notes-${taskId}`}
                  placeholder="Brief description of what's included..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-3">
                {uploadSubmission.isPending && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {uploadProgress < 100 ? "Uploading..." : "Processing..."}
                      </span>
                      <span className="font-medium">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: "0%" }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      />
                    </div>
                    {uploadProgress === 100 && (
                      <p className="text-xs text-muted-foreground">
                        Upload complete -- server is validating the ZIP...
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUploadForm(false)}
                    disabled={uploadSubmission.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={uploadSubmission.isPending}
                    className="gap-2"
                  >
                    {uploadSubmission.isPending ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {uploadProgress < 100 ? `${uploadProgress}%` : "Validating..."}
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {(!data || data.data.length === 0) && !showUploadForm && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No submissions yet.
          {canSubmitZip && " Upload a ZIP file to submit your work."}
        </p>
      )}

      {/* Submission history, newest first */}
      {data && data.data.map((submission, index) => (
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
                  <Badge variant="secondary" className="text-xs">Latest</Badge>
                )}
              </div>

              {submission.notes && (
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">Your notes:</span> {submission.notes}
                </p>
              )}

              {submission.reviewer_notes && (
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                  <span className="font-medium">Buyer feedback:</span> {submission.reviewer_notes}
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-1">
                Submitted {formatDate(submission.submitted_at)}
                {submission.reviewed_at && ` · Reviewed ${formatDate(submission.reviewed_at)}`}
              </p>
            </div>

            <div className="flex-shrink-0">
              {submission.status === SubmissionState.PENDING_REVIEW && (
                <Clock className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
              )}
              {submission.status === SubmissionState.ACCEPTED && (
                <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
              )}
              {submission.status === SubmissionState.REJECTED && (
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
