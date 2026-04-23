import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await requireWorkspaceMember(id, session.user.id);

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim() ?? "";
    const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(isNaN(limitRaw) ? 20 : limitRaw, 50);

    const documents = await db.document.findMany({
      where: {
        workspaceId: id,
        isArchived: false,
        ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, title: true },
    });

    return NextResponse.json({ documents });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (
      msg.includes("Not a workspace member") ||
      msg.includes("Insufficient permissions")
    ) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[workspace documents GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
