import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocumentById, updateDocument } from "@/lib/dal/document";
import { db } from "@/lib/db";
import { updateDocumentSchema } from "@/lib/validation";
import { ZodError } from "zod";
import { emitSSEEvent } from "@/lib/sse/emitter";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const doc = await getDocumentById(id, session.user.id);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    return NextResponse.json(doc);
  } catch (err) {
    console.error("[document GET]", err);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const data = updateDocumentSchema.parse(body);
    const doc = await updateDocument(id, session.user.id, {
      title: data.title,
      content: data.content,
      tags: data.tags ?? undefined,
    });

    emitSSEEvent(doc.workspaceId, {
      type: "document_updated",
      payload: { documentId: id, updatedBy: session.user.id },
    });

    return NextResponse.json(doc);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[document PATCH]", err);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const doc = await getDocumentById(id, session.user.id);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    await db.document.update({ where: { id }, data: { isArchived: true } });

    await db.activityLog.create({
      data: {
        workspaceId: doc.workspaceId,
        userId: session.user.id,
        action: "DOCUMENT_ARCHIVED",
        entityType: "document",
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[document DELETE]", err);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
