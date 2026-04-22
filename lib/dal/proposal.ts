import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireWorkspaceMember } from "./workspace";

export async function getWorkspaceProposals(
  workspaceId: string,
  userId: string,
  opts: {
    documentId?: string;
    status?: string;
    cursor?: string;
    limit?: number;
  } = {}
) {
  await requireWorkspaceMember(workspaceId, userId);
  const { documentId, status, cursor, limit = 20 } = opts;

  const proposals = await db.changeProposal.findMany({
    where: {
      workspaceId,
      ...(documentId && { documentId }),
      ...(status && { status: status as "PENDING" | "ACCEPTED" | "REJECTED" | "COMMITTED" }),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      document: { select: { id: true, title: true } },
      votes: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      _count: { select: { votes: true } },
    },
  });

  let nextCursor: string | undefined;
  if (proposals.length > limit) {
    const next = proposals.pop();
    nextCursor = next?.id;
  }

  return { proposals, nextCursor };
}

export async function createProposal(
  workspaceId: string,
  userId: string,
  data: {
    documentId: string;
    patch: string;
    baseVersionId?: string;
    proposalType?: string;
  }
) {
  await requireWorkspaceMember(workspaceId, userId, ["OWNER", "EDITOR"]);

  const doc = await db.document.findFirst({
    where: { id: data.documentId, workspaceId },
  });
  if (!doc) throw new Error("Document not found");

  const proposal = await db.changeProposal.create({
    data: {
      documentId: data.documentId,
      workspaceId,
      authorId: userId,
      baseVersionId: data.baseVersionId,
      patch: data.patch,
      proposalType: data.proposalType ?? "content_update",
      status: "PENDING",
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      document: { select: { id: true, title: true } },
    },
  });

  await db.activityLog.create({
    data: {
      workspaceId,
      userId,
      action: "PROPOSAL_CREATED",
      entityType: "proposal",
      entityId: proposal.id,
      metadata: { documentId: data.documentId, documentTitle: doc.title },
    },
  });

  return proposal;
}

export async function voteOnProposal(
  proposalId: string,
  userId: string,
  decision: "APPROVE" | "REJECT"
) {
  const proposal = await db.changeProposal.findFirst({
    where: { id: proposalId },
    include: {
      votes: true,
      workspace: {
        include: {
          members: {
            where: { role: { in: ["OWNER", "EDITOR"] } },
          },
        },
      },
    },
  });

  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "PENDING") throw new Error("Proposal is no longer pending");

  await requireWorkspaceMember(proposal.workspaceId, userId, ["OWNER", "EDITOR"]);

  await db.proposalVote.upsert({
    where: { proposalId_userId: { proposalId, userId } },
    update: { decision },
    create: { proposalId, userId, decision },
  });

  const allVotes = await db.proposalVote.findMany({ where: { proposalId } });
  const eligibleVoters = proposal.workspace.members;
  const eligibleCount = eligibleVoters.length;
  const approvals = allVotes.filter((v: { decision: string }) => v.decision === "APPROVE").length;
  const rejections = allVotes.filter((v: { decision: string }) => v.decision === "REJECT").length;

  const voter = eligibleVoters.find((m: { userId: string; role: string }) => m.userId === userId);
  const isOwnerVoting = voter?.role === "OWNER";

  let newStatus: "PENDING" | "ACCEPTED" | "REJECTED" | "COMMITTED" = "PENDING";

  if (decision === "APPROVE" && isOwnerVoting) {
    newStatus = "COMMITTED";
  } else if (eligibleCount > 0 && approvals / eligibleCount > 0.5) {
    newStatus = "COMMITTED";
  } else if (eligibleCount > 0 && rejections / eligibleCount > 0.5) {
    newStatus = "REJECTED";
  }

  if (newStatus !== "PENDING") {
    await commitOrRejectProposal(proposalId, proposal.workspaceId, userId, newStatus);
  }

  return { proposalId, newStatus, approvals, rejections, eligibleCount };
}

async function commitOrRejectProposal(
  proposalId: string,
  workspaceId: string,
  userId: string,
  status: "COMMITTED" | "REJECTED"
) {
  const proposal = await db.changeProposal.findUnique({
    where: { id: proposalId },
    include: { document: true },
  });
  if (!proposal) return;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.changeProposal.update({
      where: { id: proposalId },
      data: { status, committedAt: status === "COMMITTED" ? new Date() : undefined },
    });

    if (status === "COMMITTED") {
      const lastVersion = await tx.documentVersion.findFirst({
        where: { documentId: proposal.documentId },
        orderBy: { versionNumber: "desc" },
      });

      const newVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;
      const patch = JSON.parse(proposal.patch);
      const base = lastVersion?.contentSnapshot ?? proposal.document.contentSnapshot;

      let newContent = base;
      if (patch.content !== undefined) {
        newContent = patch.content;
      }

      const version = await tx.documentVersion.create({
        data: {
          documentId: proposal.documentId,
          versionNumber: newVersionNumber,
          contentSnapshot: newContent,
          patch: proposal.patch,
          createdById: userId,
        },
      });

      await tx.document.update({
        where: { id: proposal.documentId },
        data: {
          contentSnapshot: newContent,
          currentVersionId: version.id,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: "PROPOSAL_COMMITTED",
          entityType: "proposal",
          entityId: proposalId,
          metadata: { documentId: proposal.documentId, versionNumber: newVersionNumber },
        },
      });
    } else {
      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: "PROPOSAL_REJECTED",
          entityType: "proposal",
          entityId: proposalId,
        },
      });
    }
  });
}
