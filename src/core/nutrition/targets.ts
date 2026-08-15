import type {
  ActivityLevel,
  ChannelProgress,
  Goal,
  GoalPace,
  MacroChannel,
  NutritionTargets,
  NutritionTotals,
  UserProfile,
} from "./types";

/* ============================================================================
   Targets engine
   ----------------------------------------------------------------------------
   Turns a profile and a goal into daily numbers. Pure functions only: same
   inputs, same outputs, no clock and no I/O, so this is trivially testable and
   safe to run on either the server or the client.

   References for the constants used here:
     - BMR: Mifflin-St Jeor (1990), the current standard for predictive equations
     - Activity multipliers: conventional Harris-Benedict style factors
     - Fibre: ~14 g per 1000 kcal (Institute of Medicine)
     - Protein: 1.4–2.2 g/kg spans the evidence-supported range for active adults
   ========================================================================== */

/** Multipliers applied to BMR to reach total daily energy expenditure. */
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_COPY: Record<
  ActivityLevel,
  { label: string; detail: string }
> = {
  sedentary: { label: "Sedentary", detail: "Desk job, little planned exercise" },
  light: { label: "Light", detail: "Light movement 1–3 days a week" },
  moderate: { label: "Moderate", detail: "Training 3–5 days a week" },
  active: { label: "Active", detail: "Hard training 6–7 days a week" },
  athlete: { label: "Athlete", detail: "Twice-daily or physical job" },
};

/**
 * Energy adjustment as a fraction of TDEE, by goal and pace.
 * Negative is a deficit, positive is a surplus.
 */
const ENERGY_DELTA: Record<GoalPace, { lose: number; gain: number }> = {
  gentle: { lose: -0.1, gain: 0.05 },
  steady: { lose: -0.2, gain: 0.1 },
  aggressive: { lose: -0.25, gain: 0.15 },
};

/**
 * Protein in grams per kg of bodyweight. Fat loss gets the most because
 * protein preserves lean mass in a deficit and is the most satiating macro.
 */
const PROTEIN_PER_KG: Record<Goal["type"], number> = {
  lose_fat: 2.0,
  gain_muscle: 1.8,
  maintain: 1.6,
  improve_nutrition: 1.4,
  custom: 1.6,
};

/** Fraction of total calories allocated to fat, before the per-kg floor. */
const FAT_FRACTION: Record<Goal["type"], number> = {
  lose_fat: 0.27,
  gain_muscle: 0.25,
  maintain: 0.3,
  improve_nutrition: 0.3,
  custom: 0.3,
};

/** Hard floors. Below these, a target is not a plan, it is a health risk. */
const MIN_CALORIES = { male: 1500, female: 1200 } as const;
/** Dietary fat below ~0.5 g/kg risks hormonal and absorption problems. */
const MIN_FAT_PER_KG = 0.6;

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Basal metabolic rate via Mifflin-St Jeor.
 * Returns kcal/day burned at complete rest.
 */
