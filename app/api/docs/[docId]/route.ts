import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDocumentById,
  updateDocumentTitle,
  archiveDocument,
  deleteDocument,
  getClosestSnapshot,
} from "@/lib/dal/document";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
}).strict();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;
  try {
    const doc = await getDocumentById(docId, session.user.id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Include the latest snapshot content so the client can seed its local state
    const snapshot = await getClosestSnapshot(docId, doc.currentRev);

    return NextResponse.json({ document: doc, snapshot });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace")) return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;
  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    if (data.title) {
      await updateDocumentTitle(docId, session.user.id, data.title);
    }
    const doc = await getDocumentById(docId, session.user.id);
    return NextResponse.json({ document: doc });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;
  try {
    await deleteDocument(docId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
