"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Mail, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { spring, ease } from "@/lib/motion";

type Mode = "signin" | "signup";

export function AuthScreen({ initialError }: { initialError?: string }) {
  const { signIn, signUp, resendConfirmation } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resent, setResent] = useState(false);

  const canSubmit = email.includes("@") && password.length >= 6 && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    const result =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);

    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if ("needsConfirmation" in result && result.needsConfirmation) {
      setAwaitingConfirmation(true);
    }
    // On success the auth listener flips status to "signed-in" and the router
    // swaps this screen out. Nothing to do here.
  }

  if (awaitingConfirmation) {
    return (
      <ConfirmationPending
        email={email}
        resent={resent}
        onResend={async () => {
          const result = await resendConfirmation(email);
          if (result.error) setError(result.error);
          else setResent(true);
        }}
        onBack={() => {
          setAwaitingConfirmation(false);
          setMode("signin");
        }}
        error={error}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-[26rem]">
        <Stagger className="space-y-6" gap={0.07}>
          <Reveal>
            <div className="text-center">
              <motion.span
                className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent text-on-accent"
                initial={{ scale: 0.7, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={spring}
              >
                <Sparkles size={22} />
              </motion.span>
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">
                NutrixOS
              </h1>
              <p className="mt-1.5 text-secondary">
                Tell it what you ate. It handles the rest.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <Segmented
              options={[
                { value: "signin", label: "Sign in" },
                { value: "signup", label: "Create account" },
              ]}
              value={mode}
              onChange={(next) => {
                setMode(next);
                setError(null);
              }}
            />
          </Reveal>

          <Reveal>
            <form onSubmit={submit} className="space-y-3">
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
              />

              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="At least 6 characters"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={ease}
                    className="overflow-hidden text-sm text-danger"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                size="lg"
                block
                loading={busy}
                disabled={!canSubmit}
                className="mt-1"
              >
                {mode === "signin" ? "Sign in" : "Create account"}
                <ArrowRight size={16} />
              </Button>
            </form>
          </Reveal>

          <Reveal>
            <p className="px-2 text-center text-xs leading-relaxed text-tertiary">
              Your log is private to your account. Every table enforces that at
              the database level, not just in the app.
            </p>
          </Reveal>
        </Stagger>
      </div>
    </div>
  );
}

function ConfirmationPending({
  email,
  resent,
  onResend,
  onBack,
  error,
}: {
  email: string;
  resent: boolean;
  onResend: () => void;
  onBack: () => void;
  error: string | null;
}) {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <motion.div
        className="mx-auto w-full max-w-[26rem] text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        <motion.span
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"
          initial={{ scale: 0.7 }}
          animate={{ scale: 1 }}
          transition={spring}
        >
          <Mail size={22} />
        </motion.span>

        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-secondary">
          We sent a confirmation link to{" "}
          <span className="font-medium text-primary">{email}</span>. Open it and
          you&rsquo;ll be signed in.
        </p>

        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-2.5">
          <Button
            variant="secondary"
            block
            onClick={onResend}
            disabled={resent}
          >
            {resent ? (
              <>
                <Check size={15} />
                Sent again
              </>
            ) : (
              "Resend the link"
            )}
          </Button>

          <Button variant="ghost" block onClick={onBack}>
            Back to sign in
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-secondary">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className={cn(
          "h-12 w-full rounded-field border border-line bg-surface-inset px-3.5",
          "text-base placeholder:text-tertiary",
          "focus:border-accent focus:outline-none",
        )}
      />
    </label>
  );
}
