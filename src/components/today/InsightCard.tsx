"use client";

import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { ease, spring, stagger } from "@/lib/motion";
import type { CoachInsight, CopilotContext } from "@/core/ai/types";

const TONE = {
  positive: { ring: "border-success/40", dot: "bg-success", text: "text-success" },
  neutral: { ring: "border-line", dot: "bg-accent", text: "text-accent" },
  warning: { ring: "border-warn/40", dot: "bg-warn", text: "text-warn" },
} as const;

/**
 * The copilot's read on the day.
 *
 * Fetched client-side after the rings have already painted, so the dashboard
 * is useful immediately and the insight arrives as an enhancement rather than
 * a blocking dependency. A failed request renders nothing at all — a broken
 * card is worse than no card.
 */
export function InsightCard({ context }: { context: CopilotContext }) {
  const [insight, setInsight] = useState<CoachInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/copilot/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(context),
          signal: controller.signal,
        });
        // 204 means the copilot declined or failed; leave the card absent.
        if (response.ok && response.status !== 204) {
          setInsight(await response.json());
        }
      } catch {
        // Aborted or offline. Nothing to show, nothing to say.
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
    // Refetch when the day's numbers move enough to change the advice.
  }, [context.consumedSoFar.calories, context.consumedSoFar.protein]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div key="loading" exit={{ opacity: 0 }} transition={ease}>
          <Card tier={2} className="flex items-center gap-3">
            <motion.span
              className="size-2 rounded-full bg-accent"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1, 0.85] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-sm text-tertiary">Reading your day…</span>
          </Card>
        </motion.div>
      )}

      {!loading && insight && (
        <motion.div
          key="insight"
          variants={stagger(0.06)}
          initial="hidden"
          animate="show"
        >
          <Card tier={2} className={cn("border", TONE[insight.tone].ring)}>
            <motion.div
              className="flex items-start gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3",
                  TONE[insight.tone].text,
                )}
              >
                <Sparkles size={14} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug tracking-tight">
                  {insight.headline}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-secondary">
                  {insight.body}
                </p>

                {insight.suggestions.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {insight.suggestions.map((suggestion, index) => (
                      <motion.li
                        key={suggestion}
                        className="flex items-start gap-2 text-sm text-secondary"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...spring, delay: 0.1 + index * 0.06 }}
                      >
                        <span
                          className={cn(
                            "mt-1.5 size-1 shrink-0 rounded-full",
                            TONE[insight.tone].dot,
                          )}
                        />
                        {suggestion}
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
