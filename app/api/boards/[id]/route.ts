import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoardWithState, updateBoard } from "@/lib/dal/board";
import { z } from "zod";
import { ZodError } from "zod";
import { emitSSEEvent } from "@/lib/sse/redis-emitter";

const patchBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isArchived: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const board = await getBoardWithState(id, session.user.id);
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    return NextResponse.json(board);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[board GET]", err);
    return NextResponse.json({ error: "Failed to fetch board" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const data = patchBoardSchema.parse(body);
    const board = await updateBoard(id, session.user.id, data);

    await emitSSEEvent(board.workspaceId, {
      type: "board_updated",
      payload: { boardId: board.id, ...data },
    });

    return NextResponse.json(board);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[board PATCH]", err);
    return NextResponse.json({ error: "Failed to update board" }, { status: 500 });
  }
}
