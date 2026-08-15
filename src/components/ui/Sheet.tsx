"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ease, sheetUp } from "@/lib/motion";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Bottom sheet with drag-to-dismiss.
 *
 * Dismissal is intentionally forgiving: a flick past a velocity threshold or a
 * drag past a distance threshold both close it, so the gesture works whether
 * the user swipes fast or slow. Releasing short of either springs it back.
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  // Escape closes, and the page behind must not scroll while the sheet is up.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={ease}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "relative w-full max-w-[34rem] rounded-t-sheet border-t border-line",
              "bg-surface-1 shadow-[var(--shadow-lg)]",
              "max-h-[92dvh] overflow-y-auto overscroll-contain",
              "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
              className,
            )}
            variants={sheetUp}
            initial="hidden"
            animate="show"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            {/* Grab handle. Doubles as the affordance for the drag gesture. */}
            <div className="sticky top-0 z-10 flex justify-center bg-surface-1 pt-3 pb-2">
              <div className="h-1 w-10 rounded-pill bg-line-strong" />
            </div>

            {title && (
              <h2 className="px-5 pb-1 text-lg font-semibold tracking-tight">
                {title}
              </h2>
            )}

            <div className="px-5 pt-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
