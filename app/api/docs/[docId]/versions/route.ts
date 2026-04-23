import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDocumentMembership,
  listSnapshots,
  getClosestSnapshot,
  getOpsBetweenRevs,
} from "@/lib/dal/document";
import { replayOps } from "@/lib/sync/doc-merge";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;
  const { searchParams } = new URL(req.url);
  const targetRevParam = searchParams.get("rev");

  const membership = await getDocumentMembership(docId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    // If a specific rev is requested, reconstruct content at that rev
    if (targetRevParam !== null) {
      const targetRev = parseInt(targetRevParam, 10);
      if (isNaN(targetRev) || targetRev < 0) {
        return NextResponse.json({ error: "Invalid rev" }, { status: 400 });
      }

      const snap = await getClosestSnapshot(docId, targetRev);
      if (!snap) return NextResponse.json({ error: "Cannot reconstruct: no snapshot" }, { status: 404 });

      const ops = await getOpsBetweenRevs(docId, snap.rev, targetRev);
      const content = replayOps(snap.content, ops);

      return NextResponse.json({ rev: targetRev, content });
    }

    // Otherwise return list of all snapshots (version history) + current rev
    const [snapshots, doc] = await Promise.all([
      listSnapshots(docId),
      db.document.findUnique({ where: { id: docId }, select: { currentRev: true } }),
    ]);
    return NextResponse.json({
      versions: snapshots.map((s) => ({
        id: s.id,
        rev: s.rev,
        createdAt: s.createdAt.toISOString(),
      })),
      currentRev: doc?.currentRev ?? 0,
    });
  } catch (err) {
    console.error("[docs versions GET]", err);
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}
