import type {
  DietaryPattern,
  EntryItem,
  GoalType,
  MealSlot,
  NutritionTargets,
  NutritionTotals,
} from "@/core/nutrition/types";

/* ============================================================================
   Copilot contract
   ----------------------------------------------------------------------------
   The AI layer is defined as an interface first. The UI depends on this
   contract, never on the model provider, so the app runs end-to-end against
   deterministic mocks and switches to live inference by swapping the
   implementation — no call sites change.
   ========================================================================== */

/** Everything the model needs to know about the user to answer well. */
export interface CopilotContext {
  goal: GoalType;
  dietaryPattern: DietaryPattern;
  allergies?: string[];
  targets: NutritionTargets;
  consumedSoFar: NutritionTotals;
  /** Local time of day, so "breakfast" vs "dinner" can be inferred. */
  localTime: string;
}

export interface ParsedMeal {
  items: EntryItem[];
  slot: MealSlot;
  totals: NutritionTargets;
  /**
   * Judgement calls the model made that the user should be able to see and
   * correct — "assumed a medium egg", "assumed cooked weight". Surfacing these
   * is what makes an estimate trustworthy instead of a black box.
   */
  assumptions: string[];
  /**
   * Set when the input is too vague to estimate responsibly. The UI asks this
   * instead of inventing numbers.
   */
  clarification?: string;
  /** 0–1, aggregate confidence across items. */
  confidence: number;
}

export interface CoachInsight {
  /** One short sentence. The headline the user reads first. */
  headline: string;
  /** Two or three sentences of reasoning behind the headline. */
  body: string;
  /** Concrete, immediately actionable next steps. */
  suggestions: string[];
  /** Drives the accent colour of the insight card. */
  tone: "positive" | "neutral" | "warning";
}

export interface NutritionCopilot {
  /** Natural language in ("two eggs and toast"), structured macros out. */
  parseMeal(input: string, context: CopilotContext): Promise<ParsedMeal>;

  /** A photo of a meal in, structured macros out. */
  parsePhoto(
    image: { base64: string; mediaType: string },
    note: string | undefined,
    context: CopilotContext,
  ): Promise<ParsedMeal>;

  /** Reads the day so far and says something useful about it. */
  dailyInsight(context: CopilotContext): Promise<CoachInsight>;
}
