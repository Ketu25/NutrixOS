import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 *
 * Where the email confirmation link lands. Supabase sends one of two shapes
 * depending on the project's email template and flow, so both are handled:
 *
 *   ?code=...                  PKCE — exchange it for a session
 *   ?token_hash=...&type=...   the older verify flow
 *
 * Handling only one of them produces a confirmation link that silently fails
 * for half of all configurations, which is a miserable thing to debug later.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Only ever redirect to a path on this origin. Taking an absolute URL from
  // the query string would make this an open redirect.
  const next = sanitiseNext(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`,
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/?auth_error=${encodeURIComponent("That confirmation link is invalid or has expired.")}`,
  );
}

function sanitiseNext(value: string | null): string {
  if (!value) return "/";
  // A leading "//" is protocol-relative and would leave the site.
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
