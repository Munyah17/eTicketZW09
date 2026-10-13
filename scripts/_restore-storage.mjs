// One-off: recreate storage buckets + upload objects exported from the old
// project. Expects the storage zip extracted to <dir>/<old-ref>/<bucket>/<key>.
//   node --env-file=.env.local scripts/_restore-storage.mjs <extracted-dir>
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const root = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!root || !url || !key) {
  console.error("Usage: node --env-file=.env.local scripts/_restore-storage.mjs <dir>");
  process.exit(1);
}

const MIME = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  gif: "image/gif", svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm",
  pdf: "application/pdf",
};

// Bucket defs carried over from the old project's storage.buckets rows.
const BUCKETS = {
  banners: { public: true, file_size_limit: 5242880, allowed_mime_types: ["image/png", "image/jpeg", "image/webp"] },
  events: { public: true, file_size_limit: 20971520, allowed_mime_types: ["image/png", "image/jpeg", "image/webp", "image/gif"] },
};

const api = (path, init = {}) =>
  fetch(`${url}/storage/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, apikey: key, ...(init.headers || {}) },
  });

// create buckets
for (const [name, cfg] of Object.entries(BUCKETS)) {
  const r = await api("/bucket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: name, name, public: cfg.public, file_size_limit: cfg.file_size_limit, allowed_mime_types: cfg.allowed_mime_types }),
  });
  const t = await r.text();
  console.log(`bucket ${name}: ${r.status} ${t}`);
}

// walk files: root/<old-ref>/<bucket>/<key...>
const [refDir] = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
const jobs = [];
let ok = 0, fail = 0;
for (const bucket of readdirSync(join(root, refDir))) {
  const walk = (dir, prefix) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { walk(p, `${prefix}${e}/`); continue; }
      const ext = e.split(".").pop().toLowerCase();
      jobs.push({ bucket, key: `${prefix}${e}`, path: p, mime: MIME[ext] || "application/octet-stream" });
    }
  };
  walk(join(root, refDir, bucket), "");
}

for (const j of jobs) {
  const r = await api(`/object/${j.bucket}/${j.key}`, {
    method: "POST",
    headers: { "Content-Type": j.mime, "x-upsert": "true" },
    body: readFileSync(j.path),
    duplex: "half",
  });
  if (r.ok) { ok++; } else { fail++; console.log(`FAIL ${j.bucket}/${j.key}: ${r.status} ${await r.text()}`); }
}
console.log(`uploaded ${ok}/${jobs.length} (${fail} failed)`);
