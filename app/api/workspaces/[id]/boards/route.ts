import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoardsByWorkspace } from "@/lib/dal/board";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workspaceId } = await params;

  try {
    const boards = await getBoardsByWorkspace(workspaceId, session.user.id);
    return NextResponse.json({ boards });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch boards" }, { status: 500 });
  }
}
