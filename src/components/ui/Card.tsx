"use client";

import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { springSnappy } from "@/lib/motion";

type Tier = 1 | 2 | 3;

const TIER: Record<Tier, string> = {
  1: "bg-surface-1",
  2: "bg-surface-2",
  3: "bg-surface-3",
};

interface CardProps extends ComponentProps<typeof motion.div> {
  tier?: Tier;
  /** Adds press feedback and a pointer cursor. */
  interactive?: boolean;
  /** Removes the default padding when the card owns its own layout. */
  bare?: boolean;
  children?: ReactNode;
}

/**
 * The single container primitive. Everything that sits on the canvas is a Card
 * at some tier, so elevation stays consistent instead of being re-invented per
 * screen.
 */
export function Card({
  tier = 1,
  interactive,
  bare,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <motion.div
      whileTap={interactive ? { scale: 0.985 } : undefined}
      transition={springSnappy}
      className={cn(
        "rounded-card border border-line shadow-[var(--shadow-sm)]",
        TIER[tier],
        !bare && "p-4",
        interactive && "cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Small uppercase label used above card content. */
export function CardLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-tertiary",
        className,
      )}
    >
      {children}
    </p>
  );
}
