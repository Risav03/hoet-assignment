import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireDocumentMember } from "@/lib/dal/document";
import { emitDocPresence } from "@/lib/sse/redis-emitter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
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

  let body: { anchor?: unknown; head?: unknown; userName?: unknown; color?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { anchor, head, userName, color } = body;

  if (typeof anchor !== "number" || typeof head !== "number") {
    return NextResponse.json({ error: "anchor and head must be numbers" }, { status: 400 });
  }
  if (typeof userName !== "string" || !userName.trim()) {
    return NextResponse.json({ error: "userName is required" }, { status: 400 });
  }
  if (typeof color !== "string" || !color.trim()) {
    return NextResponse.json({ error: "color is required" }, { status: 400 });
  }

  void emitDocPresence(docId, {
    userId: session.user.id,
    userName: userName.trim(),
    color: color.trim(),
    anchor,
    head,
  });

  return NextResponse.json({ ok: true });
}
