"use client";

/**
 * LifecycleStepper — Visual progress indicator for state machines.
 *
 * Shows the current step in a multi-step workflow as connected circles
 * with an animated progress line. Two variants:
 *
 * PROJECT:  OPEN ──→ ASSIGNED ──→ COMPLETED
 * TASK:     IN_PROGRESS ──→ SUBMITTED ──→ COMPLETED
 *           (with REVISION_REQUESTED shown as a rework indicator)
 *
 * WHY THIS COMPONENT?
 * The PDF spec requires "step-by-step project lifecycle visualization."
 * This stepper gives users an instant visual understanding of where
 * a project or task is in its lifecycle — no need to read status text.
 *
 * ANIMATION DETAILS:
 * - Progress line animates from left to right on mount (600ms)
 * - Active step circle pulses subtly to draw attention
 * - Completed steps show a checkmark with scale-in animation
 * - Uses Framer Motion for smooth, GPU-accelerated transitions
 */

import { motion } from "framer-motion";
import { Check, RotateCcw } from "lucide-react";
import { ProjectState, TaskState } from "@/types";
import type { ProjectStatus, TaskStatus } from "@/types";

// ============================================================
// Step definitions for each state machine
// ============================================================

interface Step {
  label: string;
  status: string;
}

const PROJECT_STEPS: Step[] = [
  { label: "Open", status: ProjectState.OPEN },
  { label: "Assigned", status: ProjectState.ASSIGNED },
  { label: "Completed", status: ProjectState.COMPLETED },
];

const TASK_STEPS: Step[] = [
  { label: "In Progress", status: TaskState.IN_PROGRESS },
  { label: "Submitted", status: TaskState.SUBMITTED },
  { label: "Completed", status: TaskState.COMPLETED },
];

// ============================================================
// Props
// ============================================================

interface LifecycleStepperProps {
  /** Which state machine to visualize */
  type: "project" | "task";
  /** Current status value (e.g., "OPEN", "IN_PROGRESS") */
  currentStatus: ProjectStatus | TaskStatus;
  /** Optional CSS class for the wrapper */
  className?: string;
}

// ============================================================
// Component
// ============================================================

export function LifecycleStepper({ type, currentStatus, className = "" }: LifecycleStepperProps) {
  const steps = type === "project" ? PROJECT_STEPS : TASK_STEPS;

  // Find the index of the current step (0-based)
  // REVISION_REQUESTED maps back to step 0 (rework cycle)
  const isRevisionRequested = currentStatus === TaskState.REVISION_REQUESTED;
  const currentIndex = isRevisionRequested
    ? 0 // Back to "In Progress" conceptually
    : steps.findIndex((s) => s.status === currentStatus);

  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {steps.map((step, index) => {
        // Determine step state relative to current position
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div key={step.status} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <motion.div
                className={`
                  relative flex h-8 w-8 items-center justify-center rounded-full
                  text-xs font-semibold border-2 transition-colors
                  ${isCompleted
                    ? "bg-green-500 border-green-500 text-white"
                    : isCurrent
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-muted border-muted-foreground/30 text-muted-foreground"
                  }
                `}
                // Scale-in animation on mount
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                {/* Completed steps show a checkmark */}
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: index * 0.1 + 0.2 }}
                  >
                    <Check className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <span>{index + 1}</span>
                )}

                {/* Pulse ring on current step — draws attention */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </motion.div>

              {/* Step label below the circle */}
              <motion.span
                className={`
                  mt-1.5 text-[11px] font-medium whitespace-nowrap
                  ${isCurrent ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground"}
                `}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 + 0.1 }}
              >
                {step.label}
              </motion.span>
            </div>

            {/* Connecting line between steps (not after the last step) */}
            {index < steps.length - 1 && (
              <div className="relative mx-2 h-0.5 w-12 bg-muted-foreground/20 rounded overflow-hidden">
                {/* Animated fill — shows progress through the workflow */}
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded ${
                    isCompleted ? "bg-green-500" : isCurrent ? "bg-primary" : ""
                  }`}
                  initial={{ width: "0%" }}
                  animate={{
                    width: isCompleted ? "100%" : isCurrent ? "50%" : "0%",
                  }}
                  transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Revision Requested indicator — shown as a rework loop badge */}
      {isRevisionRequested && (
        <motion.div
          className="ml-3 flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <RotateCcw className="h-3 w-3" />
          <span className="text-[11px] font-medium">Revision Requested</span>
        </motion.div>
      )}
    </div>
  );
}
