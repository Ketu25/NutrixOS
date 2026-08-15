"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { deriveTargets, emptyTotals, sumTotals } from "@/core/nutrition/targets";
import type {
  Goal,
  LogEntry,
  NutritionTargets,
  NutritionTotals,
  UserProfile,
} from "@/core/nutrition/types";

/* ============================================================================
   Application state
   ----------------------------------------------------------------------------
   Persisted locally for now. Every read and write goes through this one module
   so moving to Supabase means reimplementing `load` and `persist` and adding
   the sync — no component knows where its data lives.
   ========================================================================== */

const STORAGE_KEY = "nutrixos.state.v1";

interface AppState {
  profile: UserProfile | null;
  goal: Goal | null;
  targets: NutritionTargets | null;
  entries: LogEntry[];
  /** False until the first read from storage completes, to avoid a flash. */
  hydrated: boolean;
}

type Action =
  | { type: "hydrate"; state: Partial<AppState> }
  | { type: "completeOnboarding"; profile: UserProfile; goal: Goal }
  | { type: "addEntry"; entry: LogEntry }
  | { type: "removeEntry"; id: string }
  | { type: "setTargets"; targets: NutritionTargets }
  | { type: "reset" };

const initialState: AppState = {
  profile: null,
  goal: null,
  targets: null,
  entries: [],
  hydrated: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.state, hydrated: true };

    case "completeOnboarding":
      return {
        ...state,
        profile: action.profile,
        goal: action.goal,
        targets: deriveTargets(action.profile, action.goal),
      };

    case "addEntry":
      // Newest first — the timeline reads top-down and so does the animation.
      return { ...state, entries: [action.entry, ...state.entries] };

    case "removeEntry":
      return {
        ...state,
        entries: state.entries.filter((e) => e.id !== action.id),
      };

    case "setTargets":
      return { ...state, targets: action.targets };

    case "reset":
      return { ...initialState, hydrated: true };
  }
}

interface StoreValue extends AppState {
  /** Entries logged on the current calendar day, newest first. */
  todayEntries: LogEntry[];
  /** Everything consumed today, summed. */
  todayTotals: NutritionTotals;
  isOnboarded: boolean;
  completeOnboarding: (profile: UserProfile, goal: Goal) => void;
  addEntry: (entry: LogEntry) => void;
  removeEntry: (id: string) => void;
  setTargets: (targets: NutritionTargets) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function isSameDay(iso: string, reference: Date): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load once on mount. Reading during render would break SSR.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      dispatch({ type: "hydrate", state: raw ? JSON.parse(raw) : {} });
    } catch {
      // Corrupt or unavailable storage shouldn't wedge the app — start fresh.
      dispatch({ type: "hydrate", state: {} });
    }
  }, []);

  // Persist after every change, but never before hydration or the initial
  // empty state would overwrite real saved data.
  useEffect(() => {
    if (!state.hydrated) return;
    try {
      // Listed explicitly rather than spread, so `hydrated` (and anything
      // transient added later) can never leak into storage by accident.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          profile: state.profile,
          goal: state.goal,
          targets: state.targets,
          entries: state.entries,
        }),
      );
    } catch {
      // Private browsing or a full quota. Losing persistence is survivable;
      // crashing the app over it is not.
    }
  }, [state]);

  const todayEntries = useMemo(() => {
    const now = new Date();
    return state.entries.filter((entry) => isSameDay(entry.loggedAt, now));
  }, [state.entries]);

  const todayTotals = useMemo(
    () =>
      todayEntries.length
        ? sumTotals(todayEntries.map((entry) => entry.totals))
        : emptyTotals(),
    [todayEntries],
  );

  const completeOnboarding = useCallback(
    (profile: UserProfile, goal: Goal) =>
      dispatch({ type: "completeOnboarding", profile, goal }),
    [],
  );
  const addEntry = useCallback(
    (entry: LogEntry) => dispatch({ type: "addEntry", entry }),
    [],
  );
  const removeEntry = useCallback(
    (id: string) => dispatch({ type: "removeEntry", id }),
    [],
  );
  const setTargets = useCallback(
    (targets: NutritionTargets) => dispatch({ type: "setTargets", targets }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  const value: StoreValue = {
    ...state,
    todayEntries,
    todayTotals,
    isOnboarded: Boolean(state.profile && state.goal && state.targets),
    completeOnboarding,
    addEntry,
    removeEntry,
    setTargets,
    reset,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
