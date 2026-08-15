import type { Database } from "./types.generated";

/* ============================================================================
   Schema type aliases
   ----------------------------------------------------------------------------
   `types.generated.ts` is the source of truth, generated from the live schema.
   This file only gives its rows and enums readable names, so call sites read
   as `ProfileRow` rather than
   `Database["public"]["Tables"]["profiles"]["Row"]`.

   Regenerate after every migration:
     npx supabase gen types typescript --project-id tyhiagylqkfvvcxvlpjp \
       > src/lib/supabase/types.generated.ts

   Two things the generator got right that a hand-written version did not:

     * Every column of `daily_totals` is nullable. It is an aggregate view, so
       PostgREST cannot prove non-nullness — code reading it has to cope.
     * Relationships are populated, which is what lets the client infer the
       shape of an embedded `select("*, entry_items(*)")` instead of falling
       back to a cast.
   ========================================================================== */

export type { Database, Json } from "./types.generated";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type ProfileRow = Tables["profiles"]["Row"];
export type ProfileInsert = Tables["profiles"]["Insert"];

export type GoalRow = Tables["goals"]["Row"];
export type GoalInsert = Tables["goals"]["Insert"];

export type TargetRow = Tables["targets"]["Row"];
export type TargetInsert = Tables["targets"]["Insert"];

export type LogEntryRow = Tables["log_entries"]["Row"];
export type LogEntryInsert = Tables["log_entries"]["Insert"];

export type EntryItemRow = Tables["entry_items"]["Row"];
export type EntryItemInsert = Tables["entry_items"]["Insert"];

export type WeightLogRow = Tables["weight_logs"]["Row"];
export type InsightRow = Tables["insights"]["Row"];

export type DailyTotalsRow = Database["public"]["Views"]["daily_totals"]["Row"];

export type Sex = Enums["sex"];
export type ActivityLevel = Enums["activity_level"];
export type GoalTypeRow = Enums["goal_type"];
export type GoalPaceRow = Enums["goal_pace"];
export type DietaryPatternRow = Enums["dietary_pattern"];
export type UnitSystemRow = Enums["unit_system"];
export type MealSlotRow = Enums["meal_slot"];
export type EntrySourceRow = Enums["entry_source"];
export type TargetSourceRow = Enums["target_source"];
export type InsightToneRow = Enums["insight_tone"];
