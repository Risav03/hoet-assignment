import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceDocuments, createDocument } from "@/lib/dal/document";
import { createDocumentSchema, searchDocumentSchema } from "@/lib/validation";
import { ZodError } from "zod";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  try {
    const opts = searchDocumentSchema.parse({
      query: url.searchParams.get("query") ?? undefined,
      isArchived: url.searchParams.get("isArchived") === "true",
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? 20,
    });
    const result = await getWorkspaceDocuments(id, session.user.id, opts);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[workspace docs GET]", err);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const data = createDocumentSchema.parse(body);
    const doc = await createDocument(id, session.user.id, {
      title: data.title,
      content: data.content ?? "",
      tags: data.tags ?? [],
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[workspace docs POST]", err);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
