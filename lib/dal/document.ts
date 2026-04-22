import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireWorkspaceMember } from "./workspace";

export async function getWorkspaceDocuments(
  workspaceId: string,
  userId: string,
  opts: {
    query?: string;
    tags?: string[];
    isArchived?: boolean;
    cursor?: string;
    limit?: number;
  } = {}
) {
  await requireWorkspaceMember(workspaceId, userId);
  const { query, tags, isArchived = false, cursor, limit = 20 } = opts;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    workspaceId,
    isArchived,
    ...(query && { title: { contains: query, mode: "insensitive" } }),
    ...(tags?.length && { tags: { hasEvery: tags } }),
  };

  const documents = await db.document.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true,
      title: true,
      tags: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      currentVersionId: true,
      _count: { select: { versions: true, proposals: true } },
    },
  });

  let nextCursor: string | undefined;
  if (documents.length > limit) {
    const next = documents.pop();
    nextCursor = next?.id;
  }

  return { documents, nextCursor };
}

export async function getDocumentById(
  documentId: string,
  userId: string
) {
  const doc = await db.document.findFirst({
    where: {
      id: documentId,
      workspace: { members: { some: { userId } } },
    },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });
  return doc;
}

export async function createDocument(
  workspaceId: string,
  userId: string,
  data: { title: string; content: string; tags: string[] }
) {
  await requireWorkspaceMember(workspaceId, userId, ["OWNER", "EDITOR"]);

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const doc = await tx.document.create({
      data: {
        workspaceId,
        title: data.title,
        contentSnapshot: data.content,
        tags: data.tags,
        createdById: userId,
      },
    });

    const version = await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        contentSnapshot: data.content,
        createdById: userId,
      },
    });

    await tx.document.update({
      where: { id: doc.id },
      data: { currentVersionId: version.id },
    });

    await tx.activityLog.create({
      data: {
        workspaceId,
        userId,
        action: "DOCUMENT_CREATED",
        entityType: "document",
        entityId: doc.id,
        metadata: { title: data.title },
      },
    });

    return { ...doc, currentVersionId: version.id };
  });
}

export async function updateDocument(
  documentId: string,
  userId: string,
  data: { title?: string; content?: string; tags?: string[] }
) {
  const doc = await db.document.findFirst({
    where: {
      id: documentId,
      workspace: { members: { some: { userId, role: { in: ["OWNER", "EDITOR"] } } } },
    },
  });
  if (!doc) throw new Error("Document not found or insufficient permissions");

  return db.document.update({
    where: { id: documentId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.content !== undefined && { contentSnapshot: data.content }),
      ...(data.tags && { tags: data.tags }),
    },
  });
}

export async function getDocumentVersions(documentId: string, userId: string) {
  const doc = await db.document.findFirst({
    where: {
      id: documentId,
      workspace: { members: { some: { userId } } },
    },
  });
  if (!doc) throw new Error("Document not found");

  return db.documentVersion.findMany({
    where: { documentId },
    orderBy: { versionNumber: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}