export function basalMetabolicRate(profile: UserProfile): number {
  const { weightKg, heightCm, age, sex } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

/** Total daily energy expenditure: BMR scaled by habitual activity. */
export function totalDailyEnergyExpenditure(profile: UserProfile): number {
  return basalMetabolicRate(profile) * ACTIVITY_MULTIPLIER[profile.activityLevel];
}

/**
 * The bodyweight protein and fat floors are anchored to.
 *
 * Adipose tissue has little protein requirement, so scaling protein linearly
 * off total mass over-prescribes badly at high BMI — it can crowd out nearly
 * all the carbohydrate in a deficit. Above a BMI of 27.5 this falls back to
 * the standard adjusted-bodyweight formula: the weight at BMI 27.5, plus a
 * quarter of the excess.
 */
export function referenceWeightKg(profile: UserProfile): number {
  const heightM = profile.heightCm / 100;
  const bmi = profile.weightKg / (heightM * heightM);
  if (bmi <= 27.5) return profile.weightKg;

  const cappedWeight = 27.5 * heightM * heightM;
  return cappedWeight + 0.25 * (profile.weightKg - cappedWeight);
}

/**
 * The energy target for a goal, before macro splitting.
 * Clamped so a deficit never drops below the sex-specific floor.
 */
export function calorieTarget(profile: UserProfile, goal: Goal): number {
  const tdee = totalDailyEnergyExpenditure(profile);
  const delta = ENERGY_DELTA[goal.pace];

  let calories = tdee;
  if (goal.type === "lose_fat") calories = tdee * (1 + delta.lose);
  else if (goal.type === "gain_muscle") calories = tdee * (1 + delta.gain);

  return Math.max(calories, MIN_CALORIES[profile.sex]);
}

/**
 * Derive a full set of daily targets.
 *
 * Order matters: protein is anchored to bodyweight first, fat takes a
 * percentage of energy with a per-kg floor, and carbohydrate absorbs whatever
 * energy remains. That ordering is deliberate — protein and fat have floors
 * driven by physiology, carbohydrate is the flexible fuel.
 */
export function deriveTargets(profile: UserProfile, goal: Goal): NutritionTargets {
  const calories = Math.round(calorieTarget(profile, goal));
  const refWeight = referenceWeightKg(profile);

  const protein = Math.round(PROTEIN_PER_KG[goal.type] * refWeight);

  const fatFromFraction = (calories * FAT_FRACTION[goal.type]) / KCAL_PER_G.fat;
  const fatFloor = MIN_FAT_PER_KG * refWeight;
  const fat = Math.round(Math.max(fatFromFraction, fatFloor));

  const energyFromProtein = protein * KCAL_PER_G.protein;
  const energyFromFat = fat * KCAL_PER_G.fat;
  const carbEnergy = Math.max(0, calories - energyFromProtein - energyFromFat);
  const carbs = Math.round(carbEnergy / KCAL_PER_G.carbs);

  // 14 g per 1000 kcal, held to a sane band so very low or very high energy
  // targets don't produce an unreachable or pointless fibre number.
  const fiber = Math.round(clamp((calories / 1000) * 14, 20, 50));

  // ~35 ml/kg is the common clinical starting point for adults.
  const water = Math.round((profile.weightKg * 35) / 50) * 50;

  const derived: NutritionTargets = {
    calories,
    protein,
    carbs,
    fat,
    fiber,
    water,
  };

  // A custom goal means the user has overridden us. Honour exactly what they
  // set and keep the derived value for anything they left blank.
  if (goal.type === "custom" && goal.customTargets) {
    return { ...derived, ...stripUndefined(goal.customTargets) };
  }

  return derived;
}

/** What share of total energy each macro contributes. Useful for the split bar. */
export function macroSplit(targets: NutritionTargets) {
  const p = targets.protein * KCAL_PER_G.protein;
  const c = targets.carbs * KCAL_PER_G.carbs;
  const f = targets.fat * KCAL_PER_G.fat;
  const total = p + c + f || 1;
  return {
    protein: p / total,
    carbs: c / total,
    fat: f / total,
  };
}

/** Sum any number of macro totals into one. */
export function sumTotals(
  entries: ReadonlyArray<Partial<NutritionTotals>>,
): NutritionTotals {
  return entries.reduce<NutritionTotals>(
    (acc, e) => ({
      calories: acc.calories + (e.calories ?? 0),
      protein: acc.protein + (e.protein ?? 0),
      carbs: acc.carbs + (e.carbs ?? 0),
      fat: acc.fat + (e.fat ?? 0),
      fiber: acc.fiber + (e.fiber ?? 0),
      water: acc.water + (e.water ?? 0),
    }),
    emptyTotals(),
  );
}

export function emptyTotals(): NutritionTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, water: 0 };
}

/**
 * Per-channel progress for the ring UI.
 * `ratio` is intentionally unclamped so the UI can show overshoot.
 */
