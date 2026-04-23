import "server-only";
import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
import type { CanvasOp, BoardState, CanvasNode, CanvasEdge, ConflictInfo } from "@/lib/types/canvas";
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

/**
 * Bulk-persists the full in-memory canvas state for a board.
 * Called by the CanvasStateManager every 30 seconds for dirty boards.
 * Uses upserts for nodes/edges and deletes for removed entities.
 */
export async function persistBoardState(
  boardId: string,
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  deletedNodeIds: string[],
  deletedEdgeIds: string[]
): Promise<void> {
  const nodeList = Object.values(nodes);
  const edgeList = Object.values(edges);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Delete removed edges first (edges reference nodes via FK)
    if (deletedEdgeIds.length > 0) {
      await tx.boardEdge.deleteMany({ where: { id: { in: deletedEdgeIds }, boardId } });
    }

    // Delete removed nodes (cascades edges in DB, but we've already deleted above)
    if (deletedNodeIds.length > 0) {
      await tx.boardNode.deleteMany({ where: { id: { in: deletedNodeIds }, boardId } });
    }

    // Upsert all current nodes
    for (const node of nodeList) {
      const nodeWithMeta = node as CanvasNode & { lastModifiedById?: string; lastModifiedByName?: string };
      await tx.boardNode.upsert({
        where: { id: node.id },
        create: {
          id: node.id,
          boardId,
          type: node.type,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          content: node.content as Prisma.InputJsonValue,
          updatedAt: new Date(node.updatedAt),
          lastModifiedById: nodeWithMeta.lastModifiedById ?? null,
          lastModifiedByName: nodeWithMeta.lastModifiedByName ?? null,
        },
        update: {
          type: node.type,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          content: node.content as Prisma.InputJsonValue,
          updatedAt: new Date(node.updatedAt),
          lastModifiedById: nodeWithMeta.lastModifiedById ?? null,
          lastModifiedByName: nodeWithMeta.lastModifiedByName ?? null,
        },
      });
    }

    // Upsert all current edges
    for (const edge of edgeList) {
      await tx.boardEdge.upsert({
        where: {
          boardId_sourceId_targetId: {
            boardId,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
          },
        },
        create: {
          id: edge.id,
          boardId,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          label: edge.label ?? null,
        },
        update: {
          label: edge.label ?? null,
        },
      });
    }

    // Touch board.updatedAt so consumers know when it was last written
    await tx.board.update({
      where: { id: boardId },
      data: { updatedAt: new Date() },
    });
  });
}

export interface ApplyOpResult {
  applied: boolean;
  conflict?: ConflictInfo;
}

/**
 * Applies a canvas operation to the database using Last-Write-Wins (LWW) conflict resolution.
 *
 * For mutating ops (MOVE_NODE, UPDATE_NODE), if the target node was last modified by a
 * *different* user more recently than when this op was created, the op is rejected and
 * ConflictInfo is returned describing both parties.
 */
export async function applyBoardOp(
  boardId: string,
  workspaceId: string,
  userId: string,
  userName: string,
  op: CanvasOp,
  opCreatedAt: string
): Promise<ApplyOpResult> {
  await requireWorkspaceMember(workspaceId, userId, ["OWNER", "EDITOR"]);

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const now = new Date();
    const clientTime = new Date(opCreatedAt);

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
            lastModifiedById: userId,
            lastModifiedByName: userName,
          },
        });
        return { applied: true };
      }

      case "MOVE_NODE": {
        const existing = await tx.boardNode.findUnique({
          where: { id: op.payload.id },
          select: { updatedAt: true, lastModifiedById: true, lastModifiedByName: true },
        });

        if (existing && existing.updatedAt > clientTime && existing.lastModifiedById && existing.lastModifiedById !== userId) {
          return {
            applied: false,
            conflict: {
              entityId: op.payload.id,
              entityType: "node" as const,
              winnerUserId: existing.lastModifiedById,
              winnerName: existing.lastModifiedByName ?? "Unknown",
              loserUserId: userId,
              loserName: userName,
            },
          };
        }

        await tx.boardNode.updateMany({
          where: { id: op.payload.id, boardId },
          data: {
            x: op.payload.x,
            y: op.payload.y,
            updatedAt: now,
            lastModifiedById: userId,
            lastModifiedByName: userName,
          },
        });
        return { applied: true };
      }

      case "UPDATE_NODE": {
        const { id, content, x, y, width, height } = op.payload;

        const existing = await tx.boardNode.findUnique({
          where: { id },
          select: { updatedAt: true, lastModifiedById: true, lastModifiedByName: true },
        });

        if (existing && existing.updatedAt > clientTime && existing.lastModifiedById && existing.lastModifiedById !== userId) {
          return {
            applied: false,
            conflict: {
              entityId: id,
              entityType: "node" as const,
              winnerUserId: existing.lastModifiedById,
              winnerName: existing.lastModifiedByName ?? "Unknown",
              loserUserId: userId,
              loserName: userName,
            },
          };
        }

        await tx.boardNode.updateMany({
          where: { id, boardId },
          data: {
            ...(content !== undefined && { content: content as Prisma.InputJsonValue }),
            ...(x !== undefined && { x }),
            ...(y !== undefined && { y }),
            ...(width !== undefined && { width }),
            ...(height !== undefined && { height }),
            updatedAt: now,
            lastModifiedById: userId,
            lastModifiedByName: userName,
          },
        });
        return { applied: true };
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
        return { applied: true };
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
        return { applied: true };
      }

      case "DELETE_EDGE": {
        await tx.boardEdge.deleteMany({
          where: { id: op.payload.id, boardId },
        });
        return { applied: true };
      }

      default:
        return { applied: true };
    }
  });
}
