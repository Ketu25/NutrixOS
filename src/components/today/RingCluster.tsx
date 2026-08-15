"use client";

import { motion } from "motion/react";
import { MacroRing } from "@/components/nutrition/MacroRing";
import { CountUp } from "@/components/motion/CountUp";
import { channelProgress } from "@/core/nutrition/targets";
import { spring } from "@/lib/motion";
import type {
  MacroChannel,
  NutritionTargets,
  NutritionTotals,
} from "@/core/nutrition/types";

const LABEL: Record<MacroChannel, string> = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fiber: "Fibre",
};

/**
 * The day at a glance: one hero ring for energy, four smaller ones for macros.
 *
 * The hero ring shows what's *left*, not what's eaten. Remaining is the number
 * that answers the question the user actually has when they open the app —
 * "what can I still eat?" — and it flips to an over-budget readout rather than
 * showing a meaningless negative.
 */
export function RingCluster({
  totals,
  targets,
}: {
  totals: NutritionTotals;
  targets: NutritionTargets;
}) {
  const progress = channelProgress(totals, targets);
  const calories = progress.find((c) => c.channel === "calories")!;
  const macros = progress.filter((c) => c.channel !== "calories");

  const isOver = calories.remaining < 0;

  return (
    <div className="flex flex-col items-center">
      <MacroRing
        channel="calories"
        ratio={calories.ratio}
        size={208}
        stroke={14}
        label={`${Math.round(calories.consumed)} of ${Math.round(calories.target)} calories consumed`}
      >
        <motion.span
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-tertiary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...spring, delay: 0.3 }}
        >
          {isOver ? "Over by" : "Remaining"}
        </motion.span>

        <CountUp
          value={Math.abs(calories.remaining)}
          duration={1}
          className="tnum text-5xl font-semibold leading-tight tracking-tight"
        />

        <span className="text-sm text-tertiary">
          of {Math.round(calories.target).toLocaleString()} kcal
        </span>
      </MacroRing>

      <div className="mt-6 grid w-full grid-cols-4 gap-2">
        {macros.map((macro, index) => (
          <div key={macro.channel} className="flex flex-col items-center">
            <MacroRing
              channel={macro.channel}
              ratio={macro.ratio}
              size={62}
              stroke={5}
              delay={0.15 + index * 0.08}
              label={`${LABEL[macro.channel]} ${Math.round(macro.consumed)} of ${Math.round(macro.target)} grams`}
            >
              <CountUp
                value={macro.consumed}
                duration={0.9}
                className="tnum text-sm font-semibold leading-none"
              />
            </MacroRing>

            <span className="mt-1.5 text-[0.6875rem] font-medium text-secondary">
              {LABEL[macro.channel]}
            </span>
            <span className="tnum text-[0.6875rem] text-tertiary">
              {Math.max(0, Math.round(macro.remaining))}g left
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
