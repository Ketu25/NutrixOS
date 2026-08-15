import { describe, expect, it } from "vitest";
import {
  adaptCalorieTarget,
  basalMetabolicRate,
  calorieTarget,
  channelProgress,
  deriveTargets,
  KCAL_PER_G,
  macroSplit,
  projectEndOfDay,
  referenceWeightKg,
  sumTotals,
  totalDailyEnergyExpenditure,
} from "./targets";
import type { Goal, UserProfile } from "./types";

const male: UserProfile = {
  age: 30,
  sex: "male",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  dietaryPattern: "omnivore",
  unitSystem: "metric",
};

const female: UserProfile = {
  age: 30,
  sex: "female",
  heightCm: 165,
  weightKg: 65,
  activityLevel: "light",
  dietaryPattern: "omnivore",
  unitSystem: "metric",
};

const goal = (over: Partial<Goal> = {}): Goal => ({
  type: "maintain",
  pace: "steady",
  ...over,
});

describe("basalMetabolicRate", () => {
  it("matches Mifflin-St Jeor for men", () => {
    // 10(80) + 6.25(180) - 5(30) + 5
    expect(basalMetabolicRate(male)).toBeCloseTo(1780, 5);
  });

  it("matches Mifflin-St Jeor for women", () => {
    // 10(65) + 6.25(165) - 5(30) - 161
    expect(basalMetabolicRate(female)).toBeCloseTo(1370.25, 5);
  });
});

describe("totalDailyEnergyExpenditure", () => {
  it("scales BMR by the activity multiplier", () => {
    expect(totalDailyEnergyExpenditure(male)).toBeCloseTo(1780 * 1.55, 5);
  });

  it("increases monotonically with activity level", () => {
    const levels = ["sedentary", "light", "moderate", "active", "athlete"] as const;
    const values = levels.map((activityLevel) =>
      totalDailyEnergyExpenditure({ ...male, activityLevel }),
    );
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });
});

describe("calorieTarget", () => {
  it("applies a deficit for fat loss", () => {
    const target = calorieTarget(male, goal({ type: "lose_fat" }));
    expect(target).toBeCloseTo(1780 * 1.55 * 0.8, 5);
  });

  it("applies a surplus for muscle gain", () => {
    const target = calorieTarget(male, goal({ type: "gain_muscle" }));
    expect(target).toBeCloseTo(1780 * 1.55 * 1.1, 5);
  });

  it("leaves maintenance at TDEE", () => {
    expect(calorieTarget(male, goal())).toBeCloseTo(totalDailyEnergyExpenditure(male), 5);
  });

  it("never drops below the safety floor", () => {
    // Small, sedentary, aggressive deficit: the raw maths would go under 1200.
    const tiny: UserProfile = {
      ...female,
      weightKg: 42,
      heightCm: 150,
      age: 65,
      activityLevel: "sedentary",
    };
    const target = calorieTarget(tiny, goal({ type: "lose_fat", pace: "aggressive" }));
    expect(target).toBe(1200);
  });
});

describe("referenceWeightKg", () => {
  it("passes through unchanged at a normal BMI", () => {
    expect(referenceWeightKg(male)).toBe(80);
  });

  it("damps the excess above BMI 27.5", () => {
    const heavy: UserProfile = { ...male, weightKg: 150, heightCm: 175 };
    const ref = referenceWeightKg(heavy);
    expect(ref).toBeGreaterThan(84); // above the BMI-27.5 weight
    expect(ref).toBeLessThan(150); // but well below raw bodyweight
  });
});

