import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoardsByWorkspace, createBoard } from "@/lib/dal/board";
import { z } from "zod";
import { ZodError } from "zod";
import { emitSSEEvent } from "@/lib/sse/redis-emitter";

const createBoardSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1).max(200),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const boards = await getBoardsByWorkspace(workspaceId, session.user.id);
    return NextResponse.json({ boards });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[boards GET]", err);
    return NextResponse.json({ error: "Failed to fetch boards" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId, title } = createBoardSchema.parse(body);
    const board = await createBoard(workspaceId, session.user.id, title);

    await emitSSEEvent(workspaceId, {
      type: "board_created",
      payload: { boardId: board.id, title, authorId: session.user.id },
    });

    return NextResponse.json(board, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[boards POST]", err);
    return NextResponse.json({ error: "Failed to create board" }, { status: 500 });
  }
}
