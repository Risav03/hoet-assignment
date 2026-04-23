import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getDocumentMembership,
  getClosestSnapshot,
  getOpsBetweenRevs,
  createSnapshot,
} from "@/lib/dal/document";
import { replayOps } from "@/lib/sync/doc-merge";

const restoreSchema = z.object({
  targetRev: z.number().int().min(0),
});

/**
 * POST /api/docs/[docId]/restore
 *
 * Restores the document to a historical rev by:
 * 1. Reconstructing the content at targetRev (snapshot + ops replay)
 * 2. Creating a NEW snapshot at currentRev + 1 with the old content
 * 3. Incrementing currentRev
 *
 * NEVER overwrites history — this is a forward operation.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;
  const userId = session.user.id;

  const membership = await getDocumentMembership(docId, userId);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers cannot restore versions" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
  }

  const { targetRev } = parsed.data;

  try {
    const result = await db.$transaction(async () => {
      const doc = await db.document.findUnique({ where: { id: docId } });
      if (!doc) throw new Error("Document not found");

      if (targetRev > doc.currentRev) {
        throw new Error("targetRev exceeds currentRev");
      }

      // Snapshot the current state so it remains visible in version history
      // after the restore (prevents losing unsaved history between the last
      // automatic snapshot and currentRev).
      const existingCurrentSnap = await db.documentSnapshot.findFirst({
        where: { documentId: docId, rev: doc.currentRev },
      });
      if (!existingCurrentSnap) {
        const currentBaseSnap = await getClosestSnapshot(docId, doc.currentRev);
        if (currentBaseSnap) {
          const currentOps = await getOpsBetweenRevs(docId, currentBaseSnap.rev, doc.currentRev);
          const currentContent = currentOps.length > 0
            ? replayOps(currentBaseSnap.content, currentOps)
            : currentBaseSnap.content;
          await createSnapshot(docId, doc.currentRev, currentContent);
        }
      }

      // Reconstruct content at targetRev
      const snap = await getClosestSnapshot(docId, targetRev);
      if (!snap) throw new Error("Cannot reconstruct: no snapshot for targetRev");

      const ops = await getOpsBetweenRevs(docId, snap.rev, targetRev);
      const restoredContent = replayOps(snap.content, ops);

      // Create a new snapshot at the next rev (forward restore)
      const newRev = doc.currentRev + 1;
      const newSnapshot = await createSnapshot(docId, newRev, restoredContent);
      await db.document.update({ where: { id: docId }, data: { currentRev: newRev } });

      return { newRev, snapshotId: newSnapshot.id };
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("not found") || msg.includes("Cannot reconstruct")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("targetRev exceeds")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[docs restore]", err);
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }
}
