import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireWorkspaceMember } from "./workspace";
import { applyBoardOp } from "./board";
import type { CanvasOp } from "@/lib/types/canvas";

export async function getWorkspaceProposals(
  workspaceId: string,
  userId: string,
  opts: {
    boardId?: string;
    status?: string;
    cursor?: string;
    limit?: number;
  } = {}
) {
  await requireWorkspaceMember(workspaceId, userId);
  const { boardId, status, cursor, limit = 20 } = opts;

  const proposals = await db.changeProposal.findMany({
    where: {
      workspaceId,
      ...(boardId && { boardId }),
      ...(status && { status: status as "PENDING" | "ACCEPTED" | "REJECTED" | "COMMITTED" }),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      board: { select: { id: true, title: true } },
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
  const proposal = await db.changeProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.changeProposal.update({
      where: { id: proposalId },
      data: { status, committedAt: status === "COMMITTED" ? new Date() : undefined },
    });

    const action =
      status === "COMMITTED" ? ("PROPOSAL_COMMITTED" as const) : ("PROPOSAL_REJECTED" as const);

    await tx.activityLog.create({
      data: {
        workspaceId,
        userId,
        action,
        entityType: "proposal",
        entityId: proposalId,
      },
    });
  });

  // If committed and it's a canvas op, apply it to the board
  if (status === "COMMITTED" && proposal.boardId && proposal.operationType) {
    try {
      const op = JSON.parse(proposal.patch) as CanvasOp;
      await applyBoardOp(proposal.boardId, workspaceId, userId, op);
    } catch {
      // If apply fails post-commit, log but don't throw
      console.error("[proposal commit] Failed to apply canvas op", proposalId);
    }
  }
}
