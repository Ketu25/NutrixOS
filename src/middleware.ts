import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Document requests only — static assets and `/api` are excluded.
     *
     * Excluding `/api` is not just an optimisation. Supabase rotates the
     * refresh token on every use, and middleware builds a fresh server client
     * per request with no shared refresh lock. With `/api` included, a page
     * load racing two in-flight API calls means three clients independently
     * attempting the same refresh: one wins, the others present an
     * already-rotated token, and the library treats that as an invalid session
     * and clears the auth cookie. The symptom is a user being silently signed
     * out after doing several things at once.
     *
     * API routes still authenticate — they read the session directly via the
     * server client, which only refreshes when the token has actually expired.
     */
    "/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
