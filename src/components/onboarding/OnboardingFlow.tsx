"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Flame,
  Leaf,
  Scale,
  Sparkles,
  TrendingUp,
  Dumbbell,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { OptionCard } from "@/components/ui/OptionCard";
import { Segmented } from "@/components/ui/Segmented";
import { MeasureInput } from "@/components/ui/MeasureInput";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { TargetReveal } from "./TargetReveal";
import { spring, slideVariants } from "@/lib/motion";
import { ACTIVITY_COPY, deriveTargets } from "@/core/nutrition/targets";
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from "@/core/nutrition/units";
import type {
  ActivityLevel,
  DietaryPattern,
  Goal,
  GoalPace,
  GoalType,
  Sex,
  UnitSystem,
  UserProfile,
} from "@/core/nutrition/types";

/* ============================================================================
   Onboarding
   ----------------------------------------------------------------------------
   Six steps, each asking for one thing. Every field starts at a plausible
   default so the flow can be completed by tapping Continue — nothing is
   required before the user sees value, and every answer only sharpens the
   numbers they get at the end.
   ========================================================================== */

const STEPS = ["goal", "basics", "body", "activity", "diet", "reveal"] as const;
type Step = (typeof STEPS)[number];

const GOALS: Array<{
  value: GoalType;
  title: string;
  detail: string;
  icon: React.ReactNode;
}> = [
  {
    value: "lose_fat",
    title: "Lose body fat",
    detail: "A managed deficit that protects muscle",
    icon: <TrendingUp size={20} />,
  },
  {
    value: "gain_muscle",
    title: "Gain muscle",
    detail: "A controlled surplus with high protein",
    icon: <Dumbbell size={20} />,
  },
  {
    value: "maintain",
    title: "Maintain weight",
    detail: "Hold steady and eat consistently",
    icon: <Scale size={20} />,
  },
  {
    value: "improve_nutrition",
    title: "Eat better",
    detail: "Same weight, better fuel and more fibre",
    icon: <Leaf size={20} />,
  },
];

const DIETS: Array<{ value: DietaryPattern; title: string; detail: string }> = [
  { value: "omnivore", title: "No restrictions", detail: "Everything is on the table" },
  { value: "vegetarian", title: "Vegetarian", detail: "No meat or fish" },
  { value: "vegan", title: "Vegan", detail: "No animal products at all" },
  { value: "pescatarian", title: "Pescatarian", detail: "Fish, but no other meat" },
  { value: "mediterranean", title: "Mediterranean", detail: "Fish, olive oil, whole grains" },
  { value: "keto", title: "Keto", detail: "Very low carbohydrate" },
];

const PACES: Array<{ value: GoalPace; label: string }> = [
  { value: "gentle", label: "Gentle" },
  { value: "steady", label: "Steady" },
  { value: "aggressive", label: "Fast" },
];

