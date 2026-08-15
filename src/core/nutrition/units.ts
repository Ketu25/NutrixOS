import type { UnitSystem } from "./types";

/* ============================================================================
   Unit conversion
   ----------------------------------------------------------------------------
   The domain stores metric, always. Imperial exists only at the edges, for
   display and input. Keeping one canonical unit internally means the targets
   engine never has to ask which system it is dealing with.
   ========================================================================== */

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const inchToCm = (inch: number) => inch * CM_PER_INCH;
export const cmToInch = (cm: number) => cm / CM_PER_INCH;

/** Split centimetres into feet and inches, rounding inches to the nearest whole. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cmToInch(cm));
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inchToCm(feet * 12 + inches);
}

export function formatWeight(kg: number, system: UnitSystem): string {
  return system === "metric"
    ? `${kg.toFixed(1)} kg`
    : `${kgToLb(kg).toFixed(1)} lb`;
}

export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === "metric") return `${Math.round(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}′ ${inches}″`;
}

/** Compact energy display: 1,850 rather than 1850. */
export function formatCalories(kcal: number): string {
  return Math.round(kcal).toLocaleString("en-US");
}

export function formatGrams(g: number): string {
  return `${Math.round(g)}g`;
}

export function formatVolume(ml: number, system: UnitSystem): string {
  if (system === "metric") {
    return ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${Math.round(ml)} ml`;
  }
  return `${(ml / 236.588).toFixed(1)} cups`;
}
