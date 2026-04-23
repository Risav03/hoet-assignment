import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDocumentMember } from "@/lib/dal/document";
import { emitDocYjsUpdate } from "@/lib/sse/redis-emitter";
import { isValidBase64 } from "@/lib/yjs/encoding";
import * as Y from "yjs";
import type { Prisma } from "@/app/generated/prisma/client";

type InputJson = Prisma.InputJsonValue;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Maximum allowed payload size for a single Yjs update (1 MB encoded as base64)
const MAX_UPDATE_BYTES = 1_048_576;

// Threshold: once this many incremental updates accumulate after the last snapshot,
// a new snapshot is written to keep future GET responses lean.
const SNAPSHOT_THRESHOLD = 100;

// ── GET /api/docs/[docId]/yjs ─────────────────────────────────────────────────
// Returns all Yjs updates needed to reconstruct the current document state.
// If a snapshot exists it is returned first, followed only by updates created
// after that snapshot, so clients never replay the full history.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { docId } = await params;

  try {
    await requireDocumentMember(docId, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await db.yjsSnapshot.findUnique({ where: { documentId: docId } });

  const incrementalUpdates = await db.yjsUpdate.findMany({
    where: {
      documentId: docId,
      ...(snapshot ? { createdAt: { gt: snapshot.createdAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { update: true },
  });

  const updates: string[] = [];

  if (snapshot) {
    updates.push(Buffer.from(snapshot.state).toString("base64"));
  }

  for (const row of incrementalUpdates) {
    updates.push(Buffer.from(row.update).toString("base64"));
  }

  return NextResponse.json({ updates });
}

// ── POST /api/docs/[docId]/yjs ────────────────────────────────────────────────
// Accepts a single Yjs binary update (base64-encoded), stores it, and
// broadcasts it to all SSE clients subscribed to the doc channel.
// Viewers (read-only role) are rejected with 403.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { docId } = await params;

  let membership: { role: string };
  try {
    membership = await requireDocumentMember(docId, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (membership.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers cannot edit documents" }, { status: 403 });
  }

  let body: { update?: unknown; content?: unknown };
  try {
    body = await req.json() as { update?: unknown; content?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { update, content } = body;

  if (typeof update !== "string" || !update) {
    return NextResponse.json({ error: "update must be a non-empty string" }, { status: 400 });
  }

  if (update.length > MAX_UPDATE_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!isValidBase64(update)) {
    return NextResponse.json({ error: "update must be valid base64" }, { status: 400 });
  }

  const binary = Buffer.from(update, "base64");

  // Validate that this is a well-formed Yjs update by attempting to apply it
  // to a throwaway document; reject malformed data early.
  try {
    const probe = new Y.Doc();
    Y.applyUpdate(probe, new Uint8Array(binary));
    probe.destroy();
  } catch {
    return NextResponse.json({ error: "Invalid Yjs update binary" }, { status: 400 });
  }

  await db.yjsUpdate.create({
    data: { documentId: docId, update: binary },
  });

  // Fire-and-forget SSE broadcast — never blocks the response.
  void emitDocYjsUpdate(docId, update);

  // When the client attaches a Tiptap JSON snapshot, create a new
  // DocumentSnapshot and bump currentRev so the history panel stays up-to-date.
  let snapshotCreated = false;
  if (content !== undefined && content !== null && typeof content === "object") {
    await saveHistorySnapshot(docId, content as InputJson);
    snapshotCreated = true;
  }

  // Opportunistically write a Yjs CRDT snapshot when enough incremental updates
  // have accumulated so future GET responses stay lean.
  void maybeSnapshot(docId);

  return NextResponse.json({ success: true, snapshotCreated });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Increment currentRev and persist a DocumentSnapshot so the history panel
 * keeps getting new entries as the user edits via the Yjs pipeline.
 * Runs in the background — failures are logged but never bubble up.
 */
async function saveHistorySnapshot(docId: string, content: InputJson): Promise<void> {
  try {
    const doc = await db.document.update({
      where: { id: docId },
      data: { currentRev: { increment: 1 } },
      select: { currentRev: true },
    });

    await db.documentSnapshot.create({
      data: {
        documentId: docId,
        rev: doc.currentRev,
        content,
      },
    });
  } catch (err) {
    console.error("[yjs/route] saveHistorySnapshot failed", err);
  }
}

async function maybeSnapshot(docId: string): Promise<void> {
  try {
    const snapshot = await db.yjsSnapshot.findUnique({ where: { documentId: docId } });

    const count = await db.yjsUpdate.count({
      where: {
        documentId: docId,
        ...(snapshot ? { createdAt: { gt: snapshot.createdAt } } : {}),
      },
    });

    if (count < SNAPSHOT_THRESHOLD) return;

    // Merge all updates into a single state vector.
    const allUpdates = await db.yjsUpdate.findMany({
      where: { documentId: docId },
      orderBy: { createdAt: "asc" },
      select: { update: true },
    });

    const ydoc = new Y.Doc();
    if (snapshot) {
      Y.applyUpdate(ydoc, new Uint8Array(snapshot.state));
    }
    for (const row of allUpdates) {
      Y.applyUpdate(ydoc, new Uint8Array(row.update));
    }

    const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    ydoc.destroy();

    await db.yjsSnapshot.upsert({
      where: { documentId: docId },
      create: { documentId: docId, state },
      update: { state, createdAt: new Date() },
    });

    // Prune incremental updates that are now baked into the snapshot.
    await db.yjsUpdate.deleteMany({ where: { documentId: docId } });
  } catch (err) {
    console.error("[yjs/route] snapshot failed", err);
  }
}
