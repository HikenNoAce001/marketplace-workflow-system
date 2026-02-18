import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes intelligently.
 * - clsx: handles conditional classes (e.g., cn("p-2", isActive && "bg-blue-500"))
 * - twMerge: resolves conflicts (e.g., cn("p-2", "p-4") → "p-4", not "p-2 p-4")
 *
 * Used by every shadcn/ui component for className composition.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
