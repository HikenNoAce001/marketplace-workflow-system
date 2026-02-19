"use client";

// Badge that animates on status change (e.g., OPEN -> ASSIGNED)

import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface AnimatedBadgeProps {
  status: string;
  className?: string;
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
