import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDocuments, createDocument } from "@/lib/dal/document";
import { z } from "zod";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1).max(255),
  initialContent: z.unknown().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  try {
    const docs = await listDocuments(workspaceId, session.user.id);
    return NextResponse.json({ documents: docs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace")) return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId, title, initialContent } = createSchema.parse(body);

    const doc = await createDocument(workspaceId, session.user.id, {
      title,
      initialContent,
    });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
