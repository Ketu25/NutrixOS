"use client";

import { motion } from "motion/react";
import { macroSplit } from "@/core/nutrition/targets";
import { spring } from "@/lib/motion";
import type { NutritionTargets } from "@/core/nutrition/types";

/**
 * The protein / carb / fat split as one bar.
 *
 * Reads as a single object rather than three bars, which is the point: what
 * matters is the proportion between them, not each value in isolation.
 */
export function MacroSplitBar({ targets }: { targets: NutritionTargets }) {
  const split = macroSplit(targets);

  const segments = [
    { key: "protein", label: "Protein", fraction: split.protein, className: "bg-protein" },
    { key: "carbs", label: "Carbs", fraction: split.carbs, className: "bg-carbs" },
    { key: "fat", label: "Fat", fraction: split.fat, className: "bg-fat" },
  ];

  return (
    <div>
      <div
        className="flex h-2.5 gap-1 overflow-hidden"
        role="img"
        aria-label={segments
          .map((s) => `${s.label} ${Math.round(s.fraction * 100)}%`)
          .join(", ")}
      >
        {segments.map((segment, index) => (
          <motion.div
            key={segment.key}
            className={`h-full rounded-pill ${segment.className}`}
            initial={{ width: 0 }}
            animate={{ width: `${segment.fraction * 100}%` }}
            transition={{ ...spring, delay: index * 0.08 }}
          />
        ))}
      </div>

      <div className="mt-2 flex justify-center gap-4">
        {segments.map((segment) => (
          <span key={segment.key} className="text-[0.6875rem] text-tertiary">
            {segment.label}{" "}
            <span className="tnum font-medium text-secondary">
              {Math.round(segment.fraction * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
