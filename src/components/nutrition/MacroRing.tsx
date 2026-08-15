"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { springSoft } from "@/lib/motion";
import type { MacroChannel } from "@/core/nutrition/types";

/** Channel to token. The ring never knows a literal color. */
const CHANNEL_VAR: Record<MacroChannel, string> = {
  calories: "var(--energy)",
  protein: "var(--protein)",
  carbs: "var(--carbs)",
  fat: "var(--fat)",
  fiber: "var(--fiber)",
};

interface MacroRingProps {
  channel: MacroChannel;
  /** consumed / target. Values above 1 render as a distinct overshoot arc. */
  ratio: number;
  size?: number;
  stroke?: number;
  /** Rendered in the middle of the ring. */
  children?: ReactNode;
  /** Seconds to wait before filling, so a group of rings cascades. */
  delay?: number;
  className?: string;
  label?: string;
}

/**
 * A single progress ring.
 *
 * The fill is animated with a soft spring on `strokeDashoffset` so it settles
 * with visible follow-through rather than arriving instantly. Overshoot is a
 * first-class state: past 100% a second arc laps the ring in the warning tone,
 * because "you went over" is information the user needs, not an error to clamp
 * away silently.
 */
export function MacroRing({
  channel,
  ratio,
  size = 120,
  stroke = 10,
  children,
  delay = 0,
  className,
  label,
}: MacroRingProps) {
  const reduceMotion = useReducedMotion();

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const safeRatio = Number.isFinite(ratio) ? Math.max(ratio, 0) : 0;
  const primary = Math.min(safeRatio, 1);
  const overshoot = Math.min(Math.max(safeRatio - 1, 0), 1);

  const color = CHANNEL_VAR[channel];
  const transition = reduceMotion
    ? { duration: 0 }
    : { ...springSoft, delay };

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        label ?? `${channel} ${Math.round(safeRatio * 100)} percent of target`
      }
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // Start the arc at 12 o'clock instead of 3 o'clock.
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--track)"
          strokeWidth={stroke}
        />

        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - primary) }}
          transition={transition}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, opacity: 0.999 }}
        />

        {overshoot > 0 && (
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--danger)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - overshoot) }}
            transition={
              reduceMotion ? { duration: 0 } : { ...springSoft, delay: delay + 0.35 }
            }
          />
        )}
      </svg>

      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
