"use client";

import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { springSnappy } from "@/lib/motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover shadow-[var(--shadow-sm)]",
  secondary:
    "bg-surface-2 text-primary border border-line hover:border-line-strong",
  ghost: "bg-transparent text-secondary hover:bg-surface-2 hover:text-primary",
  danger: "bg-danger-soft text-danger hover:brightness-105",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[0.9375rem] gap-2",
  lg: "h-14 px-6 text-base gap-2.5",
};

interface ButtonProps extends Omit<ComponentProps<typeof motion.button>, "children"> {
  variant?: Variant;
  size?: Size;
  /** Stretch to the container. Used for primary actions in sheets and forms. */
  block?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={springSnappy}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center rounded-pill font-medium",
        "transition-colors duration-150 select-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </motion.button>
  );
}

function Spinner() {
  return (
    <motion.span
      className="size-4 rounded-full border-2 border-current border-t-transparent"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
      aria-label="Loading"
    />
  );
}
