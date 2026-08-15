"use client";

import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { springSnappy } from "@/lib/motion";
import { CountUp } from "@/components/motion/CountUp";

interface MeasureInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
}

/**
 * A large numeric control built for thumbs.
 *
 * Uses steppers plus a slider rather than a text field: on mobile a numeric
 * keyboard covers half the screen and every value here is a nudge away from a
 * sensible default, so typing is the slower path.
 */
export function MeasureInput({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
  decimals = 0,
}: MeasureInputProps) {
  const clamp = (next: number) =>
    Math.min(max, Math.max(min, Number(next.toFixed(decimals))));

  return (
    <div className="rounded-card border border-line bg-surface-1 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-secondary">{label}</span>
        <div className="flex items-baseline gap-1">
          <CountUp
            value={value}
            decimals={decimals}
            duration={0.3}
            className="tnum text-2xl font-semibold tracking-tight"
          />
          <span className="text-sm text-tertiary">{unit}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <StepButton
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          label={`Decrease ${label}`}
        >
          <Minus size={16} strokeWidth={2.5} />
        </StepButton>

        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className={cn(
            "h-1.5 flex-1 cursor-pointer appearance-none rounded-pill bg-track",
            "[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent",
            "[&::-webkit-slider-thumb]:shadow-[var(--shadow-md)]",
            "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent",
          )}
        />

        <StepButton
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          label={`Increase ${label}`}
        >
          <Plus size={16} strokeWidth={2.5} />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
      transition={springSnappy}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        "bg-surface-2 text-secondary transition-colors",
        "hover:bg-surface-3 hover:text-primary",
        "disabled:opacity-40 disabled:pointer-events-none",
      )}
    >
      {children}
    </motion.button>
  );
}
