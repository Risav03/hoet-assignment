import "server-only";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";
import type { CanvasOp, CanvasNode, CanvasEdge, ConflictInfo } from "@/lib/types/canvas";

export interface StoredNode extends CanvasNode {
  lastModifiedById?: string;
  lastModifiedByName?: string;
}

export interface RedisBoardState {
  nodes: Record<string, StoredNode>;
  edges: Record<string, CanvasEdge>;
}

export interface ApplyOpResult {
  applied: boolean;
  conflict?: ConflictInfo;
}

export function boardStateKey(boardId: string): string {
  return `board:${boardId}:state`;
}

/**
 * Load the full board state from DB and write it into Redis (cold-start seed).
 */
async function seedFromDb(boardId: string): Promise<RedisBoardState> {
  const board = await db.board.findUnique({
    where: { id: boardId },
    include: { BoardNode: true, BoardEdge: true },
  });

  const nodes: Record<string, StoredNode> = {};
  const edges: Record<string, CanvasEdge> = {};

  if (board) {
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
        lastModifiedById: n.lastModifiedById ?? undefined,
        lastModifiedByName: n.lastModifiedByName ?? undefined,
      };
    }
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
  }

  const state: RedisBoardState = { nodes, edges };
  await redis.set(boardStateKey(boardId), JSON.stringify(state));
  return state;
}

/**
 * Read board state from Redis. Falls back to DB on cache miss, seeding Redis for
 * subsequent requests (handles cold starts and Redis eviction).
 */
export async function getOrInitBoardState(boardId: string): Promise<RedisBoardState> {
  const data = await redis.get(boardStateKey(boardId));
  if (data) return JSON.parse(data) as RedisBoardState;
  return seedFromDb(boardId);
}

/**
 * Apply a canvas op to an in-memory state snapshot using Last-Write-Wins conflict
 * resolution. Pure — no I/O. Returns the new state and whether the op was applied.
 */
export function applyOpToState(
  state: RedisBoardState,
  op: CanvasOp,
  userId: string,
  userName: string,
  opCreatedAt: string
): { result: ApplyOpResult; nextState: RedisBoardState } {
  const now = new Date().toISOString();
  const clientTime = new Date(opCreatedAt);

  const nodes = { ...state.nodes };
  const edges = { ...state.edges };

  switch (op.type) {
    case "CREATE_NODE": {
      if (!nodes[op.payload.id]) {
        nodes[op.payload.id] = {
          ...op.payload,
          updatedAt: now,
          lastModifiedById: userId,
          lastModifiedByName: userName,
        };
      }
      return { result: { applied: true }, nextState: { nodes, edges } };
    }

    case "MOVE_NODE": {
      const existing = nodes[op.payload.id];
      if (
        existing &&
        new Date(existing.updatedAt) > clientTime &&
        existing.lastModifiedById &&
        existing.lastModifiedById !== userId
      ) {
        return {
          result: {
            applied: false,
            conflict: {
              entityId: op.payload.id,
              entityType: "node",
              winnerUserId: existing.lastModifiedById,
              winnerName: existing.lastModifiedByName ?? "Unknown",
              loserUserId: userId,
              loserName: userName,
            },
          },
          nextState: state,
        };
      }
      if (nodes[op.payload.id]) {
        nodes[op.payload.id] = {
          ...nodes[op.payload.id],
          x: op.payload.x,
          y: op.payload.y,
          updatedAt: now,
          lastModifiedById: userId,
          lastModifiedByName: userName,
        };
      }
      return { result: { applied: true }, nextState: { nodes, edges } };
    }

    case "UPDATE_NODE": {
      const { id, ...updates } = op.payload;
      const existing = nodes[id];
      if (
        existing &&
        new Date(existing.updatedAt) > clientTime &&
        existing.lastModifiedById &&
        existing.lastModifiedById !== userId
      ) {
        return {
          result: {
            applied: false,
            conflict: {
              entityId: id,
              entityType: "node",
              winnerUserId: existing.lastModifiedById,
              winnerName: existing.lastModifiedByName ?? "Unknown",
              loserUserId: userId,
              loserName: userName,
            },
          },
          nextState: state,
        };
      }
      if (nodes[id]) {
        nodes[id] = {
          ...nodes[id],
          ...updates,
          updatedAt: now,
          lastModifiedById: userId,
          lastModifiedByName: userName,
        };
      }
      return { result: { applied: true }, nextState: { nodes, edges } };
    }

    case "DELETE_NODE": {
      delete nodes[op.payload.id];
      for (const edgeId of Object.keys(edges)) {
        if (
          edges[edgeId].sourceId === op.payload.id ||
          edges[edgeId].targetId === op.payload.id
        ) {
          delete edges[edgeId];
        }
      }
      return { result: { applied: true }, nextState: { nodes, edges } };
    }

    case "CONNECT_NODES": {
      edges[op.payload.id] = { ...op.payload };
      return { result: { applied: true }, nextState: { nodes, edges } };
    }

    case "DELETE_EDGE": {
      delete edges[op.payload.id];
      return { result: { applied: true }, nextState: { nodes, edges } };
    }

    default:
      return { result: { applied: true }, nextState: state };
  }
}

/**
 * Write the updated board state to Redis and mark the board + workspace as dirty
 * so the cron flush picks them up.
 */
export async function saveBoardState(
  boardId: string,
  workspaceId: string,
  state: RedisBoardState
): Promise<void> {
  await redis.set(boardStateKey(boardId), JSON.stringify(state));
  await redis.sadd("dirty:boards", boardId);
  await redis.sadd("dirty:workspaces", workspaceId);
}
