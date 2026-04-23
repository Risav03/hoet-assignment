import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceMembers, requireWorkspaceMember } from "@/lib/dal/workspace";
import { db } from "@/lib/db";
import { inviteMemberSchema } from "@/lib/validation";
import { ZodError } from "zod";
import { emitSSEEvent } from "@/lib/sse/redis-emitter";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const members = await getWorkspaceMembers(id, session.user.id);
    return NextResponse.json(members);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
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
    await requireWorkspaceMember(id, session.user.id, ["OWNER"]);
    const body = await req.json();
    const data = inviteMemberSchema.parse(body);

    const invitee = await db.user.findUnique({ where: { email: data.email } });
    if (!invitee) {
      return NextResponse.json({ error: "User not found with that email" }, { status: 404 });
    }

    const existing = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId: invitee.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    const member = await db.workspaceMember.create({
      data: { workspaceId: id, userId: invitee.id, role: data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await db.activityLog.create({
      data: {
        workspaceId: id,
        userId: session.user.id,
        action: "MEMBER_INVITED",
        entityType: "member",
        entityId: invitee.id,
        metadata: { inviteeEmail: invitee.email, role: data.role },
      },
    });

    await emitSSEEvent(id, { type: "member_invited", payload: { memberId: invitee.id, role: data.role } });

    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[members POST]", err);
    return NextResponse.json({ error: "Failed to invite member" }, { status: 500 });
  }
}
