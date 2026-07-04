import fs from "fs";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "logs", "error.log");

// Structured server-side error logging. In production on Vercel the
// filesystem is read-only outside of /tmp (which doesn't persist between
// invocations) — console.error is what actually gets captured there
// (visible via `vercel logs` / the dashboard), so that's the source of
// truth in production. Locally, also append to a real logs/error.log file
// for quick inspection without needing the Vercel CLI.
export function logError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...extra,
  };

  console.error(JSON.stringify(entry));

  if (process.env.NODE_ENV !== "production") {
    try {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
      fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
    } catch {
      // Best-effort only — logging must never crash the request it's logging for.
    }
  }
}
