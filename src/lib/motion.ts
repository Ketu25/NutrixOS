import type { Transition, Variants } from "motion/react";

/* ============================================================================
   Motion tokens
   ----------------------------------------------------------------------------
   Motion is part of the design system, not a per-component decision. Every
   animation in the app picks a named spring from this file. If the product
   should feel snappier or softer, it changes here and nowhere else.

   Springs are physical (stiffness/damping/mass) rather than duration-based so
   that interrupted gestures resolve naturally instead of snapping.
   ========================================================================== */

/** Default for layout shifts and entrances. Settles with a hint of overshoot. */
export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 36,
  mass: 0.9,
};

/** Crisper. For taps, toggles, and anything that should feel immediate. */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 620,
  damping: 34,
  mass: 0.7,
};

/** Looser, with visible follow-through. For hero elements and rings. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 30,
  mass: 1,
};

/** Heavy and deliberate. For full-screen sheets and route transitions. */
export const springSheet: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 38,
  mass: 1.1,
};

/** Non-spring easing for opacity-only fades, where a spring reads as sloppy. */
export const ease: Transition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] };
export const easeFast: Transition = { duration: 0.15, ease: [0.22, 1, 0.36, 1] };

/* -- Reusable variants ----------------------------------------------------- */

/** Rise and fade in. The workhorse entrance. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
  exit: { opacity: 0, y: -8, transition: easeFast },
};

/** Scale up from slightly small. For cards and tiles that "pop" into place. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.97, transition: easeFast },
};

/** Pure fade, for crossfading content that shouldn't move. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: ease },
  exit: { opacity: 0, transition: easeFast },
};

/** Bottom sheet. Slides from below the fold. */
export const sheetUp: Variants = {
  hidden: { y: "100%" },
  show: { y: 0, transition: springSheet },
  exit: { y: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

/**
 * Parent that releases children one after another.
 * Pair with any child variant that uses the same hidden/show names.
 */
export function stagger(childDelay = 0.05, initialDelay = 0): Variants {
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: childDelay,
        delayChildren: initialDelay,
      },
    },
    exit: {
      transition: { staggerChildren: 0.03, staggerDirection: -1 },
    },
  };
}

/** Directional slide, for wizard steps that should track navigation direction. */
export const slideVariants: Variants = {
  hidden: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  show: { opacity: 1, x: 0, transition: spring },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -48 : 48,
    transition: easeFast,
  }),
};

/** Tap feedback applied to every interactive surface. */
export const pressable = {
  whileTap: { scale: 0.97 },
  whileHover: { scale: 1.01 },
  transition: springSnappy,
} as const;
