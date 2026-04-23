import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { applyBoardOp, getBoardById } from "@/lib/dal/board";
import { emitSSEEvent } from "@/lib/sse/emitter";
import { z } from "zod";
import { ZodError } from "zod";
import type { CanvasOp } from "@/lib/types/canvas";

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

  try {
    const board = await getBoardById(boardId, session.user.id);
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const body = await req.json();
    const { operations } = batchSchema.parse(body);

    const results: { operationId: string; proposalId?: string; status: string }[] = [];

    for (const { operationId, op } of operations) {
      try {
        const proposalId = await applyBoardOp(
          boardId,
          board.workspaceId,
          session.user.id,
          op as CanvasOp
        );

        emitSSEEvent(board.workspaceId, {
          type: "proposal_created",
          payload: {
            proposalId,
            boardId,
            operationId,
            operationType: op.type,
            authorId: session.user.id,
          },
        });

        results.push({ operationId, proposalId, status: "pending" });
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
