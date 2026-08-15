"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

/* ============================================================================
   Auth
   ----------------------------------------------------------------------------
   Owns the session and nothing else. Data loading lives in the store, which
   reacts to the user id changing — keeping them separate means a token refresh
   does not re-trigger a data fetch, and a failed fetch cannot log anyone out.
   ========================================================================== */

export type AuthStatus = "loading" | "signed-in" | "signed-out" | "unconfigured";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  supabase: SupabaseClient<Database> | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // One client for the provider's lifetime. Creating it per render would tear
  // down and re-establish the auth listener on every state change.
  const supabase = useMemo(
    () => (isSupabaseConfigured() ? createClient() : null),
    [],
  );

  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured() ? "loading" : "unconfigured",
  );

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    // Subscribe before the initial read so a transition landing mid-read is
    // not missed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      // A failed refresh emits TOKEN_REFRESHED with a null session. Treating
      // that as a definitive sign-out is what makes a transient network blip
      // look like being logged out — leave the existing session in place and
      // let the next attempt settle it.
      if (event === "TOKEN_REFRESHED" && !nextSession) return;

      setSession(nextSession);
      setStatus(nextSession ? "signed-in" : "signed-out");
    });

    // Explicit initial read. onAuthStateChange does fire INITIAL_SESSION, but
    // resolving the cookie here as well means `status` is never left on
    // "loading" if that event is missed, and never flashes "signed-out"
    // before the stored session has been parsed.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? "signed-in" : "signed-out");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: "Supabase is not configured." };

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!error) return {};

      // Supabase deliberately returns the same message for a wrong password
      // and a non-existent account, so an attacker cannot enumerate users.
      // Pass it through rather than trying to be more specific.
      return { error: friendlyAuthError(error.message) };
    },
    [supabase],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: "Supabase is not configured." };

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) return { error: friendlyAuthError(error.message) };

      // With email confirmation enabled, signUp returns a user but no session.
      // The caller shows a "check your inbox" state rather than assuming the
      // user is now signed in.
      if (!data.session) return { needsConfirmation: true };

      return {};
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, [supabase]);

  const resendConfirmation = useCallback(
    async (email: string) => {
      if (!supabase) return { error: "Supabase is not configured." };

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      return error ? { error: friendlyAuthError(error.message) } : {};
    },
    [supabase],
  );

  const value: AuthContextValue = {
    status,
    user: session?.user ?? null,
    session,
    supabase,
    signIn,
    signUp,
    signOut,
    resendConfirmation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Turns Supabase's terse messages into something a person can act on. */
function friendlyAuthError(message: string): string {
  const normalised = message.toLowerCase();

  if (normalised.includes("invalid login credentials")) {
    return "That email and password don't match an account.";
  }
  if (normalised.includes("email not confirmed")) {
    return "Confirm your email first — check your inbox for the link.";
  }
  if (normalised.includes("already registered")) {
    return "An account with that email already exists. Try signing in.";
  }
  if (normalised.includes("password should be")) {
    return "Password must be at least 6 characters.";
  }
  if (normalised.includes("rate limit") || normalised.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }

  return message;
}
