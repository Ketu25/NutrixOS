import { NextResponse } from "next/server";
import { getCopilot } from "@/core/ai";
import type { CopilotContext } from "@/core/ai";

/**
 * POST /api/copilot/insight
 *
 * Reads the day so far and returns one useful observation. Failures here are
 * non-fatal by design: the insight card is an enhancement, so a failed call
 * returns 204 and the card simply doesn't render rather than showing an error
 * where a helpful sentence should be.
 */
export async function POST(request: Request) {
  try {
    const context = (await request.json()) as CopilotContext;
    const insight = await getCopilot().dailyInsight(context);
    return NextResponse.json(insight);
  } catch (error) {
    console.error("[copilot/insight]", error);
    return new NextResponse(null, { status: 204 });
  }
}
