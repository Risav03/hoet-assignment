"use client";
import { getLocalDB } from "@/lib/db/local";
import { diffToOTOps } from "@/lib/ot/apply";
import { transform } from "@/lib/ot/transform";
import type { OTOperation } from "@/lib/ot/types";
import type { SyncRequest, SyncResponse, SyncOpPayload } from "@/lib/types/document";

const BATCH_SIZE = 20;
let syncRunning = false;

// ── Unique ID ──────────────────────────────────────────────────────────────────

export function createDocOpId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createClientId(): string {
  if (typeof window === "undefined") return "server";
  const stored = localStorage.getItem("doc_client_id");
  if (stored) return stored;
  const id = `client-${Math.random().toString(36).slice(2, 11)}`;
  localStorage.setItem("doc_client_id", id);
  return id;
}

// ── Write flow (offline-first) ─────────────────────────────────────────────────

/**
 * Called on every debounced Tiptap onUpdate. Diffs the previous and next
 * plain-text representations to produce atomic OT insert/delete operations,
 * stores them in IndexedDB, and queues them for sync.
 */
export async function applyLocalChange(
  docId: string,
  workspaceId: string,
  prevText: string,
  nextText: string
): Promise<void> {
  const db = getLocalDB();
  const meta = await db.docMeta.get(docId);
  const baseRev = meta?.lastLocalRev ?? 0;
  const clientId = createClientId();
  const now = new Date().toISOString();

  let opCounter = 0;
  const makeOpId = () => {
    const id = createDocOpId() + (opCounter > 0 ? `-${opCounter}` : "");
    opCounter++;
    return id;
  };

  const ops = diffToOTOps(prevText, nextText, clientId, makeOpId, baseRev);
  if (ops.length === 0) return;

  let newRev = baseRev;

  await db.transaction("rw", [db.docMeta, db.docOps, db.docOutbox], async () => {
    for (const op of ops) {
      newRev += 1;
      await db.docOps.add({
        opId: op.opId,
        docId,
        clientId,
        baseRev: op.baseRev,
        type: op.type,
        position: op.position,
        text: op.type === "insert" ? op.text : undefined,
        length: op.type === "delete" ? op.length : undefined,
        createdAt: now,
        status: "pending",
      });

      await db.docOutbox.put({
        opId: op.opId,
        docId,
        retryCount: 0,
        nextRetryAt: now,
      });
    }

    if (meta) {
      await db.docMeta.update(docId, {
        lastLocalRev: newRev,
        isDirty: true,
        updatedAt: now,
      });
    } else {
      await db.docMeta.put({
        docId,
        workspaceId,
        title: "",
        lastKnownServerRev: 0,
        lastLocalRev: newRev,
        isDirty: true,
        updatedAt: now,
      });
    }
  });
}

// ── Local snapshot cache ──────────────────────────────────────────────────────

export async function cacheDocSnapshot(
  docId: string,
  rev: number,
  content: unknown
): Promise<void> {
  const db = getLocalDB();
  const snapshotId = `${docId}:${rev}`;
  await db.docSnapshots.put({ snapshotId, docId, rev, content, createdAt: new Date().toISOString() });
}

// ── Sync engine ───────────────────────────────────────────────────────────────

/**
 * Flush pending ops to the server. Respects back-off via nextRetryAt.
 * Idempotent — safe to call frequently.
 *
 * Returns the server response (which includes remote ops for the client to
 * apply) or null when there is nothing to flush / already flushing.
 */
export async function runDocSyncEngine(docId: string): Promise<SyncResponse | null> {
  if (syncRunning) return null;
  if (typeof window === "undefined") return null;
  if (!navigator.onLine) return null;

  syncRunning = true;
  try {
    return await _flush(docId);
  } finally {
    syncRunning = false;
  }
}

