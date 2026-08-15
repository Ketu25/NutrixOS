/**
 * Generated from the live schema — do not edit by hand.
 *
 *   npx supabase gen types typescript --project-id tyhiagylqkfvvcxvlpjp
 *
 * Regenerate after every migration. Domain-facing aliases live in `./types`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      entry_items: {
        Row: {
          calories: number;
          carbs: number;
          confidence: number;
          created_at: string;
          entry_id: string;
          fat: number;
          fiber: number;
          id: string;
          name: string;
          portion: string;
          position: number;
          protein: number;
          quantity: number;
          unit: string;
        };
        Insert: {
          calories?: number;
          carbs?: number;
          confidence?: number;
          created_at?: string;
          entry_id: string;
          fat?: number;
          fiber?: number;
          id?: string;
          name: string;
          portion: string;
          position?: number;
          protein?: number;
          quantity?: number;
          unit?: string;
        };
        Update: {
          calories?: number;
          carbs?: number;
          confidence?: number;
          created_at?: string;
          entry_id?: string;
          fat?: number;
          fiber?: number;
          id?: string;
          name?: string;
          portion?: string;
          position?: number;
          protein?: number;
          quantity?: number;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entry_items_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "log_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          created_at: string;
          custom_targets: Json | null;
          id: string;
          is_active: boolean;
          pace: Database["public"]["Enums"]["goal_pace"];
          target_weight_kg: number | null;
          type: Database["public"]["Enums"]["goal_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          custom_targets?: Json | null;
          id?: string;
          is_active?: boolean;
          pace?: Database["public"]["Enums"]["goal_pace"];
          target_weight_kg?: number | null;
          type: Database["public"]["Enums"]["goal_type"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          custom_targets?: Json | null;
          id?: string;
          is_active?: boolean;
          pace?: Database["public"]["Enums"]["goal_pace"];
          target_weight_kg?: number | null;
          type?: Database["public"]["Enums"]["goal_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      insights: {
        Row: {
          body: string;
          created_at: string;
          for_date: string;
          headline: string;
          id: string;
          suggestions: string[];
          tone: Database["public"]["Enums"]["insight_tone"];
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          for_date?: string;
          headline: string;
          id?: string;
          suggestions?: string[];
          tone?: Database["public"]["Enums"]["insight_tone"];
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          for_date?: string;
          headline?: string;
          id?: string;
          suggestions?: string[];
          tone?: Database["public"]["Enums"]["insight_tone"];
          user_id?: string;
        };
        Relationships: [];
      };
      log_entries: {
        Row: {
          created_at: string;
          id: string;
          logged_at: string;
          logged_on: string;
          photo_url: string | null;
          raw_input: string | null;
          slot: Database["public"]["Enums"]["meal_slot"];
          source: Database["public"]["Enums"]["entry_source"];
          total_calories: number;
          total_carbs: number;
          total_fat: number;
          total_fiber: number;
          total_protein: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logged_at?: string;
          logged_on?: string;
          photo_url?: string | null;
          raw_input?: string | null;
          slot: Database["public"]["Enums"]["meal_slot"];
          source?: Database["public"]["Enums"]["entry_source"];
          total_calories?: number;
          total_carbs?: number;
          total_fat?: number;
          total_fiber?: number;
          total_protein?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logged_at?: string;
          logged_on?: string;
          photo_url?: string | null;
          raw_input?: string | null;
          slot?: Database["public"]["Enums"]["meal_slot"];
          source?: Database["public"]["Enums"]["entry_source"];
          total_calories?: number;
          total_carbs?: number;
          total_fat?: number;
          total_fiber?: number;
          total_protein?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"];
          age: number;
          allergies: string[];
          created_at: string;
          dietary_pattern: Database["public"]["Enums"]["dietary_pattern"];
          display_name: string | null;
          height_cm: number;
          id: string;
          sex: Database["public"]["Enums"]["sex"];
          unit_system: Database["public"]["Enums"]["unit_system"];
          updated_at: string;
          weight_kg: number;
        };
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"];
          age: number;
          allergies?: string[];
          created_at?: string;
          dietary_pattern?: Database["public"]["Enums"]["dietary_pattern"];
          display_name?: string | null;
          height_cm: number;
          id: string;
          sex: Database["public"]["Enums"]["sex"];
          unit_system?: Database["public"]["Enums"]["unit_system"];
          updated_at?: string;
          weight_kg: number;
        };
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"];
          age?: number;
          allergies?: string[];
          created_at?: string;
          dietary_pattern?: Database["public"]["Enums"]["dietary_pattern"];
          display_name?: string | null;
          height_cm?: number;
          id?: string;
          sex?: Database["public"]["Enums"]["sex"];
          unit_system?: Database["public"]["Enums"]["unit_system"];
          updated_at?: string;
          weight_kg?: number;
        };
        Relationships: [];
      };
      targets: {
        Row: {
          calories: number;
          carbs: number;
          created_at: string;
          effective_from: string;
          fat: number;
          fiber: number;
          goal_id: string | null;
          id: string;
          protein: number;
          rationale: string | null;
          source: Database["public"]["Enums"]["target_source"];
          user_id: string;
          water: number;
        };
        Insert: {
          calories: number;
          carbs: number;
          created_at?: string;
          effective_from?: string;
          fat: number;
          fiber: number;
          goal_id?: string | null;
          id?: string;
          protein: number;
          rationale?: string | null;
          source?: Database["public"]["Enums"]["target_source"];
          user_id: string;
          water?: number;
        };
        Update: {
          calories?: number;
          carbs?: number;
          created_at?: string;
          effective_from?: string;
          fat?: number;
          fiber?: number;
          goal_id?: string | null;
          id?: string;
          protein?: number;
          rationale?: string | null;
          source?: Database["public"]["Enums"]["target_source"];
          user_id?: string;
          water?: number;
        };
        Relationships: [
          {
            foreignKeyName: "targets_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
        ];
      };
      weight_logs: {
        Row: {
          created_at: string;
          id: string;
          measured_on: string;
          user_id: string;
          weight_kg: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          measured_on?: string;
          user_id: string;
          weight_kg: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          measured_on?: string;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      daily_totals: {
        Row: {
          calories: number | null;
          carbs: number | null;
          entry_count: number | null;
          fat: number | null;
          fiber: number | null;
          logged_on: string | null;
          protein: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      activity_level: "sedentary" | "light" | "moderate" | "active" | "athlete";
      dietary_pattern:
        | "omnivore"
        | "vegetarian"
        | "vegan"
        | "pescatarian"
        | "keto"
        | "paleo"
        | "mediterranean";
      entry_source: "text" | "voice" | "photo" | "manual" | "recipe";
      goal_pace: "gentle" | "steady" | "aggressive";
      goal_type:
        | "lose_fat"
        | "maintain"
        | "gain_muscle"
        | "improve_nutrition"
        | "custom";
      insight_tone: "positive" | "neutral" | "warning";
      meal_slot: "breakfast" | "lunch" | "dinner" | "snack";
      sex: "male" | "female";
      target_source: "derived" | "adapted" | "manual";
      unit_system: "metric" | "imperial";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
