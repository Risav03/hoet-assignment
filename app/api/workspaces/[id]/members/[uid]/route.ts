import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
import { db } from "@/lib/db";
import { updateMemberRoleSchema } from "@/lib/validation";
import { ZodError } from "zod";
import { emitSSEEvent } from "@/lib/sse/emitter";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; uid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, uid } = await params;
  try {
    await requireWorkspaceMember(id, session.user.id, ["OWNER"]);
    const body = await req.json();
    const data = updateMemberRoleSchema.parse(body);

    if (uid === session.user.id) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }

    const member = await db.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: id, userId: uid } },
      data: { role: data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await db.activityLog.create({
      data: {
        workspaceId: id,
        userId: session.user.id,
        action: "MEMBER_ROLE_UPDATED",
        entityType: "member",
        entityId: uid,
        metadata: { newRole: data.role },
      },
    });

    emitSSEEvent(id, { type: "member_role_updated", payload: { userId: uid, newRole: data.role } });

    return NextResponse.json(member);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[member PATCH]", err);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; uid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, uid } = await params;
  try {
    await requireWorkspaceMember(id, session.user.id, ["OWNER"]);

    if (uid === session.user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    await db.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: id, userId: uid } },
    });

    await db.activityLog.create({
      data: {
        workspaceId: id,
        userId: session.user.id,
        action: "MEMBER_REMOVED",
        entityType: "member",
        entityId: uid,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[member DELETE]", err);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
