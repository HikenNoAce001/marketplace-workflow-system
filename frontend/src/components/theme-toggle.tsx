"use client";

/**
 * ThemeToggle — Animated sun/moon button for switching dark/light mode.
 *
 * WHY useEffect + mounted state?
 * next-themes reads the theme from localStorage on mount. On the server,
 * we don't know the theme yet, so we render a disabled placeholder until
 * after hydration. This prevents a flash of the wrong icon.
 *
 * The icon cross-fades with a rotation animation for a polished feel.
 */

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Only render the icon after hydration (avoids server/client mismatch)
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Placeholder button while hydrating — same size, no icon
    return <Button variant="ghost" size="icon" className="h-9 w-9" disabled />;
  }

  // resolvedTheme accounts for "system" → actual "light" or "dark"
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? "moon" : "sun"}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.2 }}
        >
          {isDark ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </motion.div>
      </AnimatePresence>
    </Button>
  );
}
