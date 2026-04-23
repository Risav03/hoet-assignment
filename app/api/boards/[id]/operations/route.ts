import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoardById } from "@/lib/dal/board";
import { emitSSEEvent } from "@/lib/sse/emitter";
import { getStateManager } from "@/lib/canvas/canvas-state-manager";
import { z } from "zod";
import { ZodError } from "zod";
import type { CanvasOp } from "@/lib/types/canvas";

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

    const stateManager = getStateManager();
    const results: { operationId: string; status: "applied" | "conflict" | "error" }[] = [];

    for (const { operationId, op, createdAt } of operations) {
      try {
        // Apply op to in-memory state — no DB round-trip in the hot path
        const result = stateManager.applyOp(
          boardId,
          board.workspaceId,
          authorId,
          authorName,
          op as CanvasOp,
          createdAt
        );

        if (result.applied) {
          // Emit SSE immediately after in-memory apply
          emitSSEEvent(board.workspaceId, {
            type: "canvas_op_applied",
            payload: {
              boardId,
              operationId,
              op,
              authorId,
              authorName,
              authorColor,
              appliedAt: new Date().toISOString(),
            },
          });
          results.push({ operationId, status: "applied" });
        } else {
          emitSSEEvent(board.workspaceId, {
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
