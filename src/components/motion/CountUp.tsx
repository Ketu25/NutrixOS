"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

interface CountUpProps {
  value: number;
  /** Seconds. Long enough to read as motion, short enough not to feel slow. */
  duration?: number;
  decimals?: number;
  /** Insert thousands separators. On by default for calorie-scale numbers. */
  separator?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * A number that animates from its previous value to the next one.
 *
 * Every figure in the app that can change — remaining calories, grams of
 * protein, a streak — goes through here, so numbers never teleport. Uses a
 * MotionValue rather than React state so the tween runs off the main render
 * loop and never triggers a re-render per frame.
 */
export function CountUp({
  value,
  duration = 0.9,
  decimals = 0,
  separator = true,
  prefix = "",
  suffix = "",
  className,
}: CountUpProps) {
  const motionValue = useMotionValue(0);

  const display = useTransform(motionValue, (latest) => {
    const fixed = latest.toFixed(decimals);
    const formatted = separator
      ? Number(fixed).toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : fixed;
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [value, duration, motionValue]);

  return (
    <motion.span className={className} suppressHydrationWarning>
      {display}
    </motion.span>
  );
}
