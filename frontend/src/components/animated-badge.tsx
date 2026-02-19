"use client";

/**
 * AnimatedBadge — Badge that animates when its status text changes.
 *
 * When a real-time poll detects a status transition (e.g., OPEN → ASSIGNED),
 * this component provides a visual pop + color shift so the user notices
 * the change without manually comparing text.
 *
 * Uses AnimatePresence with mode="wait" — the old badge fades out,
 * then the new one scales in. The key prop triggers the swap.
 *
 * Drop-in replacement for static <Badge> on status displays.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface AnimatedBadgeProps {
  /** The status value — used as the animation key (triggers re-animation on change) */
  status: string;
  /** Tailwind classes for the badge (color, border, etc.) */
  className?: string;
  /** Display text (e.g., "PENDING REVIEW" from "PENDING_REVIEW"). Defaults to status with _ → spaces */
  label?: string;
}

export function AnimatedBadge({ status, className, label }: AnimatedBadgeProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Badge variant="outline" className={className}>
          {label || status.replace(/_/g, " ")}
        </Badge>
      </motion.div>
    </AnimatePresence>
  );
}
