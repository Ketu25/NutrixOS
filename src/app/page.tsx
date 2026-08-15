"use client";

import { AnimatePresence, motion } from "motion/react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";
import { StoreProvider, useStore } from "@/lib/store";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { TodayScreen } from "@/components/today/TodayScreen";
import { Button } from "@/components/ui/Button";
import { ease } from "@/lib/motion";

export default function Home() {
  return (
    <AuthProvider>
      <StoreProvider>
        {/* useSearchParams needs a Suspense boundary to avoid opting the whole
            route out of static rendering. */}
        <Suspense fallback={<Splash />}>
          <AppRouter />
        </Suspense>
      </StoreProvider>
    </AuthProvider>
  );
}

/**
 * Decides which surface to show.
 *
 * Order matters: auth resolves before the store, and the store resolves before
 * onboarding. Showing onboarding to a signed-in user whose profile is still
 * loading would ask them to re-enter a plan they already have.
 */
function AppRouter() {
  const { status: authStatus, signOut } = useAuth();
  const { status: storeStatus, isOnboarded, completeOnboarding, error } = useStore();
  const searchParams = useSearchParams();
  const authError = searchParams.get("auth_error") ?? undefined;

  if (authStatus === "loading") return <Splash />;

  if (authStatus === "signed-out") {
    return <AuthScreen initialError={authError} />;
  }

  // "unconfigured" falls through deliberately: with no Supabase credentials
  // the app runs locally without an account, so development and previews work
  // without secrets.

  if (storeStatus === "loading") return <Splash />;

  if (storeStatus === "error") {
    return (
      <ErrorScreen
        message={error ?? "Something went wrong."}
        onRetry={() => window.location.reload()}
        onSignOut={signOut}
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isOnboarded ? (
        <motion.div
          key="today"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={ease}
          className="flex-1"
        >
          <TodayScreen />
        </motion.div>
      ) : (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={ease}
          className="flex-1"
        >
          <OnboardingFlow onComplete={completeOnboarding} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center">
      <motion.span
        className="size-2.5 rounded-full bg-accent"
        animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
        transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        aria-label="Loading"
      />
    </div>
  );
}

function ErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col justify-center px-5">
      <div className="mx-auto w-full max-w-[24rem] text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Couldn&rsquo;t load your data
        </h1>
        <p className="mt-2 text-secondary">{message}</p>
        <div className="mt-6 space-y-2.5">
          <Button block onClick={onRetry}>
            Try again
          </Button>
          <Button variant="ghost" block onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
