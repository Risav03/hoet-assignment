import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { syncBatchSchema } from "@/lib/validation";
import { ZodError } from "zod";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 1_048_576; // 1MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`sync:${session.user.id}`, { windowMs: 60_000, max: 30 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Slow down sync." }, { status: 429 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    const body = await req.json();
    const { operations } = syncBatchSchema.parse(body);

    const results: { operationId: string; status: string; error?: string }[] = [];

    for (const op of operations) {
      try {
        await requireWorkspaceMember(op.workspaceId, session.user.id);

        const existing = await db.syncOperation.findUnique({
          where: { operationId: op.operationId },
        });

        if (existing) {
          results.push({ operationId: op.operationId, status: "already_processed" });
          continue;
        }

        await db.syncOperation.create({
          data: {
            operationId: op.operationId,
            documentId: op.documentId,
            workspaceId: op.workspaceId,
            userId: session.user.id,
            operationType: op.operationType as "CREATE_DOCUMENT" | "UPDATE_DOCUMENT" | "DELETE_DOCUMENT" | "ARCHIVE_DOCUMENT" | "RESTORE_DOCUMENT",
            payload: op.payload as Parameters<typeof db.syncOperation.create>[0]["data"]["payload"],
            status: "COMPLETED",
            clientChecksum: op.clientChecksum,
            processedAt: new Date(),
          },
        });

        await applyOperation(op);
        results.push({ operationId: op.operationId, status: "applied" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ operationId: op.operationId, status: "error", error: msg });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    console.error("[sync POST]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

async function applyOperation(
  op: {
    operationId: string;
    documentId: string;
    workspaceId: string;
    operationType: string;
    payload: Record<string, unknown>;
  },

) {
  switch (op.operationType) {
    case "UPDATE_DOCUMENT": {
      const { title, content, tags } = op.payload as {
        title?: string;
        content?: string;
        tags?: string[];
      };
      await db.document.updateMany({
        where: {
          id: op.documentId,
          workspaceId: op.workspaceId,
        },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { contentSnapshot: content }),
          ...(tags !== undefined && { tags }),
        },
      });
      break;
    }
    case "ARCHIVE_DOCUMENT":
      await db.document.updateMany({
        where: { id: op.documentId, workspaceId: op.workspaceId },
        data: { isArchived: true },
      });
      break;
    case "RESTORE_DOCUMENT":
      await db.document.updateMany({
        where: { id: op.documentId, workspaceId: op.workspaceId },
        data: { isArchived: false },
      });
      break;
    default:
      break;
  }
}
