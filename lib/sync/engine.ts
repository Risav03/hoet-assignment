"use client";
import { getLocalDB, type LocalSyncOperation } from "@/lib/db/local";
import { computeChecksum } from "./differ";

const MAX_RETRIES = 5;
const BATCH_SIZE = 10;
const CHUNK_SIZE_BYTES = 50 * 1024; // 50KB

let syncRunning = false;

export async function enqueueSyncOperation(
  op: Omit<LocalSyncOperation, "id" | "status" | "retryCount">
) {
  const db = getLocalDB();
  await db.syncQueue.add({ ...op, status: "pending", retryCount: 0 });
}

export async function runSyncEngine(userId: string): Promise<void> {
  if (syncRunning) return;
  syncRunning = true;

  const db = getLocalDB();
  try {
    const pendingOps = await db.syncQueue
      .where("status")
      .anyOf(["pending", "failed"])
      .filter((op) => op.retryCount < MAX_RETRIES)
      .sortBy("createdAt");

    if (pendingOps.length === 0) return;

    const batches = chunkArray(pendingOps, BATCH_SIZE);
    for (const batch of batches) {
      const chunkBatches = splitBySize(batch, CHUNK_SIZE_BYTES);
      for (const chunk of chunkBatches) {
        await processBatch(chunk, userId, db);
      }
    }
  } finally {
    syncRunning = false;
  }
}

async function processBatch(
  ops: LocalSyncOperation[],
  userId: string,
  db: ReturnType<typeof getLocalDB>
) {
  const ids = ops.map((o) => o.id!);

  await db.syncQueue.where("id").anyOf(ids).modify({ status: "processing" });

  const payload = ops.map((op) => ({
    operationId: op.operationId,
    documentId: op.documentId,
    workspaceId: op.workspaceId,
    operationType: op.operationType,
    payload: op.payload,
    createdAt: op.createdAt,
    clientChecksum: op.clientChecksum,
  }));

  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations: payload }),
    });

    if (res.ok) {
      await db.syncQueue.where("id").anyOf(ids).modify({
        status: "completed",
        processedAt: new Date().toISOString(),
      });
    } else {
      await db.syncQueue.where("id").anyOf(ids).modify((op: LocalSyncOperation) => {
        op.status = "failed";
        op.retryCount += 1;
      });
    }
  } catch {
    await db.syncQueue.where("id").anyOf(ids).modify((op: LocalSyncOperation) => {
      op.status = "failed";
      op.retryCount += 1;
    });
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function splitBySize(ops: LocalSyncOperation[], maxBytes: number): LocalSyncOperation[][] {
  const chunks: LocalSyncOperation[][] = [];
  let current: LocalSyncOperation[] = [];
  let currentSize = 0;

  for (const op of ops) {
    const opSize = JSON.stringify(op.payload).length;
    if (currentSize + opSize > maxBytes && current.length > 0) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(op);
    currentSize += opSize;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function createOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function generateChecksum(content: string): string {
  return computeChecksum(content);
}
