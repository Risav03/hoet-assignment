import "server-only";
import type { CanvasNode, CanvasEdge, CanvasOp, ConflictInfo } from "@/lib/types/canvas";

export interface ApplyOpResult {
  applied: boolean;
  conflict?: ConflictInfo;
}

interface InMemoryBoardState {
  workspaceId: string;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  dirty: boolean;
  deletedNodeIds: Set<string>;
  deletedEdgeIds: Set<string>;
}

const PERSIST_INTERVAL_MS = 30_000;

class CanvasStateManager {
  private boards = new Map<string, InMemoryBoardState>();
  private persistTimer: ReturnType<typeof setInterval> | null = null;

  startPeriodicPersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setInterval(() => {
      void this.persistDirtyBoards();
    }, PERSIST_INTERVAL_MS);
  }

  /**
   * Returns board state if already in memory, without touching the DB.
   */
  getLoadedState(boardId: string): InMemoryBoardState | undefined {
    return this.boards.get(boardId);
  }

  /**
   * Returns board state from memory, loading from DB on first access.
   * Requires `loadBoardStateFromDB` to be provided externally to avoid
   * circular imports between this module and dal/board.
   */
  async getOrLoad(
    boardId: string,
    workspaceId: string,
    loadFromDB: () => Promise<{ nodes: Record<string, CanvasNode>; edges: Record<string, CanvasEdge> }>
  ): Promise<{ nodes: Record<string, CanvasNode>; edges: Record<string, CanvasEdge> }> {
    const existing = this.boards.get(boardId);
    if (existing) {
      return { nodes: existing.nodes, edges: existing.edges };
    }

    const { nodes, edges } = await loadFromDB();
    this.boards.set(boardId, {
      workspaceId,
      nodes,
      edges,
      dirty: false,
      deletedNodeIds: new Set(),
      deletedEdgeIds: new Set(),
    });
    return { nodes, edges };
  }

  /**
   * Applies a canvas op to the in-memory board state using Last-Write-Wins
   * conflict resolution against in-memory timestamps (no DB round-trip).
   */
  applyOp(
    boardId: string,
    workspaceId: string,
    userId: string,
    userName: string,
    op: CanvasOp,
    opCreatedAt: string
  ): ApplyOpResult {
    let state = this.boards.get(boardId);
    if (!state) {
      // Board not loaded yet — create an empty shell; GET route will fill it
      state = {
        workspaceId,
        nodes: {},
        edges: {},
        dirty: false,
        deletedNodeIds: new Set(),
        deletedEdgeIds: new Set(),
      };
      this.boards.set(boardId, state);
    }

    const clientTime = new Date(opCreatedAt);
    const now = new Date().toISOString();

    switch (op.type) {
      case "CREATE_NODE": {
        if (!state.nodes[op.payload.id]) {
          state.nodes[op.payload.id] = { ...op.payload };
          state.deletedNodeIds.delete(op.payload.id);
        }
        break;
      }

      case "MOVE_NODE": {
        const node = state.nodes[op.payload.id];
        if (!node) break;

        const conflict = this.checkConflict(node, clientTime, userId, userName, op.payload.id, "node");
        if (conflict) return { applied: false, conflict };

        node.x = op.payload.x;
        node.y = op.payload.y;
        node.updatedAt = now;
        (node as CanvasNode & { lastModifiedById?: string; lastModifiedByName?: string }).lastModifiedById = userId;
        (node as CanvasNode & { lastModifiedById?: string; lastModifiedByName?: string }).lastModifiedByName = userName;
        break;
      }

      case "UPDATE_NODE": {
        const node = state.nodes[op.payload.id];
        if (!node) break;

        const conflict = this.checkConflict(node, clientTime, userId, userName, op.payload.id, "node");
        if (conflict) return { applied: false, conflict };

        Object.assign(node, op.payload, { updatedAt: now });
        (node as CanvasNode & { lastModifiedById?: string; lastModifiedByName?: string }).lastModifiedById = userId;
        (node as CanvasNode & { lastModifiedById?: string; lastModifiedByName?: string }).lastModifiedByName = userName;
        break;
      }

      case "DELETE_NODE": {
        const node = state.nodes[op.payload.id];
        if (node) {
          delete state.nodes[op.payload.id];
          state.deletedNodeIds.add(op.payload.id);
          // Remove any edges connected to this node
          for (const [edgeId, edge] of Object.entries(state.edges)) {
            if (edge.sourceId === op.payload.id || edge.targetId === op.payload.id) {
              delete state.edges[edgeId];
              state.deletedEdgeIds.add(edgeId);
            }
          }
        }
        break;
      }

      case "CONNECT_NODES": {
        state.edges[op.payload.id] = { ...op.payload };
        state.deletedEdgeIds.delete(op.payload.id);
        break;
      }

      case "DELETE_EDGE": {
        if (state.edges[op.payload.id]) {
          delete state.edges[op.payload.id];
          state.deletedEdgeIds.add(op.payload.id);
        }
        break;
      }
    }

    state.dirty = true;
    return { applied: true };
  }

  /**
   * Primes the in-memory state for a board that was just loaded from DB.
   * No-op if board is already in memory (preserves live state).
   */
  primeFromDB(
    boardId: string,
    workspaceId: string,
    nodes: Record<string, CanvasNode>,
    edges: Record<string, CanvasEdge>
  ): void {
    if (!this.boards.has(boardId)) {
      this.boards.set(boardId, {
        workspaceId,
        nodes,
        edges,
        dirty: false,
        deletedNodeIds: new Set(),
        deletedEdgeIds: new Set(),
      });
    }
  }

  /**
   * Called by the periodic timer. Persists all dirty boards to DB.
   * Uses the injected persist function to avoid circular imports.
   */
  async persistDirtyBoards(
    persistFn?: (
      boardId: string,
      nodes: Record<string, CanvasNode>,
      edges: Record<string, CanvasEdge>,
      deletedNodeIds: string[],
      deletedEdgeIds: string[]
    ) => Promise<void>
  ): Promise<void> {
    if (!persistFn) {
      // Lazy-import to avoid circular dependency at module load time
      const { persistBoardState } = await import("@/lib/dal/board");
      persistFn = persistBoardState;
    }

    for (const [boardId, state] of this.boards.entries()) {
      if (!state.dirty) continue;
      try {
        await persistFn(
          boardId,
          state.nodes,
          state.edges,
          Array.from(state.deletedNodeIds),
          Array.from(state.deletedEdgeIds)
        );
        state.dirty = false;
        state.deletedNodeIds.clear();
        state.deletedEdgeIds.clear();
      } catch (err) {
        console.error(`[CanvasStateManager] Failed to persist board ${boardId}:`, err);
      }
    }
  }

  private checkConflict(
    node: CanvasNode,
    clientTime: Date,
    userId: string,
    userName: string,
    entityId: string,
    entityType: "node" | "edge"
  ): ConflictInfo | null {
    const nodeWithMeta = node as CanvasNode & { lastModifiedById?: string; lastModifiedByName?: string };
    const nodeUpdatedAt = new Date(node.updatedAt);

    if (
      nodeUpdatedAt > clientTime &&
      nodeWithMeta.lastModifiedById &&
      nodeWithMeta.lastModifiedById !== userId
    ) {
      return {
        entityId,
        entityType,
        winnerUserId: nodeWithMeta.lastModifiedById,
        winnerName: nodeWithMeta.lastModifiedByName ?? "Unknown",
        loserUserId: userId,
        loserName: userName,
      };
    }
    return null;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var canvasStateManager: CanvasStateManager | undefined;
}

export function getStateManager(): CanvasStateManager {
  if (!global.canvasStateManager) {
    global.canvasStateManager = new CanvasStateManager();
    global.canvasStateManager.startPeriodicPersist();
  }
  return global.canvasStateManager;
}
