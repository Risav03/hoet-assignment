import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoardVersionById } from "@/lib/dal/board";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId, versionId } = await params;

  try {
    const version = await getBoardVersionById(versionId, boardId, session.user.id);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    return NextResponse.json({ version });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("not found")) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[board version GET]", err);
    return NextResponse.json({ error: "Failed to fetch version" }, { status: 500 });
  }
}
