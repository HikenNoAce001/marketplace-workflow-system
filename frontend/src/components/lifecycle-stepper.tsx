"use client";

// Visual progress indicator for project/task state machines

import { motion } from "framer-motion";
import { Check, RotateCcw } from "lucide-react";
import { ProjectState, TaskState } from "@/types";
import type { ProjectStatus, TaskStatus } from "@/types";

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

interface LifecycleStepperProps {
  type: "project" | "task";
  currentStatus: ProjectStatus | TaskStatus;
  className?: string;
}

export function LifecycleStepper({ type, currentStatus, className = "" }: LifecycleStepperProps) {
  const steps = type === "project" ? PROJECT_STEPS : TASK_STEPS;

  // REVISION_REQUESTED maps back to step 0 (rework cycle)
  const isRevisionRequested = currentStatus === TaskState.REVISION_REQUESTED;
  const currentIndex = isRevisionRequested
    ? 0
    : steps.findIndex((s) => s.status === currentStatus);

  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {steps.map((step, index) => {
        const isLastStep = currentIndex === steps.length - 1;
        const isCompleted = index < currentIndex || (isLastStep && index === currentIndex);
        const isCurrent = index === currentIndex && !isLastStep;
        const isPending = index > currentIndex;

        return (
          <div key={step.status} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                className={`
                  relative flex h-8 w-8 items-center justify-center rounded-full
                  text-xs font-semibold border-2 transition-colors
                  ${isCompleted
                    ? "bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600"
                    : isCurrent
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-muted border-muted-foreground/30 text-muted-foreground"
                  }
                `}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
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

                {/* Pulse on current step */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </motion.div>

              <motion.span
                className={`
                  mt-1.5 text-[11px] font-medium whitespace-nowrap
                  ${isCurrent ? "text-primary" : isCompleted ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}
                `}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 + 0.1 }}
              >
                {step.label}
              </motion.span>
            </div>

            {/* Connecting line between steps */}
            {index < steps.length - 1 && (
              <div className="relative mx-2 h-0.5 w-12 bg-muted-foreground/20 rounded overflow-hidden">
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded ${
                    isCompleted ? "bg-green-500 dark:bg-green-600" : isCurrent ? "bg-primary" : ""
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

      {/* Revision requested indicator */}
      {isRevisionRequested && (
        <motion.div
          className="ml-3 flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 px-2.5 py-1"
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
