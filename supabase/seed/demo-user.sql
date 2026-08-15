-- ============================================================================
-- Demo account — DEVELOPMENT ONLY
-- ----------------------------------------------------------------------------
-- Creates a pre-confirmed account so the app can be tested without a working
-- inbox. Run it in the SQL Editor, replacing :demo_password first.
--
--   NEVER run this against production. It bypasses email confirmation, and an
--   account whose password lives in a repo is not an account, it is a back
--   door. Delete it before launch:
--
--     delete from auth.users where email = 'demo@nutrixos.app';
--
-- ----------------------------------------------------------------------------
-- Why this is more than a one-line insert:
--
--   * auth.identities needs a matching row for the email provider, and its
--     `email` column is GENERATED — inserting into it directly errors.
--
--   * GoTrue scans confirmation_token, recovery_token, email_change,
--     email_change_token_new, email_change_token_current, phone_change,
--     phone_change_token, and reauthentication_token into non-nullable Go
--     strings. Leaving them NULL makes login fail with a completely
--     unhelpful `500 "Database error querying schema"` — the row looks
--     perfect in the table view. They must be empty strings, which is what
--     GoTrue itself writes.
-- ============================================================================

do $$
declare
  uid uuid := gen_random_uuid();
  demo_email text := 'demo@nutrixos.app';
  -- Replace before running.
  demo_password text := ':demo_password';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    -- Empty strings, not NULL. See the note above.
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    demo_email,
    crypt(demo_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', demo_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end $$;

-- Reset the demo account to a fresh state without deleting it, so onboarding
-- can be walked through again:
--
--   delete from profiles    where id      = (select id from auth.users where email = 'demo@nutrixos.app');
--   delete from goals       where user_id = (select id from auth.users where email = 'demo@nutrixos.app');
--   delete from targets     where user_id = (select id from auth.users where email = 'demo@nutrixos.app');
--   delete from log_entries where user_id = (select id from auth.users where email = 'demo@nutrixos.app');
