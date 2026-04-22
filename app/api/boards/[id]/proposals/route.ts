import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoardProposals } from "@/lib/dal/board";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "PENDING" | "COMMITTED" | "REJECTED" | null;

  try {
    const proposals = await getBoardProposals(boardId, session.user.id, status ?? undefined);
    return NextResponse.json({ proposals });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not found")) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }
    console.error("[board proposals GET]", err);
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 });
  }
}
