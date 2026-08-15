/* ============================================================================
   Nutrition domain types
   ----------------------------------------------------------------------------
   The vocabulary the whole app shares. These types are storage-agnostic and
   transport-agnostic on purpose: the targets engine, the AI layer, the UI, and
   the Supabase mappers all speak this language, so none of them depend on each
   other's shape.
   ========================================================================== */

export type Sex = "male" | "female";

/**
 * Activity level maps to a TDEE multiplier. Labels describe weekly training
 * volume because users estimate that far more reliably than "activity factor".
 */
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "athlete";

export type GoalType =
  | "lose_fat"
  | "maintain"
  | "gain_muscle"
  | "improve_nutrition"
  | "custom";

/** How aggressively to pursue a fat-loss or muscle-gain goal. */
export type GoalPace = "gentle" | "steady" | "aggressive";

export type DietaryPattern =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "keto"
  | "paleo"
  | "mediterranean";

export type UnitSystem = "metric" | "imperial";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

/** The five channels the UI renders as rings. Order is display order. */
export const MACRO_CHANNELS = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
] as const;

export type MacroChannel = (typeof MACRO_CHANNELS)[number];

/**
 * A complete set of daily targets.
 * `calories` is kcal; every macro is grams.
 */
export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** Millilitres of water per day. */
  water: number;
}

/** The same five channels, as consumed-so-far totals. */
export type NutritionTotals = NutritionTargets;

export interface UserProfile {
  age: number;
  sex: Sex;
  /** Centimetres. */
  heightCm: number;
  /** Kilograms. */
  weightKg: number;
  activityLevel: ActivityLevel;
  dietaryPattern: DietaryPattern;
  /** Free-text restrictions the AI should honour, e.g. "no shellfish". */
  allergies?: string[];
  unitSystem: UnitSystem;
}

export interface Goal {
  type: GoalType;
  pace: GoalPace;
  /** Target body weight in kg. Optional — not every goal has one. */
  targetWeightKg?: number;
  /**
   * Only meaningful when `type` is "custom": the user has dictated their own
   * numbers and the engine should pass them through untouched.
   */
  customTargets?: Partial<NutritionTargets>;
}

/** A single food within a logged entry. */
export interface EntryItem {
  id: string;
  name: string;
  /** Human-readable portion as the user expressed it, e.g. "1 cup cooked". */
  portion: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** 0–1. How sure the AI is about this item's macros. Drives the UI. */
  confidence: number;
}

export interface LogEntry {
  id: string;
  loggedAt: string;
  slot: MealSlot;
  /** What the user actually typed or said, preserved verbatim. */
  rawInput: string;
  source: "text" | "voice" | "photo" | "manual" | "recipe";
  items: EntryItem[];
  /** Populated from `items`; stored denormalised for fast day rollups. */
  totals: NutritionTargets;
  photoUrl?: string;
}

/** Derived per-channel progress, ready for the ring components to render. */
export interface ChannelProgress {
  channel: MacroChannel;
  consumed: number;
  target: number;
  remaining: number;
  /** consumed / target, unclamped so overshoot is visible. */
  ratio: number;
  unit: "kcal" | "g";
}
