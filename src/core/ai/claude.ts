import Anthropic from "@anthropic-ai/sdk";
import { sumTotals } from "@/core/nutrition/targets";
import type { EntryItem, NutritionTargets } from "@/core/nutrition/types";
import {
  COACH_INSIGHT_JSON_SCHEMA,
  coachInsightSchema,
  PARSED_MEAL_JSON_SCHEMA,
  parsedMealSchema,
} from "./schemas";
import {
  COACH_SYSTEM,
  MEAL_PARSER_SYSTEM,
  PHOTO_PARSER_SYSTEM,
  renderContext,
} from "./prompts";
import type { CoachInsight, NutritionCopilot, ParsedMeal } from "./types";

/* ============================================================================
   Claude-backed copilot
   ----------------------------------------------------------------------------
   Model selection is per task, not global:

   - Meal parsing runs on Haiku 4.5. It is a fast, bounded extraction with a
     schema doing the structural work, and it sits directly in the logging
     interaction — latency is the product here.
   - Photo estimation and coaching run on Opus 5. Judging portion size from a
     photograph, and reading a day's numbers into useful advice, are both
     genuinely reasoning-heavy.

   Every call constrains generation with `output_config.format`, so the model
   cannot emit a shape the app can't read.
   ========================================================================== */

const MODEL = {
  /** Fast structured extraction in the logging path. */
  parse: "claude-haiku-4-5",
  /** Vision and coaching, where judgement matters more than latency. */
  reason: "claude-opus-5",
} as const;

/** Thrown when the model declines a request. Callers degrade gracefully. */
export class CopilotRefusalError extends Error {
  constructor(readonly category: string | null) {
    super("The request was declined.");
    this.name = "CopilotRefusalError";
  }
}

export class CopilotResponseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "CopilotResponseError";
  }
}

export function createClaudeCopilot(apiKey?: string): NutritionCopilot {
  // With no argument the SDK resolves ANTHROPIC_API_KEY from the environment.
  const client = new Anthropic(apiKey ? { apiKey } : {});

  return {
    async parseMeal(input, context) {
      const message = await client.messages.create({
        model: MODEL.parse,
        max_tokens: 4096,
        system: MEAL_PARSER_SYSTEM,
        output_config: {
          format: { type: "json_schema", schema: PARSED_MEAL_JSON_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: `${renderContext(context)}\n\nThe user logged:\n"""\n${input}\n"""`,
          },
        ],
      });

      return toParsedMeal(readJson(message, parsedMealSchema));
    },

    async parsePhoto(image, note, context) {
      const message = await client.messages.create({
        model: MODEL.reason,
        // Opus 5 thinks by default, and max_tokens caps thinking plus output
        // together — this needs headroom the parse path does not.
        max_tokens: 16000,
        system: PHOTO_PARSER_SYSTEM,
        output_config: {
          format: { type: "json_schema", schema: PARSED_MEAL_JSON_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType as
                    | "image/jpeg"
                    | "image/png"
                    | "image/gif"
                    | "image/webp",
                  data: image.base64,
                },
              },
              {
                type: "text",
                text: [
                  renderContext(context),
                  "",
                  "Estimate the nutrition content of the meal in this photo.",
                  note ? `The user added: "${note}"` : null,
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            ],
          },
        ],
      });

      return toParsedMeal(readJson(message, parsedMealSchema));
    },

    async dailyInsight(context) {
      const message = await client.messages.create({
        model: MODEL.reason,
        max_tokens: 16000,
        system: COACH_SYSTEM,
        output_config: {
          // A short, well-defined judgement. Full effort would spend tokens
          // deliberating over a card the user reads in three seconds.
          effort: "low",
          format: { type: "json_schema", schema: COACH_INSIGHT_JSON_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: `${renderContext(context)}\n\nWhat is the most useful thing to tell me right now?`,
          },
        ],
      });

      return readJson(message, coachInsightSchema) satisfies CoachInsight;
    },
  };
}

/* -- response handling ------------------------------------------------------ */

/**
 * Pull the structured payload out of a response.
 *
 * Checks `stop_reason` before touching `content`: a declined request returns a
 * successful HTTP 200 with an empty content array, so indexing straight into
 * `content[0]` would throw an unhelpful TypeError instead of surfacing what
 * actually happened.
 */
function readJson<T>(
  message: Anthropic.Message,
  schema: { parse: (value: unknown) => T },
): T {
  if (message.stop_reason === "refusal") {
    throw new CopilotRefusalError(message.stop_details?.category ?? null);
  }

  if (message.stop_reason === "max_tokens") {
    throw new CopilotResponseError(
      "The response was cut off before it finished.",
    );
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!text.trim()) {
    throw new CopilotResponseError("The model returned no content.");
  }

  try {
    return schema.parse(JSON.parse(text));
  } catch (cause) {
    throw new CopilotResponseError(
      "The model returned a response the app could not read.",
      cause,
    );
  }
}

/**
 * Attach ids and compute totals.
 *
 * Totals are summed here rather than asked for in the schema. A model can add
 * up five rows of macros, but there is no reason to let it: the arithmetic is
 * free, exact, and guaranteed consistent with the items actually shown.
 */
function toParsedMeal(
  parsed: ReturnType<typeof parsedMealSchema.parse>,
): ParsedMeal {
  const items: EntryItem[] = parsed.items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    calories: Math.max(0, Math.round(item.calories)),
    protein: Math.max(0, Math.round(item.protein)),
    carbs: Math.max(0, Math.round(item.carbs)),
    fat: Math.max(0, Math.round(item.fat)),
    fiber: Math.max(0, Math.round(item.fiber)),
    confidence: Math.min(1, Math.max(0, item.confidence)),
  }));

  const totals: NutritionTargets = { ...sumTotals(items), water: 0 };

  return {
    items,
    slot: parsed.slot,
    totals,
    assumptions: parsed.assumptions,
    clarification: parsed.clarification.trim() || undefined,
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
  };
}
