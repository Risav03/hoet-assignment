import "server-only";
import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
import type { CanvasOp, BoardState, CanvasNode, CanvasEdge } from "@/lib/types/canvas";
import type { Prisma } from "@/app/generated/prisma/client";

export async function getBoardsByWorkspace(workspaceId: string, userId: string) {
  await requireWorkspaceMember(workspaceId, userId);
  return db.board.findMany({
    where: { workspaceId, isArchived: false },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBoardById(boardId: string, userId: string) {
  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) return null;
  await requireWorkspaceMember(board.workspaceId, userId);
  return board;
}

export async function getBoardWithState(boardId: string, userId: string) {
  const board = await db.board.findUnique({
    where: { id: boardId },
    include: {
      BoardNode: true,
      BoardEdge: true,
    },
  });
  if (!board) return null;
  await requireWorkspaceMember(board.workspaceId, userId);

  const nodes: Record<string, CanvasNode> = {};
  for (const n of board.BoardNode) {
    nodes[n.id] = {
      id: n.id,
      boardId: n.boardId,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      content: n.content as CanvasNode["content"],
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
  }

  const edges: Record<string, CanvasEdge> = {};
  for (const e of board.BoardEdge) {
    edges[e.id] = {
      id: e.id,
      boardId: e.boardId,
      sourceId: e.sourceId,
      targetId: e.targetId,
      label: e.label ?? undefined,
      createdAt: e.createdAt.toISOString(),
    };
  }

  return {
    id: board.id,
    workspaceId: board.workspaceId,
    title: board.title,
    isArchived: board.isArchived,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    state: { nodes, edges } satisfies BoardState,
  };
}

export async function createBoard(
  workspaceId: string,
  userId: string,
  title: string
) {
  await requireWorkspaceMember(workspaceId, userId, ["OWNER", "EDITOR"]);
  return db.board.create({
    data: { workspaceId, title, createdById: userId },
  });
}

export async function updateBoard(
  boardId: string,
  userId: string,
  data: { title?: string; isArchived?: boolean }
) {
  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) throw new Error("Board not found");
  await requireWorkspaceMember(board.workspaceId, userId, ["OWNER", "EDITOR"]);
  return db.board.update({ where: { id: boardId }, data });
}

export async function applyBoardOp(
  boardId: string,
  workspaceId: string,
  userId: string,
  op: CanvasOp
): Promise<string> {
  await requireWorkspaceMember(workspaceId, userId, ["OWNER", "EDITOR"]);

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const now = new Date();

    switch (op.type) {
      case "CREATE_NODE": {
        await tx.boardNode.upsert({
          where: { id: op.payload.id },
          update: {},
          create: {
            id: op.payload.id,
            boardId,
            type: op.payload.type,
            x: op.payload.x,
            y: op.payload.y,
            width: op.payload.width,
            height: op.payload.height,
            content: op.payload.content as Prisma.InputJsonValue,
            updatedAt: now,
          },
        });
        break;
      }
      case "MOVE_NODE": {
        await tx.boardNode.updateMany({
          where: { id: op.payload.id, boardId },
          data: { x: op.payload.x, y: op.payload.y, updatedAt: now },
        });
        break;
      }
      case "UPDATE_NODE": {
        const { id, content, x, y, width, height } = op.payload;
        await tx.boardNode.updateMany({
          where: { id, boardId },
          data: {
            ...(content !== undefined && { content: content as Prisma.InputJsonValue }),
            ...(x !== undefined && { x }),
            ...(y !== undefined && { y }),
            ...(width !== undefined && { width }),
            ...(height !== undefined && { height }),
            updatedAt: now,
          },
        });
        break;
      }
      case "DELETE_NODE": {
        await tx.boardEdge.deleteMany({
          where: {
            boardId,
            OR: [
              { sourceId: op.payload.id },
              { targetId: op.payload.id },
            ],
          },
        });
        await tx.boardNode.deleteMany({
          where: { id: op.payload.id, boardId },
        });
        break;
      }
      case "CONNECT_NODES": {
        await tx.boardEdge.upsert({
          where: {
            boardId_sourceId_targetId: {
              boardId,
              sourceId: op.payload.sourceId,
              targetId: op.payload.targetId,
            },
          },
          update: { label: op.payload.label ?? null },
          create: {
            id: op.payload.id,
            boardId,
            sourceId: op.payload.sourceId,
            targetId: op.payload.targetId,
            label: op.payload.label ?? null,
          },
        });
        break;
      }
    }

    const proposal = await tx.changeProposal.create({
      data: {
        workspaceId,
        boardId,
        authorId: userId,
        patch: JSON.stringify(op),
        operationType: op.type,
        proposalType: "canvas_op",
        status: "PENDING",
      },
    });

    return proposal.id;
  });
}

export async function getBoardProposals(
  boardId: string,
  userId: string,
  status?: "PENDING" | "COMMITTED" | "REJECTED"
) {
  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) throw new Error("Board not found");
  await requireWorkspaceMember(board.workspaceId, userId);

  return db.changeProposal.findMany({
    where: { boardId, ...(status ? { status } : {}) },
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      votes: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
