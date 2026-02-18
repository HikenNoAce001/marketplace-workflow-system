"use client";

/**
 * Create Project Page — Form for buyers to create new projects.
 *
 * PDF SPEC: Buyer can "Create a project" with title, description,
 * optional budget, and optional deadline. Projects start as OPEN.
 *
 * FEATURES:
 * - Title (required) and Description (required) fields
 * - Budget (optional, number input) and Deadline (optional, date input)
 * - Client-side validation before submission
 * - Loading state on submit button to prevent double-clicks
 * - Success → toast + redirect to project list
 * - Error → toast with error message
 *
 * DATA FLOW:
 * Form submit → useCreateProject().mutate(payload)
 *   → POST /api/projects { title, description, budget?, deadline? }
 *   → invalidates ["projects"] cache → redirect to /buyer/projects
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCreateProject } from "@/hooks/use-buyer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useCreateProject();

  // Form state — controlled inputs for easy validation
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");

  /**
   * Handle form submission.
   *
   * Steps:
   * 1. Validate required fields (title + description)
   * 2. Build payload (convert budget to number, deadline to ISO string)
   * 3. Call createProject mutation
   * 4. On success → toast + redirect back to project list
   * 5. On error → toast with error message
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation — catch obvious errors before hitting the API
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    try {
      await createProject.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        // Convert budget string → number (null if empty)
        budget: budget ? parseFloat(budget) : null,
        // Convert date string → ISO format (null if empty)
        // The date input gives us "YYYY-MM-DD", backend expects ISO datetime
        deadline: deadline ? new Date(deadline).toISOString() : null,
      });

      toast.success("Project created successfully!");
      // Navigate back to the project list (which will refetch due to cache invalidation)
      router.push("/buyer/projects");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project"
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button — navigates to project list without losing context */}
      <Button
        variant="ghost"
        onClick={() => router.push("/buyer/projects")}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Button>

      {/* Form card — wraps the form in a clean container */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title — required, what solvers see when browsing */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., E-commerce Website Redesign"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                A clear, descriptive title helps solvers find your project.
              </p>
            </div>

            {/* Description — required, detailed project brief */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe what you need done, any technical requirements, and expected deliverables..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                required
              />
              <p className="text-xs text-muted-foreground">
                Include requirements, tech stack preferences, and what success looks like.
              </p>
            </div>

            {/* Budget and Deadline — optional, side by side on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Budget — optional, in USD */}
              <div className="space-y-2">
                <Label htmlFor="budget">Budget (USD)</Label>
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g., 5000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Leave blank if negotiable.
                </p>
              </div>

              {/* Deadline — optional, date picker */}
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  // Don't allow past dates
                  min={new Date().toISOString().split("T")[0]}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. When do you need this done?
                </p>
              </div>
            </div>

            {/* Submit button — tap animation + loading state */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/buyer/projects")}
              >
                Cancel
              </Button>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  type="submit"
                  disabled={createProject.isPending}
                  className="gap-2"
                >
                  {createProject.isPending ? (
                    <>
                      {/* Simple spinner using Tailwind animation */}
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Project
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
