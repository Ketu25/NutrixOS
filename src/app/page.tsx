"use client";

import { AnimatePresence, motion } from "motion/react";
import { StoreProvider, useStore } from "@/lib/store";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { TodayScreen } from "@/components/today/TodayScreen";
import { ease } from "@/lib/motion";

export default function Home() {
  return (
    <StoreProvider>
      <AppRouter />
    </StoreProvider>
  );
}

/**
 * Chooses between onboarding and the dashboard.
 *
 * Renders nothing until the store has read from storage — showing onboarding
 * to an existing user for one frame is worse than a brief blank.
 */
function AppRouter() {
  const { hydrated, isOnboarded, completeOnboarding } = useStore();

  return (
    <AnimatePresence mode="wait">
      {!hydrated ? (
        <motion.div key="loading" className="flex-1" />
      ) : isOnboarded ? (
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
