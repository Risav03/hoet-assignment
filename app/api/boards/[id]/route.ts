import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoardWithState, updateBoard } from "@/lib/dal/board";
import { getStateManager } from "@/lib/canvas/canvas-state-manager";
import { z } from "zod";
import { ZodError } from "zod";
import { emitSSEEvent } from "@/lib/sse/emitter";

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
    // Always fetch from DB for auth check and board metadata
    const board = await getBoardWithState(id, session.user.id);
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const stateManager = getStateManager();
    const inMemory = stateManager.getLoadedState(id);

    if (inMemory) {
      // Override DB state with live in-memory state — the most up-to-date view
      // for clients joining a session that's already active
      return NextResponse.json({
        ...board,
        state: { nodes: inMemory.nodes, edges: inMemory.edges },
      });
    }

    // Board not in memory yet — prime it with the DB state so future ops
    // are applied against the correct baseline
    stateManager.primeFromDB(id, board.workspaceId, board.state.nodes, board.state.edges);

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

    emitSSEEvent(board.workspaceId, {
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
