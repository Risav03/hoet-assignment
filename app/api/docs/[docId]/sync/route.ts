import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getDocumentMembership,
  appendDocOp,
  getOpsAfterRev,
  getClosestSnapshot,
  createSnapshot,
  countOpsSinceLastSnapshot,
} from "@/lib/dal/document";
import { replayOps } from "@/lib/sync/doc-merge";
import { transform } from "@/lib/ot/transform";
import type { OTOperation } from "@/lib/ot/types";
import type { SyncResponse, SyncOpPayload } from "@/lib/types/document";

const SNAPSHOT_INTERVAL = 50;
const MAX_OPS_PER_REQUEST = 50;
const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB

// ── Zod validation ────────────────────────────────────────────────────────────

const syncOpSchema = z.object({
  opId: z.string().min(1).max(128),
  clientId: z.string().min(1).max(128),
  baseRev: z.number().int().min(0),
  type: z.enum(["insert", "delete"]),
  position: z.number().int().min(0),
  text: z.string().optional(),
  length: z.number().int().min(0).optional(),
  createdAt: z.string().datetime(),
});

const syncRequestSchema = z.object({
  clientId: z.string().min(1).max(128),
  baseRev: z.number().int().min(0),
  ops: z.array(syncOpSchema).min(1).max(MAX_OPS_PER_REQUEST),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function dbOpToOT(op: {
  type: string | null;
  position: number | null;
  text: string | null;
  length: number | null;
  clientId: string;
  opClientId: string | null;
  baseRev: number;
  rev: number;
}): OTOperation | null {
  if (!op.type || op.position === null) return null;
  const base = {
    clientId: op.clientId,
    opId: op.opClientId ?? op.clientId,
    baseRev: op.baseRev,
    position: op.position,
  };
  if (op.type === "insert" && op.text !== null) {
    return { ...base, type: "insert", text: op.text };
  }
  if (op.type === "delete" && op.length !== null) {
    return { ...base, type: "delete", length: op.length };
  }
  return null;
}

// ── POST /api/docs/[docId]/sync ───────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;
  const userId = session.user.id;

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

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

  const { ops } = parsed.data;

  try {
    const result = await db.$transaction(async () => {
      const doc = await db.document.findUnique({ where: { id: docId } });
      if (!doc) throw new Error("Document not found");

      const currentRev = doc.currentRev;
      const acceptedOps: string[] = [];
      const remoteOpsForClient: SyncOpPayload[] = [];
      let newRev = currentRev;

      // Collect the server ops that the client hasn't seen yet (union of
      // all baseRevs across incoming ops; use the minimum for safety).
      const minBaseRev = Math.min(...ops.map((o) => o.baseRev));
      const serverOps = await getOpsAfterRev(docId, minBaseRev);

      // Build the list of remote ops to return — anything the client hasn't seen.
      for (const sop of serverOps) {
        if (
          sop.type &&
          sop.position !== null &&
          (sop.type !== "insert" || sop.text !== null) &&
          (sop.type !== "delete" || sop.length !== null)
        ) {
          remoteOpsForClient.push({
            opId: sop.opClientId ?? sop.id,
            clientId: sop.clientId,
            baseRev: sop.baseRev,
            type: sop.type as "insert" | "delete",
            position: sop.position,
            text: sop.text ?? undefined,
            length: sop.length ?? undefined,
            createdAt: sop.createdAt.toISOString(),
          });
        }
      }

      // ── OT transform + apply each incoming op ─────────────────────────────
      for (const incomingPayload of ops) {
        // Build an OTOperation from the payload
        let incomingOT: OTOperation;
        if (incomingPayload.type === "insert") {
          if (!incomingPayload.text) continue; // malformed — skip
          incomingOT = {
            type: "insert",
            position: incomingPayload.position,
            text: incomingPayload.text,
            clientId: incomingPayload.clientId,
            opId: incomingPayload.opId,
            baseRev: incomingPayload.baseRev,
          };
        } else {
          if (incomingPayload.length === undefined) continue; // malformed — skip
          incomingOT = {
            type: "delete",
            position: incomingPayload.position,
            length: incomingPayload.length,
            clientId: incomingPayload.clientId,
            opId: incomingPayload.opId,
            baseRev: incomingPayload.baseRev,
          };
        }

        // Transform against every server op committed after the client's baseRev
        const opsAfterBase = serverOps.filter((s) => s.rev > incomingOT.baseRev);
        for (const sop of opsAfterBase) {
          const serverOT = dbOpToOT(sop);
          if (serverOT) {
            incomingOT = transform(incomingOT, serverOT);
          }
        }

        // Skip no-op deletes that got fully transformed away
        if (incomingOT.type === "delete" && incomingOT.length === 0) {
          acceptedOps.push(incomingPayload.opId);
          continue;
        }

        newRev += 1;
        await appendDocOp({
          documentId: docId,
          clientId: incomingPayload.clientId,
          opClientId: incomingPayload.opId,
          baseRev: incomingPayload.baseRev,
          rev: newRev,
          type: incomingOT.type,
          position: incomingOT.position,
          text: incomingOT.type === "insert" ? incomingOT.text : undefined,
          length: incomingOT.type === "delete" ? incomingOT.length : undefined,
        });

        acceptedOps.push(incomingPayload.opId);
      }

      if (newRev > currentRev) {
        await db.document.update({
          where: { id: docId },
          data: { currentRev: newRev },
        });
      }

      // ── Auto-snapshot every SNAPSHOT_INTERVAL ops ─────────────────────────
      try {
        const opsSinceSnap = await countOpsSinceLastSnapshot(docId);
        if (acceptedOps.length > 0 && opsSinceSnap >= SNAPSHOT_INTERVAL) {
          const latestSnap = await getClosestSnapshot(docId, newRev);
          if (latestSnap && latestSnap.rev < newRev) {
            const opsToReplay = await getOpsAfterRev(docId, latestSnap.rev);
            const newContent = replayOps(latestSnap.content, opsToReplay);
            await createSnapshot(docId, newRev, newContent);
          }
        }
      } catch {
        // Non-fatal
      }

      return { acceptedOps, remoteOps: remoteOpsForClient, newRev };
    });

    if (result instanceof NextResponse) return result;

    const response: SyncResponse = result;
    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Document not found")) return NextResponse.json({ error: msg }, { status: 404 });
    console.error("[docs sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
