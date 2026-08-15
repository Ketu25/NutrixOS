"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, Mic, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";
import { ease, spring, springSnappy } from "@/lib/motion";
import type { CopilotContext, ParsedMeal } from "@/core/ai/types";
import type { LogEntry } from "@/core/nutrition/types";

/* ============================================================================
   Conversational logging
   ----------------------------------------------------------------------------
   The whole point of the product. The user says what they ate in their own
   words; the copilot does the structuring.

   The review step is not friction to be optimised away — it is what makes an
   estimate honest. The user sees exactly what was assumed before it lands in
   their day, and can reject it in one tap.
   ========================================================================== */

type Phase = "input" | "parsing" | "review";

const PROMPTS = [
  "Two scrambled eggs on wholegrain toast",
  "Chicken breast, rice and a big salad",
  "Greek yoghurt with a banana",
  "Protein shake after the gym",
];

export function LogSheet({
  open,
  onClose,
  context,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  context: CopilotContext;
  onLogged: (entry: LogEntry) => void;
}) {
  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState("");
  const [meal, setMeal] = useState<ParsedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Reset to a clean slate whenever the sheet reopens, so a previous entry's
  // review state never bleeds into a new one. Adjusting during render rather
  // than in an effect: React discards this render and redoes it with the new
  // state before anything paints, so the stale phase is never shown.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPhase("input");
      setInput("");
      setMeal(null);
      setError(null);
    }
  }

  // Focus is a DOM side effect, so it does belong in an effect. Delayed until
  // the sheet has finished sliding up — focusing mid-animation makes iOS
  // scroll the sheet halfway off screen to chase the caret.
  useEffect(() => {
    if (!open) return;
    const focus = setTimeout(() => textareaRef.current?.focus(), 350);
    return () => clearTimeout(focus);
  }, [open]);

  async function parse(text: string) {
    if (!text.trim()) return;

    setPhase("parsing");
    setError(null);

    try {
      const response = await fetch("/api/copilot/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, context }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "That didn't work. Try again.");
        setPhase("input");
        return;
      }

      setMeal(payload as ParsedMeal);
      setPhase("review");
    } catch {
      setError("Couldn't reach the copilot. Check your connection.");
      setPhase("input");
    }
  }

  function confirm() {
    if (!meal) return;

    onLogged({
      id: crypto.randomUUID(),
      loggedAt: new Date().toISOString(),
      slot: meal.slot,
      rawInput: input,
      source: listening ? "voice" : "text",
      items: meal.items,
      totals: meal.totals,
    });

    onClose();
  }

  /**
   * Dictation via the browser's speech recognition, where it exists.
   * Silently unavailable elsewhere rather than showing a button that fails.
   */
  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : undefined;

    if (!SpeechRecognition) {
      setError("Voice input isn't supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      setInput(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <Sheet open={open} onClose={onClose} title="What did you eat?">
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring}
            className="pb-2"
          >
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    parse(input);
                  }
                }}
                rows={3}
                placeholder="Describe it however you'd say it out loud…"
                className={cn(
                  "w-full resize-none rounded-card border border-line bg-surface-inset",
                  "p-3.5 pr-12 text-base leading-relaxed placeholder:text-tertiary",
                  "focus:border-accent focus:outline-none",
                )}
              />

              <div className="absolute right-2.5 bottom-2.5 flex gap-1.5">
                <motion.button
                  type="button"
                  aria-label={listening ? "Stop dictation" : "Dictate"}
                  onClick={toggleDictation}
                  whileTap={{ scale: 0.9 }}
                  transition={springSnappy}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full transition-colors",
                    listening
                      ? "bg-danger text-inverse"
                      : "bg-surface-2 text-secondary hover:text-primary",
                  )}
                >
                  {listening ? (
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Mic size={15} />
                    </motion.span>
                  ) : (
                    <Mic size={15} />
                  )}
                </motion.button>

                <motion.button
                  type="button"
                  aria-label="Analyse"
                  onClick={() => parse(input)}
                  disabled={!input.trim()}
                  whileTap={{ scale: 0.9 }}
                  transition={springSnappy}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full",
                    "bg-accent text-on-accent transition-opacity",
                    "disabled:opacity-30 disabled:pointer-events-none",
                  )}
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </motion.button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden pt-2 text-sm text-danger"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <p className="mt-4 mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-tertiary">
              Or try one of these
            </p>

            <Stagger className="flex flex-wrap gap-2" gap={0.04}>
              {PROMPTS.map((prompt) => (
                <Reveal key={prompt} variant="pop">
                  <motion.button
                    type="button"
                    onClick={() => {
                      setInput(prompt);
                      parse(prompt);
                    }}
                    whileTap={{ scale: 0.96 }}
                    transition={springSnappy}
                    className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-sm text-secondary hover:border-line-strong hover:text-primary"
                  >
                    {prompt}
                  </motion.button>
                </Reveal>
              ))}
            </Stagger>
          </motion.div>
        )}

        {phase === "parsing" && (
          <motion.div
            key="parsing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={ease}
            className="flex flex-col items-center py-14"
          >
            <motion.span
              className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles size={20} />
            </motion.span>
            <p className="mt-4 font-medium tracking-tight">Working it out…</p>
            <p className="mt-1 max-w-[18rem] text-center text-sm text-secondary">
              Identifying foods and estimating portions.
            </p>
          </motion.div>
        )}

        {phase === "review" && meal && (
          <ReviewStep
            meal={meal}
            onConfirm={confirm}
            onRetry={() => {
              setMeal(null);
              setPhase("input");
            }}
          />
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function ReviewStep({
  meal,
  onConfirm,
  onRetry,
}: {
  meal: ParsedMeal;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  // A clarification means the copilot could not estimate responsibly. Showing
  // the question instead of inventing numbers is the whole contract.
  if (meal.clarification || meal.items.length === 0) {
    return (
      <motion.div
        key="clarify"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={spring}
        className="py-6"
      >
        <p className="font-medium leading-snug tracking-tight">
          {meal.clarification ?? "I couldn't identify a food in that."}
        </p>
        <Button variant="secondary" block className="mt-5" onClick={onRetry}>
          <RotateCcw size={15} />
          Try again
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={spring}
      className="pb-2"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-tertiary">
          {meal.slot}
        </span>
        <span className="tnum text-lg font-semibold tracking-tight">
          {Math.round(meal.totals.calories).toLocaleString()} kcal
        </span>
      </div>

      <Stagger className="mt-3 space-y-2" gap={0.05}>
        {meal.items.map((item) => (
          <Reveal key={item.id} variant="pop">
            <div className="rounded-field border border-line bg-surface-2 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-medium tracking-tight">{item.name}</p>
                <span className="tnum shrink-0 text-sm text-secondary">
                  {Math.round(item.calories)} kcal
                </span>
              </div>
              <p className="mt-0.5 text-sm text-tertiary">{item.portion}</p>

              <div className="mt-2 flex gap-3 text-[0.6875rem]">
                <span className="text-tertiary">
                  <span className="font-semibold text-protein">P</span>{" "}
                  <span className="tnum text-secondary">{Math.round(item.protein)}g</span>
                </span>
                <span className="text-tertiary">
                  <span className="font-semibold text-carbs">C</span>{" "}
                  <span className="tnum text-secondary">{Math.round(item.carbs)}g</span>
                </span>
                <span className="text-tertiary">
                  <span className="font-semibold text-fat">F</span>{" "}
                  <span className="tnum text-secondary">{Math.round(item.fat)}g</span>
                </span>
              </div>
            </div>
          </Reveal>
        ))}
      </Stagger>

      {meal.assumptions.length > 0 && (
        <div className="mt-3 rounded-field bg-surface-inset p-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-tertiary">
            Assumed
          </p>
          <ul className="mt-1.5 space-y-1">
            {meal.assumptions.map((assumption) => (
              <li key={assumption} className="text-sm text-secondary">
                {assumption}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex gap-2.5">
        <Button variant="secondary" size="lg" onClick={onRetry} className="flex-1">
          <RotateCcw size={15} />
          Redo
        </Button>
        <Button size="lg" onClick={onConfirm} className="flex-[2]">
          <Check size={16} strokeWidth={2.5} />
          Log it
        </Button>
      </div>
    </motion.div>
  );
}

/* -- Minimal typings for the Web Speech API, which TS does not ship. -------- */

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
