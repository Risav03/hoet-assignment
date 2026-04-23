import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getBoardById,
  hasRecentBoardVersion,
  createBoardVersion,
} from "@/lib/dal/board";
import { emitSSEEvent, updateWorkspaceState } from "@/lib/sse/redis-emitter";
import { getOrInitBoardState, applyOpToState, saveBoardState } from "@/lib/sync/board-redis";
import { z } from "zod";
import { ZodError } from "zod";
import type { CanvasOp } from "@/lib/types/canvas";

const VERSION_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

const USER_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

const canvasOpSchema = z.object({
  operationId: z.string().min(1).max(128),
  op: z.object({
    type: z.enum(["CREATE_NODE", "MOVE_NODE", "UPDATE_NODE", "DELETE_NODE", "CONNECT_NODES", "DELETE_EDGE"]),
    payload: z.record(z.string(), z.unknown()),
  }),
  createdAt: z.string().datetime(),
});

const batchSchema = z.object({
  operations: z.array(canvasOpSchema).min(1).max(50),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const authorId = session.user.id;
  const authorName = session.user.name ?? "Unknown";
  const authorColor = getColorForUser(authorId);

  try {
    const board = await getBoardById(boardId, authorId);
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const body = await req.json();
    const { operations } = batchSchema.parse(body);

    // Load board state from Redis once (falls back to DB on cache miss)
    let currentState = await getOrInitBoardState(boardId);
    let stateModified = false;

    const results: { operationId: string; status: "applied" | "conflict" | "error" }[] = [];

    for (const { operationId, op, createdAt } of operations) {
      try {
        const { result, nextState } = applyOpToState(
          currentState,
          op as CanvasOp,
          authorId,
          authorName,
          createdAt
        );

        if (result.applied) {
          currentState = nextState;
          stateModified = true;

          const appliedAt = new Date().toISOString();

          await updateWorkspaceState(board.workspaceId, {
            lastOp: { boardId, operationId, type: op.type, authorId, appliedAt },
          });

          await emitSSEEvent(board.workspaceId, {
            type: "canvas_op_applied",
            payload: {
              boardId,
              operationId,
              op,
              authorId,
              authorName,
              authorColor,
              appliedAt,
            },
          });

          results.push({ operationId, status: "applied" });
        } else {
          await emitSSEEvent(board.workspaceId, {
            type: "canvas_conflict_resolved",
            payload: {
              boardId,
              operationId,
              conflict: result.conflict,
            },
          });
          results.push({ operationId, status: "conflict" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ operationId, status: "error" });
        console.error("[board operations]", operationId, msg);
      }
    }

    // Persist the final state to Redis once and mark board + workspace dirty
    if (stateModified) {
      await saveBoardState(boardId, board.workspaceId, currentState);
    }

    // Auto-snapshot: create a board version if any op was applied and no recent
    // version exists for this user on this board (debounced to 5 minutes).
    const anyApplied = results.some((r) => r.status === "applied");
    if (anyApplied && stateModified) {
      try {
        const alreadySnapshotted = await hasRecentBoardVersion(
          boardId,
          authorId,
          VERSION_DEBOUNCE_MS
        );
        if (!alreadySnapshotted) {
          await createBoardVersion(
            boardId,
            authorId,
            authorName,
            currentState.nodes,
            currentState.edges
          );
        }
      } catch (snapshotErr) {
        // Non-fatal: log and continue
        console.error("[board operations] auto-snapshot failed", snapshotErr);
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[board operations POST]", err);
    return NextResponse.json({ error: "Failed to process operations" }, { status: 500 });
  }
}
