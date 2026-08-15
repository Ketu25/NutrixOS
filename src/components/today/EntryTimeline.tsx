"use client";

import { AnimatePresence, motion } from "motion/react";
import { Camera, Mic, PenLine, Trash2, Utensils } from "lucide-react";
import { Card, CardLabel } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import type { LogEntry, MealSlot } from "@/core/nutrition/types";

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const SOURCE_ICON = {
  text: PenLine,
  voice: Mic,
  photo: Camera,
  manual: Utensils,
  recipe: Utensils,
} as const;

/**
 * The day's log.
 *
 * Uses `layout` so that removing an entry makes the remaining rows glide into
 * their new positions instead of snapping — the user keeps track of where
 * everything went, which matters when the action is destructive.
 */
export function EntryTimeline({
  entries,
  onRemove,
}: {
  entries: LogEntry[];
  onRemove: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        <Card tier={2} className="py-8 text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-surface-3 text-tertiary">
            <Utensils size={18} />
          </span>
          <p className="font-medium tracking-tight">Nothing logged yet</p>
          <p className="mx-auto mt-1 max-w-[22rem] text-sm text-secondary">
            Tap the button below and just say what you ate — &ldquo;two eggs on
            toast and a coffee&rdquo; is enough.
          </p>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2.5">
      <CardLabel className="px-1">Today&rsquo;s log</CardLabel>

      <AnimatePresence initial={false} mode="popLayout">
        {entries.map((entry) => {
          const Icon = SOURCE_ICON[entry.source];
          // Confidence is the mean across items, so a single uncertain
          // component visibly drags the whole entry down.
          const confidence = entry.items.length
            ? entry.items.reduce((sum, item) => sum + item.confidence, 0) /
              entry.items.length
            : 0;

          return (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.95 }}
              transition={spring}
            >
              <Card className="p-3.5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-tertiary">
                    <Icon size={14} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium tracking-tight">
                        {SLOT_LABEL[entry.slot]}
                      </p>
                      <span className="tnum shrink-0 text-sm font-semibold">
                        {Math.round(entry.totals.calories).toLocaleString()} kcal
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-sm text-secondary">
                      {entry.items.map((item) => item.name).join(", ")}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <MacroPill label="P" value={entry.totals.protein} tint="text-protein" />
                      <MacroPill label="C" value={entry.totals.carbs} tint="text-carbs" />
                      <MacroPill label="F" value={entry.totals.fat} tint="text-fat" />
                      {entry.totals.fiber > 0 && (
                        <MacroPill label="Fib" value={entry.totals.fiber} tint="text-fiber" />
                      )}

                      {confidence < 0.75 && (
                        <span className="text-[0.6875rem] text-tertiary">
                          ~{Math.round(confidence * 100)}% confident
                        </span>
                      )}
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    aria-label={`Delete ${SLOT_LABEL[entry.slot]} entry`}
                    onClick={() => onRemove(entry.id)}
                    whileTap={{ scale: 0.88 }}
                    transition={ease}
                    className={cn(
                      "-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full",
                      "text-tertiary transition-colors hover:bg-danger-soft hover:text-danger",
                    )}
                  >
                    <Trash2 size={14} />
                  </motion.button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function MacroPill({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <span className="text-[0.6875rem] text-tertiary">
      <span className={cn("font-semibold", tint)}>{label}</span>{" "}
      <span className="tnum text-secondary">{Math.round(value)}g</span>
    </span>
  );
}
