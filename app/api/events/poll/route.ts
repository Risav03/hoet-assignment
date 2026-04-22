import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceMember } from "@/lib/dal/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const since = url.searchParams.get("since");

  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });

  const member = await getWorkspaceMember(workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60_000);

    const [proposals, activity] = await Promise.all([
      db.changeProposal.findMany({
        where: { workspaceId, updatedAt: { gte: sinceDate } },
        select: { id: true, status: true, documentId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.activityLog.findMany({
        where: { workspaceId, createdAt: { gte: sinceDate } },
        select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      serverTime: new Date().toISOString(),
      proposals,
      activity,
    });
  } catch (err) {
    console.error("[poll GET]", err);
    return NextResponse.json({ error: "Poll failed" }, { status: 500 });
  }
}
