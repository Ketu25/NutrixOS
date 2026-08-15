import { NextResponse } from "next/server";
import { z } from "zod";
import { CopilotRefusalError, CopilotResponseError, getCopilot } from "@/core/ai";

/* ============================================================================
   POST /api/copilot/parse
   ----------------------------------------------------------------------------
   Turns a description — or a photo — into structured macros.

   This runs server-side for one reason that matters: the Anthropic key must
   never reach the browser.
   ========================================================================== */

const contextSchema = z.object({
  goal: z.enum([
    "lose_fat",
    "maintain",
    "gain_muscle",
    "improve_nutrition",
    "custom",
  ]),
  dietaryPattern: z.enum([
    "omnivore",
    "vegetarian",
    "vegan",
    "pescatarian",
    "keto",
    "paleo",
    "mediterranean",
  ]),
  allergies: z.array(z.string()).optional(),
  targets: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
    water: z.number(),
  }),
  consumedSoFar: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
    water: z.number(),
  }),
  localTime: z.string(),
});

const bodySchema = z.object({
  input: z.string().optional(),
  image: z
    .object({
      base64: z.string(),
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    })
    .optional(),
  context: contextSchema,
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;

  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!body.image && !body.input?.trim()) {
    return NextResponse.json(
      { error: "Provide a description or a photo." },
      { status: 400 },
    );
  }

  const copilot = getCopilot();

  try {
    const meal = body.image
      ? await copilot.parsePhoto(body.image, body.input, body.context)
      : await copilot.parseMeal(body.input!, body.context);

    return NextResponse.json(meal);
  } catch (error) {
    if (error instanceof CopilotRefusalError) {
      return NextResponse.json(
        { error: "I can't help with that one. Try describing the food itself." },
        { status: 422 },
      );
    }

    if (error instanceof CopilotResponseError) {
      return NextResponse.json(
        { error: "I couldn't read that. Try rephrasing it." },
        { status: 502 },
      );
    }

    console.error("[copilot/parse]", error);
    return NextResponse.json(
      { error: "Something went wrong reading that meal." },
      { status: 500 },
    );
  }
}
