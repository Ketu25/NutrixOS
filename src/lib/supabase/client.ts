import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Supabase client for browser code.
 *
 * The publishable key is meant to ship to the browser — row level security is
 * what protects the data, not key secrecy. Every table has RLS enabled with a
 * policy keyed to auth.uid(), so this key can only ever read the signed-in
 * user's own rows.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

/** Whether Supabase is configured. Drives the local-only fallback. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
