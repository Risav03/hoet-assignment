import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocumentVersions } from "@/lib/dal/document";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const versions = await getDocumentVersions(id, session.user.id);
    return NextResponse.json(versions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("not found")) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    console.error("[versions GET]", err);
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}
