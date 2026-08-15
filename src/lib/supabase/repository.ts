import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import type {
  Goal,
  LogEntry,
  NutritionTargets,
  UserProfile,
} from "@/core/nutrition/types";

/* ============================================================================
   Repository
   ----------------------------------------------------------------------------
   The only place that knows how domain objects map onto rows. Components
   speak in domain types; this module owns the translation in both directions,
   so a schema change is contained here.

   No query filters by user_id. That is deliberate — RLS does it in the
   database, and a client-side filter would imply the security lives here when
   it does not. The session determines what is visible.
   ========================================================================== */

type Client = SupabaseClient<Database>;

export interface AccountSnapshot {
  profile: UserProfile;
  goal: Goal;
  targets: NutritionTargets;
}

/**
 * Everything needed to render the app for a signed-in user.
 * Returns null when onboarding has not been completed.
 */
export async function loadAccount(
  supabase: Client,
  userId: string,
): Promise<AccountSnapshot | null> {
  const [profileResult, goalResult, targetResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("goals")
      .select("*")
      .eq("is_active", true)
      .maybeSingle(),
    // Targets are append-only and versioned; the newest effective row wins.
    supabase
      .from("targets")
      .select("*")
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (goalResult.error) throw goalResult.error;
  if (targetResult.error) throw targetResult.error;

  const profileRow = profileResult.data;
  const goalRow = goalResult.data;
  const targetRow = targetResult.data;

  if (!profileRow || !goalRow || !targetRow) return null;

  return {
    profile: {
      age: profileRow.age,
      sex: profileRow.sex,
      heightCm: Number(profileRow.height_cm),
      weightKg: Number(profileRow.weight_kg),
      activityLevel: profileRow.activity_level,
      dietaryPattern: profileRow.dietary_pattern,
      allergies: profileRow.allergies,
      unitSystem: profileRow.unit_system,
    },
    goal: {
      type: goalRow.type,
      pace: goalRow.pace,
      targetWeightKg: goalRow.target_weight_kg ?? undefined,
      customTargets: goalRow.custom_targets ?? undefined,
    },
    targets: {
      calories: targetRow.calories,
      protein: targetRow.protein,
      carbs: targetRow.carbs,
      fat: targetRow.fat,
      fiber: targetRow.fiber,
      water: targetRow.water,
    },
  };
}

/** Persist the result of onboarding: profile, active goal, and first targets. */
export async function saveOnboarding(
  supabase: Client,
  userId: string,
  profile: UserProfile,
  goal: Goal,
  targets: NutritionTargets,
): Promise<void> {
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    age: profile.age,
    sex: profile.sex,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    activity_level: profile.activityLevel,
    dietary_pattern: profile.dietaryPattern,
    allergies: profile.allergies ?? [],
    unit_system: profile.unitSystem,
  });
  if (profileError) throw profileError;

  // A partial unique index enforces one active goal per user, so the previous
  // one has to be stood down before the new one is written.
  const { error: deactivateError } = await supabase
    .from("goals")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);
  if (deactivateError) throw deactivateError;

  const { data: goalRow, error: goalError } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      type: goal.type,
      pace: goal.pace,
      target_weight_kg: goal.targetWeightKg ?? null,
      custom_targets: goal.customTargets ?? null,
    })
    .select()
    .single();
  if (goalError) throw goalError;

  const { error: targetError } = await supabase.from("targets").upsert(
    {
      user_id: userId,
      goal_id: goalRow.id,
      effective_from: today(),
      calories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
      fiber: targets.fiber,
      water: targets.water,
      source: "derived",
    },
    // Re-running onboarding on the same day replaces that day's targets
    // rather than colliding with the (user_id, effective_from) unique key.
    { onConflict: "user_id,effective_from" },
  );
  if (targetError) throw targetError;
}

/** A day's entries, newest first, with their items. */
export async function loadEntriesForDay(
  supabase: Client,
  day: string = today(),
): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from("log_entries")
    .select("*, entry_items(*)")
    .eq("logged_on", day)
    .order("logged_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const items = (
      row as typeof row & { entry_items: Database["public"]["Tables"]["entry_items"]["Row"][] }
    ).entry_items;

    return {
      id: row.id,
      loggedAt: row.logged_at,
      slot: row.slot,
      rawInput: row.raw_input ?? "",
      source: row.source,
      photoUrl: row.photo_url ?? undefined,
      items: [...items]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          id: item.id,
          name: item.name,
          portion: item.portion,
          quantity: Number(item.quantity),
          unit: item.unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          confidence: Number(item.confidence),
        })),
      totals: {
        calories: row.total_calories,
        protein: row.total_protein,
        carbs: row.total_carbs,
        fat: row.total_fat,
        fiber: row.total_fiber,
        water: 0,
      },
    };
  });
}

/**
 * Write an entry and its items.
 *
 * The entry's totals are not written — a trigger recomputes them from the
 * items after this insert, which is what keeps the two permanently in step.
 */
export async function insertEntry(
  supabase: Client,
  userId: string,
  entry: LogEntry,
): Promise<void> {
  const { error: entryError } = await supabase.from("log_entries").insert({
    id: entry.id,
    user_id: userId,
    logged_at: entry.loggedAt,
    // The user's own local date, not the server's. Someone logging at 11pm
    // should see that meal on today, whatever timezone the database is in.
    logged_on: localDayOf(entry.loggedAt),
    slot: entry.slot,
    raw_input: entry.rawInput,
    source: entry.source,
    photo_url: entry.photoUrl ?? null,
  });
  if (entryError) throw entryError;

  if (entry.items.length === 0) return;

  const { error: itemsError } = await supabase.from("entry_items").insert(
    entry.items.map((item, index) => ({
      id: item.id,
      entry_id: entry.id,
      position: index,
      name: item.name,
      portion: item.portion,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      confidence: item.confidence,
    })),
  );
  if (itemsError) throw itemsError;
}

/** Items cascade on delete, so only the parent row needs removing. */
export async function deleteEntry(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("log_entries").delete().eq("id", id);
  if (error) throw error;
}

export async function recordWeight(
  supabase: Client,
  userId: string,
  weightKg: number,
  measuredOn: string = today(),
): Promise<void> {
  const { error } = await supabase
    .from("weight_logs")
    .upsert(
      { user_id: userId, weight_kg: weightKg, measured_on: measuredOn },
      { onConflict: "user_id,measured_on" },
    );
  if (error) throw error;
}

/* -- date helpers ----------------------------------------------------------- */

/** Local calendar date as YYYY-MM-DD. `toISOString` would shift the day. */
function today(): string {
  return localDayOf(new Date().toISOString());
}

function localDayOf(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
