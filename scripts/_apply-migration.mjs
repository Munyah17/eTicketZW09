// Applies a SQL migration file directly to production via the Supabase
// Management API — used when there's no direct Postgres/DB password
// available for `supabase db push` (only SUPABASE_ACCESS_TOKEN +
// SUPABASE_PROJECT_REF). Not part of the deployed app.
//
//   node --env-file=.env.local scripts/_apply-migration.mjs <path-to-sql-file>

import { readFileSync } from "fs";

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const filePath = process.argv[2];

if (!ref || !token) {
  console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN in the environment.");
  process.exit(1);
}
if (!filePath) {
  console.error("Usage: node scripts/_apply-migration.mjs <path-to-sql-file>");
  process.exit(1);
}

const sql = readFileSync(filePath, "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
console.log(`Status: ${res.status}`);
console.log(text);

if (!res.ok) process.exit(1);
