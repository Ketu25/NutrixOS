/* ============================================================================
   Database types
   ----------------------------------------------------------------------------
   Hand-written to mirror supabase/migrations/0001_init.sql. Once the migration
   is applied these can be regenerated from the live schema, which is the
   better long-term source:

     supabase gen types typescript --project-id tyhiagylqkfvvcxvlpjp

   Until then this file is the contract, and it is the thing to update in
   lockstep with any migration change.
   ========================================================================== */

export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "athlete";
export type GoalTypeRow =
  | "lose_fat"
  | "maintain"
  | "gain_muscle"
  | "improve_nutrition"
  | "custom";
export type GoalPaceRow = "gentle" | "steady" | "aggressive";
export type DietaryPatternRow =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "keto"
  | "paleo"
  | "mediterranean";
export type UnitSystemRow = "metric" | "imperial";
export type MealSlotRow = "breakfast" | "lunch" | "dinner" | "snack";
export type EntrySourceRow = "text" | "voice" | "photo" | "manual" | "recipe";
export type TargetSourceRow = "derived" | "adapted" | "manual";
export type InsightToneRow = "positive" | "neutral" | "warning";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  age: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  dietary_pattern: DietaryPatternRow;
  allergies: string[];
  unit_system: UnitSystemRow;
  created_at: string;
  updated_at: string;
}

export type GoalRow = {
  id: string;
  user_id: string;
  type: GoalTypeRow;
  pace: GoalPaceRow;
  target_weight_kg: number | null;
  custom_targets: Record<string, number> | null;
  is_active: boolean;
  created_at: string;
}

export type TargetRow = {
  id: string;
  user_id: string;
  goal_id: string | null;
  effective_from: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
  source: TargetSourceRow;
  rationale: string | null;
  created_at: string;
}

export type LogEntryRow = {
  id: string;
  user_id: string;
  logged_at: string;
  logged_on: string;
  slot: MealSlotRow;
  raw_input: string | null;
  source: EntrySourceRow;
  photo_url: string | null;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fiber: number;
  created_at: string;
  updated_at: string;
}

export type EntryItemRow = {
  id: string;
  entry_id: string;
  position: number;
  name: string;
  portion: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: number;
  created_at: string;
}

export type WeightLogRow = {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: number;
  created_at: string;
}

/**
 * Makes the named keys optional. Used to model columns the database will fill
 * in — anything with a DEFAULT, and anything nullable — so callers are not
 * forced to pass ids, timestamps, or explicit nulls the schema already handles.
 */
type Defaulted<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Shape consumed by the Supabase client's generics.
 *
 * Note every Row above is a `type`, not an `interface`. Interfaces do not get
 * an implicit index signature, so an interface Row fails supabase-js's
 * `Record<string, unknown>` constraint — and the failure is silent: the schema
 * stops satisfying GenericSchema and every query result degrades to `never`
 * instead of raising a useful error. Keep these as type aliases.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Defaulted<
          ProfileRow,
          | "display_name"
          | "activity_level"
          | "dietary_pattern"
          | "allergies"
          | "unit_system"
          | "created_at"
          | "updated_at"
        >;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      goals: {
        Row: GoalRow;
        Insert: Defaulted<
          GoalRow,
          "id" | "pace" | "target_weight_kg" | "custom_targets" | "is_active" | "created_at"
        >;
        Update: Partial<GoalRow>;
        Relationships: [];
      };
      targets: {
        Row: TargetRow;
        Insert: Defaulted<
          TargetRow,
          | "id"
          | "goal_id"
          | "effective_from"
          | "water"
          | "source"
          | "rationale"
          | "created_at"
        >;
        Update: Partial<TargetRow>;
        Relationships: [];
      };
      log_entries: {
        Row: LogEntryRow;
        // The five total_* columns are maintained by trigger, never written
        // by the client — writing them here would be overwritten anyway.
        Insert: Defaulted<
          Omit<
            LogEntryRow,
            | "total_calories"
            | "total_protein"
            | "total_carbs"
            | "total_fat"
            | "total_fiber"
          >,
          | "id"
          | "logged_at"
          | "logged_on"
          | "raw_input"
          | "source"
          | "photo_url"
          | "created_at"
          | "updated_at"
        >;
        Update: Partial<LogEntryRow>;
        Relationships: [];
      };
      entry_items: {
        Row: EntryItemRow;
        Insert: Defaulted<
          EntryItemRow,
          | "id"
          | "position"
          | "quantity"
          | "unit"
          | "calories"
          | "protein"
          | "carbs"
          | "fat"
          | "fiber"
          | "confidence"
          | "created_at"
        >;
        Update: Partial<EntryItemRow>;
        Relationships: [];
      };
      weight_logs: {
        Row: WeightLogRow;
        Insert: Defaulted<WeightLogRow, "id" | "measured_on" | "created_at">;
        Update: Partial<WeightLogRow>;
        Relationships: [];
      };
    };
    Views: {
      daily_totals: {
        Row: {
          user_id: string;
          logged_on: string;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          fiber: number;
          entry_count: number;
        };
        Relationships: [];
      };
    };
    // Required by supabase-js's GenericSchema even when empty. Enums and
    // CompositeTypes are not part of that constraint, but the type generator
    // emits them, so they are kept here to stay diffable against generated
    // output later.
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
