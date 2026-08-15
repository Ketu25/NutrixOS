# NutrixOS

An AI nutrition copilot. You say what you ate in your own words; it handles the
structuring, the maths, and the coaching.

The product bet is that the search-and-select flow every calorie tracker uses is
the reason people quit. So there is no food database to search here — there is a
text box, and a review step that shows you exactly what was assumed before
anything lands in your day.

```bash
npm install
cp .env.example .env.local   # optional — the app runs without any keys
npm run dev
```

## Where things live

```
src/
  core/nutrition/   Targets engine. Pure functions, no React, no network.
  core/ai/          Copilot contract, Claude implementation, and mock.
  components/       UI, grouped by surface (onboarding, today, logging).
  lib/              Design-system motion tokens, app state.
supabase/
  migrations/       Schema, RLS policies.
```

Three boundaries do most of the architectural work:

**`core/nutrition` knows nothing about React or the network.** BMR, TDEE, macro
derivation, projection, and adaptation are pure functions of their inputs, which
is why they can be exhaustively unit-tested (`npm test`) without mounting
anything or mocking a request.

**`core/ai` is an interface first.** The UI depends on `NutritionCopilot`, never
on a model provider. That is what lets the app ship complete and usable before
an API key exists — see below.

**The design system is token-driven.** Every colour, radius, shadow, and easing
curve resolves to a CSS custom property in `globals.css`. Light and dark are
both defined from the same token names, so nothing downstream branches on theme.
Motion is a fixed vocabulary of named springs in `lib/motion.ts` rather than a
per-component decision.

## Accounts and data ownership

Email and password via Supabase Auth. Every row is owned by a user and every
table has RLS keyed to `auth.uid()`, so isolation is enforced by Postgres
rather than by remembering to add a `where user_id = ?` in application code.
The repository deliberately contains **no** `user_id` filters for that reason —
a client-side filter would imply the security lives there when it doesn't.

Two failure modes shaped this code, both found by testing rather than review:

**Concurrent requests could silently sign a user out.** Supabase rotates the
refresh token on every use, and Next.js middleware builds a fresh server client
per request with no shared refresh lock. With `/api` inside the middleware
matcher, a page load racing two in-flight API calls meant three clients
attempting the same refresh — one wins, the others present an already-rotated
token, and the library treats that as an invalid session and clears the cookie.
`/api` is now excluded from the matcher; API routes read the session directly,
which only refreshes when the token has genuinely expired.

**The copilot routes were unauthenticated.** They spend money on every call, so
anyone who found the deployed URL could run up the Anthropic bill. RLS is no
help there — those routes never touch the database. They now require a session.

Email confirmation is on, so `signUp` returns a user with no session and the UI
shows a "check your inbox" state. `/auth/callback` handles both the PKCE
(`?code=`) and older (`?token_hash=`) link shapes, because which one Supabase
sends depends on project configuration and handling only one produces a
confirmation link that silently fails for half of all setups.

## Running without an API key

`getCopilot()` returns the Claude implementation when `ANTHROPIC_API_KEY` is
set, and a mock otherwise. The mock is not a stub returning a fixed blob — it
matches real foods, parses quantities ("3 eggs" → 3 × 72 kcal), infers the meal
slot from the clock, simulates latency so loading states get exercised, and
reports honest confidence.

That means local development, previews, and CI all work with no credentials, and
turning on real inference is an env var, not a refactor.

## Models

Selection is per task, not global:

| Task | Model | Why |
|---|---|---|
| Meal parsing | `claude-haiku-4-5` | Bounded extraction in the logging path, where latency *is* the product |
| Photo estimation | `claude-opus-5` | Judging portion size from a photo is genuinely hard |
| Daily coaching | `claude-opus-5` | Reading a day's numbers into one useful sentence |

Every call constrains generation with `output_config.format`, so the model
cannot emit a shape the app can't read. Responses are still validated with Zod
at the boundary — constrained generation guarantees the shape, not the
semantics, and a bad value should fail loudly rather than flow into the targets
engine as `NaN`.

## The estimates are honest, deliberately

Every parsed meal carries per-item confidence and a list of assumptions in plain
language ("Assumed cooked weight", "Assumed whole milk"). If an input is too
vague to estimate responsibly, the copilot asks a question instead of inventing
numbers to fill the schema.

This is a product decision, not a limitation. An estimate that hides its
uncertainty is worse than one that shows it.

## Safety constraints

The coaching prompt forbids commentary on body weight, appearance, or moral
worth, and forbids the language of guilt, reward, or "earning" food. Calorie
targets are floored at 1200 (F) / 1500 (M) regardless of what the goal maths
produces, and dietary fat is floored at 0.6 g/kg. A target that goes below those
is not a plan.

## Commands

```bash
npm run dev     # dev server
npm test        # targets engine unit tests
npm run lint    # eslint
npm run build   # production build
```
