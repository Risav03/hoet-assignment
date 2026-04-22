import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceById, requireWorkspaceMember } from "@/lib/dal/workspace";
import { db } from "@/lib/db";
import { updateWorkspaceSchema } from "@/lib/validation";
import { ZodError } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const workspace = await getWorkspaceById(id, session.user.id);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    return NextResponse.json(workspace);
  } catch (err) {
    console.error("[workspace GET]", err);
    return NextResponse.json({ error: "Failed to fetch workspace" }, { status: 500 });
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
    await requireWorkspaceMember(id, session.user.id, ["OWNER"]);
    const body = await req.json();
    const data = updateWorkspaceSchema.parse(body);
    const workspace = await db.workspace.update({ where: { id }, data });
    return NextResponse.json(workspace);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient permissions") || msg.includes("Not a workspace member")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[workspace PATCH]", err);
    return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 });
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
    const member = await requireWorkspaceMember(id, session.user.id, ["OWNER"]);
    await db.workspace.delete({ where: { id, ownerId: member.userId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient permissions") || msg.includes("Not a workspace member")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[workspace DELETE]", err);
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}
