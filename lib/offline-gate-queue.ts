"use client";

import { isUuid, normalizeTicketCode } from "@/lib/validation";

// Offline-tolerant gate check-in. Venue connectivity in the field is
// unreliable, and a scanner that simply stops working the moment the network
// drops is a real problem, not a hypothetical one — this caches each
// event's ticket roster locally so scans can still be looked up and
// provisionally admitted with no connection, then queues those admits to
// replay against the real API once connectivity returns.
//
// Two independent gate devices provisionally admitting the same ticket while
// both offline is a real, unavoidable limitation of any offline-first
// check-in system — not something this can silently paper over. Those cases
// surface as conflicts after sync for a human to resolve, rather than being
// hidden.

const DB_NAME = "eticket-gate";
const DB_VERSION = 1;
const ROSTER_STORE = "roster";
const QUEUE_STORE = "queue";

export interface RawTicketRow {
  id: string;
  event_id: string;
  id_number?: string;
  qr_code?: string;
  is_admitted: boolean;
  payment_status: string;
  [key: string]: unknown;
}

export interface QueuedAdmit {
  localId: string;
  eventId: string;
  ticketId: string;
  admittedAt: string;
  admittedBy: string;
}

export interface SyncConflict {
  ticketId: string;
  message: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ROSTER_STORE)) {
        db.createObjectStore(ROSTER_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "localId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Replaces the entire cached roster for one event — called after every
// successful online fetch so the offline snapshot never drifts far from
// reality. Tickets from other events are left untouched.
export async function cacheRoster(eventId: string, tickets: RawTicketRow[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, "readwrite");
    const store = tx.objectStore(ROSTER_STORE);
    const clearReq = store.openCursor();
    clearReq.onsuccess = () => {
      const cursor = clearReq.result;
      if (cursor) {
        if ((cursor.value as RawTicketRow).event_id === eventId) cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => {
      const writeTx = db.transaction(ROSTER_STORE, "readwrite");
      const writeStore = writeTx.objectStore(ROSTER_STORE);
      for (const t of tickets) writeStore.put(t);
      writeTx.oncomplete = () => resolve();
      writeTx.onerror = () => reject(writeTx.error);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedRoster(eventId: string): Promise<RawTicketRow[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, "readonly");
    const store = tx.objectStore(ROSTER_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as RawTicketRow[]).filter((t) => t.event_id === eventId));
    req.onerror = () => reject(req.error);
  });
}

export type OfflineLookupResult =
  | { status: "valid"; ticket: RawTicketRow }
  | { status: "admitted"; ticket: RawTicketRow }
  | { status: "invalid"; ticket: RawTicketRow }
  | { status: "not_found" };

// Mirrors the server's /api/organizer/gate "scan" logic against the locally
// cached roster — same normalize-then-match approach, just reading from
// IndexedDB instead of Postgres.
export function lookupOffline(roster: RawTicketRow[], code: string): OfflineLookupResult {
  const normalized = normalizeTicketCode(code);
  const ticket = roster.find(
    (t) => (isUuid(normalized) && t.id === normalized) || (!!t.id_number && t.id_number === normalized)
  );
  if (!ticket) return { status: "not_found" };
  if (ticket.is_admitted) return { status: "admitted", ticket };
  if (ticket.payment_status !== "completed") return { status: "invalid", ticket };
  return { status: "valid", ticket };
}

// Marks a ticket admitted in the local roster snapshot immediately (so a
// second offline scan of the same ticket, on the same device, correctly
// shows "already admitted" instead of admitting it twice) and queues the
// real admit to replay once back online.
export async function queueOfflineAdmit(eventId: string, ticketId: string, admittedBy: string): Promise<void> {
  const db = await openDB();
  const now = new Date().toISOString();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, "readwrite");
    const store = tx.objectStore(ROSTER_STORE);
    const getReq = store.get(ticketId);
    getReq.onsuccess = () => {
      const ticket = getReq.result as RawTicketRow | undefined;
      if (ticket) {
        ticket.is_admitted = true;
        ticket.admitted_at = now;
        ticket.admitted_by = admittedBy;
        store.put(ticket);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const entry: QueuedAdmit = {
      localId: `${ticketId}-${now}`,
      eventId,
      ticketId,
      admittedAt: now,
      admittedBy,
    };
    tx.objectStore(QUEUE_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueue(eventId?: string): Promise<QueuedAdmit[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => {
      const all = req.result as QueuedAdmit[];
      resolve(eventId ? all.filter((q) => q.eventId === eventId) : all);
    };
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(localId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Replays every queued offline admit against the real API, in the order
// they happened. A ticket that comes back "already admitted" by the server
// (someone else — another gate device, or staff using the web dashboard —
// admitted it first) is a genuine conflict, not an error to retry; it's
// surfaced back to the caller for a human to look at rather than silently
// dropped or silently overwritten.
export async function syncQueue(
  eventId: string
): Promise<{ synced: number; conflicts: SyncConflict[]; stillOffline: boolean }> {
  const queue = await getQueue(eventId);
  let synced = 0;
  const conflicts: SyncConflict[] = [];

  for (const item of queue) {
    try {
      const res = await fetch("/api/organizer/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admit", ticketId: item.ticketId }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Network reached the server but it rejected the request outright
        // (not a conflict) — leave queued, something needs investigation.
        continue;
      }
      // The server guards the update with .eq("is_admitted", false), so if
      // someone else — another gate device, or staff using the web
      // dashboard — admitted this ticket first, our update matches zero
      // rows and the response carries *their* admitted_at instead of ours.
      // A returned admitted_at that doesn't match what this device recorded
      // at scan time means our offline admit lost the race.
      const serverAdmittedAt = json.ticket?.admitted_at ? new Date(json.ticket.admitted_at).getTime() : null;
      const ourAdmittedAt = new Date(item.admittedAt).getTime();
      if (serverAdmittedAt !== null && Math.abs(serverAdmittedAt - ourAdmittedAt) > 5000) {
        conflicts.push({
          ticketId: item.ticketId,
          message: `Already admitted elsewhere at ${new Date(serverAdmittedAt).toLocaleTimeString()} — this device also admitted it offline at ${new Date(ourAdmittedAt).toLocaleTimeString()}.`,
        });
      }
      synced++;
      await removeFromQueue(item.localId);
    } catch {
      // Still offline (or the request itself failed) — stop here, leave
      // the remaining queue for the next sync attempt.
      return { synced, conflicts, stillOffline: true };
    }
  }

  return { synced, conflicts, stillOffline: false };
}
