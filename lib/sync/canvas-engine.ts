"use client";
import { getLocalDB as getCanvasDB, type LocalBoardOp } from "@/lib/db/local";
import type { CanvasOp } from "@/lib/types/canvas";

const MAX_RETRIES = 5;
const BATCH_SIZE = 10;

let syncRunning = false;

export async function enqueueCanvasOp(
  op: Omit<LocalBoardOp, "id" | "status" | "retryCount">
) {
  const db = getCanvasDB();
  await db.boardOps.add({ ...op, status: "pending", retryCount: 0 });
}

export async function runCanvasSyncEngine(boardId: string): Promise<void> {
  if (syncRunning) return;
  syncRunning = true;

  const db = getCanvasDB();
  try {
    const pendingOps = await db.boardOps
      .where("status")
      .anyOf(["pending"])
      .filter((op) => op.boardId === boardId && op.retryCount < MAX_RETRIES)
      .sortBy("createdAt");

    if (pendingOps.length === 0) return;

    const batches = chunkArray(pendingOps, BATCH_SIZE);
    for (const batch of batches) {
      await processBatch(batch, boardId, db);
    }
  } finally {
    syncRunning = false;
  }
}

async function processBatch(
  ops: LocalBoardOp[],
  boardId: string,
  db: ReturnType<typeof getCanvasDB>
) {
  const ids = ops.map((o) => o.id!);

  await db.boardOps.where("id").anyOf(ids).modify({ status: "syncing" });

  const payload = ops.map((op) => ({
    operationId: op.operationId,
    op: op.op,
    createdAt: op.createdAt,
  }));

  try {
    const res = await fetch(`/api/boards/${boardId}/operations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations: payload }),
    });

    if (res.ok) {
      const data = await res.json() as {
        results: { operationId: string; proposalId?: string; status: string }[];
      };

      for (const result of data.results) {
        if (result.status === "pending" && result.proposalId) {
          const op = ops.find((o) => o.operationId === result.operationId);
          if (op?.id != null) {
            await db.boardOps.update(op.id, {
              status: "syncing",
              proposalId: result.proposalId,
            });
          }
        }
      }
    } else {
      await db.boardOps.where("id").anyOf(ids).modify((op: LocalBoardOp) => {
        op.status = "pending";
        op.retryCount += 1;
      });
    }
  } catch {
    await db.boardOps.where("id").anyOf(ids).modify((op: LocalBoardOp) => {
      op.status = "pending";
      op.retryCount += 1;
    });
  }
}

export async function markOpCommitted(operationId: string) {
  const db = getCanvasDB();
  const op = await db.boardOps.where("operationId").equals(operationId).first();
  if (op?.id != null) {
    await db.boardOps.update(op.id, {
      status: "committed",
      processedAt: new Date().toISOString(),
    });
  }
}

export async function markOpRejected(operationId: string) {
  const db = getCanvasDB();
  const op = await db.boardOps.where("operationId").equals(operationId).first();
  if (op?.id != null) {
    await db.boardOps.update(op.id, {
      status: "rejected",
      processedAt: new Date().toISOString(),
    });
  }
}

export async function getOpByProposalId(proposalId: string): Promise<LocalBoardOp | undefined> {
  const db = getCanvasDB();
  return db.boardOps.where("proposalId").equals(proposalId).first();
}

export function createOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function saveBoardSnapshot(
  boardId: string,
  workspaceId: string,
  title: string,
  nodes: Record<string, unknown>,
  edges: Record<string, unknown>
) {
  const db = getCanvasDB();
  await db.boardSnapshots.put({
    id: boardId,
    workspaceId,
    title,
    nodes: nodes as never,
    edges: edges as never,
    isArchived: false,
    snapshotAt: new Date().toISOString(),
  });
}

export async function getBoardSnapshot(boardId: string) {
  const db = getCanvasDB();
  return db.boardSnapshots.get(boardId);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function dispatchCanvasOp(
  boardId: string,
  workspaceId: string,
  userId: string,
  op: CanvasOp
): LocalBoardOp {
  const operationId = createOperationId();
  const localOp: LocalBoardOp = {
    operationId,
    boardId,
    workspaceId,
    userId,
    op,
    status: "pending",
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  return localOp;
}
