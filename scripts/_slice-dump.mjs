// Slices a full Supabase "db_cluster" pg_dump into restore pieces for a fresh
// project: public-schema DDL, wanted table data (COPY -> INSERT), post-data
// DDL. One-off migration tooling, not part of the app.
//   node scripts/_slice-dump.mjs <dump.sql> <outdir>
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [dumpPath, outDir] = process.argv.slice(2);
if (!dumpPath || !outDir) {
  console.error("Usage: node scripts/_slice-dump.mjs <dump.sql> <outdir>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const lines = readFileSync(dumpPath, "utf8").split(/\r?\n/);
const HEADER = /^-- (?:Data for )?Name: (.*); Type: (.*); Schema: (.*); Owner: (.*)$/;
const COPY_RE = /^COPY (\S+) \((.*)\) FROM stdin;$/;

// Tables whose rows we carry over. Ephemeral auth state (flow_state,
// one_time_tokens, sessions, refresh_tokens) is skipped: old sessions are
// signed by the old project's JWT secret and are dead weight anyway.
const WANTED_DATA = new Set([
  "auth.users",
  "auth.identities",
  "auth.mfa_factors",
  "auth.mfa_recovery_code_sets",
  "auth.mfa_recovery_codes",
  "supabase_migrations.schema_migrations",
]);
// app triggers living on non-public tables (auth.users -> handle_new_user)
const EXTRA_DDL = new Set(["users on_auth_user_created|TRIGGER"]);

function unescapeCopyField(f) {
  let out = "";
  for (let i = 0; i < f.length; i++) {
    if (f[i] !== "\\") { out += f[i]; continue; }
    const c = f[++i];
    switch (c) {
      case "N": out += "\\N"; break; // shouldn't hit (handled earlier)
      case "n": out += "\n"; break;
      case "t": out += "\t"; break;
      case "r": out += "\r"; break;
      case "b": out += "\b"; break;
      case "f": out += "\f"; break;
      case "v": out += "\v"; break;
      case "\\": out += "\\"; break;
      default:
        if (c >= "0" && c <= "7") {
          const oct = f.slice(i, i + 3).match(/^[0-7]{1,3}/);
          out += String.fromCharCode(parseInt(oct[0], 8));
          i += oct[0].length - 1;
        } else {
          out += c;
        }
    }
  }
  return out;
}

function sqlLiteral(raw) {
  if (raw === "\\N") return "NULL";
  return "'" + unescapeCopyField(raw).replace(/'/g, "''") + "'";
}

const ddlPre = [];
const ddlPost = [];
const dataSql = [];
let phase = "pre";
let stats = { ddl: 0, dataTables: 0, rows: 0, skipped: 0 };

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(HEADER);
  if (!m) continue;
  const [, name, type, schema] = m;
  // body = lines until the "--" separator right before the next "-- Name:" header
  const body = [];
  let j = i + 1;
  while (j < lines.length) {
    if (lines[j] === "--" && lines[j + 1] && HEADER.test(lines[j + 1])) break;
    body.push(lines[j]);
    j++;
  }
  // strip trailing blank lines
  while (body.length && body[body.length - 1].trim() === "") body.pop();
  const sql = body.join("\n");

  if (type === "TABLE DATA") {
    phase = "data";
    const copyStart = body.findIndex((l) => COPY_RE.test(l));
    const cm = copyStart >= 0 ? body[copyStart].match(COPY_RE) : null;
    if (!cm) { stats.skipped++; i = j - 1; continue; }
    const table = cm[1];
    const cols = cm[2];
    if (schema !== "public" && !WANTED_DATA.has(table)) { stats.skipped++; i = j - 1; continue; }
    // rows live between the COPY line and the terminating "\."
    const rows = [];
    for (let k = copyStart + 1; k < body.length && body[k] !== "\\."; k++) rows.push(body[k]);
    if (rows.length) {
      const tuples = rows.map((r) => "(" + r.split("\t").map(sqlLiteral).join(",") + ")");
      dataSql.push(`INSERT INTO ${table} (${cols}) VALUES\n${tuples.join(",\n")};`);
      stats.rows += rows.length;
    }
    stats.dataTables++;
    i = j - 1;
    continue;
  }

  if (schema === "public" || EXTRA_DDL.has(`${name}|${type}`)) {
    if (type === "ACL" || type === "DEFAULT ACL" || type === "COMMENT") { stats.skipped++; i = j - 1; continue; }
    (phase === "data" ? ddlPost : ddlPre).push(sql);
    stats.ddl++;
  } else {
    stats.skipped++;
  }
  i = j - 1;
}

// auth FKs exist already — parents before children
const AUTH_ORDER = ["auth.users", "auth.identities", "auth.mfa_factors", "auth.mfa_recovery_code_sets", "auth.mfa_recovery_codes"];
dataSql.sort((a, b) => {
  const ta = AUTH_ORDER.findIndex((t) => a.startsWith(`INSERT INTO ${t} `));
  const tb = AUTH_ORDER.findIndex((t) => b.startsWith(`INSERT INTO ${t} `));
  return (ta === -1 ? 99 : ta) - (tb === -1 ? 99 : tb);
});

writeFileSync(join(outDir, "1_schema_pre.sql"), ddlPre.join("\n\n"));
writeFileSync(join(outDir, "2_data.sql"), "DELETE FROM auth.identities;\nDELETE FROM auth.mfa_factors;\nDELETE FROM auth.users;\n\n" + dataSql.join("\n\n"));
writeFileSync(join(outDir, "3_schema_post.sql"), ddlPost.join("\n\n"));
console.log(JSON.stringify(stats, null, 2));
console.log("pre:", ddlPre.length, "post:", ddlPost.length, "data:", dataSql.length);
