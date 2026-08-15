"use client";

import { motion } from "motion/react";
import { Moon, Plus, Sun, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { RingCluster } from "./RingCluster";
import { InsightCard } from "./InsightCard";
import { EntryTimeline } from "./EntryTimeline";
import { LogSheet } from "@/components/logging/LogSheet";
import { Card, CardLabel } from "@/components/ui/Card";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { useTheme } from "@/components/system/ThemeProvider";
import { useStore } from "@/lib/store";
import { spring, springSnappy } from "@/lib/motion";
import { projectEndOfDay } from "@/core/nutrition/targets";
import type { CopilotContext } from "@/core/ai/types";

/** Minutes since the eating window opens, used to scale the projection. */
const WINDOW_START_HOUR = 7;

export function TodayScreen() {
  const { profile, goal, targets, todayEntries, todayTotals, addEntry, removeEntry } =
    useStore();
  const { resolved, toggle } = useTheme();
  const [logOpen, setLogOpen] = useState(false);

  const context = useMemo<CopilotContext | null>(() => {
    if (!profile || !goal || !targets) return null;
    return {
      goal: goal.type,
      dietaryPattern: profile.dietaryPattern,
      allergies: profile.allergies,
      targets,
      consumedSoFar: todayTotals,
      localTime: new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }, [profile, goal, targets, todayTotals]);

  const projection = useMemo(() => {
    if (!targets) return null;
    const now = new Date();
    const minutesElapsed =
      (now.getHours() - WINDOW_START_HOUR) * 60 + now.getMinutes();
    if (minutesElapsed <= 0) return null;
    return projectEndOfDay(todayTotals, targets, minutesElapsed);
  }, [todayTotals, targets]);

  if (!targets || !context) return null;

  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 frost px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex w-full max-w-[32rem] items-center justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-tertiary">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </p>
            <h1 className="text-lg font-semibold tracking-tight">{greeting}</h1>
          </div>

          <motion.button
            type="button"
            aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} theme`}
            onClick={toggle}
            whileTap={{ scale: 0.9, rotate: -20 }}
            transition={springSnappy}
            className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-secondary hover:text-primary"
          >
            <motion.span
              key={resolved}
              initial={{ scale: 0.6, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={spring}
            >
              {resolved === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </motion.span>
          </motion.button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[32rem] flex-1 px-5 pb-32">
        <Stagger className="space-y-5 pt-4" gap={0.09}>
          <Reveal variant="pop">
            <Card className="py-7">
              <RingCluster totals={todayTotals} targets={targets} />
            </Card>
          </Reveal>

          <Reveal>
            <InsightCard context={context} />
          </Reveal>

          {projection && todayTotals.calories > 0 && (
            <Reveal>
              <Card tier={2}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} className="text-tertiary" />
                  <CardLabel>Projected finish</CardLabel>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <CountUp
                    value={projection.calories}
                    className="tnum text-2xl font-semibold tracking-tight"
                  />
                  <span className="text-sm text-tertiary">
                    kcal at your current pace
                  </span>
                </div>
                <p className="mt-1 text-sm text-secondary">
                  {projectionCopy(
                    projection.calories,
                    targets.calories,
                    new Date().getHours(),
                  )}
                </p>
              </Card>
            </Reveal>
          )}

          <Reveal>
            <EntryTimeline entries={todayEntries} onRemove={removeEntry} />
          </Reveal>
        </Stagger>
      </main>

      {/* Logging is the primary action, so it gets the only floating control. */}
      <div className="fixed inset-x-0 bottom-0 z-20 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[32rem]">
          <motion.button
            type="button"
            onClick={() => setLogOpen(true)}
            whileTap={{ scale: 0.97 }}
            transition={springSnappy}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-accent font-medium text-on-accent shadow-[var(--shadow-lg)]"
          >
            <Plus size={18} strokeWidth={2.5} />
            Log a meal
          </motion.button>
        </div>
      </div>

      <LogSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        context={context}
        onLogged={addEntry}
      />
    </div>
  );
}

function greetingForHour(hour: number): string {
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function projectionCopy(
  projected: number,
  target: number,
  hour: number,
): string {
  const delta = projected - target;

  // A very large shortfall late in the day almost always means meals went
  // unlogged, not that the user ate 1,300 kcal less than they needed. Reading
  // it the other way would nudge someone toward a late binge to "catch up",
  // which is the opposite of useful.
  if (delta < -target * 0.4 && hour >= 20) {
    return "That's well under target — if you ate more today, logging it will sharpen tomorrow's numbers.";
  }

  if (Math.abs(delta) < target * 0.05) return "Right on target for the day.";

  if (delta > 0)
    return `About ${Math.round(delta)} kcal over — easing off later brings it back.`;

  return `About ${Math.round(Math.abs(delta))} kcal under, which leaves room for more.`;
}
