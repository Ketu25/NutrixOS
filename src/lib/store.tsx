"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { deriveTargets, emptyTotals, sumTotals } from "@/core/nutrition/targets";
import type {
  Goal,
  LogEntry,
  NutritionTargets,
  NutritionTotals,
  UserProfile,
} from "@/core/nutrition/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  deleteEntry as deleteEntryRow,
  insertEntry,
  loadAccount,
  loadEntriesForDay,
  saveOnboarding,
} from "@/lib/supabase/repository";

/* ============================================================================
   Application state
   ----------------------------------------------------------------------------
   One store, two backends. Signed in, everything reads and writes through the
   repository. Without Supabase configured it falls back to localStorage, which
   keeps the app runnable for local development and previews with no
   credentials.

   Writes are optimistic and roll back on failure. Logging a meal should feel
   instant — but a rollback that leaves the UI claiming a meal was saved when
   it was not is worse than a slow save, so every failure path restores the
   previous state and surfaces the error.
   ========================================================================== */

const STORAGE_KEY = "nutrixos.state.v1";

type Status = "loading" | "ready" | "error";

interface AppState {
  profile: UserProfile | null;
  goal: Goal | null;
  targets: NutritionTargets | null;
  entries: LogEntry[];
  status: Status;
  error: string | null;
}

const EMPTY: AppState = {
  profile: null,
  goal: null,
  targets: null,
  entries: [],
  status: "loading",
  error: null,
};

interface StoreValue extends AppState {
  todayEntries: LogEntry[];
  todayTotals: NutritionTotals;
  isOnboarded: boolean;
  /** True when writes are going to Supabase rather than localStorage. */
  isRemote: boolean;
  completeOnboarding: (profile: UserProfile, goal: Goal) => Promise<void>;
  addEntry: (entry: LogEntry) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  dismissError: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/* -- local persistence ------------------------------------------------------ */

interface LocalSnapshot {
  profile: UserProfile | null;
  goal: Goal | null;
  targets: NutritionTargets | null;
  entries: LogEntry[];
}

function readLocal(): LocalSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalSnapshot) : null;
  } catch {
    return null;
  }
}

function writeLocal(snapshot: LocalSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private browsing or a full quota. Losing persistence is survivable;
    // crashing the app over it is not.
  }
}

function clearLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the data is already unreachable.
  }
}

function isSameDay(iso: string, reference: Date): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus, user, supabase } = useAuth();
  const [state, setState] = useState<AppState>(EMPTY);

  const isRemote = Boolean(supabase && user);

  // Guards against a slow load for a previous user resolving after a faster
  // one for the current user and overwriting it.
  const loadTokenRef = useRef(0);

  useEffect(() => {
    if (authStatus === "loading") return;

    const token = ++loadTokenRef.current;
    const commit = (next: AppState) => {
      if (loadTokenRef.current === token) setState(next);
    };

    // No Supabase — run entirely on localStorage.
    if (authStatus === "unconfigured") {
      const local = readLocal();
      commit({ ...EMPTY, ...(local ?? {}), status: "ready" });
      return;
    }

    // Signed out: hold nothing in memory. Another account must never see the
    // previous one's data still sitting in state.
    if (authStatus === "signed-out" || !supabase || !user) {
      commit({ ...EMPTY, status: "ready" });
      return;
    }

    (async () => {
      // Inside the async body rather than the effect body: this runs a
      // microtask later, so it does not cascade a render synchronously during
      // the effect, and the fetch below has not resolved yet either way.
      setState((s) => ({ ...s, status: "loading", error: null }));

      try {
        const account = await loadAccount(supabase, user.id);

        // First sign-in on a device that has local data: adopt it rather than
        // silently discarding what the person already logged.
        if (!account) {
          const local = readLocal();
          if (local?.profile && local.goal && local.targets) {
            await saveOnboarding(
              supabase,
              user.id,
              local.profile,
              local.goal,
              local.targets,
            );
            for (const entry of local.entries) {
              await insertEntry(supabase, user.id, entry);
            }
            clearLocal();

            const entries = await loadEntriesForDay(supabase);
            commit({
              profile: local.profile,
              goal: local.goal,
              targets: local.targets,
              entries,
              status: "ready",
              error: null,
            });
            return;
          }

          commit({ ...EMPTY, status: "ready" });
          return;
        }

        const entries = await loadEntriesForDay(supabase);
        commit({
          profile: account.profile,
          goal: account.goal,
          targets: account.targets,
          entries,
          status: "ready",
          error: null,
        });
      } catch (error) {
        console.error("[store] load failed", error);
        commit({
          ...EMPTY,
          status: "error",
          error: "Couldn't load your data. Check your connection and retry.",
        });
      }
    })();
  }, [authStatus, user, supabase]);

  const completeOnboarding = useCallback(
    async (profile: UserProfile, goal: Goal) => {
      const targets = deriveTargets(profile, goal);

      setState((s) => ({ ...s, profile, goal, targets, error: null }));

      if (!supabase || !user) {
        writeLocal({ profile, goal, targets, entries: state.entries });
        return;
      }

      try {
        await saveOnboarding(supabase, user.id, profile, goal, targets);
      } catch (error) {
        console.error("[store] saveOnboarding failed", error);
        setState((s) => ({
          ...s,
          error: "Couldn't save your plan. Check your connection and retry.",
        }));
      }
    },
    [supabase, user, state.entries],
  );

  const addEntry = useCallback(
    async (entry: LogEntry) => {
      // Newest first — the timeline reads top-down and so does the animation.
      setState((s) => ({ ...s, entries: [entry, ...s.entries], error: null }));

      if (!supabase || !user) {
        const snapshot = readLocal();
        writeLocal({
          profile: snapshot?.profile ?? null,
          goal: snapshot?.goal ?? null,
          targets: snapshot?.targets ?? null,
          entries: [entry, ...(snapshot?.entries ?? [])],
        });
        return;
      }

      try {
        await insertEntry(supabase, user.id, entry);
      } catch (error) {
        console.error("[store] insertEntry failed", error);
        setState((s) => ({
          ...s,
          entries: s.entries.filter((e) => e.id !== entry.id),
          error: "That meal didn't save. Try logging it again.",
        }));
      }
    },
    [supabase, user],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      const removed = state.entries.find((e) => e.id === id);
      setState((s) => ({
        ...s,
        entries: s.entries.filter((e) => e.id !== id),
        error: null,
      }));

      if (!supabase || !user) {
        const snapshot = readLocal();
        writeLocal({
          profile: snapshot?.profile ?? null,
          goal: snapshot?.goal ?? null,
          targets: snapshot?.targets ?? null,
          entries: (snapshot?.entries ?? []).filter((e) => e.id !== id),
        });
        return;
      }

      try {
        await deleteEntryRow(supabase, id);
      } catch (error) {
        console.error("[store] deleteEntry failed", error);
        // Put it back where it was rather than at the top, so the timeline
        // does not silently reorder on a failed delete.
        setState((s) => ({
          ...s,
          entries: removed
            ? [...s.entries, removed].sort(
                (a, b) => Date.parse(b.loggedAt) - Date.parse(a.loggedAt),
              )
            : s.entries,
          error: "Couldn't delete that entry.",
        }));
      }
    },
    [supabase, user, state.entries],
  );

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

  const dismissError = useCallback(
    () => setState((s) => ({ ...s, error: null })),
    [],
  );

  const value: StoreValue = {
    ...state,
    todayEntries,
    todayTotals,
    isOnboarded: Boolean(state.profile && state.goal && state.targets),
    isRemote,
    completeOnboarding,
    addEntry,
    removeEntry,
    dismissError,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
