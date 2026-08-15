import { sumTotals } from "@/core/nutrition/targets";
import type { EntryItem, MealSlot, NutritionTargets } from "@/core/nutrition/types";
import type {
  CoachInsight,
  CopilotContext,
  NutritionCopilot,
  ParsedMeal,
} from "./types";

/* ============================================================================
   Mock copilot
   ----------------------------------------------------------------------------
   Runs the whole product without an API key. This is not a stub that returns a
   fixed blob — it matches real foods, scales by quantity, infers the meal slot
   from the clock, and reports honest confidence, so every screen, animation,
   and empty state can be built and reviewed against plausible data.

   Swapping this for the Claude implementation changes one line in `index.ts`.
   ========================================================================== */

interface FoodFact {
  match: RegExp;
  name: string;
  unit: string;
  /** Macros for a single unit. */
  per: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  portion: string;
}

/** A small reference table — enough breadth to demo against, per common unit. */
const FOODS: FoodFact[] = [
  { match: /\begg/i, name: "Eggs", unit: "large", portion: "1 large", per: { calories: 72, protein: 6, carbs: 0, fat: 5, fiber: 0 } },
  { match: /\b(toast|bread|slice)/i, name: "Wholegrain toast", unit: "slice", portion: "1 slice", per: { calories: 82, protein: 4, carbs: 14, fat: 1, fiber: 2 } },
  { match: /\b(chicken breast|chicken)/i, name: "Chicken breast", unit: "100g", portion: "100g cooked", per: { calories: 165, protein: 31, carbs: 0, fat: 4, fiber: 0 } },
  { match: /\b(rice)/i, name: "Cooked rice", unit: "cup", portion: "1 cup cooked", per: { calories: 205, protein: 4, carbs: 45, fat: 0, fiber: 1 } },
  { match: /\b(oat|porridge|oatmeal)/i, name: "Oats", unit: "40g", portion: "40g dry", per: { calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4 } },
  { match: /\b(banana)/i, name: "Banana", unit: "medium", portion: "1 medium", per: { calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3 } },
  { match: /\b(apple)/i, name: "Apple", unit: "medium", portion: "1 medium", per: { calories: 95, protein: 0, carbs: 25, fat: 0, fiber: 4 } },
  { match: /\b(salmon)/i, name: "Salmon", unit: "100g", portion: "100g cooked", per: { calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 } },
  { match: /\b(greek yog|yogurt|yoghurt)/i, name: "Greek yoghurt", unit: "170g", portion: "170g pot", per: { calories: 100, protein: 17, carbs: 6, fat: 0, fiber: 0 } },
  { match: /\b(coffee|espresso|americano)/i, name: "Black coffee", unit: "cup", portion: "1 cup", per: { calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
  { match: /\b(salad|greens|spinach)/i, name: "Mixed leaf salad", unit: "bowl", portion: "1 bowl", per: { calories: 33, protein: 3, carbs: 6, fat: 0, fiber: 3 } },
  { match: /\b(pasta|spaghetti|penne)/i, name: "Cooked pasta", unit: "cup", portion: "1 cup cooked", per: { calories: 221, protein: 8, carbs: 43, fat: 1, fiber: 3 } },
  { match: /\b(avocado)/i, name: "Avocado", unit: "half", portion: "1/2 medium", per: { calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7 } },
  { match: /\b(protein shake|whey|protein powder)/i, name: "Protein shake", unit: "scoop", portion: "1 scoop", per: { calories: 120, protein: 24, carbs: 3, fat: 1, fiber: 0 } },
  { match: /\b(almond|nuts|walnut|cashew)/i, name: "Mixed nuts", unit: "30g", portion: "30g handful", per: { calories: 180, protein: 6, carbs: 6, fat: 16, fiber: 3 } },
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  half: 0.5, couple: 2, few: 3,
};

/** Pull the quantity that precedes a food mention, defaulting to one serving. */
function extractQuantity(input: string, match: RegExp): number {
  const found = input.match(match);
  if (!found?.index) return 1;

  const preceding = input.slice(Math.max(0, found.index - 24), found.index);
  const digit = preceding.match(/(\d+(?:\.\d+)?)\s*$/);
  if (digit) return Number(digit[1]);

  const word = preceding
    .toLowerCase()
    .match(/\b(a|an|one|two|three|four|five|six|half|couple|few)\b\s*(?:of\s+)?$/);
  if (word) return NUMBER_WORDS[word[1]] ?? 1;

  return 1;
}

function slotForTime(localTime: string): MealSlot {
  const hour = Number(localTime.split(":")[0]);
  if (Number.isNaN(hour)) return "snack";
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function simulateLatency(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockCopilot(): NutritionCopilot {
  const copilot: NutritionCopilot = {
    async parseMeal(input, context) {
      // Realistic latency, so loading states are exercised rather than skipped.
      await simulateLatency(700);

      const matched = FOODS.filter((food) => food.match.test(input));

      if (matched.length === 0) {
        return {
          items: [],
          slot: slotForTime(context.localTime),
          totals: emptyMealTotals(),
          assumptions: [],
          clarification:
            "I couldn't identify a food in that. What did you eat, and roughly how much?",
          confidence: 0,
        };
      }

      const items: EntryItem[] = matched.map((food) => {
        const quantity = extractQuantity(input, food.match);
        return {
          id: crypto.randomUUID(),
          name: food.name,
          portion: `${quantity} × ${food.portion}`,
          quantity,
          unit: food.unit,
          calories: Math.round(food.per.calories * quantity),
          protein: Math.round(food.per.protein * quantity),
          carbs: Math.round(food.per.carbs * quantity),
          fat: Math.round(food.per.fat * quantity),
          fiber: Math.round(food.per.fiber * quantity),
          // Explicit quantities are trusted more than inferred single servings.
          confidence: /\d/.test(input) ? 0.86 : 0.68,
        };
      });

      return {
        items,
        slot: slotForTime(context.localTime),
        totals: { ...sumTotals(items), water: 0 },
        assumptions: /\d/.test(input)
          ? ["Weights are treated as cooked."]
          : ["Assumed one standard serving of each item.", "Weights are treated as cooked."],
        confidence: /\d/.test(input) ? 0.86 : 0.68,
      } satisfies ParsedMeal;
    },

    async parsePhoto(_image, note, context) {
      await simulateLatency(1400);
      // Without a model there is nothing to see in the pixels, so the mock
      // reads the note if there is one and is honest when there isn't.
      if (note) return copilot.parseMeal(note, context);

      return {
        items: [],
        slot: slotForTime(context.localTime),
        totals: emptyMealTotals(),
        assumptions: [],
        clarification:
          "Photo recognition needs an API key. Describe the meal and I'll log it.",
        confidence: 0,
      };
    },

    async dailyInsight(context) {
      await simulateLatency(500);
      return buildHeuristicInsight(context);
    },
  };

  return copilot;
}

function emptyMealTotals(): NutritionTargets {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, water: 0 };
}

/**
 * A deterministic stand-in for model coaching.
 *
 * Deliberately ordered: protein shortfall outranks calorie headroom, because
 * hitting protein is the constraint that actually drives the outcome for
 * every goal the app supports.
 */
function buildHeuristicInsight(ctx: CopilotContext): CoachInsight {
  const remainingCalories = ctx.targets.calories - ctx.consumedSoFar.calories;
  const remainingProtein = ctx.targets.protein - ctx.consumedSoFar.protein;
  const proteinRatio = ctx.consumedSoFar.protein / (ctx.targets.protein || 1);
  const calorieRatio = ctx.consumedSoFar.calories / (ctx.targets.calories || 1);

  if (ctx.consumedSoFar.calories === 0) {
    return {
      headline: "Nothing logged yet today",
      body: `You have ${Math.round(ctx.targets.calories)} kcal and ${Math.round(ctx.targets.protein)}g of protein to work with. Logging your first meal sets the pace for the rest of the day.`,
      suggestions: ["Log breakfast to start the day's picture"],
      tone: "neutral",
    };
  }

  if (calorieRatio > 1.1) {
    return {
      headline: `${Math.abs(Math.round(remainingCalories))} kcal over target`,
      body: "You're past today's energy target. One day rarely changes a trend, and the useful move is simply to return to plan tomorrow rather than compensate.",
      suggestions: ["Keep tomorrow normal — no need to cut to make up for today"],
      tone: "warning",
    };
  }

  if (proteinRatio < 0.6 && calorieRatio > 0.7) {
    return {
      headline: `${Math.round(remainingProtein)}g of protein still to go`,
      body: `You've used ${Math.round(calorieRatio * 100)}% of your energy but only ${Math.round(proteinRatio * 100)}% of your protein. That's the gap worth closing before the day ends.`,
      suggestions: [
        "A 170g pot of Greek yoghurt adds 17g protein for 100 kcal",
        "A scoop of whey adds 24g protein for 120 kcal",
      ],
      tone: "warning",
    };
  }

  if (proteinRatio >= 0.9 && calorieRatio <= 1) {
    return {
      headline: "Today is tracking well",
      body: `Protein is at ${Math.round(proteinRatio * 100)}% of target with ${Math.round(remainingCalories)} kcal still available. This is exactly the shape you want.`,
      suggestions: ["Spend the remaining calories on whatever you'll enjoy most"],
      tone: "positive",
    };
  }

  return {
    headline: `${Math.round(remainingCalories)} kcal left today`,
    body: `You're at ${Math.round(calorieRatio * 100)}% of your energy target and ${Math.round(proteinRatio * 100)}% of protein. Steady so far.`,
    suggestions: [
      `Aim for roughly ${Math.round(remainingProtein)}g more protein across your remaining meals`,
    ],
    tone: "neutral",
  };
}
