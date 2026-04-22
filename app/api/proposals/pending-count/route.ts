import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/dal/workspace";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 422 });
  }

  try {
    await requireWorkspaceMember(workspaceId, session.user.id);
    const count = await db.changeProposal.count({
      where: { workspaceId, status: "PENDING" },
    });
    return NextResponse.json({ count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[proposals/pending-count GET]", err);
    return NextResponse.json({ error: "Failed to fetch count" }, { status: 500 });
  }
}
