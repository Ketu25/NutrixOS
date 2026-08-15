import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Gate for the copilot routes.
 *
 * These endpoints spend money — every call is an inference request billed to
 * the project's Anthropic key. Left open, anyone who finds the deployed URL
 * can run up that bill, and no amount of row level security helps because the
 * route never touches the database.
 *
 * Uses `getUser()`, which verifies the JWT with Supabase, rather than
 * `getSession()`, which only decodes a cookie the caller controls.
 *
 * When Supabase is not configured the app is running in local mode with no
 * accounts, so the gate stands down rather than locking the developer out of
 * their own app.
 */
export async function requireUser(): Promise<
  { user: User | null; response?: never } | { user?: never; response: NextResponse }
> {
  if (!isSupabaseConfigured()) return { user: null };

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: "Sign in to use the copilot." },
        { status: 401 },
      ),
    };
  }

  return { user };
}
