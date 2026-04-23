import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoardById } from "@/lib/dal/board";
import { emitSSEEvent } from "@/lib/sse/emitter";
import { z } from "zod";
import { ZodError } from "zod";

const presenceSchema = z.object({
  x: z.number(),
  y: z.number(),
  name: z.string().max(100),
  color: z.string().max(20),
  draggingNodeId: z.string().nullable().optional(),
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
    const { x, y, name, color, draggingNodeId } = presenceSchema.parse(body);

    emitSSEEvent(board.workspaceId, {
      type: "canvas_presence",
      payload: {
        boardId,
        userId: session.user.id,
        name,
        x,
        y,
        color,
        updatedAt: Date.now(),
        draggingNodeId: draggingNodeId ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 });
  }
}
