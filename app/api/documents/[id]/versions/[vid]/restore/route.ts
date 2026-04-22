import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
import { emitSSEEvent } from "@/lib/sse/emitter";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, vid } = await params;
  try {
    const doc = await db.document.findFirst({
      where: {
        id,
        workspace: { members: { some: { userId: session.user.id } } },
      },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    await requireWorkspaceMember(doc.workspaceId, session.user.id, ["OWNER", "EDITOR"]);

    const version = await db.documentVersion.findFirst({
      where: { id: vid, documentId: id },
    });
    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

    const lastVersion = await db.documentVersion.findFirst({
      where: { documentId: id },
      orderBy: { versionNumber: "desc" },
    });

    const newVersion = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.documentVersion.create({
        data: {
          documentId: id,
          versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
          contentSnapshot: version.contentSnapshot,
          createdById: session.user.id,
        },
      });

      await tx.document.update({
        where: { id },
        data: {
          contentSnapshot: version.contentSnapshot,
          currentVersionId: created.id,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: doc.workspaceId,
          userId: session.user.id,
          action: "VERSION_RESTORED",
          entityType: "document",
          entityId: id,
          metadata: { restoredFromVersion: version.versionNumber, newVersionNumber: created.versionNumber },
        },
      });

      return created;
    });

    emitSSEEvent(doc.workspaceId, {
      type: "document_version_created",
      payload: {
        documentId: id,
        versionId: newVersion.id,
        versionNumber: newVersion.versionNumber,
        restoredFrom: vid,
      },
    });

    return NextResponse.json(newVersion, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[restore POST]", err);
    return NextResponse.json({ error: "Failed to restore version" }, { status: 500 });
  }
}
