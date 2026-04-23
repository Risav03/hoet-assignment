import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getBoardById,
  getBoardWithState,
  getBoardVersions,
  createBoardVersion,
} from "@/lib/dal/board";
import { z } from "zod";
import { ZodError } from "zod";

const postSchema = z.object({
  label: z.string().max(200).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));

  try {
    const result = await getBoardVersions(boardId, session.user.id, limit, cursor);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("not found")) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[board versions GET]", err);
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const userId = session.user.id;
  const userName = session.user.name ?? "Unknown";

  try {
    const board = await getBoardById(boardId, userId);
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { label } = postSchema.parse(body);

    const boardState = await getBoardWithState(boardId, userId);
    if (!boardState) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const version = await createBoardVersion(
      boardId,
      userId,
      userName,
      boardState.state.nodes,
      boardState.state.edges,
      label
    );

    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[board versions POST]", err);
    return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
  }
}
