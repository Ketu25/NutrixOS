import { z } from "zod";

/* ============================================================================
   Structured output schemas
   ----------------------------------------------------------------------------
   Each schema exists twice, deliberately:

   - As a JSON Schema sent to the API via `output_config.format`, which
     constrains generation so the model physically cannot emit a bad shape.
   - As a Zod schema used to validate what comes back.

   The second is not redundant. Constrained generation guarantees the shape,
   not the semantics — and a malformed response from any cause (a truncated
   stream, a future API change) should fail loudly at the boundary rather than
   flow into the targets engine as NaN.

   Note the JSON Schema dialect the API accepts is a subset: every object needs
   `additionalProperties: false`, and numeric bounds like `minimum` are not
   supported. Ranges are therefore expressed in the field descriptions, where
   the model will actually read them, and enforced by Zod on the way back.
   ========================================================================== */

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

export const entryItemSchema = z.object({
  name: z.string(),
  portion: z.string(),
  quantity: z.number(),
  unit: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  confidence: z.number(),
});

export const parsedMealSchema = z.object({
  items: z.array(entryItemSchema),
  slot: z.enum(MEAL_SLOTS),
  assumptions: z.array(z.string()),
  clarification: z.string(),
  confidence: z.number(),
});

export type ParsedMealResponse = z.infer<typeof parsedMealSchema>;

/** The wire schema for meal parsing. Mirrors `parsedMealSchema` above. */
export const PARSED_MEAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description:
        "One entry per distinct food. Split composite dishes into their main components when the macros differ meaningfully between them.",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Short food name, e.g. 'Scrambled eggs'.",
          },
          portion: {
            type: "string",
            description:
              "Portion as a person would say it, e.g. '2 large' or '1 cup cooked'.",
          },
          quantity: { type: "number", description: "Numeric amount." },
          unit: {
            type: "string",
            description: "Unit for quantity, e.g. 'g', 'cup', 'piece', 'slice'.",
          },
          calories: { type: "number", description: "Kilocalories, at least 0." },
          protein: { type: "number", description: "Grams of protein, at least 0." },
          carbs: {
            type: "number",
            description: "Grams of carbohydrate, at least 0.",
          },
          fat: { type: "number", description: "Grams of fat, at least 0." },
          fiber: { type: "number", description: "Grams of fibre, at least 0." },
          confidence: {
            type: "number",
            description:
              "How confident you are in this item's macros, from 0 to 1. Be honest: a named packaged food is near 1, a vague home-cooked portion is nearer 0.5.",
          },
        },
        required: [
          "name",
          "portion",
          "quantity",
          "unit",
          "calories",
          "protein",
          "carbs",
          "fat",
          "fiber",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
    slot: {
      type: "string",
      enum: [...MEAL_SLOTS],
      description:
        "Which meal this is. Infer from the food and the user's local time.",
    },
    assumptions: {
      type: "array",
      description:
        "Judgement calls you made that change the numbers, phrased for the user, e.g. 'Assumed cooked weight' or 'Assumed whole milk'. Empty array if the input was fully specific.",
      items: { type: "string" },
    },
    clarification: {
      type: "string",
      description:
        "If the input is too vague to estimate responsibly, the single most useful question to ask. Empty string when you can estimate.",
    },
    confidence: {
      type: "number",
      description: "Overall confidence across the whole meal, from 0 to 1.",
    },
  },
  required: ["items", "slot", "assumptions", "clarification", "confidence"],
  additionalProperties: false,
} as const;

export const coachInsightSchema = z.object({
  headline: z.string(),
  body: z.string(),
  suggestions: z.array(z.string()),
  tone: z.enum(["positive", "neutral", "warning"]),
});

export const COACH_INSIGHT_JSON_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description:
        "One short sentence, under 60 characters. The single most useful thing to say about the day so far.",
    },
    body: {
      type: "string",
      description:
        "Two or three sentences explaining the headline, referencing the user's actual numbers.",
    },
    suggestions: {
      type: "array",
      description:
        "One to three concrete, immediately actionable next steps. Name real foods and amounts rather than giving generic advice.",
      items: { type: "string" },
    },
    tone: {
      type: "string",
      enum: ["positive", "neutral", "warning"],
      description:
        "'positive' when on track, 'neutral' for a factual observation, 'warning' only for something that genuinely needs attention today.",
    },
  },
  required: ["headline", "body", "suggestions", "tone"],
  additionalProperties: false,
} as const;