export function channelProgress(
  totals: NutritionTotals,
  targets: NutritionTargets,
): ChannelProgress[] {
  const channels: Array<{ channel: MacroChannel; unit: "kcal" | "g" }> = [
    { channel: "calories", unit: "kcal" },
    { channel: "protein", unit: "g" },
    { channel: "carbs", unit: "g" },
    { channel: "fat", unit: "g" },
    { channel: "fiber", unit: "g" },
  ];

  return channels.map(({ channel, unit }) => {
    const consumed = totals[channel];
    const target = targets[channel];
    return {
      channel,
      consumed,
      target,
      remaining: target - consumed,
      ratio: target > 0 ? consumed / target : 0,
      unit,
    };
  });
}

/**
 * Project where the day lands if the user keeps eating at the current rate.
 *
 * Early in the day a naive linear extrapolation is wildly unstable — 300 kcal
 * at 8am extrapolates to an absurd daily total. So the projection blends the
 * observed pace with the target, weighted by how much of the eating window has
 * elapsed. Late in the day the observed pace dominates; early on the target does.
 *
 * @param minutesElapsed Minutes since the eating window opened.
 * @param windowMinutes  Length of the typical eating window.
 */
export function projectEndOfDay(
  totals: NutritionTotals,
  targets: NutritionTargets,
  minutesElapsed: number,
  windowMinutes = 14 * 60,
): NutritionTotals {
  const progress = clamp(minutesElapsed / windowMinutes, 0.01, 1);
  const confidence = progress; // trust the observed pace more as the day fills in

  const project = (consumed: number, target: number) => {
    const paceProjection = consumed / progress;
    return Math.round(paceProjection * confidence + target * (1 - confidence));
  };

  return {
    calories: project(totals.calories, targets.calories),
    protein: project(totals.protein, targets.protein),
    carbs: project(totals.carbs, targets.carbs),
    fat: project(totals.fat, targets.fat),
    fiber: project(totals.fiber, targets.fiber),
    water: project(totals.water, targets.water),
  };
}

/**
 * Adapt the calorie target to observed reality.
 *
 * Predictive equations are estimates; a real person's expenditure can sit 10%
 * either side of them. If measured weight change diverges from what the goal
 * implies, nudge energy to close the gap. Adjustments are capped at 10% per
 * cycle so the plan drifts rather than lurches.
 *
 * @param actualWeeklyChangeKg Measured change from a smoothed weight trend.
 */
export function adaptCalorieTarget(
  current: NutritionTargets,
  goal: Goal,
  actualWeeklyChangeKg: number,
  profile: UserProfile,
): { calories: number; deltaKcal: number; rationale: string } {
  const expected = expectedWeeklyChangeKg(goal);
  const drift = actualWeeklyChangeKg - expected;

  // ~7700 kcal per kg of body mass, spread across seven days.
  const rawDelta = (-drift * 7700) / 7;
  const cap = current.calories * 0.1;
  const deltaKcal = Math.round(clamp(rawDelta, -cap, cap));

  const calories = Math.max(
    Math.round(current.calories + deltaKcal),
    MIN_CALORIES[profile.sex],
  );

  let rationale: string;
  if (Math.abs(drift) < 0.1) {
    rationale = "Your weight trend matches the plan. Holding targets steady.";
  } else if (deltaKcal < 0) {
    rationale = `Progress is slower than planned, so energy comes down by ${Math.abs(deltaKcal)} kcal.`;
  } else {
    rationale = `Progress is faster than planned, so energy goes up by ${deltaKcal} kcal to protect lean mass.`;
  }

  return { calories, deltaKcal: calories - current.calories, rationale };
}

/** Weight change per week the goal implies, in kg. */
export function expectedWeeklyChangeKg(goal: Goal): number {
  if (goal.type === "lose_fat") {
    return { gentle: -0.25, steady: -0.5, aggressive: -0.75 }[goal.pace];
  }
  if (goal.type === "gain_muscle") {
    return { gentle: 0.12, steady: 0.25, aggressive: 0.4 }[goal.pace];
  }
  return 0;
}

/* -- helpers --------------------------------------------------------------- */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
