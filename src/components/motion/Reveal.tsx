"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { popIn, riseIn, stagger } from "@/lib/motion";

/**
 * Container that releases its children one after another.
 * Children must be <Reveal> (or any motion element using the same variant names).
 */
export function Stagger({
  children,
  className,
  gap = 0.05,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  as?: "div" | "ul" | "section";
}) {
  const MotionTag = motion[Tag];
  return (
    <MotionTag
      className={className}
      variants={stagger(gap, delay)}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      {children}
    </MotionTag>
  );
}

/**
 * A single element that rises or pops into view.
 *
 * Inside a <Stagger> it inherits timing from the parent. Standalone, it plays
 * on mount — `standalone` drives the initial/animate props explicitly because
 * variants only propagate from a parent that declares them.
 */
export function Reveal({
  children,
  className,
  variant = "rise",
  standalone = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  variant?: "rise" | "pop";
  standalone?: boolean;
  as?: "div" | "li" | "section" | "article";
}) {
  const MotionTag = motion[Tag];
  const variants: Variants = variant === "pop" ? popIn : riseIn;

  return (
    <MotionTag
      className={cn(className)}
      variants={variants}
      {...(standalone
        ? { initial: "hidden", animate: "show", exit: "exit" }
        : {})}
    >
      {children}
    </MotionTag>
  );
}
