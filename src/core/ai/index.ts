import { createClaudeCopilot } from "./claude";
import { createMockCopilot } from "./mock";
import type { NutritionCopilot } from "./types";

export * from "./types";
export { CopilotRefusalError, CopilotResponseError } from "./claude";

let cached: NutritionCopilot | null = null;

/**
 * The copilot the app should use.
 *
 * Presence of an API key is the only switch. With a key the app talks to
 * Claude; without one it runs on the mock and stays fully usable, which keeps
 * local development, previews, and CI working without credentials.
 *
 * Server-only — never import this from a client component. The key must not
 * reach the browser.
 */
export function getCopilot(): NutritionCopilot {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = apiKey ? createClaudeCopilot(apiKey) : createMockCopilot();
  return cached;
}

/** True when real inference is wired up. The UI uses this to set expectations. */
export function isCopilotLive(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