export function OnboardingFlow({
  onComplete,
}: {
  onComplete: (profile: UserProfile, goal: Goal) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  // Tracked so step transitions slide in the direction of travel.
  const [direction, setDirection] = useState(1);

  const [goalType, setGoalType] = useState<GoalType>("lose_fat");
  const [pace, setPace] = useState<GoalPace>("steady");
  const [sex, setSex] = useState<Sex>("female");
  const [age, setAge] = useState(30);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [dietaryPattern, setDietaryPattern] = useState<DietaryPattern>("omnivore");

  const step: Step = STEPS[stepIndex];

  const profile = useMemo<UserProfile>(
    () => ({ age, sex, heightCm, weightKg, activityLevel, dietaryPattern, unitSystem }),
    [age, sex, heightCm, weightKg, activityLevel, dietaryPattern, unitSystem],
  );

  const goal = useMemo<Goal>(() => ({ type: goalType, pace }), [goalType, pace]);
  const targets = useMemo(() => deriveTargets(profile, goal), [profile, goal]);

  const go = (delta: number) => {
    setDirection(delta);
    setStepIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)));
  };

  // Pace only applies where there's a direction to move in.
  const showsPace = goalType === "lose_fat" || goalType === "gain_muscle";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 frost px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex w-full max-w-[32rem] items-center gap-3">
          <AnimatePresence mode="popLayout">
            {stepIndex > 0 && step !== "reveal" && (
              <motion.button
                type="button"
                aria-label="Back"
                onClick={() => go(-1)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={spring}
                className="flex size-8 items-center justify-center rounded-full text-secondary hover:bg-surface-2"
              >
                <ArrowLeft size={18} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Progress. A shared layout animation makes the fill travel rather
              than jump, which reads as forward motion through the flow. */}
          <div className="h-1 flex-1 overflow-hidden rounded-pill bg-track">
            <motion.div
              className="h-full rounded-pill bg-accent"
              initial={false}
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={spring}
            />
          </div>

          <span className="tnum text-xs font-medium text-tertiary">
            {stepIndex + 1}/{STEPS.length}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[32rem] flex-1 px-5 pb-32">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {step === "goal" && (
              <StepBody
                title="What are you working toward?"
                subtitle="This shapes every number that follows."
              >
                <Stagger className="space-y-2.5" gap={0.045}>
                  {GOALS.map((option) => (
                    <Reveal key={option.value} variant="pop">
                      <OptionCard
                        selected={goalType === option.value}
                        onSelect={() => setGoalType(option.value)}
                        title={option.title}
                        detail={option.detail}
                        icon={option.icon}
                      />
                    </Reveal>
                  ))}
                </Stagger>

                <AnimatePresence>
                  {showsPace && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={spring}
                      className="overflow-hidden"
                    >
                      <div className="pt-5">
                        <p className="mb-2 text-sm font-medium text-secondary">
                          How quickly?
                        </p>
                        <Segmented options={PACES} value={pace} onChange={setPace} />
                        <p className="mt-2 text-xs text-tertiary">
                          {paceCopy(goalType, pace)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </StepBody>
            )}

            {step === "basics" && (
              <StepBody
                title="A little about you"
                subtitle="Age and sex change your energy needs meaningfully."
              >
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-secondary">Sex</p>
                    <Segmented
                      options={[
                        { value: "female", label: "Female" },
                        { value: "male", label: "Male" },
                      ]}
                      value={sex}
                      onChange={setSex}
                    />
                    <p className="mt-2 text-xs text-tertiary">
                      Used only for the metabolic equation, which is calibrated
                      separately for each.
                    </p>
                  </div>

                  <MeasureInput
                    label="Age"
                    value={age}
                    onChange={setAge}
                    unit="years"
                    min={14}
                    max={100}
                  />
                </div>
              </StepBody>
            )}

            {step === "body" && (
              <StepBody
                title="Height and weight"
                subtitle="The base for your energy and protein targets."
              >
                <div className="space-y-4">
                  <Segmented
                    options={[
                      { value: "metric", label: "Metric" },
                      { value: "imperial", label: "Imperial" },
                    ]}
                    value={unitSystem}
                    onChange={setUnitSystem}
                  />

                  {unitSystem === "metric" ? (
                    <>
                      <MeasureInput
                        label="Height"
                        value={Math.round(heightCm)}
                        onChange={setHeightCm}
                        unit="cm"
                        min={130}
                        max={220}
                      />
                      <MeasureInput
                        label="Weight"
                        value={Number(weightKg.toFixed(1))}
                        onChange={setWeightKg}
                        unit="kg"
                        min={35}
                        max={200}
                        step={0.5}
                        decimals={1}
                      />
                    </>
                  ) : (
                    <>
                      <MeasureInput
                        label="Height"
                        value={Math.round(cmToFeetInches(heightCm).feet * 12 + cmToFeetInches(heightCm).inches)}
                        onChange={(totalInches) =>
                          setHeightCm(feetInchesToCm(0, totalInches))
                        }
                        unit="in"
                        min={51}
                        max={87}
                      />
                      <MeasureInput
                        label="Weight"
                        value={Number(kgToLb(weightKg).toFixed(1))}
                        onChange={(lb) => setWeightKg(lbToKg(lb))}
                        unit="lb"
                        min={77}
                        max={440}
                        step={1}
                        decimals={1}
                      />
                    </>
                  )}
                </div>
              </StepBody>
            )}

            {step === "activity" && (
              <StepBody
                title="How active are you?"
                subtitle="Count deliberate training, not incidental steps."
              >
                <Stagger className="space-y-2.5" gap={0.045}>
                  {(Object.keys(ACTIVITY_COPY) as ActivityLevel[]).map((level) => (
                    <Reveal key={level} variant="pop">
                      <OptionCard
                        selected={activityLevel === level}
                        onSelect={() => setActivityLevel(level)}
                        title={ACTIVITY_COPY[level].label}
                        detail={ACTIVITY_COPY[level].detail}
                        icon={<Flame size={20} />}
                      />
                    </Reveal>
                  ))}
                </Stagger>
              </StepBody>
            )}

            {step === "diet" && (
              <StepBody
                title="How do you eat?"
                subtitle="Your copilot will only ever suggest food that fits."
              >
                <Stagger className="space-y-2.5" gap={0.04}>
                  {DIETS.map((option) => (
                    <Reveal key={option.value} variant="pop">
                      <OptionCard
                        selected={dietaryPattern === option.value}
                        onSelect={() => setDietaryPattern(option.value)}
                        title={option.title}
                        detail={option.detail}
                      />
                    </Reveal>
                  ))}
                </Stagger>
              </StepBody>
            )}

            {step === "reveal" && (
              <TargetReveal
                targets={targets}
                profile={profile}
                goal={goal}
                onStart={() => onComplete(profile, goal)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {step !== "reveal" && (
        <div className="fixed inset-x-0 bottom-0 z-10 frost px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-[32rem]">
            <Button size="lg" block onClick={() => go(1)}>
              Continue
              <Sparkles size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepBody({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-8">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">
        {title}
      </h1>
      <p className="mt-1.5 mb-6 text-secondary">{subtitle}</p>
      {children}
    </div>
  );
}

function paceCopy(goalType: GoalType, pace: GoalPace): string {
  const rate = {
    gentle: goalType === "lose_fat" ? "0.25 kg" : "0.12 kg",
    steady: goalType === "lose_fat" ? "0.5 kg" : "0.25 kg",
    aggressive: goalType === "lose_fat" ? "0.75 kg" : "0.4 kg",
  }[pace];

  const direction = goalType === "lose_fat" ? "loss" : "gain";
  const caution =
    pace === "aggressive" && goalType === "lose_fat"
      ? " Harder to sustain, and more of the loss comes from muscle."
      : "";

  return `About ${rate} of ${direction} per week.${caution}`;
}
