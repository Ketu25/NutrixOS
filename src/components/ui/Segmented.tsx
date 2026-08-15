"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Segmented control where the selection indicator is a single shared element.
 *
 * The pill uses `layoutId`, so it physically travels between segments instead
 * of fading out and in. That continuity is what makes the control feel
 * connected rather than like two separate states.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  // Scope the layoutId so multiple controls on one screen don't share a pill.
  const groupId = useId();

  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-full gap-1 rounded-pill bg-surface-inset p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex-1 rounded-pill px-3 py-2 text-sm font-medium",
              "transition-colors duration-150",
              selected ? "text-primary" : "text-tertiary hover:text-secondary",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`segmented-${groupId}`}
                className="absolute inset-0 rounded-pill bg-surface-1 shadow-[var(--shadow-sm)]"
                transition={spring}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
