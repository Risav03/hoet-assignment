"use client";
import { compare, applyPatch, deepClone, type Operation as JSONPatchOp } from "fast-json-patch";
import { getLocalDB } from "@/lib/db/local";
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
 * Called on every Tiptap onUpdate. Generates a JSON Patch diff between the
 * previous and next Tiptap JSON content, stores the op in IndexedDB, and
 * queues it for sync. Does NOT make any network calls.
 */
export async function applyLocalChange(
  docId: string,
  workspaceId: string,
  prevContent: unknown,
  nextContent: unknown
): Promise<void> {
  const diff: JSONPatchOp[] = compare(
    prevContent as object,
    nextContent as object
  );
  if (diff.length === 0) return;

  const db = getLocalDB();
  const meta = await db.docMeta.get(docId);
  const baseRev = meta?.lastLocalRev ?? 0;
  const newRev = baseRev + 1;
  const opId = createDocOpId();
  const clientId = createClientId();
  const now = new Date().toISOString();

  await db.transaction("rw", [db.docMeta, db.docOps, db.docOutbox], async () => {
    await db.docOps.add({
      opId,
      docId,
      clientId,
      baseRev,
      diff,
      createdAt: now,
      status: "pending",
    });

    await db.docOutbox.put({
      opId,
      docId,
      retryCount: 0,
      nextRetryAt: now,
    });

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

// ── Local version reconstruction ──────────────────────────────────────────────

/**
 * Reconstruct the document content at a target rev by loading the nearest
 * local snapshot and replaying pending ops. Used for local offline preview.
 */
export async function reconstructAtRev(
  docId: string,
  targetRev: number
): Promise<unknown | null> {
  const db = getLocalDB();

  const snaps = await db.docSnapshots
    .where("[docId+rev]")
    .between([docId, 0], [docId, targetRev], true, true)
    .reverse()
    .first()
    .catch(() => null);

  // Fallback: just get the most recent snapshot for this doc
  const snap = snaps ?? (await db.docSnapshots
    .where("docId")
    .equals(docId)
    .last()
    .catch(() => null));

  if (!snap) return null;

  const ops = await db.docOps
    .where("docId")
    .equals(docId)
    .filter((op) => op.baseRev >= snap.rev && op.baseRev < targetRev)
    .sortBy("baseRev");

  let doc = deepClone(snap.content as object);
  for (const op of ops) {
    if (op.diff.length === 0) continue;
    try {
      doc = applyPatch(doc, op.diff, false, false).newDocument;
    } catch {
      // skip malformed patches
    }
  }

  return doc;
}

// ── Sync engine ───────────────────────────────────────────────────────────────

/**
 * Flush pending ops to the server. Respects back-off via nextRetryAt.
 * Idempotent — safe to call frequently.
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
      diff: op.diff,
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

    // Mark accepted ops as acked, remove from outbox
    for (const opId of data.acceptedOps) {
      await db.docOps.where("opId").equals(opId).modify({ status: "acked" });
      await db.docOutbox.where("opId").equals(opId).delete();
    }

    // Update lastKnownServerRev
    if (meta) {
      await db.docMeta.update(docId, {
        lastKnownServerRev: data.newRev,
        isDirty: data.acceptedOps.length < opIds.length,
      });
    }

    // Cache received remote snapshot if any
    if (data.remoteOps.length > 0) {
      // Remote ops received — the server has already merged; just update rev
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
  // Mark as failed after 5 retries
  const entries = await db.docOutbox.where("opId").anyOf(outboxOpIds).toArray();
  for (const entry of entries) {
    if (entry.retryCount >= 5) {
      await db.docOps.where("opId").equals(entry.opId).modify({ status: "failed" });
      await db.docOutbox.where("opId").equals(entry.opId).delete();
    }
  }
  await db.docMeta.update(docId, { isDirty: true });
}

// ── Pending count ─────────────────────────────────────────────────────────────

export async function getPendingDocOpCount(docId: string): Promise<number> {
  const db = getLocalDB();
  return db.docOutbox.where("docId").equals(docId).count();
}
