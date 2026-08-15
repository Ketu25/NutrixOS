-- ============================================================================
-- Harden the trigger functions
-- ----------------------------------------------------------------------------
-- Two problems with 0001, both caught by the database linter after it was
-- applied:
--
--   1. Supabase exposes every function in the `public` schema over PostgREST
--      at /rest/v1/rpc/<name>. `sync_entry_totals` is SECURITY DEFINER, so it
--      was reachable by anon and authenticated callers running with the
--      owner's privileges. Trigger functions are invoked by the trigger, never
--      by a client, so no role needs EXECUTE on them.
--
--   2. `set_updated_at` had no fixed search_path, so a caller able to set a
--      session search_path could influence what the function body resolves to.
--      `sync_entry_totals` already pinned it; this brings the other in line.
--
-- Verified after applying: the triggers still fire correctly on insert and on
-- delete, and `get_advisors` reports no remaining security lints.
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Revoke from PUBLIC as well as the two API roles: PUBLIC is granted EXECUTE
-- by default, so revoking only anon and authenticated would leave the grant
-- intact through role inheritance.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.sync_entry_totals() from public, anon, authenticated;
