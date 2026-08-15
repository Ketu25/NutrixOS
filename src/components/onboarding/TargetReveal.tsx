"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { MacroSplitBar } from "@/components/nutrition/MacroSplitBar";
import { spring, springSoft } from "@/lib/motion";
import {
  basalMetabolicRate,
  totalDailyEnergyExpenditure,
} from "@/core/nutrition/targets";
import type { Goal, NutritionTargets, UserProfile } from "@/core/nutrition/types";

/**
 * The end of onboarding: the user's numbers, explained.
 *
 * The explanation is the point. A calorie target handed over without its
 * derivation is a number to be doubted; showing BMR, activity, and the goal
 * adjustment as a visible chain makes it something the user can reason about
 * and trust.
 */
export function TargetReveal({
  targets,
  profile,
  goal,
  onStart,
}: {
  targets: NutritionTargets;
  profile: UserProfile;
  goal: Goal;
  onStart: () => void;
}) {
  const bmr = Math.round(basalMetabolicRate(profile));
  const tdee = Math.round(totalDailyEnergyExpenditure(profile));
  const adjustment = targets.calories - tdee;

  return (
    <div className="pt-8">
      <Stagger className="space-y-5" gap={0.08}>
        <Reveal>
          <p className="text-sm font-medium text-accent">Your plan is ready</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight">
            Here&rsquo;s what a day looks like
          </h1>
        </Reveal>

        <Reveal variant="pop">
          <Card className="overflow-hidden p-0">
            <div className="p-6 text-center">
              <CardLabel>Daily energy</CardLabel>
              <div className="mt-2 flex items-baseline justify-center gap-1.5">
                <CountUp
                  value={targets.calories}
                  duration={1.2}
                  className="tnum text-[3.25rem] font-semibold leading-none tracking-tight"
                />
                <span className="text-lg text-tertiary">kcal</span>
              </div>

              <motion.div
                className="mt-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...springSoft, delay: 0.5 }}
              >
                <MacroSplitBar targets={targets} />
              </motion.div>
            </div>

            <div className="grid grid-cols-4 border-t border-line">
              <MacroCell label="Protein" value={targets.protein} channel="protein" delay={0.6} />
              <MacroCell label="Carbs" value={targets.carbs} channel="carbs" delay={0.68} />
              <MacroCell label="Fat" value={targets.fat} channel="fat" delay={0.76} />
              <MacroCell label="Fibre" value={targets.fiber} channel="fiber" delay={0.84} />
            </div>
          </Card>
        </Reveal>

        <Reveal>
          <Card tier={2}>
            <CardLabel>How we got there</CardLabel>
            <div className="mt-3 space-y-2.5 text-sm">
              <DerivationRow
                label="At complete rest"
                detail="Mifflin-St Jeor equation"
                value={`${bmr.toLocaleString()} kcal`}
              />
              <DerivationRow
                label="With your activity"
                detail="Training and daily movement"
                value={`${tdee.toLocaleString()} kcal`}
              />
              <DerivationRow
                label={adjustment === 0 ? "No adjustment" : "Goal adjustment"}
                detail={goalDetail(goal)}
                value={
                  adjustment === 0
                    ? "—"
                    : `${adjustment > 0 ? "+" : ""}${adjustment.toLocaleString()} kcal`
                }
                emphasis
              />
            </div>
          </Card>
        </Reveal>

        <Reveal>
          <p className="px-1 text-xs leading-relaxed text-tertiary">
            These are a starting point, not a verdict. NutrixOS watches how your
            weight actually responds and adjusts the numbers as it learns — no
            equation predicts a real metabolism perfectly.
          </p>
        </Reveal>

        <Reveal>
          <Button size="lg" block onClick={onStart}>
            Start tracking
            <ArrowRight size={16} />
          </Button>
        </Reveal>
      </Stagger>
    </div>
  );
}

function MacroCell({
  label,
  value,
  channel,
  delay,
}: {
  label: string;
  value: number;
  channel: "protein" | "carbs" | "fat" | "fiber";
  delay: number;
}) {
  const color = {
    protein: "bg-protein",
    carbs: "bg-carbs",
    fat: "bg-fat",
    fiber: "bg-fiber",
  }[channel];

  return (
    <motion.div
      className="border-r border-line px-2 py-3.5 text-center last:border-r-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay }}
    >
      <span className={`mx-auto mb-1.5 block size-1.5 rounded-full ${color}`} />
      <CountUp
        value={value}
        duration={0.8}
        suffix="g"
        className="tnum block text-base font-semibold tracking-tight"
      />
      <span className="mt-0.5 block text-[0.6875rem] text-tertiary">{label}</span>
    </motion.div>
  );
}

function DerivationRow({
  label,
  detail,
  value,
  emphasis,
}: {
  label: string;
  detail: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={emphasis ? "font-medium text-primary" : "text-primary"}>
          {label}
        </p>
        <p className="text-xs text-tertiary">{detail}</p>
      </div>
      <span
        className={`tnum shrink-0 ${emphasis ? "font-semibold text-accent" : "text-secondary"}`}
      >
        {value}
      </span>
    </div>
  );
}

function goalDetail(goal: Goal): string {
  if (goal.type === "lose_fat") return `A ${goal.pace} deficit for fat loss`;
  if (goal.type === "gain_muscle") return `A ${goal.pace} surplus to build`;
  if (goal.type === "improve_nutrition") return "Maintenance, with more fibre";
  return "Eating at maintenance";
}
