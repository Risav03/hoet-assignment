import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { emitSSEEvent } from "@/lib/sse/emitter";
import { getWorkspaceMember } from "@/lib/dal/workspace";
import { z } from "zod";

const presenceSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  color: z.string().max(20),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId, boardId, x, y, color } = presenceSchema.parse(body);

    const member = await getWorkspaceMember(workspaceId, session.user.id);
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    emitSSEEvent(workspaceId, {
      type: "canvas_presence",
      payload: {
        boardId,
        userId: session.user.id,
        name: session.user.name ?? "Unknown",
        x,
        y,
        color,
        updatedAt: Date.now(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 });
  }
}
