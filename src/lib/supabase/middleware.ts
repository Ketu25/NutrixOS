import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

/**
 * Refreshes the auth session on every request.
 *
 * Supabase access tokens are short-lived. Without this running in middleware,
 * a token expires mid-session and Server Components start seeing a signed-out
 * user while the browser still thinks it is signed in. The refreshed cookies
 * have to be written onto the response that is actually returned, which is why
 * the response object is created first and threaded through `setAll`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token against Supabase. getSession() only reads
  // the cookie, which a client could have forged — never gate on it here.
  await supabase.auth.getUser();

  return response;
}
