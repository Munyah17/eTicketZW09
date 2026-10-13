// Run arbitrary SQL against the Supabase Management API query endpoint.
//   node scripts/_sb-query.mjs "select 1"
//   node scripts/_sb-query.mjs --file path/to.sql
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("Missing SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

let sql;
if (process.argv[2] === "--file") {
  const { readFileSync } = await import("fs");
  sql = readFileSync(process.argv[3], "utf8");
} else {
  sql = process.argv.slice(2).join(" ");
}

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
const text = await r.text();
console.log(`Status: ${r.status}`);
console.log(text);
if (!r.ok) process.exit(1);
