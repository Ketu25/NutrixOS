"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { spring, springSnappy } from "@/lib/motion";

interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail?: string;
  icon?: ReactNode;
  className?: string;
}

/**
 * A large, tappable choice used throughout onboarding.
 *
 * Selection is communicated three ways at once — border, tinted fill, and a
 * check that springs in — so the state is unmistakable without relying on
 * color alone.
 */
export function OptionCard({
  selected,
  onSelect,
  title,
  detail,
  icon,
  className,
}: OptionCardProps) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      transition={springSnappy}
      className={cn(
        "relative flex w-full items-center gap-3.5 rounded-card border p-4 text-left",
        "transition-colors duration-200",
        selected
          ? "border-accent bg-accent-soft"
          : "border-line bg-surface-1 hover:border-line-strong",
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-field transition-colors",
            selected ? "text-accent" : "bg-surface-2 text-secondary",
          )}
        >
          {icon}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block font-medium tracking-tight">{title}</span>
        {detail && (
          <span className="mt-0.5 block text-sm text-secondary">{detail}</span>
        )}
      </span>

      <motion.span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          selected ? "bg-accent text-on-accent" : "border border-line-strong",
        )}
        initial={false}
        animate={{ scale: selected ? 1 : 0.85 }}
        transition={spring}
      >
        {selected && (
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring}
          >
            <Check size={14} strokeWidth={3} />
          </motion.span>
        )}
      </motion.span>
    </motion.button>
  );
}
