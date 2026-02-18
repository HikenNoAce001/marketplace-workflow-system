"use client";

/**
 * AnimatedList — Reusable staggered list animation wrapper.
 *
 * Wraps any list of items and applies a staggered fade-in + slide-up
 * animation. Each child appears 50ms after the previous one, creating
 * a smooth "progressive reveal" effect.
 *
 * WHY?
 * Lists appear everywhere in this app (projects, tasks, requests,
 * submissions, users). This wrapper ensures consistent animation
 * timing without duplicating Framer Motion config in every page.
 *
 * USAGE:
 *   <AnimatedList>
 *     {items.map(item => (
 *       <AnimatedListItem key={item.id}>
 *         <Card>...</Card>
 *       </AnimatedListItem>
 *     ))}
 *   </AnimatedList>
 *
 * IMPORTANT: Each direct child should be an <AnimatedListItem>.
 * This is because Framer Motion's staggerChildren only works when
 * the parent (variants="container") and children (variants="item")
 * share a coordinated animation.
 */

import { motion } from "framer-motion";

// ============================================================
// Animation variants — parent orchestrates, children animate
// ============================================================

/**
 * Container variant — tells Framer Motion to stagger its children.
 * staggerChildren: 0.05 means 50ms delay between each child.
 */
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

/**
 * Item variant — each child fades in and slides up.
 * Starts 15px below and transparent, ends at natural position and visible.
 */
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

// ============================================================
// Components
// ============================================================

interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Parent wrapper — triggers staggered animation on mount.
 * Use this around a list of <AnimatedListItem> children.
 */
export function AnimatedList({ children, className = "" }: AnimatedListProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Child wrapper — each item in the list.
 * Inherits animation trigger from parent's staggerChildren.
 */
export function AnimatedListItem({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

// ============================================================
// Table-compatible variants
// ============================================================
//
// HTML tables have strict nesting rules:
//   <table> → <thead>/<tbody> → <tr> → <td>/<th>
//
// Inserting a <div> (from motion.div) between these elements
// breaks HTML validity and causes React hydration errors.
//
// These components use motion.tbody and motion.tr instead,
// giving the same stagger animation without breaking the DOM.
//
// USAGE (inside a <Table>):
//   <AnimatedTableBody>
//     {rows.map(row => (
//       <AnimatedTableRow key={row.id}>
//         <TableCell>...</TableCell>
//       </AnimatedTableRow>
//     ))}
//   </AnimatedTableBody>

/**
 * Table body with stagger animation — replaces <TableBody>.
 * Uses motion.tbody so it's a valid child of <table>.
 */
export function AnimatedTableBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.tbody
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.tbody>
  );
}

/**
 * Table row with fade-in animation — replaces <TableRow>.
 * Uses motion.tr so it's a valid child of <tbody>.
 */
export function AnimatedTableRow({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.tr
      variants={itemVariants}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.tr>
  );
}
