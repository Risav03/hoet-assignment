import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getDocumentMembership,
  appendDocOp,
  getOpsBetweenRevs,
  getClosestSnapshot,
  createSnapshot,
  countOpsSinceLastSnapshot,
  createConflict,
} from "@/lib/dal/document";
import { mergeDocs, replayOps } from "@/lib/sync/doc-merge";
import type { SyncResponse, SyncOpPayload, DocConflict } from "@/lib/types/document";
import type { Operation as JSONPatchOp } from "fast-json-patch";

const SNAPSHOT_INTERVAL = 50;
const MAX_OPS_PER_REQUEST = 50;
const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB

// ── Zod validation ────────────────────────────────────────────────────────────

const jsonPatchOpSchema = z.object({
  op: z.enum(["add", "remove", "replace", "move", "copy", "test"]),
  path: z.string(),
  value: z.unknown().optional(),
  from: z.string().optional(),
});

const syncOpSchema = z.object({
  opId: z.string().min(1).max(128),
  clientId: z.string().min(1).max(128),
  baseRev: z.number().int().min(0),
  diff: z.array(jsonPatchOpSchema).max(500),
  createdAt: z.string().datetime(),
});

const syncRequestSchema = z.object({
  clientId: z.string().min(1).max(128),
  baseRev: z.number().int().min(0),
  ops: z.array(syncOpSchema).min(1).max(MAX_OPS_PER_REQUEST),
});

// ── POST /api/docs/[docId]/sync ───────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;
  const userId = session.user.id;

  // Payload size guard
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Role check — reject VIEWER ops
  const membership = await getDocumentMembership(docId, userId);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers cannot edit documents" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { baseRev, ops } = parsed.data;

  try {
    const result = await db.$transaction(async () => {
      const doc = await db.document.findUnique({ where: { id: docId } });
      if (!doc) throw new Error("Document not found");

      const currentRev = doc.currentRev;

      const acceptedOps: string[] = [];
      const remoteOps: SyncOpPayload[] = [];
      const conflicts: DocConflict[] = [];
      let newRev = currentRev;

      // ── Case A: baseRev === currentRev ─────────────────────────────────────
      if (baseRev === currentRev) {
        for (const op of ops) {
          newRev += 1;
          await appendDocOp(docId, op.clientId, op.baseRev, newRev, op.diff as JSONPatchOp[]);
          acceptedOps.push(op.opId);
        }
        await db.document.update({
          where: { id: docId },
          data: { currentRev: newRev },
        });
      }
      // ── Case B: baseRev < currentRev — need 3-way merge ───────────────────
      else if (baseRev < currentRev) {
        // Reconstruct base state at baseRev
        const baseSnap = await getClosestSnapshot(docId, baseRev);
        if (!baseSnap) throw new Error("Cannot reconstruct base: no snapshot found");

        const opsToBase = await getOpsBetweenRevs(docId, baseSnap.rev, baseRev);
        const baseContent = replayOps(baseSnap.content, opsToBase);

        // Collect server ops since baseRev
        const serverOps = await getOpsBetweenRevs(docId, baseRev, currentRev);
        const serverDiffs = serverOps.map((o) => o.diff as unknown as JSONPatchOp[]);

        const clientDiffs = ops.map((o) => o.diff as JSONPatchOp[]);

        const { merged, conflicts: conflictPairs } = mergeDocs(
          baseContent,
          clientDiffs,
          serverDiffs
        );

        // Store conflicts
        for (const pair of conflictPairs) {
          const localOp = ops.find((o) =>
            (o.diff as unknown as JSONPatchOp[]).some((d) => d.path === pair.path)
          );
          const remoteOp = serverOps.find((o) =>
            (o.diff as unknown as JSONPatchOp[]).some((d) => d.path === pair.path)
          );
          if (localOp && remoteOp) {
            const conflict = await createConflict({
              documentId: docId,
              baseRev,
              localOp: { opId: localOp.opId, diff: localOp.diff },
              remoteOp: { id: remoteOp.id, diff: remoteOp.diff },
            });
            conflicts.push({
              id: conflict.id,
              documentId: docId,
              baseRev,
              localOp: {
                opId: localOp.opId,
                docId,
                clientId: localOp.clientId,
                baseRev: localOp.baseRev,
                diff: localOp.diff as JSONPatchOp[],
                createdAt: localOp.createdAt,
                status: "pending",
              },
              remoteOp: {
                opId: remoteOp.id,
                docId,
                clientId: remoteOp.clientId,
                baseRev: remoteOp.baseRev,
                diff: remoteOp.diff as unknown as JSONPatchOp[],
                createdAt: remoteOp.createdAt.toISOString(),
                status: "acked",
              },
              status: "PENDING",
            });
          }
        }

        // Accept non-conflicting client ops
        const conflictPaths = new Set(conflictPairs.map((c) => c.path));
        for (const op of ops) {
          const hasConflict = (op.diff as unknown as JSONPatchOp[]).some((d) =>
            conflictPaths.has(d.path)
          );
          if (!hasConflict) {
            newRev += 1;
            await appendDocOp(docId, op.clientId, op.baseRev, newRev, op.diff as JSONPatchOp[]);
            acceptedOps.push(op.opId);
          }
        }

        // Save merged snapshot after 3-way merge
        newRev += 1;
        await createSnapshot(docId, newRev, merged);
        await db.document.update({
          where: { id: docId },
          data: { currentRev: newRev },
        });

        // Return server ops for client to apply
        for (const sop of serverOps) {
          remoteOps.push({
            opId: sop.id,
            clientId: sop.clientId,
            baseRev: sop.baseRev,
            diff: sop.diff as unknown as JSONPatchOp[],
            createdAt: sop.createdAt.toISOString(),
          });
        }
      } else {
        // baseRev > currentRev — revision inconsistency
        return NextResponse.json(
          { error: "Invalid baseRev: ahead of server" },
          { status: 409 }
        );
      }

      // ── Auto-snapshot every SNAPSHOT_INTERVAL ops ─────────────────────────
      try {
        const opsSinceSnap = await countOpsSinceLastSnapshot(docId);
        if (acceptedOps.length > 0 && opsSinceSnap >= SNAPSHOT_INTERVAL) {
          const latestSnap = await getClosestSnapshot(docId, newRev);
          if (latestSnap && latestSnap.rev < newRev) {
            const opsToReplay = await getOpsBetweenRevs(docId, latestSnap.rev, newRev);
            const newContent = replayOps(latestSnap.content, opsToReplay);
            await createSnapshot(docId, newRev, newContent);
          }
        }
      } catch {
        // Non-fatal
      }

      return { acceptedOps, remoteOps, conflicts, newRev };
    });

    if (result instanceof NextResponse) return result;

    const response: SyncResponse = result;
    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Document not found")) return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.includes("Cannot reconstruct")) return NextResponse.json({ error: msg }, { status: 409 });
    console.error("[docs sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