async function _flush(docId: string): Promise<SyncResponse | null> {
  const db = getLocalDB();
  const now = new Date().toISOString();

  const outboxEntries = await db.docOutbox
    .where("docId")
    .equals(docId)
    .filter((e) => e.nextRetryAt <= now)
    .limit(BATCH_SIZE)
    .toArray();

  if (outboxEntries.length === 0) return null;

  const opIds = outboxEntries.map((e) => e.opId);
  const ops = await db.docOps
    .where("opId")
    .anyOf(opIds)
    .filter((o) => o.status === "pending" || o.status === "sent")
    .toArray();

  if (ops.length === 0) return null;

  const meta = await db.docMeta.get(docId);
  const baseRev = meta?.lastKnownServerRev ?? 0;
  const clientId = createClientId();

  const payload: SyncRequest = {
    clientId,
    baseRev,
    ops: ops.map<SyncOpPayload>((op) => ({
      opId: op.opId,
      clientId: op.clientId,
      baseRev: op.baseRev,
      type: op.type,
      position: op.position,
      text: op.text,
      length: op.length,
      createdAt: op.createdAt,
    })),
  };

  // Mark as sent
  await db.docOps.where("opId").anyOf(opIds).modify({ status: "sent" });

  try {
    const res = await fetch(`/api/docs/${docId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      await _markRetry(docId, opIds, ops.map((o) => o.opId));
      return null;
    }

    const data: SyncResponse = await res.json();

    for (const opId of data.acceptedOps) {
      await db.docOps.where("opId").equals(opId).modify({ status: "acked" });
      await db.docOutbox.where("opId").equals(opId).delete();
    }

    if (meta) {
      await db.docMeta.update(docId, {
        lastKnownServerRev: data.newRev,
        isDirty: data.acceptedOps.length < opIds.length,
      });
    }

    return data;
  } catch {
    await _markRetry(docId, opIds, ops.map((o) => o.opId));
    return null;
  }
}

async function _markRetry(
  docId: string,
  outboxOpIds: string[],
  opIds: string[]
): Promise<void> {
  const db = getLocalDB();
  await db.docOps.where("opId").anyOf(opIds).modify({ status: "pending" });
  const nextRetry = new Date(Date.now() + 5_000).toISOString();
  await db.docOutbox
    .where("opId")
    .anyOf(outboxOpIds)
    .modify((entry) => {
      entry.retryCount += 1;
      entry.nextRetryAt = nextRetry;
    });
  const entries = await db.docOutbox.where("opId").anyOf(outboxOpIds).toArray();
  for (const entry of entries) {
    if (entry.retryCount >= 5) {
      await db.docOps.where("opId").equals(entry.opId).modify({ status: "failed" });
      await db.docOutbox.where("opId").equals(entry.opId).delete();
    }
  }
  await db.docMeta.update(docId, { isDirty: true });
}

// ── Client-side OT: transform remote ops against pending local ops ─────────────

/**
 * Transform a list of remote OT operations against the client's pending (not-yet-
 * acked) local operations, then return the adjusted remote ops for application
 * to the editor.
 *
 * This ensures remote changes land at the correct position even while the client
 * has unsynced local edits in the outbox.
 */
export async function transformRemoteOps(
  docId: string,
  remoteOps: SyncOpPayload[]
): Promise<OTOperation[]> {
  if (remoteOps.length === 0) return [];

  const db = getLocalDB();

  // Collect all local pending / sent ops (not yet acked) to transform against
  const localOps = await db.docOps
    .where("docId")
    .equals(docId)
    .filter((o) => o.status === "pending" || o.status === "sent")
    .sortBy("baseRev");

  const localOT: OTOperation[] = localOps
    .map((o): OTOperation | null => {
      if (o.type === "insert" && o.text !== undefined) {
        return { type: "insert", position: o.position, text: o.text, clientId: o.clientId, opId: o.opId, baseRev: o.baseRev };
      }
      if (o.type === "delete" && o.length !== undefined) {
        return { type: "delete", position: o.position, length: o.length, clientId: o.clientId, opId: o.opId, baseRev: o.baseRev };
      }
      return null;
    })
    .filter((o): o is OTOperation => o !== null);

  return remoteOps
    .map((remotePayload): OTOperation | null => {
      let remoteOT: OTOperation;
      if (remotePayload.type === "insert") {
        if (!remotePayload.text) return null;
        remoteOT = {
          type: "insert",
          position: remotePayload.position,
          text: remotePayload.text,
          clientId: remotePayload.clientId,
          opId: remotePayload.opId,
          baseRev: remotePayload.baseRev,
        };
      } else {
        if (remotePayload.length === undefined) return null;
        remoteOT = {
          type: "delete",
          position: remotePayload.position,
          length: remotePayload.length,
          clientId: remotePayload.clientId,
          opId: remotePayload.opId,
          baseRev: remotePayload.baseRev,
        };
      }

      for (const localOp of localOT) {
        remoteOT = transform(remoteOT, localOp);
      }

      return remoteOT;
    })
    .filter((o): o is OTOperation => o !== null);
}

// ── Pending count ─────────────────────────────────────────────────────────────

export async function getPendingDocOpCount(docId: string): Promise<number> {
  const db = getLocalDB();
  return db.docOutbox.where("docId").equals(docId).count();
}
