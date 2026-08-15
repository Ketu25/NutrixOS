"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

/* ============================================================================
   Theme control
   ----------------------------------------------------------------------------
   Three states, not two. "system" follows the OS and is the default; the other
   two are explicit user overrides written to `data-theme` on <html>, which the
   token layer in globals.css keys off.

   The DOM attribute is the single source of truth, not React state. A
   pre-paint script sets it before React exists, so mirroring it into state
   would mean two authorities that can disagree. `useSyncExternalStore` reads
   it directly instead, which also gives React the correct hydration behaviour
   for free: the server snapshot renders on the server, the real value swaps in
   immediately after hydration, and no mismatch is reported.
   ========================================================================== */

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "nutrixos.theme";
/** Broadcasts a preference change to every subscriber in the tree. */
const THEME_EVENT = "nutrixos:themechange";

/**
 * Runs before first paint to apply the stored theme.
 * Without this, a user who chose dark sees a white flash on every load.
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();
`;

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

function readPreference(): ThemePreference {
  const attribute = document.documentElement.getAttribute("data-theme");
  return attribute === "light" || attribute === "dark" ? attribute : "system";
}

function readResolved(): "light" | "dark" {
  const preference = readPreference();
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

interface ThemeContextValue {
  preference: ThemePreference;
  /** What is actually on screen right now, after resolving "system". */
  resolved: "light" | "dark";
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    () => "system" as const,
  );

  const resolved = useSyncExternalStore(
    subscribe,
    readResolved,
    () => "light" as const,
  );

  const setPreference = useCallback((next: ThemePreference) => {
    const root = document.documentElement;

    if (next === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEY);
    } else {
      root.setAttribute("data-theme", next);
      localStorage.setItem(STORAGE_KEY, next);
    }

    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggle = useCallback(() => {
    setPreference(readResolved() === "dark" ? "light" : "dark");
  }, [setPreference]);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