describe("deriveTargets", () => {
  it("produces macros whose energy reconstructs the calorie target", () => {
    const t = deriveTargets(male, goal({ type: "lose_fat" }));
    const energy =
      t.protein * KCAL_PER_G.protein +
      t.carbs * KCAL_PER_G.carbs +
      t.fat * KCAL_PER_G.fat;
    // Rounding each macro to whole grams costs a few kcal; anything larger
    // means carbohydrate is not absorbing the remainder correctly.
    expect(Math.abs(energy - t.calories)).toBeLessThanOrEqual(6);
  });

  it("gives fat loss more protein than general nutrition", () => {
    const cut = deriveTargets(male, goal({ type: "lose_fat" }));
    const general = deriveTargets(male, goal({ type: "improve_nutrition" }));
    expect(cut.protein).toBeGreaterThan(general.protein);
  });

  it("keeps carbohydrate positive under an aggressive cut at high BMI", () => {
    // This is the case that fails if protein scales off raw bodyweight.
    const heavy: UserProfile = {
      ...male,
      weightKg: 150,
      heightCm: 175,
      activityLevel: "sedentary",
    };
    const t = deriveTargets(heavy, goal({ type: "lose_fat", pace: "aggressive" }));
    expect(t.carbs).toBeGreaterThan(0);
  });

  it("respects the dietary fat floor for a lean person on a deep cut", () => {
    const lean: UserProfile = { ...male, weightKg: 60 };
    const t = deriveTargets(lean, goal({ type: "lose_fat", pace: "aggressive" }));
    expect(t.fat).toBeGreaterThanOrEqual(Math.round(0.6 * 60));
  });

  it("holds fibre inside its band", () => {
    const t = deriveTargets(male, goal());
    expect(t.fiber).toBeGreaterThanOrEqual(20);
    expect(t.fiber).toBeLessThanOrEqual(50);
  });

  it("passes custom overrides through untouched", () => {
    const t = deriveTargets(
      male,
      goal({ type: "custom", customTargets: { calories: 2500, protein: 200 } }),
    );
    expect(t.calories).toBe(2500);
    expect(t.protein).toBe(200);
    // Anything the user left blank still comes from the engine.
    expect(t.fiber).toBeGreaterThan(0);
  });
});

describe("macroSplit", () => {
  it("sums to one", () => {
    const split = macroSplit(deriveTargets(male, goal()));
    expect(split.protein + split.carbs + split.fat).toBeCloseTo(1, 6);
  });
});

describe("sumTotals", () => {
  it("adds entries channel by channel", () => {
    const total = sumTotals([
      { calories: 500, protein: 40 },
      { calories: 300, protein: 20, fiber: 8 },
    ]);
    expect(total.calories).toBe(800);
    expect(total.protein).toBe(60);
    expect(total.fiber).toBe(8);
    expect(total.carbs).toBe(0);
  });

  it("returns zeros for no entries", () => {
    expect(sumTotals([]).calories).toBe(0);
  });
});

describe("channelProgress", () => {
  it("reports remaining and an unclamped ratio so overshoot stays visible", () => {
    const targets = deriveTargets(male, goal());
    const totals = { ...targets, calories: targets.calories * 1.25 };
    const calories = channelProgress(totals, targets).find(
      (c) => c.channel === "calories",
    )!;
    expect(calories.ratio).toBeCloseTo(1.25, 5);
    expect(calories.remaining).toBeLessThan(0);
  });
});

describe("projectEndOfDay", () => {
  it("does not wildly extrapolate from a single early meal", () => {
    const targets = deriveTargets(male, goal());
    const totals = { ...sumTotals([]), calories: 400 };
    // 400 kcal one hour in. Naive extrapolation would project ~5600 kcal.
    const projected = projectEndOfDay(totals, targets, 60);
    expect(projected.calories).toBeLessThan(targets.calories * 1.3);
  });

  it("tracks the observed pace once the day is nearly over", () => {
    const targets = deriveTargets(male, goal());
    const totals = { ...sumTotals([]), calories: 3000 };
    const projected = projectEndOfDay(totals, targets, 14 * 60);
    expect(projected.calories).toBeCloseTo(3000, -1);
  });
});

describe("adaptCalorieTarget", () => {
  const cut = goal({ type: "lose_fat" });

  it("holds steady when the trend matches the plan", () => {
    const targets = deriveTargets(male, cut);
    const { deltaKcal } = adaptCalorieTarget(targets, cut, -0.5, male);
    expect(Math.abs(deltaKcal)).toBeLessThan(30);
  });

  it("cuts energy when fat loss stalls", () => {
    const targets = deriveTargets(male, cut);
    const { deltaKcal } = adaptCalorieTarget(targets, cut, 0, male);
    expect(deltaKcal).toBeLessThan(0);
  });

  it("raises energy when weight is dropping too fast", () => {
    const targets = deriveTargets(male, cut);
    const { deltaKcal } = adaptCalorieTarget(targets, cut, -1.5, male);
    expect(deltaKcal).toBeGreaterThan(0);
  });

  it("never moves more than 10% in one cycle", () => {
    const targets = deriveTargets(male, cut);
    const { deltaKcal } = adaptCalorieTarget(targets, cut, -5, male);
    expect(Math.abs(deltaKcal)).toBeLessThanOrEqual(
      Math.ceil(targets.calories * 0.1),
    );
  });

  it("still respects the safety floor while adapting downward", () => {
    const targets = { ...deriveTargets(female, cut), calories: 1250 };
    const { calories } = adaptCalorieTarget(targets, cut, 0.5, female);
    expect(calories).toBeGreaterThanOrEqual(1200);
  });
});
