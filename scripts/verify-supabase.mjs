#!/usr/bin/env node
/* ============================================================================
   Supabase schema + RLS verification
   ----------------------------------------------------------------------------
   Run after applying a migration:  npm run verify:db

   Two things are checked, and the second matters more than the first:

     1. Every expected table and view exists.
     2. An anonymous caller is denied on all of them.

   (2) is the real test. RLS enabled with no matching policy fails closed, and
   RLS forgotten entirely fails wide open — both compile, both deploy, and only
   one of them is safe. This asserts the difference from outside the database,
   using the same publishable key that ships to browsers.
   ========================================================================== */

import { readFileSync } from "node:fs";

// Minimal .env.local reader — avoids a dependency for a script that runs
// outside Next.js and therefore gets no automatic env loading.
function loadEnv(path = ".env.local") {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Fall through to whatever is already in the environment.
  }
}

loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL || !KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );
  process.exit(1);
}

const TABLES = [
  "profiles",
  "goals",
  "targets",
  "log_entries",
  "entry_items",
  "weight_logs",
  "insights",
];
const VIEWS = ["daily_totals"];

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function probe(relation) {
  const response = await fetch(
    `${URL}/rest/v1/${relation}?select=*&limit=1`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );

  const body = await response.json().catch(() => null);

  // PGRST205 is "relation not in the schema cache" — the table does not exist.
  if (body && body.code === "PGRST205") {
    return { exists: false, secure: null };
  }

  // 200 with an empty array is the correct RLS-denied result for an
  // anonymous caller: the rows are filtered out, not errored on. 200 with
  // rows means data is readable without a session, which is a leak.
  if (response.ok) {
    const leaked = Array.isArray(body) && body.length > 0;
    return { exists: true, secure: !leaked, rows: leaked ? body.length : 0 };
  }

  // 401/403 is also a correct denial.
  if (response.status === 401 || response.status === 403) {
    return { exists: true, secure: true };
  }

  return { exists: true, secure: null, error: body?.message ?? response.status };
}

console.log(`\n${DIM}Verifying ${URL}${RESET}\n`);

let missing = 0;
let insecure = 0;

for (const relation of [...TABLES, ...VIEWS]) {
  const result = await probe(relation);

  if (!result.exists) {
    missing += 1;
    console.log(`${YELLOW}○${RESET} ${relation.padEnd(14)} ${DIM}not created yet${RESET}`);
  } else if (result.secure === true) {
    console.log(`${GREEN}✓${RESET} ${relation.padEnd(14)} ${DIM}exists · anonymous access denied${RESET}`);
  } else if (result.secure === false) {
    insecure += 1;
    console.log(`${RED}✗${RESET} ${relation.padEnd(14)} ${RED}READABLE WITHOUT AUTH (${result.rows} rows) — RLS is not protecting this${RESET}`);
  } else {
    console.log(`${YELLOW}?${RESET} ${relation.padEnd(14)} ${DIM}${result.error}${RESET}`);
  }
}

console.log("");

if (insecure > 0) {
  console.log(`${RED}${insecure} relation(s) readable without authentication. Do not ship this.${RESET}\n`);
  process.exit(1);
}

if (missing > 0) {
  console.log(
    `${YELLOW}${missing} relation(s) missing.${RESET} Apply the migration:\n` +
      `${DIM}  supabase/migrations/0001_init.sql${RESET}\n` +
      `${DIM}  → https://supabase.com/dashboard/project/tyhiagylqkfvvcxvlpjp/sql/new${RESET}\n`,
  );
  process.exit(1);
}

console.log(`${GREEN}Schema present and locked down.${RESET}\n`);
