import "server-only";
import { db } from "@/lib/db";
import type { DocMeta, DocSnapshot } from "@/lib/types/document";
import type { OTOpType } from "@/lib/ot/types";
import type { Prisma } from "@/app/generated/prisma/client";

type InputJson = Prisma.InputJsonValue;

// ── Membership helpers ─────────────────────────────────────────────────────────

export async function getDocumentMembership(documentId: string, userId: string) {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: { workspaceId: true },
  });
  if (!doc) return null;
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId } },
  });
  return member ? { role: member.role, workspaceId: doc.workspaceId } : null;
}

export async function requireDocumentMember(
  documentId: string,
  userId: string,
  minRoles?: Array<"OWNER" | "EDITOR" | "VIEWER">
) {
  const result = await getDocumentMembership(documentId, userId);
  if (!result) throw new Error("Not a workspace member or document not found");
  if (minRoles && !minRoles.includes(result.role)) {
    throw new Error("Insufficient permissions");
  }
  return result;
}

// ── Document CRUD ──────────────────────────────────────────────────────────────

export async function listDocuments(workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) throw new Error("Not a workspace member");

  return db.document.findMany({
    where: { workspaceId, isArchived: false },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      workspaceId: true,
      ownerId: true,
      title: true,
      currentRev: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getDocumentById(
  documentId: string,
  userId: string
): Promise<DocMeta | null> {
  const membership = await getDocumentMembership(documentId, userId);
  if (!membership) return null;

  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return null;

  return {
    id: doc.id,
    workspaceId: doc.workspaceId,
    ownerId: doc.ownerId,
    title: doc.title,
    currentRev: doc.currentRev,
    isArchived: doc.isArchived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function createDocument(
  workspaceId: string,
  userId: string,
  data: { title: string; initialContent?: unknown }
) {
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) throw new Error("Not a workspace member");
  if (member.role === "VIEWER") throw new Error("Insufficient permissions");

  const doc = await db.document.create({
    data: { workspaceId, ownerId: userId, title: data.title, currentRev: 0 },
  });

  const emptyContent = data.initialContent ?? {
    type: "doc",
    content: [{ type: "paragraph" }],
  };

  await db.documentSnapshot.create({
    data: { documentId: doc.id, rev: 0, content: emptyContent as InputJson },
  });

  return doc;
}

export async function updateDocumentTitle(
  documentId: string,
  userId: string,
  title: string
) {
  await requireDocumentMember(documentId, userId, ["OWNER", "EDITOR"]);
  return db.document.update({ where: { id: documentId }, data: { title } });
}

export async function archiveDocument(documentId: string, userId: string) {
  await requireDocumentMember(documentId, userId, ["OWNER", "EDITOR"]);
  return db.document.update({
    where: { id: documentId },
    data: { isArchived: true },
  });
}

export async function deleteDocument(documentId: string, userId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId } },
  });
  if (!member || member.role !== "OWNER") throw new Error("Insufficient permissions");
  await db.document.delete({ where: { id: documentId } });
}

// ── Ops (append-only) ──────────────────────────────────────────────────────────

export interface AppendOTOpArgs {
  documentId: string;
  clientId: string;
  opClientId: string;
  baseRev: number;
  rev: number;
  type: OTOpType;
  position: number;
  text?: string;
  length?: number;
}

export async function appendDocOp(args: AppendOTOpArgs) {
  return db.documentOp.create({
    data: {
      documentId: args.documentId,
      clientId: args.clientId,
      opClientId: args.opClientId,
      baseRev: args.baseRev,
      rev: args.rev,
      type: args.type,
      position: args.position,
      text: args.text ?? null,
      length: args.length ?? null,
    },
  });
}

export async function getOpsAfterRev(documentId: string, afterRev: number) {
  return db.documentOp.findMany({
    where: { documentId, rev: { gt: afterRev } },
    orderBy: { rev: "asc" },
  });
}

export async function getOpsBetweenRevs(
  documentId: string,
  fromRev: number,
  toRev: number
) {
  return db.documentOp.findMany({
    where: { documentId, rev: { gt: fromRev, lte: toRev } },
    orderBy: { rev: "asc" },
  });
}

export async function incrementDocumentRev(
  documentId: string,
  expectedRev: number,
  by: number
): Promise<number> {
  const doc = await db.document.update({
    where: { id: documentId, currentRev: expectedRev },
    data: { currentRev: { increment: by } },
  });
  return doc.currentRev;
}

// ── Snapshots ──────────────────────────────────────────────────────────────────

export async function getClosestSnapshot(
  documentId: string,
  targetRev: number
): Promise<DocSnapshot | null> {
  const snap = await db.documentSnapshot.findFirst({
    where: { documentId, rev: { lte: targetRev } },
    orderBy: { rev: "desc" },
  });
  if (!snap) return null;
  return {
    id: snap.id,
    documentId: snap.documentId,
    rev: snap.rev,
    content: snap.content,
    createdAt: snap.createdAt.toISOString(),
  };
}

export async function createSnapshot(
  documentId: string,
  rev: number,
  content: unknown
): Promise<DocSnapshot> {
  const snap = await db.documentSnapshot.create({
    data: { documentId, rev, content: content as InputJson },
  });
  return {
    id: snap.id,
    documentId: snap.documentId,
    rev: snap.rev,
    content: snap.content,
    createdAt: snap.createdAt.toISOString(),
  };
}

export async function countOpsSinceLastSnapshot(
  documentId: string
): Promise<number> {
  const lastSnap = await db.documentSnapshot.findFirst({
    where: { documentId },
    orderBy: { rev: "desc" },
    select: { rev: true },
  });
  const sinceRev = lastSnap?.rev ?? -1;
  return db.documentOp.count({
    where: { documentId, rev: { gt: sinceRev } },
  });
}

export async function listSnapshots(documentId: string) {
  return db.documentSnapshot.findMany({
    where: { documentId },
    orderBy: { rev: "desc" },
  });
}
