import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";

type WorkspaceRole = "OWNER" | "EDITOR" | "VIEWER";

export async function getUserWorkspaces(userId: string) {
  return db.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: { select: { members: true, boards: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getWorkspaceById(workspaceId: string, userId: string) {
  return db.workspace.findFirst({
    where: {
      id: workspaceId,
      members: { some: { userId } },
    },
    include: {
      _count: { select: { members: true, boards: true } },
    },
  });
}

export async function getWorkspaceBySlug(slug: string, userId: string) {
  return db.workspace.findFirst({
    where: {
      slug,
      members: { some: { userId } },
    },
    include: {
      _count: { select: { members: true, boards: true } },
    },
  });
}

export async function getWorkspaceMember(workspaceId: string, userId: string) {
  return db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export async function requireWorkspaceMember(
  workspaceId: string,
  userId: string,
  minRole?: WorkspaceRole[]
) {
  const member = await getWorkspaceMember(workspaceId, userId);
  if (!member) throw new Error("Not a workspace member");
  if (minRole && !minRole.includes(member.role)) {
    throw new Error("Insufficient permissions");
  }
  return member;
}

export async function getWorkspaceMembers(workspaceId: string, userId: string) {
  await requireWorkspaceMember(workspaceId, userId);
  return db.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createWorkspace(
  userId: string,
  name: string,
  slug: string
) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workspace = await tx.workspace.create({
      data: { name, slug, ownerId: userId },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: "OWNER" },
    });
    await tx.activityLog.create({
      data: {
        workspaceId: workspace.id,
        userId,
        action: "WORKSPACE_CREATED",
        entityType: "workspace",
        entityId: workspace.id,
      },
    });
    return workspace;
  });
}
